import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureLlmProvider } from '@/infrastructure/llm'
import { planRequest } from './agent-service'

function completion(content: string): Response {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as Response
}

beforeEach(() => {
  configureLlmProvider({ baseUrl: 'http://localhost:1234/v1', model: 'test-model' })
})

afterEach(() => {
  configureLlmProvider({ baseUrl: '', model: '' })
  vi.unstubAllGlobals()
})

describe('agent plan safety', () => {
  it('rejects the entire plan when any tool remains invalid after correction', async () => {
    const invalidPlan = JSON.stringify({
      reply: 'Moving the playhead.',
      steps: [
        { tool: 'seek_to', args: { seconds: 5 } },
        { tool: 'made_up_tool', args: {} },
      ],
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(completion(invalidPlan))
      .mockResolvedValueOnce(completion(invalidPlan))
    vi.stubGlobal('fetch', fetchMock)

    const result = await planRequest('move to five seconds', { history: [] })

    expect(result.steps).toEqual([])
    expect(result.dropped).toContain('made_up_tool')
    expect(result.reply).toContain('could not safely map every requested edit')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
