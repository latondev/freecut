import { memo, useCallback, useEffect, useMemo, useRef, useState, useDeferredValue } from 'react'
import {
  Check,
  Copy,
  Heart,
  Loader2,
  Mic,
  PlayCircle,
  RotateCw,
  Search,
  Sparkles,
  Square,
  Users,
  Volume2,
  X,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { cn } from '@/shared/ui/cn'
import {
  DEFAULT_AUDIO_GEN_VOICES,
  type AudioGenProvider,
  type AudioGenVoice,
  type AudioGenVoiceCatalog,
} from '../services/audio-gen-voices-service'
import { FLAG_DATA_URLS } from './flag-data-urls'

const FAVORITES_STORAGE_KEY = 'freecut:favorite-voices'
const INITIAL_BATCH_SIZE = 24
const BATCH_STEP = 24

// --- Circular Web-grade Flag Icon Component with zero-network Data URIs ---

function FlagIcon({ code, className }: { code: string; className?: string }) {
  const norm = (code || '').toLowerCase().trim()
  const key = norm === 'all' ? 'global' : norm
  const dataUrl = FLAG_DATA_URLS[key] || FLAG_DATA_URLS['global']

  if (!dataUrl) {
    return (
      <span
        className={cn(
          'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[9px] font-semibold text-zinc-300 ring-1 ring-white/10 select-none uppercase',
          className,
        )}
      >
        {norm.slice(0, 2) || '🌐'}
      </span>
    )
  }

  return (
    <img
      src={dataUrl}
      alt={norm}
      className={cn(
        'h-4 w-4 shrink-0 rounded-full object-cover ring-1 ring-white/15 select-none shadow-xs',
        className,
      )}
      draggable={false}
      loading="eager"
    />
  )
}

interface LanguageOption {
  code: string
  flag: string
  label: string
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'all', flag: 'global', label: 'All Languages' },
  { code: 'vi', flag: 'vn', label: 'Vietnamese (Tiếng Việt)' },
  { code: 'en', flag: 'us', label: 'English (Tiếng Anh)' },
  { code: 'zh', flag: 'cn', label: 'Chinese (Mandarin)' },
  { code: 'ja', flag: 'jp', label: 'Japanese (Tiếng Nhật)' },
  { code: 'ko', flag: 'kr', label: 'Korean (Tiếng Hàn)' },
  { code: 'fr', flag: 'fr', label: 'French (Tiếng Pháp)' },
  { code: 'de', flag: 'de', label: 'German (Tiếng Đức)' },
  { code: 'es', flag: 'es', label: 'Spanish (Tây Ban Nha)' },
  { code: 'ru', flag: 'ru', label: 'Russian (Tiếng Nga)' },
  { code: 'it', flag: 'it', label: 'Italian (Tiếng Ý)' },
  { code: 'pt', flag: 'pt', label: 'Portuguese' },
  { code: 'ar', flag: 'sa', label: 'Arabic' },
  { code: 'hi', flag: 'in', label: 'Hindi' },
  { code: 'th', flag: 'th', label: 'Thai' },
  { code: 'id', flag: 'id', label: 'Indonesian' },
  { code: 'ms', flag: 'my', label: 'Malay' },
  { code: 'tr', flag: 'tr', label: 'Turkish' },
  { code: 'pl', flag: 'pl', label: 'Polish' },
  { code: 'nl', flag: 'nl', label: 'Dutch' },
  { code: 'sv', flag: 'se', label: 'Swedish' },
  { code: 'da', flag: 'dk', label: 'Danish' },
  { code: 'fi', flag: 'fi', label: 'Finnish' },
  { code: 'no', flag: 'no', label: 'Norwegian' },
  { code: 'cs', flag: 'cz', label: 'Czech' },
  { code: 'el', flag: 'gr', label: 'Greek' },
  { code: 'he', flag: 'il', label: 'Hebrew' },
  { code: 'ro', flag: 'ro', label: 'Romanian' },
  { code: 'hu', flag: 'hu', label: 'Hungarian' },
  { code: 'uk', flag: 'ua', label: 'Ukrainian' },
  { code: 'fil', flag: 'ph', label: 'Filipino' },
  { code: 'af', flag: 'za', label: 'Afrikaans' },
  { code: 'hy', flag: 'am', label: 'Armenian' },
  { code: 'as', flag: 'in', label: 'Assamese' },
  { code: 'az', flag: 'az', label: 'Azerbaijani' },
  { code: 'be', flag: 'by', label: 'Belarusian' },
  { code: 'bn', flag: 'bd', label: 'Bengali' },
  { code: 'bs', flag: 'ba', label: 'Bosnian' },
  { code: 'bg', flag: 'bg', label: 'Bulgarian' },
  { code: 'ca', flag: 'es', label: 'Catalan' },
  { code: 'ceb', flag: 'ph', label: 'Cebuano' },
  { code: 'ny', flag: 'mw', label: 'Chichewa' },
  { code: 'hr', flag: 'hr', label: 'Croatian' },
  { code: 'et', flag: 'ee', label: 'Estonian' },
  { code: 'gl', flag: 'es', label: 'Galician' },
  { code: 'ka', flag: 'ge', label: 'Georgian' },
  { code: 'gu', flag: 'in', label: 'Gujarati' },
  { code: 'ha', flag: 'ng', label: 'Hausa' },
  { code: 'is', flag: 'is', label: 'Icelandic' },
  { code: 'ga', flag: 'ie', label: 'Irish' },
  { code: 'jv', flag: 'id', label: 'Javanese' },
  { code: 'kn', flag: 'in', label: 'Kannada' },
  { code: 'kk', flag: 'kz', label: 'Kazakh' },
  { code: 'ky', flag: 'kg', label: 'Kirghiz' },
  { code: 'lv', flag: 'lv', label: 'Latvian' },
  { code: 'ln', flag: 'cd', label: 'Lingala' },
  { code: 'lt', flag: 'lt', label: 'Lithuanian' },
  { code: 'lb', flag: 'lu', label: 'Luxembourgish' },
  { code: 'mk', flag: 'mk', label: 'Macedonian' },
  { code: 'ml', flag: 'in', label: 'Malayalam' },
  { code: 'mr', flag: 'in', label: 'Marathi' },
  { code: 'ne', flag: 'np', label: 'Nepali' },
  { code: 'ps', flag: 'af', label: 'Pashto' },
  { code: 'fa', flag: 'ir', label: 'Persian' },
  { code: 'pa', flag: 'in', label: 'Punjabi' },
  { code: 'sr', flag: 'rs', label: 'Serbian' },
  { code: 'sd', flag: 'pk', label: 'Sindhi' },
  { code: 'sk', flag: 'sk', label: 'Slovak' },
  { code: 'sl', flag: 'si', label: 'Slovenian' },
  { code: 'so', flag: 'so', label: 'Somali' },
  { code: 'sw', flag: 'ke', label: 'Swahili' },
  { code: 'ta', flag: 'in', label: 'Tamil' },
  { code: 'te', flag: 'in', label: 'Telugu' },
  { code: 'ur', flag: 'pk', label: 'Urdu' },
  { code: 'cy', flag: 'gb', label: 'Welsh' },
]

function loadStoredFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? new Set(parsed) : new Set()
  } catch {
    return new Set()
  }
}

function saveStoredFavorites(favs: Set<string>): void {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favs)))
  } catch {
    // Ignore localStorage write error
  }
}

function normalizeLanguageTag(lang?: string): string {
  if (!lang) return ''
  const lower = lang.toLowerCase().trim()
  if (lower === 'vi' || lower.includes('vietnam') || lower.includes('tiếng việt'))
    return 'vietnamese'
  if (lower === 'en' || lower.includes('english')) return 'english'
  if (lower === 'zh' || lower.includes('chinese') || lower.includes('trung')) return 'chinese'
  if (lower === 'ja' || lower.includes('japanese') || lower.includes('nhật')) return 'japanese'
  if (lower === 'ko' || lower.includes('korean') || lower.includes('hàn')) return 'korean'
  if (lower === 'es' || lower.includes('spanish') || lower.includes('tây ban nha')) return 'spanish'
  if (lower === 'fr' || lower.includes('french') || lower.includes('pháp')) return 'french'
  if (lower === 'de' || lower.includes('german') || lower.includes('đức')) return 'german'
  if (lower === 'ru' || lower.includes('russian') || lower.includes('nga')) return 'russian'
  return lower
}

function normalizeGenderTag(gender?: string): string {
  if (!gender) return ''
  const lower = gender.toLowerCase().trim()
  if (
    lower.includes('female') ||
    lower.includes('nữ') ||
    lower.includes('woman') ||
    lower.includes('girl')
  )
    return 'female'
  if (
    lower.includes('male') ||
    lower.includes('nam') ||
    lower.includes('man') ||
    lower.includes('boy')
  )
    return 'male'
  return 'other'
}

function getVoiceCountryCodes(voice: AudioGenVoice): string[] {
  const codes: string[] = []
  const text =
    `${voice.language || ''} ${voice.accent || ''} ${(voice.tags || []).join(' ')} ${voice.label} ${voice.description || ''}`.toLowerCase()

  if (text.includes('vietnam') || text.includes('tiếng việt') || /\bvi\b/.test(text))
    codes.push('vn')
  if (text.includes('welsh') || text.includes('wales') || /\bcy\b/.test(text)) codes.push('gb')
  if (
    text.includes('american') ||
    text.includes('united states') ||
    /\bus\b/.test(text) ||
    text.includes('en-us') ||
    text.includes('(us)')
  )
    codes.push('us')
  if (
    text.includes('british') ||
    text.includes('united kingdom') ||
    text.includes('scottish') ||
    /\buk\b/.test(text) ||
    text.includes('en-gb') ||
    text.includes('(uk)')
  )
    codes.push('gb')
  if (text.includes('australi')) codes.push('au')
  if (
    text.includes('chines') ||
    text.includes('mandarin') ||
    text.includes('cantonese') ||
    text.includes('trung')
  )
    codes.push('cn')
  if (text.includes('japan') || text.includes('nhật')) codes.push('jp')
  if (text.includes('korean') || text.includes('hàn')) codes.push('kr')
  if (text.includes('french') || text.includes('pháp')) codes.push('fr')
  if (text.includes('german') || text.includes('đức')) codes.push('de')
  if (text.includes('spanish') || text.includes('tây ban nha')) codes.push('es')
  if (text.includes('russian') || text.includes('nga')) codes.push('ru')
  if (text.includes('italian') || text.includes('ý')) codes.push('it')
  if (text.includes('portuguese') || text.includes('brazil')) codes.push('pt')
  if (text.includes('arabic') || text.includes('ả rập')) codes.push('sa')
  if (text.includes('hindi') || text.includes('indian') || text.includes('ấn độ')) codes.push('in')
  if (text.includes('thai') || text.includes('thái')) codes.push('th')
  if (text.includes('indonesia') || text.includes('malay')) codes.push('id')
  if (text.includes('irish') || text.includes('ireland')) codes.push('ie')
  if (text.includes('canad')) codes.push('ca')
  if (text.includes('mexic')) codes.push('mx')
  if (text.includes('singapore')) codes.push('sg')
  if (text.includes('polish')) codes.push('pl')
  if (text.includes('dutch')) codes.push('nl')
  if (text.includes('swedish')) codes.push('se')
  if (text.includes('turkish')) codes.push('tr')
  if (text.includes('filipino') || text.includes('tagalog')) codes.push('ph')
  if (text.includes('greek')) codes.push('gr')
  if (text.includes('czech')) codes.push('cz')
  if (text.includes('ukrain')) codes.push('ua')
  if (text.includes('hebrew')) codes.push('il')

  // If voice contains English / en, map to US flag
  if (codes.length === 0 && (text.includes('english') || /\ben\b/.test(text))) {
    codes.push('us')
  }

  if (codes.length === 0) {
    if (voice.language?.toLowerCase().includes('vi')) codes.push('vn')
    else if (voice.language?.toLowerCase().includes('en')) codes.push('us')
    else if (voice.language?.toLowerCase().includes('zh')) codes.push('cn')
    else if (voice.language?.toLowerCase().includes('ja')) codes.push('jp')
    else if (voice.language?.toLowerCase().includes('ko')) codes.push('kr')
    else codes.push('global')
  }

  return Array.from(new Set(codes)).slice(0, 2)
}

function extractVoiceBadges(voice: AudioGenVoice) {
  const tags = voice.tags || []
  const text = `${tags.join(' ')} ${voice.description || ''} ${voice.label}`.toLowerCase()

  // 1. Accent
  let accent = voice.accent
  if (!accent) {
    if (text.includes('american') || text.includes('us')) accent = 'American'
    else if (text.includes('british') || text.includes('uk')) accent = 'British'
    else if (text.includes('welsh') || text.includes('wales')) accent = 'Welsh'
    else if (text.includes('australi')) accent = 'Australian'
    else if (text.includes('vietnam')) accent = 'Vietnamese'
    else if (text.includes('chinese')) accent = 'Chinese'
    else if (text.includes('japanese')) accent = 'Japanese'
    else if (text.includes('korean')) accent = 'Korean'
    else if (voice.language) accent = voice.language
    else accent = 'Standard'
  }

  // 2. Gender
  let gender = voice.gender
  if (!gender) {
    if (
      text.includes('female') ||
      text.includes('nữ') ||
      text.includes('woman') ||
      text.includes('girl')
    )
      gender = 'Female'
    else if (
      text.includes('male') ||
      text.includes('nam') ||
      text.includes('man') ||
      text.includes('boy')
    )
      gender = 'Male'
    else gender = 'Neutral'
  }

  // 3. Age
  let age = 'Middle_aged'
  if (
    text.includes('young') ||
    text.includes('trẻ') ||
    text.includes('youth') ||
    text.includes('child')
  ) {
    age = 'Young'
  } else if (text.includes('old') || text.includes('senior') || text.includes('elderly')) {
    age = 'Old'
  } else if (tags.some((t) => t.toLowerCase().includes('middle'))) {
    age = 'Middle_aged'
  }

  return { accent, gender, age }
}

