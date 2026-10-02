import { openDB, type DBSchema } from 'idb'
import { sanitizeAiOutputFileNameSegment } from '@/shared/utils/ai-output-filename'

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
const DB_VERSION = 3
const CACHE_KEY = 'genmax'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const PAGE_SIZE = 100

// Verified high quality default voice library from GenMax
export const DEFAULT_AUDIO_GEN_VOICES: AudioGenVoiceCatalog = {
  minimax: [
    {
      id: '362703657091264',
      label: 'Professional Guide — Clear, Informative',
      description: 'Corporate Promotion & Narration. Clear, measured Vietnamese male voice.',
      previewUrl:
        'https://cdn.hailuoai.video/moss/prod/2026-02-22-16/moss-audio/user_audio/1771747483272680073-369436790456569_2026-02-22_.mp3',
      language: 'Vietnamese',
      gender: 'Male',
    },
    {
      id: '273554146070723',
      label: 'Serene Man — Solemn, Cinematic, Captivating',
      description: 'Audiobooks & Novels, Documentary. Warm, cinematic Vietnamese male voice.',
      previewUrl:
        'https://cdn.hailuoai.video/open-hailuo-video-web/public_assets/29748991-1b83-428a-9062-b9a967e9b68a.mp3',
      language: 'Vietnamese',
      gender: 'Male',
    },
    {
      id: '362703657091265',
      label: 'Professional Narrator — Warm, Measured',
      description: 'Online Education, Documentary, Corporate. Warm and balanced delivery.',
      previewUrl:
        'https://cdn.hailuoai.video/open-hailuo-video-web/public_assets/dc8888e4-6091-429b-8111-8f7f1bfa4c9f.mp3',
      language: 'Vietnamese',
      gender: 'Male',
    },
    {
      id: '262184394641601',
      label: 'Confident Woman — Professional, Inviting, Polished',
      description: 'Audio Drama, Audiobooks & Novels, Podcasts & Social. Polished female voice.',
      previewUrl: 'https://file.cdn.minimax.io/public/e4f5a81d-5d4f-41f0-b68d-27167b815246.mp3',
      language: 'Vietnamese',
      gender: 'Female',
    },
    {
      id: '262184394641600',
      label: 'Friendly Man — Persuasive, Dynamic, High-Energy',
      description: 'Games & RPG, Commercials & Trailers, Podcasts & Social.',
      previewUrl:
        'https://cdn.hailuoai.video/open-hailuo-video-web/public_assets/883dfc14-6eaa-49d1-883f-8bead1dae05e.mp3',
      language: 'Vietnamese',
      gender: 'Male',
    },
    {
      id: '226905123659934',
      label: 'Kind-hearted Girl — Compassionate, Heartwarming',
      description: 'Audiobooks & Novels, E-Learning, Podcasts & Social. Gentle young female.',
      previewUrl:
        'https://cdn.hailuoai.video/moss/prod/2026-02-22-17/moss-audio/user_audio/1771751178982496472-369452270174418_2026-02-22_.mp3',
      language: 'Vietnamese',
      gender: 'Female',
    },
    {
      id: '362703657091266',
      label: 'Articulate Assistant — Bright, Crisp, Precise',
      description: 'Online Education, Corporate Promotion. Bright and clear young female voice.',
      previewUrl: 'https://file.cdn.minimax.io/public/f69eae01-485c-4f11-820c-9c1ee877c668.mp3',
      language: 'Vietnamese',
      gender: 'Female',
    },
    {
      id: '380426458095854',
      label: 'Deep Storyteller — Magnetic, Smooth, Sophisticated',
      description: 'Documentary, Audiobooks & Novels. Resonant male voice with natural warmth.',
      previewUrl:
        'https://cdn.hailuoai.video/open-hailuo-video-web/public_assets/29748991-1b83-428a-9062-b9a967e9b68a.mp3',
      language: 'English',
      gender: 'Male',
    },
    {
      id: '226905123659939',
      label: 'Calm Woman — Sophisticated, Serene, Captivating',
      description: 'Audiobooks, Documentaries, Museum Tours. Smooth and peaceful delivery.',
      previewUrl:
        'https://cdn.hailuoai.video/moss/prod/2026-02-24-10/moss-audio/user_audio/1771901848260058013-370069215523062_2026-02-24_.mp3',
      language: 'English',
      gender: 'Female',
    },
    {
      id: '369788429140175',
      label: 'Energetic Speaker — Bright, Lucid, Brisk',
      description: 'High-energy commercials, social media, youth-oriented promotions.',
      previewUrl:
        'https://cdn.hailuoai.video/open-hailuo-video-web/public_assets/dc8888e4-6091-429b-8111-8f7f1bfa4c9f.mp3',
      language: 'English',
      gender: 'Female',
    },
  ],
  elevenlabs: [
    {
      id: 'hpp4J3VqNfWAUOO0d1Us',
      label: 'Bella — Professional, Bright, Warm',
      description:
        'ElevenLabs Default. Versatile female voice suitable for commercials and narration.',
      previewUrl:
        'https://storage.googleapis.com/eleven-public-prod/premade/voices/hpp4J3VqNfWAUOO0d1Us/dab0f5ba-3aa4-48a8-9fad-f138fea1126d.mp3',
      gender: 'female',
      accent: 'american',
    },
    {
      id: 'CwhRBWXzGAHq8TQ4Fs17',
      label: 'Roger — Laid-Back, Casual, Resonant',
      description: 'ElevenLabs Default. Deep, resonant male voice with casual delivery.',
      previewUrl:
        'https://storage.googleapis.com/eleven-public-prod/premade/voices/CwhRBWXzGAHq8TQ4Fs17/58ee3ff5-f6f2-4628-93b8-e38eb31806b0.mp3',
      gender: 'male',
      accent: 'american',
    },
    {
      id: 'EXAVITQu4vr4xnSDxMaL',
      label: 'Sarah — Mature, Reassuring, Confident',
      description: 'ElevenLabs Default. Reassuring female voice.',
      previewUrl:
        'https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2216a32186.mp3',
      gender: 'female',
      accent: 'american',
    },
    {
      id: 'FGY2WhTYpPnrIDTdsKH5',
      label: 'Laura — Upbeat, Enthusiastic, Quirky',
      description: 'ElevenLabs Default. Youthful, energetic female.',
      previewUrl:
        'https://storage.googleapis.com/eleven-public-prod/premade/voices/FGY2WhTYpPnrIDTdsKH5/67d4bf86-13a8-4447-9759-e9aa4a6642d2.mp3',
      gender: 'female',
      accent: 'american',
    },
    {
      id: 'IKne3meq5aSn9XLyUdCD',
      label: 'Charlie — Natural, Casual, Conversational',
      description: 'ElevenLabs Default. Relatable male narrator.',
      previewUrl:
        'https://storage.googleapis.com/eleven-public-prod/premade/voices/IKne3meq5aSn9XLyUdCD/102de6f2-22ed-41a0-979f-abb443682c2d.mp3',
      gender: 'male',
      accent: 'australian',
    },
    {
      id: 'JBFqnCBsd6RMkjVDRZzb',
      label: 'George — Warm, Engaging Storyteller',
      description: 'ElevenLabs Default. Captivating British male storyteller.',
      previewUrl:
        'https://storage.googleapis.com/eleven-public-prod/premade/voices/JBFqnCBsd6RMkjVDRZzb/e6206d1a-0721-4787-ac26-2041270c53f8.mp3',
      gender: 'male',
      accent: 'british',
    },
    {
      id: 'N2lVS1w4EtoT3dr4eOWO',
      label: 'Callum — Intense, Dramatic, Video Games',
      description: 'ElevenLabs Default. Gritty and dramatic male character voice.',
      previewUrl:
        'https://storage.googleapis.com/eleven-public-prod/premade/voices/N2lVS1w4EtoT3dr4eOWO/ac83c8dc-599f-4375-8022-263309a47ef0.mp3',
      gender: 'male',
      accent: 'american',
    },
    {
      id: 'SAz9YHcvj6GT2YYXdXww',
      label: 'River — Confident, Friendly, Relaxed',
      description: 'ElevenLabs Default. Warm non-binary / conversational tone.',
      previewUrl:
        'https://storage.googleapis.com/eleven-public-prod/premade/voices/SAz9YHcvj6GT2YYXdXww/e62744cc-19ea-4fa2-939e-d30c5e3170e1.mp3',
      gender: 'neutral',
      accent: 'american',
    },
    {
      id: 'TX3LPaxmHKxFdv7VOQHJ',
      label: 'Liam — Energetic Social Media Creator',
      description: 'ElevenLabs Default. Crisp, clear, articulate male narrator.',
      previewUrl:
        'https://storage.googleapis.com/eleven-public-prod/premade/voices/TX3LPaxmHKxFdv7VOQHJ/63148076-6363-42db-aea8-31424308b92c.mp3',
      gender: 'male',
      accent: 'american',
    },
    {
      id: 'XB0fDUnXU5powFXDhCwa',
      label: 'Charlotte — Seductive, Smooth, Elegant',
      description: 'ElevenLabs Default. Smooth Swedish-accented English female.',
      previewUrl:
        'https://storage.googleapis.com/eleven-public-prod/premade/voices/XB0fDUnXU5powFXDhCwa/942356dc-f10d-4d83-9083-2b637423d513.mp3',
      gender: 'female',
      accent: 'swedish',
    },
    {
      id: 'Xb7hH8MSUJpSbSDYk0k2',
      label: 'Alice — Clear, Engaging Educator',
      description: 'ElevenLabs Default. British news anchor and educator.',
      previewUrl:
        'https://storage.googleapis.com/eleven-public-prod/premade/voices/Xb7hH8MSUJpSbSDYk0k2/d10f7534-11f6-41fe-a012-2de1e482d336.mp3',
      gender: 'female',
      accent: 'british',
    },
    {
      id: 'XrExE9yKIg1WjnnlVkGX',
      label: 'Matilda — Knowledgeable, Professional',
      description: 'ElevenLabs Default. Warm and authoritative female.',
      previewUrl:
        'https://storage.googleapis.com/eleven-public-prod/premade/voices/XrExE9yKIg1WjnnlVkGX/b930e18d-6b4d-466e-bab2-0ae97c6d8535.mp3',
      gender: 'female',
      accent: 'american',
    },
  ],
  capcut: [
    {
      id: '7102355709945188865',
      label: 'Cute Female (Cô Gái Dễ Thương)',
      description: 'CapCut Vietnamese popular female voice.',
      previewUrl: 'https://api.genmax.io/v1/capcut/voices/7102355709945188865/preview',
      language: 'vi',
      gender: 'female',
    },
    {
      id: '7252594014782755330',
      label: 'Sweet Little Girl (Bé Gái Ngọt Ngào)',
      description: 'CapCut Vietnamese sweet young girl voice.',
      previewUrl: 'https://api.genmax.io/v1/capcut/voices/7252594014782755330/preview',
      language: 'vi',
      gender: 'female',
    },
    {
      id: '7264854897953083905',
      label: 'Giọng Nữ Phổ Thông',
      description: 'CapCut Vietnamese standard female narrator.',
      previewUrl: 'https://api.genmax.io/v1/capcut/voices/7264854897953083905/preview',
      language: 'vi',
      gender: 'female',
    },
    {
      id: '7102355803792740865',
      label: 'Confident Male (Nam Tự Tin)',
      description: 'CapCut Vietnamese energetic male voice.',
      previewUrl: 'https://api.genmax.io/v1/capcut/voices/7102355803792740865/preview',
      language: 'vi',
      gender: 'male',
    },
    {
      id: '7483736254694035984',
      label: 'Chí Mai',
      description: 'CapCut Vietnamese expressive narrator.',
      previewUrl: 'https://api.genmax.io/v1/capcut/voices/7483736254694035984/preview',
      language: 'vi',
      gender: 'female',
    },
  ],
}

