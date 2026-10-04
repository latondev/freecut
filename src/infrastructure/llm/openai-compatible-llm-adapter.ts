import type { LlmAdapter, LlmGenerateOptions, LlmLoadProgress, LlmMessage } from './types'

export interface LlmProviderSettings {
  baseUrl: string
  model: string
}

const STORAGE_KEY = 'freecut:ai-editor-settings'
const DEFAULT_SETTINGS: LlmProviderSettings = {
  baseUrl: '',
  model: '',
}

function loadSettings(): { settings: LlmProviderSettings; apiKey: string } {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as
      | (Partial<LlmProviderSettings> & { apiKey?: unknown })
      | null
    return {
      settings: {
        baseUrl: typeof parsed?.baseUrl === 'string' ? parsed.baseUrl : '',
        model: typeof parsed?.model === 'string' ? parsed.model : '',
      },
      apiKey: typeof parsed?.apiKey === 'string' ? parsed.apiKey : '',
    }
  } catch {
    return { settings: { ...DEFAULT_SETTINGS }, apiKey: '' }
  }
}

const storedSettings = loadSettings()
let settings = storedSettings.settings
let apiKey = storedSettings.apiKey

export function getLlmProviderSettings(): LlmProviderSettings {
  return { ...settings }
}

export function getLlmApiKey(): string {
  return apiKey
}

export function configureLlmProvider(next: LlmProviderSettings, nextApiKey = ''): void {
  settings = { ...next }
  apiKey = nextApiKey.trim()
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, apiKey }))
  } catch {
    // Keep the active settings for this session if browser storage is unavailable.
  }
}

function getBaseUrl(value: string): string {
  const url = new URL(value.trim())
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Base URL must use HTTP or HTTPS.')
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Base URL must not include credentials, query parameters, or a hash.')
  }
  const path = url.pathname.replace(/\/(chat\/completions|models)\/?$/i, '').replace(/\/$/, '')
  return `${url.origin}${path}`
}

function getHeaders(key = apiKey): HeadersInit {
  return {
    Accept: 'application/json',
    ...(key ? { Authorization: `Bearer ${key}` } : {}),
  }
}

function responseError(payload: unknown, status: number): Error {
  const error = (payload as { error?: { message?: unknown } } | null)?.error
  const message = typeof error?.message === 'string' ? error.message : `Request failed (${status}).`
  return new Error(message)
}

export async function fetchLlmModels(
  baseUrl: string,
  key = apiKey,
  signal?: AbortSignal,
): Promise<string[]> {
  const response = await fetch(`${getBaseUrl(baseUrl)}/models`, {
    headers: getHeaders(key),
    signal,
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) throw responseError(payload, response.status)
  const entries = (payload as { data?: unknown } | null)?.data
  if (!Array.isArray(entries)) throw new Error('The models endpoint returned an invalid response.')
  return entries
    .map((entry) => (entry as { id?: unknown } | null)?.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
}

class OpenAiCompatibleLlmAdapter implements LlmAdapter {
  readonly id = 'openai-compatible'
  readonly label = 'OpenAI-compatible API'

  isSupported(): boolean {
    if (!settings.baseUrl.trim() || !settings.model.trim()) return false
    try {
      getBaseUrl(settings.baseUrl)
      return true
    } catch {
      return false
    }
  }

  async load(_onProgress?: (progress: LlmLoadProgress) => void): Promise<void> {
    if (!this.isSupported()) throw new Error('Configure a valid base URL and model first.')
  }

  // fallow-ignore-next-line complexity
  async generate(messages: LlmMessage[], options: LlmGenerateOptions = {}): Promise<string> {
    if (!this.isSupported()) throw new Error('Configure a valid base URL and model first.')
    const response = await fetch(`${getBaseUrl(settings.baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.model,
        messages,
        temperature: options.temperature ?? 0,
        max_tokens: options.maxTokens ?? 768,
      }),
      signal: options.signal,
    })
    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok) throw responseError(payload, response.status)

    const content = (payload as { choices?: { message?: { content?: unknown } }[] } | null)
      ?.choices?.[0]?.message?.content
    const text =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content
              .map((part) => (part as { text?: unknown })?.text)
              .filter((part): part is string => typeof part === 'string')
              .join('')
          : ''
    if (!text) throw new Error('The model returned an empty response.')
    options.onToken?.(text, text)
    return text
  }

  dispose(): void {}
}

export const openAiCompatibleLlmAdapter: LlmAdapter = new OpenAiCompatibleLlmAdapter()