type SubTab = 'library' | 'favourites' | 'default'

type ActiveProviderTab = 'all' | AudioGenProvider

const ALL_PROVIDER_TABS: ActiveProviderTab[] = ['all', 'minimax', 'elevenlabs', 'capcut']

const ALL_PROVIDER_LABELS: Record<ActiveProviderTab, string> = {
  all: 'Tất cả',
  minimax: 'MiniMax',
  elevenlabs: 'ElevenLabs',
  capcut: 'CapCut',
}

export interface VoiceLibraryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedVoiceId: string
  selectedProvider: AudioGenProvider
  onSelectVoice: (voiceId: string, provider: AudioGenProvider, voice: AudioGenVoice) => void
  voiceCatalog: AudioGenVoiceCatalog
  onReloadVoices?: () => Promise<void>
  isLoadingVoices?: boolean
  hasApiKey?: boolean
}

function resolveAudioPreviewUrl(url?: string): string {
  if (!url) return ''
  if (url.startsWith('https://api.genmax.io')) {
    return url.replace('https://api.genmax.io', '/api/genmax')
  }
  return url
}

export const VoiceLibraryDialog = memo(function VoiceLibraryDialog({
  open,
  onOpenChange,
  selectedVoiceId,
  selectedProvider,
  onSelectVoice,
  voiceCatalog,
  onReloadVoices,
  isLoadingVoices = false,
  hasApiKey = false,
}: VoiceLibraryDialogProps) {
  // Default to 'all' so users can seamlessly browse across providers
  const [activeProvider, setActiveProvider] = useState<ActiveProviderTab>('all')
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('library')
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)

  // Filters (Removed Accent 'Giọng' per user request)
  const [languageFilter, setLanguageFilter] = useState('all')
  const [qualityFilter, setQualityFilter] = useState('all')
  const [genderFilter, setGenderFilter] = useState('all')
  const [ageFilter, setAgeFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortOption, setSortOption] = useState<'trending' | 'newest' | 'alpha_asc' | 'alpha_desc'>(
    'trending',
  )

  const [favorites, setFavorites] = useState<Set<string>>(() => loadStoredFavorites())
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null)
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_BATCH_SIZE)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const blobUrlRef = useRef<string | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const observerTargetRef = useRef<HTMLDivElement | null>(null)

  // Selected language object for trigger UI
  const currentLangOption = useMemo(
    () => LANGUAGE_OPTIONS.find((l) => l.code === languageFilter) || LANGUAGE_OPTIONS[0]!,
    [languageFilter],
  )

  // Clean audio previews on dialog close
  useEffect(() => {
    if (open) {
      setPreviewPlayingId(null)
      setPreviewLoadingId(null)
    } else {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
      setPreviewPlayingId(null)
      setPreviewLoadingId(null)
    }
  }, [open])

  // Audio preview cleanup
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [])

  const toggleFavorite = useCallback((voiceId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(voiceId)) {
        next.delete(voiceId)
      } else {
        next.add(voiceId)
      }
      saveStoredFavorites(next)
      return next
    })
  }, [])

  const handleCopyVoiceId = useCallback((id: string) => {
    void navigator.clipboard.writeText(id)
    toast.success(`Đã sao chép ID: ${id}`)
  }, [])

  const handleResetFilters = useCallback(() => {
    setSearchQuery('')
    setLanguageFilter('all')
    setQualityFilter('all')
    setGenderFilter('all')
    setAgeFilter('all')
    setCategoryFilter('all')
    setSortOption('trending')
    toast.info('Đã đặt lại toàn bộ bộ lọc')
  }, [])

  const handlePlayPreview = useCallback(
    async (voice: AudioGenVoice) => {
      if (!voice.previewUrl) {
        toast.info('Giọng này không có file nghe thử.')
        return
      }

      // If clicked while playing or loading this same voice, toggle pause
      if (previewPlayingId === voice.id || previewLoadingId === voice.id) {
        if (audioRef.current) {
          audioRef.current.pause()
        }
        setPreviewPlayingId(null)
        setPreviewLoadingId(null)
        return
      }

      // Stop previous audio if any
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }

      const resolvedUrl = resolveAudioPreviewUrl(voice.previewUrl)
      setPreviewLoadingId(voice.id)
      setPreviewPlayingId(null)

      try {
        if (!audioRef.current) {
          audioRef.current = new Audio()
        }
        const audio = audioRef.current
        audio.crossOrigin = 'anonymous'

        audio.onended = () => {
          setPreviewPlayingId(null)
          setPreviewLoadingId(null)
        }
        audio.onerror = () => {
          // Handled in catch fallback
        }

        audio.src = resolvedUrl
        await audio.play()
        setPreviewLoadingId(null)
        setPreviewPlayingId(voice.id)
      } catch (directPlayErr) {
        // Fallback: Fetch as blob to bypass CORS/COEP
        try {
          const res = await fetch(resolvedUrl)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const blob = await res.blob()
          const objectUrl = URL.createObjectURL(blob)
          blobUrlRef.current = objectUrl

          if (!audioRef.current) {
            audioRef.current = new Audio()
          }
          const audio = audioRef.current
          audio.src = objectUrl
          await audio.play()
          setPreviewLoadingId(null)
          setPreviewPlayingId(voice.id)
        } catch (fetchErr) {
          console.error('[VoicePreview] Failed to play preview audio:', fetchErr || directPlayErr)
          toast.error('Không thể phát file nghe thử mẫu giọng này.')
          setPreviewLoadingId(null)
          setPreviewPlayingId(null)
        }
      }
    },
    [previewPlayingId, previewLoadingId],
  )

  // Combined list of all voices across all providers
  const allVoices = useMemo(() => {
    const list: AudioGenVoice[] = []
    const seen = new Set<string>()
    for (const prov of ['minimax', 'elevenlabs', 'capcut'] as const) {
      for (const v of voiceCatalog[prov] || []) {
        if (!seen.has(v.id)) {
          seen.add(v.id)
          list.push(v)
        }
      }
    }
    return list
  }, [voiceCatalog])

  // Current provider voices
  const providerVoices = useMemo(() => {
    if (activeProvider === 'all') return allVoices
    return voiceCatalog[activeProvider] || []
  }, [activeProvider, allVoices, voiceCatalog])

  // Default voices for current provider
  const defaultVoices = useMemo(() => {
    if (activeProvider === 'all') {
      return [
        ...(DEFAULT_AUDIO_GEN_VOICES.minimax || []),
        ...(DEFAULT_AUDIO_GEN_VOICES.elevenlabs || []),
        ...(DEFAULT_AUDIO_GEN_VOICES.capcut || []),
      ]
    }
    return DEFAULT_AUDIO_GEN_VOICES[activeProvider] || []
  }, [activeProvider])

  // Favourites list for current provider
  const favouriteVoices = useMemo(() => {
    return providerVoices.filter((v) => favorites.has(v.id))
  }, [providerVoices, favorites])

  // Helper to filter any voice list based on active criteria
  const filterVoiceList = useCallback(
    (list: AudioGenVoice[]) => {
      const query = deferredSearchQuery.trim().toLowerCase()
      const targetQuality = qualityFilter.toLowerCase()
      const targetGender = genderFilter.toLowerCase()
      const targetAge = ageFilter.toLowerCase()

      return list.filter((voice) => {
        // 1. Language filter (Accurate matching for 70+ languages & accents)
        if (languageFilter !== 'all') {
          const normVoiceLang = normalizeLanguageTag(voice.language)
          const fullText =
            `${voice.language || ''} ${voice.accent || ''} ${(voice.tags || []).join(' ')} ${voice.description || ''} ${voice.label}`.toLowerCase()

          let matched = false
          const selectedOption = LANGUAGE_OPTIONS.find((l) => l.code === languageFilter)
          const langCode = languageFilter.toLowerCase()
          const langLabel = (selectedOption?.label || '').toLowerCase()
          const primaryWord = langLabel
            .split(' ')[0]!
            .replace(/[^a-z]/g, '')
            .toLowerCase()

          // Match by ISO code or normalized language name
          if (normVoiceLang === langCode || voice.language?.toLowerCase() === langCode) {
            matched = true
          } else if (normVoiceLang === primaryWord) {
            matched = true
          } else if (primaryWord.length > 2 && fullText.includes(primaryWord)) {
            matched = true
          } else if (languageFilter === 'vi') {
            matched =
              normVoiceLang === 'vietnamese' ||
              fullText.includes('vietnam') ||
              fullText.includes('tiếng việt') ||
              /\bvi\b/.test(fullText)
          } else if (languageFilter === 'en') {
            matched =
              normVoiceLang === 'english' ||
              fullText.includes('english') ||
              fullText.includes('american') ||
              fullText.includes('british') ||
              fullText.includes('australi') ||
              /\ben\b/.test(fullText)
          } else if (languageFilter === 'zh') {
            matched =
              normVoiceLang === 'chinese' ||
              fullText.includes('chinese') ||
              fullText.includes('mandarin') ||
              fullText.includes('cantonese') ||
              fullText.includes('trung') ||
              /\bzh\b/.test(fullText)
          } else if (languageFilter === 'ja') {
            matched =
              normVoiceLang === 'japanese' ||
              fullText.includes('japanese') ||
              fullText.includes('nhật') ||
              /\bja\b/.test(fullText)
          } else if (languageFilter === 'ko') {
            matched =
              normVoiceLang === 'korean' ||
              fullText.includes('korean') ||
              fullText.includes('hàn') ||
              /\bko\b/.test(fullText)
          } else if (languageFilter === 'fr') {
            matched =
              normVoiceLang === 'french' ||
              fullText.includes('french') ||
              fullText.includes('pháp') ||
              /\bfr\b/.test(fullText)
          } else if (languageFilter === 'de') {
            matched =
              normVoiceLang === 'german' ||
              fullText.includes('german') ||
              fullText.includes('đức') ||
              /\bde\b/.test(fullText)
          } else if (languageFilter === 'es') {
            matched =
              normVoiceLang === 'spanish' ||
              fullText.includes('spanish') ||
              fullText.includes('tây ban nha') ||
              /\bes\b/.test(fullText)
          } else if (languageFilter === 'ru') {
            matched =
              normVoiceLang === 'russian' ||
              fullText.includes('russian') ||
              fullText.includes('nga') ||
              /\bru\b/.test(fullText)
          } else if (languageFilter === 'it') {
            matched =
              fullText.includes('italian') || fullText.includes('ý') || /\bit\b/.test(fullText)
          } else if (languageFilter === 'pt') {
            matched =
              fullText.includes('portuguese') ||
              fullText.includes('brazil') ||
              /\bpt\b/.test(fullText)
          } else if (languageFilter === 'cy') {
            matched = fullText.includes('welsh') || /\bcy\b/.test(fullText)
          }

          if (!matched) return false
        }

        // 2. Quality filter
        if (targetQuality !== 'all') {
          const fullVoiceText =
            `${(voice.tags || []).join(' ')} ${voice.description || ''} ${voice.label}`.toLowerCase()
          if (
            targetQuality === 'studio_hd' &&
            !fullVoiceText.includes('studio') &&
            !fullVoiceText.includes('hd')
          )
            return false
          if (
            targetQuality === 'ultra_realistic' &&
            !fullVoiceText.includes('ultra') &&
            !fullVoiceText.includes('realistic')
          )
            return false
          if (targetQuality === 'standard' && !fullVoiceText.includes('standard')) return false
        }

        // 3. Gender filter
        if (targetGender !== 'all') {
          const normGen = normalizeGenderTag(voice.gender)
          if (normGen !== targetGender) {
            const inTags = voice.tags?.some((t) => normalizeGenderTag(t) === targetGender)
            const inDesc = voice.description?.toLowerCase().includes(targetGender)
            if (!inTags && !inDesc) return false
          }
        }

        // 4. Age filter
        if (targetAge !== 'all') {
          const fullVoiceText =
            `${(voice.tags || []).join(' ')} ${voice.description || ''} ${voice.label}`.toLowerCase()
          if (
            targetAge === 'young' &&
            !fullVoiceText.includes('young') &&
            !fullVoiceText.includes('trẻ') &&
            !fullVoiceText.includes('child')
          )
            return false
          if (
            targetAge === 'middle_aged' &&
            !fullVoiceText.includes('middle') &&
            !fullVoiceText.includes('adult') &&
            !fullVoiceText.includes('trung niên')
          )
            return false
          if (
            targetAge === 'old' &&
            !fullVoiceText.includes('old') &&
            !fullVoiceText.includes('senior') &&
            !fullVoiceText.includes('già') &&
            !fullVoiceText.includes('cao tuổi')
          )
            return false
        }

        // 5. Category filter
        if (categoryFilter !== 'all') {
          const fullVoiceText =
            `${(voice.tags || []).join(' ')} ${voice.description || ''} ${voice.label}`.toLowerCase()
          if (categoryFilter === 'story') {
            if (
              !fullVoiceText.includes('narrat') &&
              !fullVoiceText.includes('story') &&
              !fullVoiceText.includes('tường thuật') &&
              !fullVoiceText.includes('kể') &&
              !fullVoiceText.includes('audiobook') &&
              !fullVoiceText.includes('novel')
            )
              return false
          } else if (categoryFilter === 'conversational') {
            if (
              !fullVoiceText.includes('convers') &&
              !fullVoiceText.includes('hội thoại') &&
              !fullVoiceText.includes('chat') &&
              !fullVoiceText.includes('trò chuyện') &&
              !fullVoiceText.includes('podcast')
            )
              return false
          } else if (categoryFilter === 'animation') {
            if (
              !fullVoiceText.includes('charact') &&
              !fullVoiceText.includes('nhân vật') &&
              !fullVoiceText.includes('animat') &&
              !fullVoiceText.includes('hoạt hình') &&
              !fullVoiceText.includes('anime') &&
              !fullVoiceText.includes('game')
            )
              return false
          } else if (categoryFilter === 'social_media') {
            if (
              !fullVoiceText.includes('social') &&
              !fullVoiceText.includes('mạng xã hội') &&
              !fullVoiceText.includes('stream') &&
              !fullVoiceText.includes('reels') &&
              !fullVoiceText.includes('tiktok') &&
              !fullVoiceText.includes('youtube')
            )
              return false
          } else if (categoryFilter === 'entertainment') {
            if (
              !fullVoiceText.includes('entertain') &&
              !fullVoiceText.includes('giải trí') &&
              !fullVoiceText.includes('tv') &&
              !fullVoiceText.includes('movie') &&
              !fullVoiceText.includes('cinema') &&
              !fullVoiceText.includes('drama')
            )
              return false
          } else if (categoryFilter === 'commercial') {
            if (
              !fullVoiceText.includes('commercial') &&
              !fullVoiceText.includes('quảng cáo') &&
              !fullVoiceText.includes('promo') &&
              !fullVoiceText.includes('advert') &&
              !fullVoiceText.includes('brand')
            )
              return false
          } else if (categoryFilter === 'education') {
            if (
              !fullVoiceText.includes('educat') &&
              !fullVoiceText.includes('giáo dục') &&
              !fullVoiceText.includes('inform') &&
              !fullVoiceText.includes('thông tin') &&
              !fullVoiceText.includes('instruct') &&
              !fullVoiceText.includes('news') &&
              !fullVoiceText.includes('bản tin')
            )
              return false
          }
        }

        // 6. Search query
        if (query) {
          const matchName = voice.label.toLowerCase().includes(query)
          const matchId = voice.id.toLowerCase().includes(query)
          const matchDesc = Boolean(voice.description?.toLowerCase().includes(query))
          const matchLang = Boolean(voice.language?.toLowerCase().includes(query))
          const matchAccent = Boolean(voice.accent?.toLowerCase().includes(query))
          const matchTags = Boolean(voice.tags?.some((t) => t.toLowerCase().includes(query)))
          if (!matchName && !matchId && !matchDesc && !matchLang && !matchAccent && !matchTags) {
            return false
          }
        }

        return true
      })
    },
    [deferredSearchQuery, languageFilter, qualityFilter, genderFilter, ageFilter, categoryFilter],
  )

  // Filtered and Sorted voice list
  const displayedVoices = useMemo(() => {
    let list: AudioGenVoice[] = []

    if (activeSubTab === 'favourites') {
      list = favouriteVoices
    } else if (activeSubTab === 'default') {
      list = defaultVoices
    } else {
      list = providerVoices
    }

    const filtered = filterVoiceList(list)

    // Sắp xếp
    if (sortOption === 'alpha_asc') {
      filtered.sort((a, b) => a.label.localeCompare(b.label))
    } else if (sortOption === 'alpha_desc') {
      filtered.sort((a, b) => b.label.localeCompare(a.label))
    } else if (sortOption === 'newest') {
      filtered.reverse()
    }

    return filtered
  }, [activeSubTab, favouriteVoices, defaultVoices, providerVoices, filterVoiceList, sortOption])

  // Check if other providers have matching voices when current provider has 0 results
  const otherProviderSuggestion = useMemo(() => {
    if (activeProvider === 'all') return null
    const otherProviders: AudioGenProvider[] = (
      ['minimax', 'elevenlabs', 'capcut'] as const
    ).filter((p) => p !== activeProvider)
    for (const prov of otherProviders) {
      const provVoices = voiceCatalog[prov] || []
      const matches = filterVoiceList(provVoices)
      if (matches.length > 0) {
        return {
          provider: prov,
          label: ALL_PROVIDER_LABELS[prov],
          count: matches.length,
        }
      }
    }
    return null
  }, [activeProvider, voiceCatalog, filterVoiceList])

  // Determine provider for a voice
  const resolveVoiceProvider = useCallback(
    (voice: AudioGenVoice): AudioGenProvider => {
      if (activeProvider !== 'all') return activeProvider
      if (voiceCatalog.minimax?.some((v) => v.id === voice.id)) return 'minimax'
      if (voiceCatalog.elevenlabs?.some((v) => v.id === voice.id)) return 'elevenlabs'
      if (voiceCatalog.capcut?.some((v) => v.id === voice.id)) return 'capcut'
      return selectedProvider
    },
    [activeProvider, voiceCatalog, selectedProvider],
  )

  const getVoiceProviderLabel = useCallback(
    (voice: AudioGenVoice): string | undefined => {
      if (voiceCatalog.minimax?.some((v) => v.id === voice.id)) return 'MiniMax'
      if (voiceCatalog.elevenlabs?.some((v) => v.id === voice.id)) return 'ElevenLabs'
      if (voiceCatalog.capcut?.some((v) => v.id === voice.id)) return 'CapCut'
      return undefined
    },
    [voiceCatalog],
  )

  // Reset pagination count and scroll position whenever filters or provider changes
  useEffect(() => {
    setVisibleCount(INITIAL_BATCH_SIZE)
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }, [
    activeProvider,
    activeSubTab,
    deferredSearchQuery,
    languageFilter,
    qualityFilter,
    genderFilter,
    ageFilter,
    categoryFilter,
    sortOption,
    open,
  ])

  // Progressive batch loading: load more voices as user scrolls
  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => {
      if (prev >= displayedVoices.length) return prev
      return Math.min(prev + BATCH_STEP, displayedVoices.length)
    })
  }, [displayedVoices.length])

  // Scroll listener on container for smooth auto-loading
  const handleContainerScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
      if (scrollTop + clientHeight >= scrollHeight - 350) {
        handleLoadMore()
      }
    },
    [handleLoadMore],
  )

  // IntersectionObserver on bottom sentinel
  useEffect(() => {
    const target = observerTargetRef.current
    if (!target) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          handleLoadMore()
        }
      },
      { root: scrollContainerRef.current, rootMargin: '300px' },
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [handleLoadMore, visibleCount, displayedVoices.length])

  // Sliced voice list for instantaneous, lag-free DOM rendering
  const visibleVoices = useMemo(() => {
    return displayedVoices.slice(0, visibleCount)
  }, [displayedVoices, visibleCount])

  const handleSelectVoiceAndClose = useCallback(
    (voice: AudioGenVoice) => {
      const provider = resolveVoiceProvider(voice)
      onSelectVoice(voice.id, provider, voice)
      onOpenChange(false)
    },
    [resolveVoiceProvider, onSelectVoice, onOpenChange],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="fixed left-1/2 top-1/2 flex h-[92vh] max-h-[900px] w-[96vw] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-2xl border border-zinc-800 bg-[#131417] p-0 text-zinc-100 shadow-2xl"
      >
        {/* Header Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/80 bg-[#17181c] px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
              <Volume2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold tracking-tight text-zinc-100">
                Thư viện giọng nói AI
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Lọc, nghe thử và chọn giọng đọc đa ngôn ngữ từ MiniMax, ElevenLabs, CapCut
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Provider Tabs Switcher (All Providers, MiniMax, ElevenLabs, CapCut) */}
            <div className="flex rounded-full border border-zinc-700/80 bg-zinc-800/70 p-1">
              {ALL_PROVIDER_TABS.map((prov) => {
                const count = prov === 'all' ? allVoices.length : voiceCatalog[prov]?.length || 0
                const isSelected = activeProvider === prov
                return (
                  <button
                    key={prov}
                    type="button"
                    onClick={() => setActiveProvider(prov)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all',
                      isSelected
                        ? 'bg-orange-500 text-white shadow-xs'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/60',
                    )}
                  >
                    <span>{ALL_PROVIDER_LABELS[prov]}</span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.2 text-[10px]',
                        isSelected ? 'bg-black/30 text-white' : 'bg-zinc-700 text-zinc-300',
                      )}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Sub-tabs Row (Thư viện / Yêu thích / Giọng chọn lọc) */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/60 bg-[#15161a] px-6 py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSubTab('library')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                activeSubTab === 'library'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200',
              )}
            >
              <span>📚 Thư viện giọng nói</span>
              <span className="text-[10px] opacity-80">({providerVoices.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('favourites')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                activeSubTab === 'favourites'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200',
              )}
            >
              <Heart
                className={cn('h-3.5 w-3.5', activeSubTab === 'favourites' ? 'fill-white' : '')}
              />
              <span>Yêu thích</span>
              <span className="text-[10px] opacity-80">({favouriteVoices.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('default')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                activeSubTab === 'default'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200',
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Giọng chọn lọc</span>
              <span className="text-[10px] opacity-80">({defaultVoices.length})</span>
            </button>
          </div>

          {onReloadVoices && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isLoadingVoices || !hasApiKey}
              onClick={() => void onReloadVoices()}
              className="h-7 gap-1.5 border-zinc-700/80 bg-zinc-800/60 px-2.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 shadow-none"
              title={
                hasApiKey
                  ? 'Đồng bộ lại danh mục giọng từ GenMax API'
                  : 'Cần nhập API Key để đồng bộ'
              }
            >
              <RotateCw
                className={cn('h-3 w-3', isLoadingVoices && 'animate-spin text-orange-400')}
              />
              <span>{isLoadingVoices ? 'Đang nạp...' : 'Tải lại danh mục'}</span>
            </Button>
          )}
        </div>

        {/* Filter Controls Row (Dark Theme, High-Contrast UI) */}
        <div className="flex shrink-0 flex-col gap-2.5 border-b border-zinc-800/80 bg-[#16171b] px-6 py-3">
          {/* Row 1: 6 Filter Select Dropdowns + Reset Button */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6 lg:flex lg:items-end lg:gap-2.5">
            {/* 1. Ngôn ngữ (All Languages with real circular SVG flags) */}
            <div className="space-y-1 lg:flex-1">
              <label className="block text-[11px] font-semibold text-zinc-300">Ngôn ngữ</label>
              <Select value={languageFilter} onValueChange={setLanguageFilter}>
                <SelectTrigger className="h-8.5 w-full rounded-lg border-zinc-700/80 bg-zinc-900 px-2.5 text-xs text-zinc-200 shadow-xs hover:border-zinc-600 focus:ring-1 focus:ring-orange-500">
                  <div className="flex items-center gap-1.5 truncate">
                    <FlagIcon code={currentLangOption.flag} />
                    <span className="truncate">{currentLangOption.label}</span>
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-72 border-zinc-700 bg-zinc-900 text-xs text-zinc-200 shadow-xl">
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <span className="flex items-center gap-2">
                        <FlagIcon code={lang.flag} />
                        <span className="truncate">{lang.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Chất lượng */}
            <div className="space-y-1 lg:flex-1">
              <label className="block text-[11px] font-semibold text-zinc-300">Chất lượng</label>
              <Select value={qualityFilter} onValueChange={setQualityFilter}>
                <SelectTrigger className="h-8.5 w-full rounded-lg border-zinc-700/80 bg-zinc-900 px-2.5 text-xs text-zinc-200 shadow-xs hover:border-zinc-600 focus:ring-1 focus:ring-orange-500">
                  <div className="truncate">
                    {qualityFilter === 'all'
                      ? 'Tất cả'
                      : qualityFilter === 'studio_hd'
                        ? 'Studio HD'
                        : qualityFilter === 'standard'
                          ? 'Standard'
                          : 'Ultra Realistic'}
                  </div>
                </SelectTrigger>
                <SelectContent className="border-zinc-700 bg-zinc-900 text-xs text-zinc-200 shadow-xl">
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="studio_hd">Studio HD</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="ultra_realistic">Ultra Realistic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 3. Giới tính */}
            <div className="space-y-1 lg:flex-1">
              <label className="block text-[11px] font-semibold text-zinc-300">Giới tính</label>
              <Select value={genderFilter} onValueChange={setGenderFilter}>
                <SelectTrigger className="h-8.5 w-full rounded-lg border-zinc-700/80 bg-zinc-900 px-2.5 text-xs text-zinc-200 shadow-xs hover:border-zinc-600 focus:ring-1 focus:ring-orange-500">
                  <div className="truncate">
                    {genderFilter === 'all' ? 'Tất cả' : genderFilter === 'male' ? 'Nam' : 'Nữ'}
                  </div>
                </SelectTrigger>
                <SelectContent className="border-zinc-700 bg-zinc-900 text-xs text-zinc-200 shadow-xl">
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="male">Nam (Male)</SelectItem>
                  <SelectItem value="female">Nữ (Female)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 4. Độ tuổi */}
            <div className="space-y-1 lg:flex-1">
              <label className="block text-[11px] font-semibold text-zinc-300">Độ tuổi</label>
              <Select value={ageFilter} onValueChange={setAgeFilter}>
                <SelectTrigger className="h-8.5 w-full rounded-lg border-zinc-700/80 bg-zinc-900 px-2.5 text-xs text-zinc-200 shadow-xs hover:border-zinc-600 focus:ring-1 focus:ring-orange-500">
                  <div className="truncate">
                    {ageFilter === 'all'
                      ? 'Tất cả'
                      : ageFilter === 'young'
                        ? 'Young (Trẻ)'
                        : ageFilter === 'middle_aged'
                          ? 'Middle_aged (Trung niên)'
                          : 'Old (Cao tuổi)'}
                  </div>
                </SelectTrigger>
                <SelectContent className="border-zinc-700 bg-zinc-900 text-xs text-zinc-200 shadow-xl">
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="young">Young (Trẻ)</SelectItem>
                  <SelectItem value="middle_aged">Middle_aged (Trung niên)</SelectItem>
                  <SelectItem value="old">Old (Cao tuổi)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 5. Danh mục (From reference categories) */}
            <div className="space-y-1 lg:flex-1">
              <label className="block text-[11px] font-semibold text-zinc-300">Danh mục</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-8.5 w-full rounded-lg border-zinc-700/80 bg-zinc-900 px-2.5 text-xs text-zinc-200 shadow-xs hover:border-zinc-600 focus:ring-1 focus:ring-orange-500">
                  <div className="truncate">
                    {categoryFilter === 'all'
                      ? 'Tất cả'
                      : categoryFilter === 'story'
                        ? 'Tường thuật & Câu chuyện'
                        : categoryFilter === 'conversational'
                          ? 'Hội thoại'
                          : categoryFilter === 'animation'
                            ? 'Nhân vật & Hoạt hình'
                            : categoryFilter === 'social_media'
                              ? 'Mạng xã hội'
                              : categoryFilter === 'entertainment'
                                ? 'Giải trí & Truyền hình'
                                : categoryFilter === 'commercial'
                                  ? 'Quảng cáo'
                                  : 'Thông tin & Giáo dục'}
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-72 border-zinc-700 bg-zinc-900 text-xs text-zinc-200 shadow-xl">
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="story">Tường thuật & Câu chuyện</SelectItem>
                  <SelectItem value="conversational">Hội thoại</SelectItem>
                  <SelectItem value="animation">Nhân vật & Hoạt hình</SelectItem>
                  <SelectItem value="social_media">Mạng xã hội</SelectItem>
                  <SelectItem value="entertainment">Giải trí & Truyền hình</SelectItem>
                  <SelectItem value="commercial">Quảng cáo</SelectItem>
                  <SelectItem value="education">Thông tin & Giáo dục</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 6. Sắp xếp */}
            <div className="space-y-1 lg:flex-1">
              <label className="block text-[11px] font-semibold text-zinc-300">Sắp xếp</label>
              <Select
                value={sortOption}
                onValueChange={(val) =>
                  setSortOption(val as 'trending' | 'newest' | 'alpha_asc' | 'alpha_desc')
                }
              >
                <SelectTrigger className="h-8.5 w-full rounded-lg border-zinc-700/80 bg-zinc-900 px-2.5 text-xs text-zinc-200 shadow-xs hover:border-zinc-600 focus:ring-1 focus:ring-orange-500">
                  <div className="truncate">
                    {sortOption === 'trending'
                      ? '≡ Thịnh hành'
                      : sortOption === 'newest'
                        ? 'Mới nhất'
                        : sortOption === 'alpha_asc'
                          ? 'Tên A-Z'
                          : 'Tên Z-A'}
                  </div>
                </SelectTrigger>
                <SelectContent className="border-zinc-700 bg-zinc-900 text-xs text-zinc-200 shadow-xl">
                  <SelectItem value="trending">≡ Thịnh hành</SelectItem>
                  <SelectItem value="newest">Mới nhất</SelectItem>
                  <SelectItem value="alpha_asc">Tên A-Z</SelectItem>
                  <SelectItem value="alpha_desc">Tên Z-A</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reset Filters Icon Button */}
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleResetFilters}
                className="h-8.5 w-8.5 shrink-0 rounded-lg border-zinc-700/80 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 shadow-xs"
                title="Đặt lại toàn bộ bộ lọc"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Row 2: Full Width Search Input */}
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo từ khóa hoặc ID giọng nói..."
              className="h-10 w-full rounded-xl border border-zinc-700/80 bg-zinc-900/90 pl-10 pr-9 text-xs text-zinc-100 placeholder:text-zinc-500 shadow-xs focus:border-orange-500/60 focus:outline-none focus:ring-1 focus:ring-orange-500/60 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Voices Grid Content Area (Dark Theme) */}
        <div
          ref={scrollContainerRef}
          onScroll={handleContainerScroll}
          className="flex-1 overflow-y-auto bg-[#0d0e11] p-5"
        >
          {displayedVoices.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800/80 text-zinc-500 mb-3">
                <Mic className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-200">
                Không tìm thấy giọng nói phù hợp{' '}
                {activeProvider !== 'all' ? `trong ${ALL_PROVIDER_LABELS[activeProvider]}` : ''}
              </h3>

              {otherProviderSuggestion ? (
                <div className="mt-3 flex flex-col items-center gap-2">
                  <p className="text-xs text-amber-400">
                    Tìm thấy <strong>{otherProviderSuggestion.count}</strong> giọng phù hợp trong{' '}
                    <strong>{otherProviderSuggestion.label}</strong>!
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setActiveProvider(otherProviderSuggestion.provider)}
                    className="h-8 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-4 shadow-sm"
                  >
                    Chuyển sang {otherProviderSuggestion.label} ({otherProviderSuggestion.count}{' '}
                    giọng)
                  </Button>
                </div>
              ) : (
                <p className="mt-1 max-w-sm text-xs text-zinc-500">
                  Thử chọn tab "Tất cả", thay đổi từ khóa tìm kiếm hoặc đặt lại bộ lọc.
                </p>
              )}

              <div className="mt-3.5 flex items-center gap-2">
                {activeProvider !== 'all' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 border-orange-500/50 bg-orange-950/20 text-xs text-orange-300 hover:bg-orange-900/30"
                    onClick={() => setActiveProvider('all')}
                  >
                    Tìm trong Tất cả ({allVoices.length} giọng)
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 border-zinc-700 bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700 shadow-xs"
                  onClick={handleResetFilters}
                >
                  Đặt lại bộ lọc
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {visibleVoices.map((voice) => (
                <VoiceCardItem
                  key={voice.id}
                  voice={voice}
                  isCurrent={
                    voice.id === selectedVoiceId &&
                    (activeProvider === 'all' || activeProvider === selectedProvider)
                  }
                  isFav={favorites.has(voice.id)}
                  isPlaying={previewPlayingId === voice.id}
                  isLoadingPreview={previewLoadingId === voice.id}
                  providerLabel={
                    activeProvider === 'all' ? getVoiceProviderLabel(voice) : undefined
                  }
                  onToggleFavorite={toggleFavorite}
                  onCopyVoiceId={handleCopyVoiceId}
                  onPlayPreview={handlePlayPreview}
                  onSelectVoice={handleSelectVoiceAndClose}
                />
              ))}

              {/* Progressive loading indicator & Load More button */}
              {visibleCount < displayedVoices.length ? (
                <div
                  ref={observerTargetRef}
                  className="col-span-full py-4 flex flex-col items-center justify-center gap-2"
                >
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
                    <span>
                      Đang tải thêm ({Math.min(visibleCount, displayedVoices.length)} /{' '}
                      {displayedVoices.length})...
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLoadMore}
                    className="h-8 text-xs border-zinc-700 bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200 shadow-xs"
                  >
                    Tải thêm ({displayedVoices.length - visibleCount} giọng còn lại)
                  </Button>
                </div>
              ) : displayedVoices.length > INITIAL_BATCH_SIZE ? (
                <div className="col-span-full py-3 text-center text-xs text-zinc-600">
                  Đã hiển thị toàn bộ {displayedVoices.length} giọng
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="flex shrink-0 items-center justify-between border-t border-zinc-800/80 bg-[#16171b] px-6 py-2.5 text-xs text-zinc-400">
          <span>
            Hiển thị{' '}
            <strong className="text-zinc-200">
              {Math.min(visibleCount, displayedVoices.length)}
            </strong>{' '}
            / {displayedVoices.length} giọng phù hợp (Tổng kho: {providerVoices.length} giọng{' '}
            {ALL_PROVIDER_LABELS[activeProvider]})
          </span>
          <span className="text-[11px] text-zinc-500">
            {hasApiKey ? 'Đã kết nối GenMax API' : 'Mở Settings để cấu hình GenMax API key'}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
})