const dbPromise = openDB<AudioGenVoiceCache>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('catalogs')) {
      db.createObjectStore('catalogs')
    }
  },
})

export const emptyCatalog = (): AudioGenVoiceCatalog => ({
  elevenlabs: [...DEFAULT_AUDIO_GEN_VOICES.elevenlabs],
  minimax: [...DEFAULT_AUDIO_GEN_VOICES.minimax],
  capcut: [...DEFAULT_AUDIO_GEN_VOICES.capcut],
})

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function normalizeVoice(value: Record<string, unknown>): AudioGenVoice | null {
  const id = stringValue(value.voice_id) ?? stringValue(value.id) ?? stringValue(value.public_id)
  const label = stringValue(value.name) ?? stringValue(value.voice_name) ?? id
  if (!id || !label) return null

  // Extract tags / labels
  const rawTags = (value.tag_list || value.tags || value.labels) as unknown
  const tagsList = Array.isArray(rawTags)
    ? rawTags.map((t) => String(t || '').trim()).filter(Boolean)
    : []

  const detectedLanguage =
    stringValue(value.language) ??
    stringValue(value.language_tag) ??
    tagsList.find((tag) =>
      ['vietnamese', 'tiếng việt', 'english', 'japanese', 'chinese', 'korean'].includes(
        tag.toLowerCase(),
      ),
    )

  const detectedGender =
    stringValue(value.gender) ??
    tagsList.find((tag) => ['male', 'female', 'neutral'].includes(tag.toLowerCase()))

  return {
    id,
    label,
    description: stringValue(value.description),
    previewUrl:
      stringValue(value.preview_url) ??
      stringValue(value.sample_audio_url) ??
      stringValue(value.sample_audio),
    language: detectedLanguage,
    gender: detectedGender,
    accent: stringValue(value.accent),
  }
}

