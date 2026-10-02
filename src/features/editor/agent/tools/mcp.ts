/**
 * In-process MCP-compatible API for editor tools. `listMcpTools` and
 * `callMcpTool` are the stable tool boundary used by the agent and can be wrapped
 * by a host transport later. This module does not open a network or stdio server;
 * a transport must add authentication and preserve the editor's plan/confirm gate.
 */

import { getEditorTool, listEditorTools } from './registry'
import type { JsonSchema } from './types'

export interface McpToolDescriptor {
  name: string
  description: string
  inputSchema: JsonSchema
  annotations: {
    title: string
    readOnlyHint: boolean
    destructiveHint: boolean
  }
}

export interface McpCallResult {
  content: { type: 'text'; text: string }[]
  isError: boolean
  /** Structured payload mirrored from the tool result (MCP `structuredContent`). */
  structuredContent?: unknown
}

/** MCP `tools/list`. */
export function listMcpTools(): McpToolDescriptor[] {
  return listEditorTools().map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: {
      title: tool.title,
      readOnlyHint: tool.readOnly,
      destructiveHint: tool.destructive,
    },
  }))
}

/** MCP `tools/call`; mutations require an explicit editor approval from the caller. */
export async function callMcpTool(
  name: string,
  args: unknown,
  options: { confirmedByUser?: boolean } = {},
): Promise<McpCallResult> {
  const tool = getEditorTool(name)
  if (!tool) {
    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true }
  }

  const validation = tool.validate(args)
  if (!validation.ok) {
    return {
      content: [{ type: 'text', text: `Invalid arguments — ${validation.error}` }],
      isError: true,
    }
  }
  if (!tool.readOnly && !options.confirmedByUser) {
    return {
      content: [
        { type: 'text', text: 'This editor action requires user approval in the plan preview.' },
      ],
      isError: true,
    }
  }

  try {
    const result = await tool.execute(validation.value)
    return {
      content: [{ type: 'text', text: result.message }],
      isError: !result.ok,
      structuredContent: result.data,
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: error instanceof Error ? error.message : 'Tool failed.' }],
      isError: true,
    }
  }
}