// --- Memoized Dark Theme Voice Card Component ---

interface VoiceCardItemProps {
  voice: AudioGenVoice
  isCurrent: boolean
  isFav: boolean
  isPlaying: boolean
  isLoadingPreview: boolean
  providerLabel?: string
  onToggleFavorite: (id: string) => void
  onCopyVoiceId: (id: string) => void
  onPlayPreview: (voice: AudioGenVoice) => void
  onSelectVoice: (voice: AudioGenVoice) => void
}

const VoiceCardItem = memo(function VoiceCardItem({
  voice,
  isCurrent,
  isFav,
  isPlaying,
  isLoadingPreview,
  providerLabel,
  onToggleFavorite,
  onCopyVoiceId,
  onPlayPreview,
  onSelectVoice,
}: VoiceCardItemProps) {
  const countryCodes = useMemo(() => getVoiceCountryCodes(voice), [voice])
  const { accent, gender, age } = useMemo(() => extractVoiceBadges(voice), [voice])

  return (
    <div
      className={cn(
        'group relative flex flex-col justify-between rounded-xl border p-3.5 shadow-sm transition-all duration-150',
        isCurrent
          ? 'border-emerald-500/80 bg-emerald-950/20 ring-1 ring-emerald-500/40 shadow-emerald-950/20'
          : 'border-zinc-800/90 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-800/40',
      )}
    >
      <div>
        {/* Title */}
        <h4
          className={cn(
            'text-[13px] font-bold line-clamp-1 transition-colors',
            isCurrent ? 'text-emerald-400' : 'text-zinc-100 group-hover:text-white',
          )}
          title={voice.label}
        >
          {voice.label}
        </h4>

        {/* Description */}
        <p className="mt-1 line-clamp-2 min-h-[32px] text-[11px] leading-relaxed text-zinc-400">
          {voice.description ||
            'This voice is warm, natural and expressive for high quality speech generation.'}
        </p>

        {/* Pills / Badges: Accent, Gender, Age, Provider */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {providerLabel && (
            <span className="rounded-full bg-orange-950/40 border border-orange-500/40 px-2 py-0.5 text-[9px] font-semibold text-orange-400">
              {providerLabel}
            </span>
          )}
          {accent && (
            <span className="rounded-full bg-zinc-800 border border-zinc-700/80 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
              {accent}
            </span>
          )}
          {gender && (
            <span className="rounded-full bg-zinc-800 border border-zinc-700/80 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
              {gender}
            </span>
          )}
          {age && (
            <span className="rounded-full bg-zinc-800 border border-zinc-700/80 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
              {age}
            </span>
          )}
        </div>

        {/* Stats Row (Simulated icons like screenshot: 👥 -, ⚡ -) */}
        <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>-</span>
          </span>
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            <span>-</span>
          </span>
        </div>
      </div>

      {/* Card Action Row: SVG Flag Icons + Heart + Copy ID | [ Phát ] + [ Sử dụng ] */}
      <div className="mt-3 flex items-center justify-between border-t border-zinc-800/80 pt-2.5">
        {/* Left Side: Circular SVG Flag(s) + Favorite + Copy ID */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center -space-x-1">
            {countryCodes.map((code) => (
              <FlagIcon key={code} code={code} />
            ))}
          </div>

          <button
            type="button"
            onClick={() => onToggleFavorite(voice.id)}
            className="rounded p-0.5 text-zinc-500 hover:text-red-400 transition-colors"
            title={isFav ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
          >
            <Heart
              className={cn(
                'h-3.5 w-3.5 transition-colors',
                isFav ? 'fill-red-500 text-red-500' : 'text-zinc-500 hover:text-red-400',
              )}
            />
          </button>

          <button
            type="button"
            onClick={() => onCopyVoiceId(voice.id)}
            className="rounded p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Sao chép Voice ID"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Right Side: Play button + Use button */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!voice.previewUrl}
            onClick={() => onPlayPreview(voice)}
            className={cn(
              'h-7 gap-1 px-2 text-[11px] font-medium border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 shadow-none transition-colors',
              isPlaying && 'border-red-500/50 bg-red-950/40 text-red-400 hover:bg-red-900/50',
              isLoadingPreview && 'border-amber-500/50 bg-amber-950/30 text-amber-300',
            )}
            title={voice.previewUrl ? 'Nghe thử mẫu giọng' : 'Không có file mẫu'}
          >
            {isLoadingPreview ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                <span>Tải...</span>
              </>
            ) : isPlaying ? (
              <>
                <Square className="h-3 w-3 fill-current text-red-400" />
                <span>Dừng</span>
              </>
            ) : (
              <>
                <PlayCircle className="h-3.5 w-3.5 text-zinc-300" />
                <span>Phát</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => onSelectVoice(voice)}
            className={cn(
              'h-7 px-2.5 text-[11px] font-semibold transition-all',
              isCurrent
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 shadow-xs',
            )}
          >
            {isCurrent ? (
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3" />
                <span>Đang chọn</span>
              </span>
            ) : (
              <span>Sử dụng</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
})