function getVoiceArray(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== 'object') return []
  const value = payload as Record<string, unknown>
  const dataObj = value.data as Record<string, unknown> | undefined
  const voices = value.voices ?? value.voice_list ?? dataObj?.voices
  return Array.isArray(voices)
    ? voices.filter((voice): voice is Record<string, unknown> =>
        Boolean(voice && typeof voice === 'object'),
      )
    : []
}

/**
 * Robust API requester with proxy fallback to eliminate CORS errors in browser/Electron
 */
export async function requestGenMax(
  path: string,
  apiKey: string,
  options: {
    method?: string
    params?: Record<string, string>
    headers?: Record<string, string>
    body?: string | FormData
    signal?: AbortSignal
  } = {},
): Promise<Response> {
  const query = options.params ? `?${new URLSearchParams(options.params).toString()}` : ''
  const cleanPath = path.startsWith('/') ? path : `/${path}`

  const headers: Record<string, string> = {
    'xi-api-key': apiKey.trim(),
    Accept: 'application/json',
    ...(options.headers || {}),
  }

  // In browser/dev server, try the same-origin proxy first (/api/genmax)
  const candidateUrls: string[] = []
  if (typeof window !== 'undefined' && window.location.origin) {
    candidateUrls.push(`/api/genmax${cleanPath}${query}`)
  }
  candidateUrls.push(`https://api.genmax.io${cleanPath}${query}`)

  let lastError: Error | null = null

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body,
        signal: options.signal,
      })

      // If proxy returns 404, fall back to direct URL
      if (response.status === 404 && url.startsWith('/api/genmax')) {
        continue
      }

      if (!response.ok) {
        let detail = ''
        try {
          const errorPayload = (await response.json()) as Record<string, unknown>
          detail = String(errorPayload.detail ?? errorPayload.message ?? errorPayload.error ?? '')
        } catch {
          // Response body was not JSON
        }
        throw new Error(
          `GenMax request to ${cleanPath} failed (${response.status})${detail ? `: ${detail}` : ''}`,
        )
      }

      return response
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err
      }
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }

  throw lastError ?? new Error(`Could not connect to GenMax API for ${cleanPath}`)
}

