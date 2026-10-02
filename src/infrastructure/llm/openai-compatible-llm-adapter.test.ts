import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  configureLlmProvider,
  fetchLlmModels,
  getLlmApiKey,
  openAiCompatibleLlmAdapter,
} from './openai-compatible-llm-adapter'

function jsonResponse(payload: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => payload,
  } as Response
}

beforeEach(() => {
  configureLlmProvider({
    baseUrl: 'http://localhost:1234/v1',
    model: 'test-model',
  })
})

afterEach(() => {
  configureLlmProvider({ baseUrl: '', model: '' })
  vi.unstubAllGlobals()
})

describe('OpenAI-compatible LLM adapter', () => {
  it('loads model ids from the configured models endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: 'model-a' }] }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchLlmModels('http://localhost:1234/v1/chat/completions')).resolves.toEqual([
      'model-a',
    ])
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:1234/v1/models')
  })

  it('sends chat messages to the configured model and reports the completion', async () => {
    configureLlmProvider(
      { baseUrl: 'http://localhost:1234/v1', model: 'test-model' },
      'test-secret',
    )
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'response' } }] }))
    vi.stubGlobal('fetch', fetchMock)
    const onToken = vi.fn()

    await expect(
      openAiCompatibleLlmAdapter.generate([{ role: 'user', content: 'hello' }], { onToken }),
    ).resolves.toBe('response')
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:1234/v1/chat/completions')
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe(
      'Bearer test-secret',
    )
    expect(getLlmApiKey()).toBe('test-secret')
    expect(JSON.parse(localStorage.getItem('freecut:ai-editor-settings') ?? '{}')).toMatchObject({
      baseUrl: 'http://localhost:1234/v1',
      model: 'test-model',
      apiKey: 'test-secret',
    })
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: 'test-model',
      messages: [{ role: 'user', content: 'hello' }],
    })
    expect(onToken).toHaveBeenCalledWith('response', 'response')
  })

  it('rejects non-HTTP endpoints as unsupported', () => {
    configureLlmProvider({
      baseUrl: 'file:///models',
      model: 'test-model',
    })
    expect(openAiCompatibleLlmAdapter.isSupported()).toBe(false)
  })
})
