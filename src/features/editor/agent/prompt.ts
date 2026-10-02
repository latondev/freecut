/**
 * Prompt construction and plan parsing for the editing agent.
 *
 * The agent uses a single-shot, structured-output strategy: given the tool
 * catalog (generated from the registry) and a grounded
 * timeline snapshot, it returns one JSON object with a short reply plus an
 * ordered list of tool calls. The agent service validates every call and retries
 * once before rejecting any plan that still contains invalid actions.
 */

import type { LlmMessage } from '@/infrastructure/llm'
import { buildToolCatalog } from './tools'

export interface RawPlanStep {
  tool: string
  args: Record<string, unknown>
}

export interface ParsedPlan {
  reply: string
  steps: RawPlanStep[]
}

export function buildSystemPrompt(): string {
  return `You are the FreeCut editing assistant, embedded in a browser-based video editor.
You help the user edit by choosing editing tools to run. You are given a snapshot
of the timeline, including a list of clips with short refs (c1, c2, …).

Respond with ONLY a single JSON object and nothing else:
{ "reply": "<one short sentence for the user>", "steps": [ { "tool": "<name>", "args": { ... } } ] }

Rules:
- Use ONLY the tools listed below, with the exact args shapes shown.
- Target clips by their ref (e.g. "clips": ["c2","c3"]) using the timeline list.
  Omit a target only when that specific tool says it uses the selection or a default; never assume it means all clips.
- Put steps in the order they should run.
- When the user gives absolute timeline start/end times for an image (e.g. image 1 from 0s to 30s), use "set_image_range" with those exact startSeconds/endSeconds. Never convert absolute end times into trim amounts.
- Use "trim_clip" only when the user explicitly asks to remove a duration from a clip's start or end. Use "split_range" to create segment boundaries; use "split" for a single split point.
- If the target clip or time meaning is ambiguous, ask one clarification and return "steps": []. Never guess a clip ref or whether a time is absolute vs a trim amount.
- If the user is only chatting or asking a question, return "steps": [] and answer in "reply".
- If the request is impossible with these tools, return "steps": [] and explain briefly in "reply".
- Keep "reply" under 20 words. Output the JSON only — no prose, no code fences.

Tools:
${buildToolCatalog()}

Examples:
User: cut the silences
{ "reply": "Opening the silence review.", "steps": [ { "tool": "remove_silence", "args": {} } ] }

User: delete the second clip and speed up the first one
{ "reply": "Deleting c2 and speeding up c1.", "steps": [ { "tool": "delete_clips", "args": { "clips": ["c2"] } }, { "tool": "set_speed", "args": { "clips": ["c1"], "speed": 2 } } ] }

User: place image 1 from 0 to 30 seconds and image 2 from 31 to 90 seconds
{ "reply": "Setting the image timeline ranges.", "steps": [ { "tool": "set_image_range", "args": { "clip": "c1", "startSeconds": 0, "endSeconds": 30 } }, { "tool": "set_image_range", "args": { "clip": "c2", "startSeconds": 31, "endSeconds": 90 } } ] }

User: add a title that says Welcome
{ "reply": "Adding the title.", "steps": [ { "tool": "add_title", "args": { "text": "Welcome" } } ] }

User: delete the part where I talk about pricing
(You don't know where that is — search first; you'll get the results back, then plan.)
{ "reply": "Finding where you mention pricing.", "steps": [ { "tool": "search_transcript", "args": { "query": "pricing" } } ] }

User: what can you do?
{ "reply": "I can cut silences/fillers, add titles, split a time range, delete, trim, change speed/volume, and add transitions.", "steps": [] }`
}

export function buildMessages(
  history: LlmMessage[],
  userText: string,
  contextText: string,
): LlmMessage[] {
  return [
    { role: 'system', content: buildSystemPrompt() },
    ...history,
    { role: 'user', content: `Timeline:\n${contextText}\n\nRequest: ${userText}` },
  ]
}

/** Extract the first balanced `{…}` JSON object from arbitrary model text. */
function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < raw.length; i++) {
    const char = raw[i]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '{') depth++
    else if (char === '}') {
      depth--
      if (depth === 0) return raw.slice(start, i + 1)
    }
  }
  return null
}

/**
 * Parse the model output into a plan. Tolerant of code fences and surrounding
 * prose. `valid` is false when no JSON object could be found at all, which the
 * service uses to trigger a corrective retry.
 */
export function parsePlan(raw: string): ParsedPlan & { valid: boolean } {
  const json = extractJsonObject(raw)
  if (!json) return { reply: raw.trim(), steps: [], valid: false }

  try {
    const parsed = JSON.parse(json) as unknown
    if (!parsed || typeof parsed !== 'object') {
      return { reply: raw.trim(), steps: [], valid: false }
    }
    const record = parsed as Record<string, unknown>
    const reply = typeof record.reply === 'string' ? record.reply.trim() : ''
    const rawSteps = Array.isArray(record.steps) ? record.steps : []
    const steps: RawPlanStep[] = []
    for (const entry of rawSteps) {
      if (!entry || typeof entry !== 'object') continue
      const step = entry as Record<string, unknown>
      if (typeof step.tool !== 'string') continue
      const args =
        step.args && typeof step.args === 'object' ? (step.args as Record<string, unknown>) : {}
      steps.push({ tool: step.tool, args })
    }
    return { reply, steps, valid: true }
  } catch {
    return { reply: raw.trim(), steps: [], valid: false }
  }
}