async function loadPagedVoices(
  path: string,
  apiKey: string,
  pageKey: 'page' | 'offset',
  firstPage: number,
  maxPages: number = 6,
  params: Record<string, string> = {},
): Promise<AudioGenVoice[]> {
  const voices: AudioGenVoice[] = []
  let page = firstPage
  let fetchedPages = 0

  while (fetchedPages < maxPages) {
    const res = await requestGenMax(path, apiKey, {
      params: {
        ...params,
        [pageKey]: String(page),
        page_size: String(PAGE_SIZE),
      },
    })
    const payload = await res.json()
    const pageVoices = getVoiceArray(payload)
    if (pageVoices.length === 0) break

    voices.push(
      ...pageVoices.map(normalizeVoice).filter((voice): voice is AudioGenVoice => Boolean(voice)),
    )

    const metadata = payload as Record<string, unknown>
    const dataObj = metadata.data as Record<string, unknown> | undefined
    const hasMore =
      metadata.has_more === true || dataObj?.has_more === true || metadata.next_page !== undefined
    const total = typeof metadata.total === 'number' ? metadata.total : undefined

    if (!hasMore && total === undefined) break
    if (total !== undefined && voices.length >= total) break

    page += 1
    fetchedPages += 1
  }

  return voices
}

function uniqueVoices(voices: AudioGenVoice[]): AudioGenVoice[] {
  return [...new Map(voices.map((voice) => [voice.id, voice])).values()]
}

