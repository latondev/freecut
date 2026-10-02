import { openDB, type DBSchema } from 'idb'

export type AudioGenProvider = 'elevenlabs' | 'minimax' | 'capcut'

export interface AudioGenVoice {
  id: string
  label: string
  description?: string
  previewUrl?: string
  language?: string
  gender?: string
  accent?: string
}

export type AudioGenVoiceCatalog = Record<AudioGenProvider, AudioGenVoice[]>

interface AudioGenVoiceCache extends DBSchema {
  catalogs: {
    key: string
    value: {
      fetchedAt: number
      catalogs: AudioGenVoiceCatalog
    }
  }
}

const DB_NAME = 'freecut-audio-gen'
const DB_VERSION = 2
const CACHE_KEY = 'genmax'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const GENMAX_API_URL = 'https://api.genmax.io'
const PAGE_SIZE = 100

const dbPromise = openDB<AudioGenVoiceCache>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('catalogs')) {
      db.createObjectStore('catalogs')
    }
  },
})

const emptyCatalog = (): AudioGenVoiceCatalog => ({
  elevenlabs: [],
  minimax: [],
  capcut: [],
})

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function normalizeVoice(value: Record<string, unknown>): AudioGenVoice | null {
  const id = stringValue(value.voice_id) ?? stringValue(value.id)
  const label = stringValue(value.name) ?? stringValue(value.voice_name) ?? id
  if (!id || !label) return null

  return {
    id,
    label,
    description: stringValue(value.description),
    previewUrl:
      stringValue(value.preview_url) ??
      stringValue(value.sample_audio_url) ??
      stringValue(value.sample_audio),
    language: stringValue(value.language) ?? stringValue(value.language_tag),
    gender: stringValue(value.gender),
    accent: stringValue(value.accent),
  }
}

function getVoiceArray(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== 'object') return []
  const value = payload as Record<string, unknown>
  const voices = value.voices ?? value.voice_list
  return Array.isArray(voices)
    ? voices.filter((voice): voice is Record<string, unknown> =>
        Boolean(voice && typeof voice === 'object'),
      )
    : []
}

async function requestJson(path: string, apiKey: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams(params)
  const response = await fetch(`${GENMAX_API_URL}${path}?${query}`, {
    headers: { 'xi-api-key': apiKey, Accept: 'application/json' },
  })
  if (!response.ok) {
    let detail = ''
    try {
      const errorPayload = (await response.json()) as { detail?: string; message?: string }
      detail = errorPayload.detail ?? errorPayload.message ?? ''
    } catch {
      // Keep the HTTP status when the provider does not return JSON.
    }
    throw new Error(`GenMax ${path} failed (${response.status})${detail ? `: ${detail}` : ''}`)
  }
  return response.json() as Promise<unknown>
}

async function loadPagedVoices(
  path: string,
  apiKey: string,
  pageKey: 'page' | 'offset',
  firstPage: number,
): Promise<AudioGenVoice[]> {
  const voices: AudioGenVoice[] = []
  let page = firstPage

  for (;;) {
    const payload = await requestJson(path, apiKey, {
      [pageKey]: String(page),
      page_size: String(PAGE_SIZE),
    })
    const pageVoices = getVoiceArray(payload)
    voices.push(
      ...pageVoices.map(normalizeVoice).filter((voice): voice is AudioGenVoice => Boolean(voice)),
    )

    const metadata = payload as Record<string, unknown>
    const hasMore = metadata.has_more === true || metadata.next_page !== undefined
    const total = typeof metadata.total === 'number' ? metadata.total : undefined
    if (pageVoices.length === 0 || (!hasMore && total === undefined)) break
    if (total !== undefined && voices.length >= total) break
    page += 1
  }

  return voices
}

function uniqueVoices(voices: AudioGenVoice[]): AudioGenVoice[] {
  return [...new Map(voices.map((voice) => [voice.id, voice])).values()]
}

export async function getCachedGenMaxVoiceCatalog(): Promise<AudioGenVoiceCatalog> {
  const cached = await (await dbPromise).get('catalogs', CACHE_KEY)
  return cached?.catalogs ?? emptyCatalog()
}

export async function loadGenMaxVoiceCatalog(
  apiKey: string,
  options: { forceRefresh?: boolean } = {},
): Promise<AudioGenVoiceCatalog> {
  const normalizedApiKey = apiKey.trim()
  if (!normalizedApiKey) throw new Error('Enter a GenMax API key.')

  const db = await dbPromise
  const cached = await db.get('catalogs', CACHE_KEY)
  if (!options.forceRefresh && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.catalogs
  }

  const [elevenLabsShared, elevenLabsDefault, minimaxSystem, minimaxCloned, capcut] =
    await Promise.all([
      loadPagedVoices('/v1/shared-voices', normalizedApiKey, 'page', 0),
      loadPagedVoices('/v1/default-voices', normalizedApiKey, 'page', 0),
      loadPagedVoices('/v1/minimax/system-voices', normalizedApiKey, 'page', 1),
      requestJson('/v1/minimax/voices', normalizedApiKey).then((payload) =>
        getVoiceArray(payload)
          .map(normalizeVoice)
          .filter((voice): voice is AudioGenVoice => Boolean(voice)),
      ),
      loadPagedVoices('/v1/capcut/system-voices', normalizedApiKey, 'page', 1),
    ])

  const catalogs: AudioGenVoiceCatalog = {
    elevenlabs: uniqueVoices([...elevenLabsShared, ...elevenLabsDefault]),
    minimax: uniqueVoices([...minimaxSystem, ...minimaxCloned]),
    capcut: uniqueVoices(capcut),
  }
  await db.put('catalogs', { fetchedAt: Date.now(), catalogs }, CACHE_KEY)
  return catalogs
}