export async function getCachedGenMaxVoiceCatalog(): Promise<AudioGenVoiceCatalog> {
  try {
    const db = await dbPromise
    const cached = await db.get('catalogs', CACHE_KEY)
    if (cached?.catalogs) {
      return {
        elevenlabs:
          cached.catalogs.elevenlabs?.length > 0
            ? cached.catalogs.elevenlabs
            : DEFAULT_AUDIO_GEN_VOICES.elevenlabs,
        minimax:
          cached.catalogs.minimax?.length > 0
            ? cached.catalogs.minimax
            : DEFAULT_AUDIO_GEN_VOICES.minimax,
        capcut:
          cached.catalogs.capcut?.length > 0
            ? cached.catalogs.capcut
            : DEFAULT_AUDIO_GEN_VOICES.capcut,
      }
    }
  } catch {
    // Return defaults if IndexedDB reading fails
  }
  return emptyCatalog()
}

/**
 * Loads voice catalogs from GenMax API for ElevenLabs, MiniMax, and CapCut.
 * Uses Promise.allSettled and sensible limits to ensure fast, reliable loading.
 */
export async function loadGenMaxVoiceCatalog(
  apiKey: string,
  options: {
    forceRefresh?: boolean
    onProgress?: (stage: string) => void
  } = {},
): Promise<AudioGenVoiceCatalog> {
  const normalizedApiKey = apiKey.trim()
  if (!normalizedApiKey) throw new Error('Enter a GenMax API key (xi-api-key).')

  const db = await dbPromise
  const cached = await db.get('catalogs', CACHE_KEY)
  if (!options.forceRefresh && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.catalogs
  }

  options.onProgress?.('Fetching voice catalogs from GenMax...')

  // 1. ElevenLabs: Default voices (21) + top trending library voices (up to 300)
  const loadElevenLabs = async (): Promise<AudioGenVoice[]> => {
    options.onProgress?.('Loading ElevenLabs voices...')
    const defaultVoicesPromise = loadPagedVoices(
      '/v1/default-voices',
      normalizedApiKey,
      'page',
      0,
      1,
    )
    const sharedVoicesPromise = loadPagedVoices(
      '/v1/shared-voices',
      normalizedApiKey,
      'page',
      0,
      3,
      { sort: 'trending' },
    ).catch(() => [] as AudioGenVoice[])

    const [defaults, shared] = await Promise.all([defaultVoicesPromise, sharedVoicesPromise])
    return uniqueVoices([...defaults, ...shared, ...DEFAULT_AUDIO_GEN_VOICES.elevenlabs])
  }

  // 2. MiniMax: System voices (~600) + Cloned custom voices
  const loadMiniMax = async (): Promise<AudioGenVoice[]> => {
    options.onProgress?.('Loading MiniMax voices...')
    const systemVoicesPromise = loadPagedVoices(
      '/v1/minimax/system-voices',
      normalizedApiKey,
      'page',
      1,
      6,
    )
    const clonedVoicesPromise = requestGenMax('/v1/minimax/voices', normalizedApiKey)
      .then(async (res) => {
        const payload = await res.json()
        return getVoiceArray(payload)
          .map(normalizeVoice)
          .filter((v): v is AudioGenVoice => Boolean(v))
      })
      .catch(() => [] as AudioGenVoice[])

    const [system, cloned] = await Promise.all([systemVoicesPromise, clonedVoicesPromise])
    return uniqueVoices([...cloned, ...system, ...DEFAULT_AUDIO_GEN_VOICES.minimax])
  }

  // 3. CapCut: System voices (~492)
  const loadCapCut = async (): Promise<AudioGenVoice[]> => {
    options.onProgress?.('Loading CapCut voices...')
    const system = await loadPagedVoices('/v1/capcut/system-voices', normalizedApiKey, 'page', 1, 5)
    return uniqueVoices([...system, ...DEFAULT_AUDIO_GEN_VOICES.capcut])
  }

  const [elevenLabsResult, minimaxResult, capcutResult] = await Promise.allSettled([
    loadElevenLabs(),
    loadMiniMax(),
    loadCapCut(),
  ])

  const catalogs: AudioGenVoiceCatalog = {
    elevenlabs:
      elevenLabsResult.status === 'fulfilled' && elevenLabsResult.value.length > 0
        ? elevenLabsResult.value
        : (cached?.catalogs.elevenlabs ?? DEFAULT_AUDIO_GEN_VOICES.elevenlabs),
    minimax:
      minimaxResult.status === 'fulfilled' && minimaxResult.value.length > 0
        ? minimaxResult.value
        : (cached?.catalogs.minimax ?? DEFAULT_AUDIO_GEN_VOICES.minimax),
    capcut:
      capcutResult.status === 'fulfilled' && capcutResult.value.length > 0
        ? capcutResult.value
        : (cached?.catalogs.capcut ?? DEFAULT_AUDIO_GEN_VOICES.capcut),
  }

  // Check if all failed
  if (
    elevenLabsResult.status === 'rejected' &&
    minimaxResult.status === 'rejected' &&
    capcutResult.status === 'rejected'
  ) {
    const errorMsg =
      (minimaxResult.reason instanceof Error ? minimaxResult.reason.message : '') ||
      (elevenLabsResult.reason instanceof Error ? elevenLabsResult.reason.message : '') ||
      'Failed to load voice catalogs from GenMax.'
    throw new Error(errorMsg)
  }

  await db.put('catalogs', { fetchedAt: Date.now(), catalogs }, CACHE_KEY)
  options.onProgress?.('Catalogs loaded successfully!')
  return catalogs
}

/**
 * Calculates duration in seconds for an audio blob in browser.
 */
function getAudioBlobDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    try {
      const audio = document.createElement('audio')
      const url = URL.createObjectURL(blob)
      audio.preload = 'metadata'
      audio.src = url

      const cleanup = () => {
        URL.revokeObjectURL(url)
        audio.remove()
      }

      audio.onloadedmetadata = () => {
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0
        cleanup()
        resolve(duration)
      }

      audio.onerror = () => {
        cleanup()
        resolve(0)
      }

      // Safety timeout after 5 seconds
      setTimeout(() => {
        cleanup()
        resolve(0)
      }, 5000)
    } catch {
      resolve(0)
    }
  })
}

export interface GenerateGenMaxSpeechOptions {
  apiKey: string
  provider: AudioGenProvider
  voiceId: string
  voiceName?: string
  text: string
  speed?: number
  languageCode?: string
  modelId?: string
  onProgress?: (stage: string) => void
  signal?: AbortSignal
}

/**
 * Generates an audio speech file via GenMax API (ElevenLabs, MiniMax, or CapCut).
 * Implements task creation and polling loop compliant with genmax.io.
 */
export async function generateGenMaxSpeechFile(
  options: GenerateGenMaxSpeechOptions,
): Promise<{ blob: Blob; file: File; duration: number }> {
  const trimmedText = options.text.trim()
  if (!trimmedText) {
    throw new Error('Please enter text to generate speech.')
  }

  const apiKey = options.apiKey.trim()
  if (!apiKey) {
    throw new Error('GenMax API key is required. Please enter your key in the Audio Gen section.')
  }

  const provider = options.provider.toLowerCase() as AudioGenProvider
  const voiceId = options.voiceId.trim()
  if (!voiceId) {
    throw new Error('Please select a voice.')
  }

  // Determine language code
  let languageCode = options.languageCode
  if (!languageCode) {
    if (provider === 'minimax') {
      languageCode = 'Vietnamese'
    } else if (provider === 'capcut') {
      languageCode = 'vi'
    } else {
      // For ElevenLabs, use Vietnamese 'vi' if text contains Vietnamese accents, else 'en'
      const hasVietnamese =
        /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(trimmedText)
      languageCode = hasVietnamese ? 'vi' : 'en'
    }
  }

  // Determine model ID
  let modelId = options.modelId
  if (!modelId) {
    if (provider === 'minimax') {
      modelId = 'speech-2.8-hd'
    } else if (provider === 'capcut') {
      modelId = 'capcut'
    } else {
      modelId = 'eleven_multilingual_v2'
    }
  }

  const payload = {
    text: trimmedText,
    provider,
    language_code: languageCode,
    model_id: modelId,
    voice_settings: {
      speed: options.speed ?? 1.0,
    },
  }

  options.onProgress?.(`Submitting task to GenMax (${provider.toUpperCase()})...`)

  const response = await requestGenMax(`/v1/text-to-speech/${voiceId}`, apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: options.signal,
  })

  // Direct audio/mpeg response
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('audio/')) {
    options.onProgress?.('Receiving audio stream...')
    const blob = await response.blob()
    const duration = await getAudioBlobDuration(blob)
    const file = new File(
      [blob],
      `genmax-${provider}-${sanitizeAiOutputFileNameSegment(trimmedText.slice(0, 30), 'audio')}.mp3`,
      { type: 'audio/mpeg', lastModified: Date.now() },
    )
    return { blob, file, duration }
  }

  const taskData = (await response.json()) as Record<string, unknown>
  const taskId = String(taskData.id || '')
  if (!taskId) {
    throw new Error('GenMax did not return a valid Task ID.')
  }

  // Polling loop
  const maxWaitMs = 5 * 60 * 1000 // 5 minutes
  const startTime = Date.now()
  let audioUrl = ''

  while (Date.now() - startTime < maxWaitMs) {
    if (options.signal?.aborted) {
      throw new DOMException('Generation cancelled by user', 'AbortError')
    }

    // Wait 2.5 seconds between polling checks
    await new Promise((resolve) => setTimeout(resolve, 2500))

    const elapsed = Math.round((Date.now() - startTime) / 1000)
    options.onProgress?.(`Generating speech on GenMax... (${elapsed}s)`)

    try {
      const historyRes = await requestGenMax(`/v1/history/${taskId}`, apiKey, {
        signal: options.signal,
      })
      const detail = (await historyRes.json()) as {
        status?: string
        progress?: number
        result?: { audio_url?: string }
        error?: string
        detail_error?: string
      }

      const status = String(detail.status || '').toLowerCase()
      const progress = detail.progress ?? 0

      options.onProgress?.(`Generating speech on GenMax... (${elapsed}s | ${progress}% completed)`)

      if (status === 'completed') {
        audioUrl = detail.result?.audio_url || ''
        if (!audioUrl) {
          throw new Error('GenMax task completed but no audio URL was returned.')
        }
        break
      } else if (status === 'failed') {
        throw new Error(detail.error || detail.detail_error || 'GenMax task processing failed.')
      }
    } catch (pollErr) {
      if (pollErr instanceof DOMException && pollErr.name === 'AbortError') {
        throw pollErr
      }
      // Non-fatal network hiccup during poll, retry next iteration
    }
  }

  if (!audioUrl) {
    throw new Error('Generation timed out waiting for GenMax response.')
  }

  options.onProgress?.('Downloading final audio file...')

  let blob: Blob
  if (audioUrl.includes('api.genmax.io/audio/')) {
    const audioPath = audioUrl.replace(/^https?:\/\/api\.genmax\.io/, '')
    const audioRes = await requestGenMax(audioPath, apiKey, { signal: options.signal })
    blob = await audioRes.blob()
  } else {
    const audioRes = await fetch(audioUrl, { signal: options.signal })
    blob = await audioRes.blob()
  }

  const duration = await getAudioBlobDuration(blob)
  const file = new File(
    [blob],
    `genmax-${provider}-${sanitizeAiOutputFileNameSegment(trimmedText.slice(0, 30), 'audio')}.mp3`,
    { type: 'audio/mpeg', lastModified: Date.now() },
  )

  return { blob, file, duration }
}
