import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  Info,
  ListPlus,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCw,
  Settings,
  SlidersHorizontal,
  Trash2,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react'
import { VoiceLibraryDialog } from './voice-library-dialog'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { getMusicgenModelDefinition } from '@/shared/utils/musicgen-models'
import { useMediaPlaybackControls } from '@/shared/media/use-media-playback-controls'
import {
  getStoredTtsEngine,
  setStoredTtsEngine,
  type StoredTtsEngine,
} from '@/shared/utils/tts-settings'
import { SliderInput } from '@/shared/ui/property-controls'
import { cn } from '@/shared/ui/cn'
import { i18n } from '@/i18n'
import {
  importMediaLibraryService,
  useMediaLibraryStore,
} from '@/features/editor/deps/media-library'
import { usePlaybackStore } from '@/shared/state/playback'
import type { MediaMetadata } from '@/types/storage'
import {
  KOKORO_TTS_BEST_MODEL,
  KOKORO_TTS_VOICE_OPTIONS,
  getKokoroTtsModelOption,
  getKokoroTtsVoiceOption,
  kokoroTtsService,
  type KokoroTtsModel,
  type KokoroTtsVoice,
} from '../services/kokoro-tts-service'
import {
  MOSS_TTS_VOICE_OPTIONS,
  getMossTtsVoiceOption,
  mossTtsService,
  type MossTtsVoice,
} from '../services/moss-tts-service'
import {
  SUPERTONIC_TTS_EXPRESSIVE_TAG_OPTIONS,
  SUPERTONIC_TTS_LANGUAGE_OPTIONS,
  SUPERTONIC_TTS_VOICE_OPTIONS,
  supertonicTtsService,
  type SupertonicTtsLanguageSelection,
  type SupertonicTtsVoice,
} from '../services/supertonic-tts-service'
import {
  DEFAULT_MUSICGEN_MODEL,
  MUSICGEN_MODEL_OPTIONS,
  musicgenService,
  type MusicgenModelId,
} from '../services/musicgen-service'
import { insertGeneratedAudioOnNewTrack } from '../utils/insert-generated-audio'
import { getLanguageDisplayName, insertTextAtCursor } from '../utils/tts-ui-helpers'
import {
  DEFAULT_AUDIO_GEN_VOICES,
  getCachedGenMaxVoiceCatalog,
  loadGenMaxVoiceCatalog,
  generateGenMaxSpeechFile,
  type AudioGenProvider,
  type AudioGenVoice,
  type AudioGenVoiceCatalog,
} from '../services/audio-gen-voices-service'

const AUDIO_GEN_PROVIDER_LABELS: Record<AudioGenProvider, string> = {
  elevenlabs: 'ElevenLabs',
  minimax: 'MiniMax',
  capcut: 'CapCut',
}

type AiSection = 'audio-gen' | 'tts' | 'music'

const MUSIC_PROMPT_PRESETS = [
  {
    labelKey: 'editor.aiPanel.musicPresets.lofiChillLabel',
    promptKey: 'editor.aiPanel.musicPresets.lofiChillPrompt',
  },
  {
    labelKey: 'editor.aiPanel.musicPresets.pop80sLabel',
    promptKey: 'editor.aiPanel.musicPresets.pop80sPrompt',
  },
  {
    labelKey: 'editor.aiPanel.musicPresets.rock90sLabel',
    promptKey: 'editor.aiPanel.musicPresets.rock90sPrompt',
  },
  {
    labelKey: 'editor.aiPanel.musicPresets.upbeatEdmLabel',
    promptKey: 'editor.aiPanel.musicPresets.upbeatEdmPrompt',
  },
  {
    labelKey: 'editor.aiPanel.musicPresets.countryLabel',
    promptKey: 'editor.aiPanel.musicPresets.countryPrompt',
  },
  {
    labelKey: 'editor.aiPanel.musicPresets.lofiElectroLabel',
    promptKey: 'editor.aiPanel.musicPresets.lofiElectroPrompt',
  },
]

interface AudioGeneration {
  id: string
  file: File
  objectUrl: string
  byteSize: number
  duration: number
  textSnippet: string
  voice: string
  model: string
  summary: string
  details: string
  tags: string[]
  /** null = unsaved, string = saved media ID */
  savedMediaId: string | null
  saving: boolean
}

type Generation = AudioGeneration

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const MiniAudioPlayer = memo(function MiniAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isSeeking, setIsSeeking] = useState(false)
  const isSeekingRef = useRef(false)
  isSeekingRef.current = isSeeking

  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onTimeUpdate = () => {
      if (!isSeekingRef.current) setCurrentTime(el.currentTime)
    }
    const onLoaded = () => setDuration(el.duration)
    const onEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('timeupdate', onTimeUpdate)
    el.addEventListener('loadedmetadata', onLoaded)
    el.addEventListener('ended', onEnded)

    return () => {
      el.pause()
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('timeupdate', onTimeUpdate)
      el.removeEventListener('loadedmetadata', onLoaded)
      el.removeEventListener('ended', onEnded)
    }
  }, [])

  const { togglePlay, seekToPercent } = useMediaPlaybackControls(audioRef, duration, setCurrentTime)

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/30 px-1.5 py-1">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm glow-primary-sm transition-colors hover:bg-primary/90"
        onClick={togglePlay}
        aria-label={isPlaying ? i18n.t('preview.player.pause') : i18n.t('preview.player.play')}
      >
        {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 ml-px" />}
      </button>
      <Slider
        value={[progressPercent]}
        onValueChange={(values) => {
          setIsSeeking(true)
          seekToPercent(values)
        }}
        onValueCommit={() => setIsSeeking(false)}
        max={100}
        step={0.1}
        className="min-w-0 flex-1"
        aria-label={i18n.t('editor.tts.seek')}
      />
      <span className="shrink-0 select-none font-mono text-[10px] tabular-nums text-muted-foreground">
        {formatTime(currentTime)}
        <span className="text-muted-foreground/40"> / </span>
        {formatTime(duration)}
      </span>
    </div>
  )
})

// fallow-ignore-next-line complexity
export const AiPanel = memo(function AiPanel() {
  const { t } = useTranslation()
  const currentProjectId = useMediaLibraryStore((state) => state.currentProjectId)
  const loadMediaItems = useMediaLibraryStore((state) => state.loadMediaItems)
  const selectMedia = useMediaLibraryStore((state) => state.selectMedia)
  const showNotification = useMediaLibraryStore((state) => state.showNotification)

  const [activeAiSection, setActiveAiSection] = useState<AiSection>('audio-gen')
  const [audioGenProvider, setAudioGenProvider] = useState<AudioGenProvider>('minimax')
  const [audioGenSettingsOpen, setAudioGenSettingsOpen] = useState(false)
  const [genMaxApiKey, setGenMaxApiKey] = useState(() => {
    try {
      return localStorage.getItem('freecut:genmax-api-key') || ''
    } catch {
      return ''
    }
  })
  const [genMaxVoiceCatalog, setGenMaxVoiceCatalog] = useState<AudioGenVoiceCatalog>(() => ({
    elevenlabs: [...DEFAULT_AUDIO_GEN_VOICES.elevenlabs],
    minimax: [...DEFAULT_AUDIO_GEN_VOICES.minimax],
    capcut: [...DEFAULT_AUDIO_GEN_VOICES.capcut],
  }))
  const [audioGenVoice, setAudioGenVoice] = useState(
    () => DEFAULT_AUDIO_GEN_VOICES.minimax[0]?.id || '',
  )
  const [isLoadingAudioGenVoices, setIsLoadingAudioGenVoices] = useState(false)
  const [audioGenVoiceLoadProgress, setAudioGenVoiceLoadProgress] = useState<string | null>(null)
  const [audioGenVoiceError, setAudioGenVoiceError] = useState<string | null>(null)
  const [audioGenVoiceSuccess, setAudioGenVoiceSuccess] = useState<string | null>(null)
  const [audioGenPreviewPlayingId, setAudioGenPreviewPlayingId] = useState<string | null>(null)
  const [audioGenPreviewLoadingId, setAudioGenPreviewLoadingId] = useState<string | null>(null)
  const [voiceLibraryOpen, setVoiceLibraryOpen] = useState(false)
  const audioGenPreviewAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioGenBlobUrlRef = useRef<string | null>(null)

  const handleSelectVoiceFromLibrary = useCallback(
    (voiceId: string, provider: AudioGenProvider, voice: AudioGenVoice) => {
      setAudioGenProvider(provider)
      setAudioGenVoice(voiceId)
      showNotification({
        type: 'success',
        message: `Đã chọn: ${voice.label} (${AUDIO_GEN_PROVIDER_LABELS[provider]})`,
      })
    },
    [showNotification],
  )
  const [ttsText, setTtsText] = useState(() => t('editor.aiPanel.defaultTtsPrompt'))
  const [ttsEngine, setTtsEngine] = useState<StoredTtsEngine>(() => getStoredTtsEngine())
  const [ttsKokoroVoice, setTtsKokoroVoice] = useState<KokoroTtsVoice>('af_heart')
  const [ttsMossVoice, setTtsMossVoice] = useState<MossTtsVoice>('Xiaoyu')
  const [ttsSupertonicVoice, setTtsSupertonicVoice] = useState<SupertonicTtsVoice>('M3')
  const [ttsSupertonicLanguage, setTtsSupertonicLanguage] =
    useState<SupertonicTtsLanguageSelection>('auto')
  const ttsModel: KokoroTtsModel = KOKORO_TTS_BEST_MODEL
  const [ttsSpeed, setTtsSpeed] = useState(1)
  const [isTtsGenerating, setIsTtsGenerating] = useState(false)
  const [ttsProgress, setTtsProgress] = useState<string | null>(null)
  const [ttsError, setTtsError] = useState<string | null>(null)
  const [ttsGenerations, setTtsGenerations] = useState<AudioGeneration[]>([])
  const [ttsSectionOpen, setTtsSectionOpen] = useState(true)

  const [musicPrompt, setMusicPrompt] = useState(() => t(MUSIC_PROMPT_PRESETS[0]!.promptKey))
  const [musicModel] = useState<MusicgenModelId>(DEFAULT_MUSICGEN_MODEL)
  const currentMusicModel = useMemo(() => getMusicgenModelDefinition(musicModel), [musicModel])
  const [musicDuration, setMusicDuration] = useState(currentMusicModel.defaultDurationSeconds)
  const [isMusicGenerating, setIsMusicGenerating] = useState(false)
  const [musicProgress, setMusicProgress] = useState<string | null>(null)
  const [musicError, setMusicError] = useState<string | null>(null)
  const [musicGenerations, setMusicGenerations] = useState<AudioGeneration[]>([])
  const [musicProgressPct, setMusicProgressPct] = useState<number | null>(null)
  const [musicInfoOpen, setMusicInfoOpen] = useState(false)
  const [musicSectionOpen, setMusicSectionOpen] = useState(true)

  const musicAbortRef = useRef<AbortController | null>(null)
  const ttsTextareaRef = useRef<HTMLTextAreaElement>(null)
  const generationUrlsRef = useRef<Set<string>>(new Set())

  // Revoke all blob URLs on unmount
  useEffect(() => {
    setMusicDuration((previous) =>
      Math.min(
        currentMusicModel.maxDurationSeconds,
        Math.max(currentMusicModel.minDurationSeconds, previous),
      ),
    )
  }, [currentMusicModel.maxDurationSeconds, currentMusicModel.minDurationSeconds])

  // Abort in-flight generation and revoke all blob URLs on unmount
  useEffect(() => {
    const urls = generationUrlsRef.current
    return () => {
      musicAbortRef.current?.abort()
      musicAbortRef.current = null
      audioGenPreviewAudioRef.current?.pause()
      audioGenPreviewAudioRef.current = null
      if (audioGenBlobUrlRef.current) {
        URL.revokeObjectURL(audioGenBlobUrlRef.current)
        audioGenBlobUrlRef.current = null
      }
      for (const url of urls) {
        URL.revokeObjectURL(url)
      }
    }
  }, [])

  useEffect(() => {
    setStoredTtsEngine(ttsEngine)
  }, [ttsEngine])

  useEffect(() => {
    let cancelled = false
    void getCachedGenMaxVoiceCatalog().then((catalog) => {
      if (cancelled) return
      setGenMaxVoiceCatalog((current) => ({
        elevenlabs: catalog.elevenlabs.length > 0 ? catalog.elevenlabs : current.elevenlabs,
        minimax: catalog.minimax.length > 0 ? catalog.minimax : current.minimax,
        capcut: catalog.capcut.length > 0 ? catalog.capcut : current.capcut,
      }))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleApiKeyChange = (key: string) => {
    setGenMaxApiKey(key)
  }

  const saveGenMaxApiKey = () => {
    try {
      localStorage.setItem('freecut:genmax-api-key', genMaxApiKey.trim())
      setAudioGenVoiceSuccess('GenMax API key saved on this device.')
      setAudioGenSettingsOpen(false)
    } catch {
      setAudioGenVoiceError('Could not save the GenMax API key on this device.')
    }
  }

  // fallow-ignore-next-line complexity
  const togglePlayVoicePreview = useCallback(
    // fallow-ignore-next-line complexity
    async (voiceItem?: AudioGenVoice) => {
      if (!voiceItem?.previewUrl) {
        showNotification({ type: 'warning', message: 'Giọng này chưa có file nghe thử.' })
        return
      }
      if (audioGenPreviewPlayingId === voiceItem.id || audioGenPreviewLoadingId === voiceItem.id) {
        audioGenPreviewAudioRef.current?.pause()
        setAudioGenPreviewPlayingId(null)
        setAudioGenPreviewLoadingId(null)
        return
      }

      if (audioGenPreviewAudioRef.current) {
        audioGenPreviewAudioRef.current.pause()
        audioGenPreviewAudioRef.current.currentTime = 0
      }
      if (audioGenBlobUrlRef.current) {
        URL.revokeObjectURL(audioGenBlobUrlRef.current)
        audioGenBlobUrlRef.current = null
      }

      setAudioGenPreviewLoadingId(voiceItem.id)
      setAudioGenPreviewPlayingId(null)

      let audio = audioGenPreviewAudioRef.current
      if (!audio) {
        audio = new Audio()
        audioGenPreviewAudioRef.current = audio
      }
      audio.crossOrigin = 'anonymous'

      const rawUrl = voiceItem.previewUrl
      const resolvedUrl = rawUrl.startsWith('https://api.genmax.io')
        ? rawUrl.replace('https://api.genmax.io', '/api/genmax')
        : rawUrl

      audio.onended = () => {
        setAudioGenPreviewPlayingId(null)
        setAudioGenPreviewLoadingId(null)
      }

      try {
        audio.src = resolvedUrl
        await audio.play()
        setAudioGenPreviewLoadingId(null)
        setAudioGenPreviewPlayingId(voiceItem.id)
      } catch (err) {
        try {
          const res = await fetch(resolvedUrl)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const blob = await res.blob()
          const blobUrl = URL.createObjectURL(blob)
          audioGenBlobUrlRef.current = blobUrl
          audio.src = blobUrl
          await audio.play()
          setAudioGenPreviewLoadingId(null)
          setAudioGenPreviewPlayingId(voiceItem.id)
        } catch (fallbackErr) {
          console.error('[VoicePreview] Failed to play preview audio:', fallbackErr || err)
          showNotification({
            type: 'error',
            message: 'Không thể phát file nghe thử mẫu giọng này.',
          })
          setAudioGenPreviewLoadingId(null)
          setAudioGenPreviewPlayingId(null)
        }
      }
    },
    [audioGenPreviewPlayingId, audioGenPreviewLoadingId, showNotification],
  )

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null)

  const handleFileRead = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result
        if (typeof content === 'string') {
          setTtsText(content)
          setLoadedFileName(file.name)
          showNotification({
            type: 'success',
            message: `Đã nạp văn bản từ tệp "${file.name}" (${content.length} ký tự)`,
          })
        }
      }
      reader.onerror = () => {
        showNotification({
          type: 'error',
          message: `Không thể đọc tệp "${file.name}".`,
        })
      }
      reader.readAsText(file, 'utf-8')
    },
    [setTtsText, showNotification],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingFile(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDraggingFile(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDraggingFile(false)
      const files = e.dataTransfer.files
      if (files && files.length > 0) {
        const file = files[0]
        if (file) {
          handleFileRead(file)
        }
      }
    },
    [handleFileRead],
  )

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFileRead(file)
      }
      e.target.value = ''
    },
    [handleFileRead],
  )

  const isKokoroSupported = kokoroTtsService.isSupported()
  const isMossSupported = mossTtsService.isSupported()
  const isSupertonicSupported = supertonicTtsService.isSupported()
  const supportsNativeTtsSpeed =
    ttsEngine === 'kokoro' || ttsEngine === 'supertonic' || ttsEngine === 'genmax'
  const ttsSpeedMin = ttsEngine === 'supertonic' ? 0.8 : 0.5
  const ttsSpeedMax = ttsEngine === 'supertonic' ? 1.3 : 2

  useEffect(() => {
    setTtsSpeed((current) => Math.min(ttsSpeedMax, Math.max(ttsSpeedMin, current)))
  }, [ttsSpeedMax, ttsSpeedMin])

  const effectiveTtsSpeed = supportsNativeTtsSpeed ? ttsSpeed : 1
  const isTtsSupported =
    ttsEngine === 'kokoro'
      ? isKokoroSupported
      : ttsEngine === 'moss'
        ? isMossSupported
        : ttsEngine === 'supertonic'
          ? isSupertonicSupported
          : Boolean(genMaxApiKey.trim())
  const isMusicSupported = musicgenService.isSupported()
  const trimmedTtsText = ttsText.trim()
  const audioGenVoiceOptions = genMaxVoiceCatalog[audioGenProvider]
  const filteredAudioGenVoiceOptions = audioGenVoiceOptions
  const selectedAudioGenVoice = useMemo(
    () =>
      audioGenVoiceOptions.find((voiceOption) => voiceOption.id === audioGenVoice) ??
      audioGenVoiceOptions[0] ??
      ({ id: '', label: 'No voices available' } satisfies AudioGenVoice),
    [audioGenVoiceOptions, audioGenVoice],
  )
  const trimmedMusicPrompt = musicPrompt.trim()

  const loadAllGenMaxVoices = async () => {
    const apiKey = genMaxApiKey.trim()
    if (!apiKey) {
      setAudioGenVoiceError('Enter a GenMax API key to load provider catalogs.')
      return
    }

    setIsLoadingAudioGenVoices(true)
    setAudioGenVoiceError(null)
    setAudioGenVoiceSuccess(null)
    setAudioGenVoiceLoadProgress('Connecting to GenMax...')
    try {
      const catalog = await loadGenMaxVoiceCatalog(apiKey, {
        forceRefresh: true,
        onProgress: (stage) => setAudioGenVoiceLoadProgress(stage),
        onCatalogUpdate: (catalog) => setGenMaxVoiceCatalog(catalog),
      })
      setGenMaxVoiceCatalog(catalog)
      if (catalog[audioGenProvider]?.length > 0) {
        setAudioGenVoice(catalog[audioGenProvider][0]!.id)
      }
      setAudioGenVoiceSuccess(
        `Loaded ${catalog.minimax.length} MiniMax, ${catalog.elevenlabs.length} ElevenLabs, and ${catalog.capcut.length} CapCut voices!`,
      )
    } catch (error) {
      setAudioGenVoiceError(
        error instanceof Error ? error.message : 'Could not load voice catalogs from GenMax.',
      )
    } finally {
      setIsLoadingAudioGenVoices(false)
      setAudioGenVoiceLoadProgress(null)
    }
  }

  const totalTtsBytes = useMemo(
    () => ttsGenerations.reduce((sum, generation) => sum + generation.byteSize, 0),
    [ttsGenerations],
  )

  const totalMusicBytes = useMemo(
    () => musicGenerations.reduce((sum, generation) => sum + generation.byteSize, 0),
    [musicGenerations],
  )

  const anyTtsSaving = ttsGenerations.some((generation) => generation.saving)
  const anyMusicSaving = musicGenerations.some((generation) => generation.saving)
  const text = ttsText
  const setText = setTtsText
  const voice =
    ttsEngine === 'kokoro'
      ? ttsKokoroVoice
      : ttsEngine === 'moss'
        ? ttsMossVoice
        : ttsSupertonicVoice
  const speed = ttsSpeed
  const setSpeed = setTtsSpeed
  const isGenerating = isTtsGenerating
  const progress = ttsProgress
  const error = ttsError
  const generations = ttsGenerations
  const totalBytes = totalTtsBytes
  const anySaving = anyTtsSaving
  const trimmedText = trimmedTtsText
  const currentTtsBackendLabel =
    ttsEngine === 'kokoro'
      ? 'WebGPU'
      : ttsEngine === 'moss'
        ? 'CPU'
        : ttsEngine === 'supertonic'
          ? 'WebGPU/WASM'
          : 'GenMax Cloud API'
  const currentTtsRuntimeLabel =
    ttsEngine === 'kokoro'
      ? 'Kokoro TTS Best'
      : ttsEngine === 'moss'
        ? 'MOSS Nano'
        : ttsEngine === 'supertonic'
          ? 'Supertonic 3'
          : `GenMax (${AUDIO_GEN_PROVIDER_LABELS[audioGenProvider]})`

  // --- actions ---

  const handleTtsGenerate = useCallback(async () => {
    if (!currentProjectId) {
      setTtsError(t('editor.tts.errors.openProject'))
      return
    }
    if (!trimmedTtsText) {
      setTtsError(t('editor.tts.errors.enterText'))
      return
    }
    if (ttsEngine === 'genmax' && !genMaxApiKey.trim()) {
      setAudioGenVoiceError('Please enter your GenMax API key in Audio Gen.')
      setTtsError('Please enter your GenMax API key (xi-api-key).')
      return
    }
    if (!isTtsSupported) {
      setTtsError(
        ttsEngine === 'kokoro'
          ? t('editor.tts.errors.kokoroUnsupported')
          : ttsEngine === 'moss'
            ? t('editor.tts.errors.mossUnsupported')
            : ttsEngine === 'supertonic'
              ? t('editor.tts.errors.supertonicUnsupported', {
                  defaultValue:
                    'This browser cannot run the local Supertonic TTS runtime. Try a recent Chrome or Edge browser.',
                })
              : 'GenMax API key is required.',
      )
      return
    }

    setTtsError(null)
    setIsTtsGenerating(true)
    setTtsProgress(t('editor.tts.progressPreparing'))

    try {
      const result =
        ttsEngine === 'kokoro'
          ? await kokoroTtsService.generateSpeechFile({
              text: trimmedTtsText,
              voice: ttsKokoroVoice,
              speed: effectiveTtsSpeed,
              model: ttsModel,
              onProgress: setTtsProgress,
            })
          : ttsEngine === 'moss'
            ? await mossTtsService.generateSpeechFile({
                text: trimmedTtsText,
                voice: ttsMossVoice,
                speed: effectiveTtsSpeed,
                onProgress: setTtsProgress,
              })
            : ttsEngine === 'supertonic'
              ? await supertonicTtsService.generateSpeechFile({
                  text: trimmedTtsText,
                  voice: ttsSupertonicVoice,
                  language: ttsSupertonicLanguage,
                  speed: effectiveTtsSpeed,
                  onProgress: setTtsProgress,
                })
              : await generateGenMaxSpeechFile({
                  apiKey: genMaxApiKey,
                  provider: audioGenProvider,
                  voiceId: selectedAudioGenVoice.id,
                  voiceName: selectedAudioGenVoice.label,
                  text: trimmedTtsText,
                  speed: effectiveTtsSpeed,
                  onProgress: setTtsProgress,
                })

      const { blob, file, duration } = result

      const objectUrl = URL.createObjectURL(blob)
      generationUrlsRef.current.add(objectUrl)
      const voiceLabel =
        ttsEngine === 'kokoro'
          ? getKokoroTtsVoiceOption(ttsKokoroVoice).label
          : ttsEngine === 'moss'
            ? getMossTtsVoiceOption(ttsMossVoice).label
            : ttsEngine === 'supertonic'
              ? (SUPERTONIC_TTS_VOICE_OPTIONS.find((option) => option.value === ttsSupertonicVoice)
                  ?.label ?? ttsSupertonicVoice)
              : selectedAudioGenVoice.label
      const modelLabel =
        ttsEngine === 'kokoro'
          ? getKokoroTtsModelOption(ttsModel).label
          : ttsEngine === 'moss'
            ? 'Multilingual Nano'
            : ttsEngine === 'supertonic'
              ? 'Supertonic 3'
              : `${AUDIO_GEN_PROVIDER_LABELS[audioGenProvider]} (GenMax)`
      const engineTags =
        ttsEngine === 'kokoro'
          ? [
              'ai-generated',
              'kokoro-tts',
              'tts-engine:kokoro',
              `kokoro-quality:${ttsModel}`,
              `kokoro-voice:${ttsKokoroVoice}`,
            ]
          : ttsEngine === 'moss'
            ? ['ai-generated', 'moss-tts', 'tts-engine:moss', `moss-voice:${ttsMossVoice}`]
            : ttsEngine === 'supertonic'
              ? [
                  'ai-generated',
                  'supertonic-tts',
                  'tts-engine:supertonic',
                  `supertonic-voice:${ttsSupertonicVoice}`,
                ]
              : [
                  'ai-generated',
                  'genmax-tts',
                  'tts-engine:genmax',
                  `genmax-provider:${audioGenProvider}`,
                  `genmax-voice:${selectedAudioGenVoice.id}`,
                ]

      const generation: AudioGeneration = {
        id: crypto.randomUUID(),
        file,
        objectUrl,
        byteSize: blob.size,
        duration,
        textSnippet: trimmedTtsText,
        voice: voiceLabel,
        model: modelLabel,
        summary: trimmedTtsText,
        details: `${voiceLabel} / ${modelLabel} / ${duration > 0 ? `${duration.toFixed(1)}s` : '-'} / ${formatBytes(blob.size)}`,
        tags: engineTags,
        savedMediaId: null,
        saving: false,
      }

      setTtsGenerations((prev) => [generation, ...prev])
      setTtsProgress(null)
    } catch (generationError) {
      setTtsError(
        generationError instanceof Error
          ? generationError.message
          : t('editor.tts.errors.generateFailed'),
      )
      setTtsProgress(null)
    } finally {
      setIsTtsGenerating(false)
    }
  }, [
    audioGenProvider,
    currentProjectId,
    effectiveTtsSpeed,
    genMaxApiKey,
    isTtsSupported,
    selectedAudioGenVoice,
    trimmedTtsText,
    ttsEngine,
    ttsKokoroVoice,
    ttsModel,
    ttsMossVoice,
    ttsSupertonicLanguage,
    ttsSupertonicVoice,
    t,
  ])

  const handleMusicGenerate = useCallback(async () => {
    if (!currentProjectId) return null
    if (!trimmedMusicPrompt) {
      setMusicError(t('editor.aiPanel.errors.describeMusic'))
      return null
    }
    if (!isMusicSupported) {
      setMusicError(t('editor.aiPanel.errors.musicgenUnsupported'))
      return null
    }

    const abortController = new AbortController()
    musicAbortRef.current = abortController

    setMusicError(null)
    setIsMusicGenerating(true)
    setMusicProgress(t('editor.aiPanel.progressPreparingMusic'))
    setMusicProgressPct(null)

    try {
      const { blob, file, duration } = await musicgenService.generateMusicFile({
        prompt: trimmedMusicPrompt,
        model: musicModel,
        durationSeconds: musicDuration,
        onProgress: (stage, fraction) => {
          setMusicProgress(stage)
          setMusicProgressPct(fraction ?? null)
        },
        signal: abortController.signal,
      })

      const objectUrl = URL.createObjectURL(blob)
      generationUrlsRef.current.add(objectUrl)

      const modelLabel =
        MUSICGEN_MODEL_OPTIONS.find((option) => option.value === musicModel)?.label ?? musicModel
      const generation: AudioGeneration = {
        id: crypto.randomUUID(),
        file,
        objectUrl,
        byteSize: blob.size,
        duration,
        textSnippet: trimmedMusicPrompt,
        voice: modelLabel,
        model: `target ${musicDuration}s`,
        summary: trimmedMusicPrompt,
        details: `${modelLabel} / target ${musicDuration}s / ${duration > 0 ? `${duration.toFixed(1)}s` : '-'} / ${formatBytes(blob.size)}`,
        tags: [
          'ai-generated',
          'musicgen',
          `musicgen-model:${musicModel}`,
          `musicgen-target:${musicDuration}s`,
        ],
        savedMediaId: null,
        saving: false,
      }

      setMusicGenerations((prev) => [generation, ...prev])
    } catch (generationError) {
      if (generationError instanceof DOMException && generationError.name === 'AbortError') {
        // Intentional cancellation — no error shown.
      } else {
        setMusicError(
          generationError instanceof Error
            ? generationError.message
            : t('editor.aiPanel.errors.generateMusicFailed'),
        )
      }
    } finally {
      musicAbortRef.current = null
      setIsMusicGenerating(false)
      setMusicProgress(null)
      setMusicProgressPct(null)
    }
  }, [currentProjectId, trimmedMusicPrompt, isMusicSupported, musicModel, musicDuration, t])

  const handleMusicCancel = useCallback(() => {
    musicAbortRef.current?.abort()
  }, [])

  const updateGenerationInList = useCallback(
    (
      setGenerations: Dispatch<SetStateAction<AudioGeneration[]>>,
      id: string,
      patch: Partial<AudioGeneration>,
    ) => {
      setGenerations((prev) =>
        prev.map((generation) => (generation.id === id ? { ...generation, ...patch } : generation)),
      )
    },
    [],
  )

  const saveGeneration = useCallback(
    async (
      generation: AudioGeneration,
      setGenerations: Dispatch<SetStateAction<AudioGeneration[]>>,
      setError: Dispatch<SetStateAction<string | null>>,
    ): Promise<MediaMetadata | null> => {
      if (!currentProjectId) return null
      updateGenerationInList(setGenerations, generation.id, { saving: true })

      try {
        const { mediaLibraryService } = await importMediaLibraryService()
        const media = await mediaLibraryService.importGeneratedAudio(
          generation.file,
          currentProjectId,
          {
            tags: generation.tags,
          },
        )

        await loadMediaItems()
        selectMedia([media.id])
        // Remove from tracked URLs so unmount cleanup won't revoke a URL
        // that may be referenced by a timeline item's src
        generationUrlsRef.current.delete(generation.objectUrl)
        updateGenerationInList(setGenerations, generation.id, {
          saving: false,
          savedMediaId: media.id,
        })
        return media
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : t('editor.aiPanel.errors.saveAudioFailed'),
        )
        updateGenerationInList(setGenerations, generation.id, { saving: false })
        return null
      }
    },
    [currentProjectId, loadMediaItems, selectMedia, t, updateGenerationInList],
  )

  const handleSave = useCallback(
    async (
      generation: AudioGeneration,
      setGenerations: Dispatch<SetStateAction<AudioGeneration[]>>,
      setError: Dispatch<SetStateAction<string | null>>,
    ) => {
      const media = await saveGeneration(generation, setGenerations, setError)
      if (media) {
        showNotification({
          type: 'success',
          message: t('editor.aiPanel.notifications.savedToLibrary', {
            fileName: media.fileName,
          }),
        })
      }
    },
    [saveGeneration, showNotification, t],
  )

  const handleSaveAndInsert = useCallback(
    async (
      generation: AudioGeneration,
      setGenerations: Dispatch<SetStateAction<AudioGeneration[]>>,
      setError: Dispatch<SetStateAction<string | null>>,
    ) => {
      // Saving is asynchronous, so capture the user's intended insertion point
      // when they click rather than after the media import finishes.
      const insertionFrame = usePlaybackStore.getState().currentFrame
      const media = await saveGeneration(generation, setGenerations, setError)
      if (!media) return

      const inserted = insertGeneratedAudioOnNewTrack(media, generation.objectUrl, insertionFrame)
      showNotification({
        type: inserted ? 'success' : 'warning',
        message: inserted
          ? t('editor.aiPanel.notifications.savedAndAdded', { fileName: media.fileName })
          : t('editor.tts.notifications.savedNoTrack', { fileName: media.fileName }),
      })
    },
    [saveGeneration, showNotification, t],
  )

  const removeGenerationFromList = useCallback(
    (setGenerations: Dispatch<SetStateAction<AudioGeneration[]>>, id: string) => {
      setGenerations((prev) => {
        const generation = prev.find((entry) => entry.id === id)
        if (generation) {
          // Only revoke the blob URL if it has not been saved; saved items may
          // have their blob URL referenced by a timeline audio item's `src`.
          if (!generation.savedMediaId) {
            URL.revokeObjectURL(generation.objectUrl)
            generationUrlsRef.current.delete(generation.objectUrl)
          }
        }
        return prev.filter((entry) => entry.id !== id)
      })
    },
    [],
  )

  const clearGenerationList = useCallback(
    (setGenerations: Dispatch<SetStateAction<AudioGeneration[]>>) => {
      // Only revoke blob URLs for unsaved generations; saved ones may be
      // referenced by timeline items.
      setGenerations((prev) => {
        for (const generation of prev) {
          if (!generation.savedMediaId) {
            URL.revokeObjectURL(generation.objectUrl)
            generationUrlsRef.current.delete(generation.objectUrl)
          }
        }
        return []
      })
    },
    [],
  )

  const handleSaveTtsGeneration = useCallback(
    (generation: AudioGeneration) => handleSave(generation, setTtsGenerations, setTtsError),
    [handleSave],
  )
  const handleSaveAndInsertTtsGeneration = useCallback(
    (generation: AudioGeneration) =>
      handleSaveAndInsert(generation, setTtsGenerations, setTtsError),
    [handleSaveAndInsert],
  )
  const handleGenerate = handleTtsGenerate
  const handleClearAll = () => clearGenerationList(setTtsGenerations)
  const handleRemoveGeneration = (id: string) => removeGenerationFromList(setTtsGenerations, id)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <div className="space-y-3">
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-border/70 bg-secondary/20 p-1">
          {[
            { id: 'audio-gen' as const, label: 'Audio Gen', icon: WandSparkles },
            { id: 'tts' as const, label: 'Text to Speech', icon: ListPlus },
            { id: 'music' as const, label: 'Music Generation', icon: Play },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveAiSection(id)}
              aria-pressed={activeAiSection === id}
              className={cn(
                'flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium transition-colors',
                activeAiSection === id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {activeAiSection === 'audio-gen' && (
          <section className="space-y-3 rounded-lg border border-border bg-secondary/20 p-3">
            {/* Top Toolbar: Voice Selector + Preview + Load Voices + Settings */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-foreground tracking-wide flex items-center gap-1.5">
                  <Mic className="h-3.5 w-3.5 text-primary" />
                  <span>Giọng đọc đang chọn</span>
                </span>
                <button
                  type="button"
                  onClick={() => setVoiceLibraryOpen(true)}
                  className="text-[10px] text-primary hover:underline font-medium"
                >
                  Mở thư viện giọng &rarr;
                </button>
              </div>

              <div className="flex items-stretch gap-1.5">
                {/* Clickable Voice Info Card (Opens Voice Library Dialog) */}
                <button
                  type="button"
                  onClick={() => setVoiceLibraryOpen(true)}
                  className="group relative flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-border/80 bg-secondary/50 p-2 text-left transition-all hover:border-primary/60 hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
                  title="Nhấp để đổi giọng đọc hoặc mở Thư viện giọng nói"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                      {selectedAudioGenVoice.label || 'Chọn giọng đọc...'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {selectedAudioGenVoice.language && (
                        <span className="rounded bg-sky-950/70 border border-sky-800/40 px-1.5 py-0.2 text-[9px] font-medium text-sky-300">
                          {selectedAudioGenVoice.language}
                        </span>
                      )}
                      {selectedAudioGenVoice.gender && (
                        <span className="rounded bg-zinc-800 px-1.5 py-0.2 text-[9px] text-zinc-300">
                          {selectedAudioGenVoice.gender}
                        </span>
                      )}
                      <span className="rounded bg-primary/10 border border-primary/20 px-1.5 py-0.2 font-mono text-[9px] text-primary">
                        {AUDIO_GEN_PROVIDER_LABELS[audioGenProvider]}
                      </span>
                    </div>
                  </div>
                  <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>

                {/* Preview Button (Nghe thử / Dừng) */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    !selectedAudioGenVoice.previewUrl ||
                    Boolean(
                      audioGenPreviewLoadingId &&
                      audioGenPreviewLoadingId !== selectedAudioGenVoice.id,
                    )
                  }
                  onClick={() => void togglePlayVoicePreview(selectedAudioGenVoice)}
                  className={cn(
                    'h-auto min-h-[46px] shrink-0 gap-1.5 px-3 text-xs font-medium transition-colors shadow-sm',
                    audioGenPreviewPlayingId === selectedAudioGenVoice.id
                      ? 'border-red-500/50 bg-red-500/20 text-red-300 hover:bg-red-500/30'
                      : audioGenPreviewLoadingId === selectedAudioGenVoice.id
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                        : 'border-border bg-secondary/50 text-foreground hover:bg-secondary/80 hover:border-primary/50',
                  )}
                  title={
                    selectedAudioGenVoice.previewUrl
                      ? 'Nghe thử mẫu giọng'
                      : 'Giọng này chưa có file nghe thử'
                  }
                >
                  {audioGenPreviewLoadingId === selectedAudioGenVoice.id ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                      <span className="text-[11px]">Đang tải...</span>
                    </>
                  ) : audioGenPreviewPlayingId === selectedAudioGenVoice.id ? (
                    <>
                      <Pause className="h-3.5 w-3.5 text-red-400" />
                      <span className="text-[11px]">Dừng</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 text-primary ml-0.5" />
                      <span className="text-[11px]">Nghe thử</span>
                    </>
                  )}
                </Button>

                {/* Settings Button */}
                <Button
                  type="button"
                  size="icon"
                  variant={audioGenSettingsOpen ? 'default' : 'outline'}
                  className={cn(
                    'h-auto min-h-[46px] w-9 shrink-0 border-border transition-colors',
                    audioGenSettingsOpen
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/50 hover:bg-secondary/80 hover:border-primary/50 text-foreground',
                  )}
                  onClick={() => setAudioGenSettingsOpen((open) => !open)}
                  title="Cài đặt GenMax API Key & Tải giọng"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>

              {/* Status indicator for voice loading when settings is closed */}
              {audioGenVoiceLoadProgress && !audioGenSettingsOpen && (
                <p className="flex items-center gap-1.5 text-[11px] text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>{audioGenVoiceLoadProgress}</span>
                </p>
              )}
            </div>

            {/* GenMax API Key & Voice Sync Settings Panel */}
            {audioGenSettingsOpen && (
              <div className="space-y-2.5 rounded-lg border border-primary/30 bg-primary/5 p-3 animate-in fade-in-0 duration-150">
                <div className="flex items-center justify-between gap-2">
                  <Label
                    htmlFor="ai-genmax-api-key"
                    className="text-[11px] font-semibold text-foreground"
                  >
                    GenMax API Key (xi-api-key)
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={saveGenMaxApiKey}
                  >
                    Lưu trên máy
                  </Button>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Lưu trên trình duyệt / thiết bị này</span>
                  <a
                    href="https://genmax.io/docs"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-2 hover:opacity-80"
                  >
                    genmax.io/docs
                  </a>
                </div>
                <input
                  id="ai-genmax-api-key"
                  type="password"
                  value={genMaxApiKey}
                  onChange={(event) => handleApiKeyChange(event.target.value)}
                  placeholder="sk_..."
                  autoComplete="off"
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground"
                />

                {/* Load Voices Button inside Settings */}
                <div className="border-t border-border/40 pt-2 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-foreground">
                      Kho giọng (
                      {genMaxVoiceCatalog.minimax.length +
                        genMaxVoiceCatalog.elevenlabs.length +
                        genMaxVoiceCatalog.capcut.length}{' '}
                      giọng)
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1.5 px-2.5 text-[11px] font-medium border-border hover:border-primary/50"
                      onClick={() => void loadAllGenMaxVoices()}
                      disabled={isLoadingAudioGenVoices || !genMaxApiKey.trim()}
                      title={
                        genMaxApiKey.trim()
                          ? 'Tải lại danh sách giọng từ GenMax API'
                          : 'Vui lòng nhập API Key phía trên để tải giọng'
                      }
                    >
                      {isLoadingAudioGenVoices ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                          <span>Đang tải...</span>
                        </>
                      ) : (
                        <>
                          <RotateCw className="h-3.5 w-3.5 text-primary" />
                          <span>Tải danh sách giọng</span>
                        </>
                      )}
                    </Button>
                  </div>

                  {audioGenVoiceLoadProgress && (
                    <p className="flex items-center gap-1.5 text-[11px] text-primary">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>{audioGenVoiceLoadProgress}</span>
                    </p>
                  )}
                  {audioGenVoiceSuccess && (
                    <p className="text-[10px] text-emerald-400">{audioGenVoiceSuccess}</p>
                  )}
                  {audioGenVoiceError && (
                    <p className="text-[10px] text-destructive">{audioGenVoiceError}</p>
                  )}
                </div>
              </div>
            )}

            {/* Prompt Text / Script with Drag & Drop */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                'relative space-y-1.5 rounded-lg border transition-all p-2.5',
                isDraggingFile
                  ? 'border-primary border-dashed bg-primary/10 ring-2 ring-primary/30'
                  : 'border-border/70 bg-secondary/30',
              )}
            >
              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.markdown,.srt,.vtt,.json,.text"
                onChange={handleFileInputChange}
                className="hidden"
              />

              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                  <Label
                    htmlFor="ai-audio-gen-prompt-text"
                    className="text-[11px] font-semibold text-foreground truncate"
                  >
                    Văn bản đọc (Kịch bản)
                  </Label>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Upload file button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-6 gap-1 px-1.5 text-[10px] text-primary hover:text-primary hover:bg-primary/10"
                    title="Mở tệp .txt, .md, .srt từ máy tính"
                  >
                    <Upload className="h-3 w-3" />
                    <span>Tải tệp</span>
                  </Button>

                  {text.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setText('')
                        setLoadedFileName(null)
                      }}
                      className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
                      title="Xóa văn bản"
                    >
                      Xóa
                    </Button>
                  )}

                  <span className="font-mono text-[10px] text-muted-foreground">
                    {text.length} ký tự
                  </span>
                </div>
              </div>

              {loadedFileName && (
                <div className="flex items-center justify-between rounded bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] text-primary">
                  <span className="truncate">Tệp: {loadedFileName}</span>
                  <button
                    type="button"
                    onClick={() => setLoadedFileName(null)}
                    className="text-muted-foreground hover:text-primary ml-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              <Textarea
                id="ai-audio-gen-prompt-text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Nhập nội dung cần đọc hoặc kéo thả tệp .txt, .md, .srt vào đây..."
                className="min-h-24 resize-y bg-background/60 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/70"
                disabled={isGenerating}
              />

              {isDraggingFile && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-lg bg-background/90 backdrop-blur-sm pointer-events-none">
                  <Upload className="h-6 w-6 text-primary animate-bounce" />
                  <p className="text-xs font-semibold text-primary">
                    Thả tệp .txt, .md, .srt để nạp văn bản
                  </p>
                </div>
              )}
            </div>

            {/* Speed slider */}
            <div>
              <SliderInput
                label={t('editor.tts.speed')}
                value={speed}
                onChange={setSpeed}
                min={0.5}
                max={2}
                step={0.05}
                unit="x"
                disabled={isGenerating}
              />
            </div>

            {/* Action Row */}
            <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2.5">
              <span className="text-[10px] text-muted-foreground">
                {trimmedText ? `${trimmedText.length} ký tự` : 'Chưa nhập văn bản'}
              </span>
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold bg-gradient-to-r from-primary to-orange-600 hover:from-primary/90 hover:to-orange-500 shadow-sm"
                onClick={() => {
                  setTtsEngine('genmax')
                  void handleGenerate()
                }}
                disabled={isGenerating || !trimmedText || !currentProjectId || !genMaxApiKey.trim()}
              >
                {isGenerating && ttsEngine === 'genmax' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <WandSparkles className="h-3.5 w-3.5" />
                )}
                {isGenerating && ttsEngine === 'genmax'
                  ? 'Đang tạo âm thanh...'
                  : 'Generate with Audio Gen'}
              </Button>
            </div>

            {/* In-tab Progress & Errors */}
            {progress && ttsEngine === 'genmax' && (
              <div className="mt-2.5 rounded-lg border border-primary/30 bg-primary/10 p-2.5 text-xs text-primary flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                <span>{progress}</span>
              </div>
            )}

            {error && ttsEngine === 'genmax' && (
              <div className="mt-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                {error}
              </div>
            )}

            {/* Generations History */}
            {generations.length > 0 && (
              <div className="mt-3.5 space-y-2 border-t border-border/40 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Lịch sử ({generations.length})
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-2 text-[11px] text-muted-foreground"
                    onClick={handleClearAll}
                    disabled={anySaving}
                  >
                    <Trash2 className="h-3 w-3" />
                    {t('editor.aiPanel.clearAll')}
                  </Button>
                </div>

                <div className="space-y-2">
                  {generations.map((gen) => (
                    <GenerationRow
                      key={gen.id}
                      generation={gen}
                      onSave={handleSaveTtsGeneration}
                      onSaveAndInsert={handleSaveAndInsertTtsGeneration}
                      onRemove={handleRemoveGeneration}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
        {activeAiSection === 'tts' && (
          <Collapsible open={ttsSectionOpen} onOpenChange={setTtsSectionOpen}>
            <div className="-mx-3 -mt-3 bg-secondary/50 px-3 py-2">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 text-left"
                  aria-label={
                    ttsSectionOpen
                      ? t('editor.aiPanel.collapseTextToSpeech')
                      : t('editor.aiPanel.expandTextToSpeech')
                  }
                >
                  <h2 className="text-sm font-medium">{t('editor.aiPanel.textToSpeech')}</h2>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-muted-foreground transition-transform',
                      ttsSectionOpen && 'rotate-180',
                    )}
                  />
                </button>
              </CollapsibleTrigger>
            </div>

            <CollapsibleContent className="space-y-4 pt-3">
              {!isTtsSupported && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                  {ttsEngine === 'kokoro'
                    ? t('editor.tts.kokoroUnsupported')
                    : ttsEngine === 'moss'
                      ? t('editor.tts.mossUnsupported')
                      : t('editor.tts.supertonicUnsupported', {
                          defaultValue:
                            'This browser cannot run the local Supertonic TTS runtime. Try a recent Chrome or Edge browser.',
                        })}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="ai-tts-text">{t('editor.tts.text')}</Label>
                <Textarea
                  ref={ttsTextareaRef}
                  id="ai-tts-text"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={t('editor.tts.textPlaceholder')}
                  className="min-h-24 resize-y bg-secondary/30 text-sm"
                  disabled={isGenerating}
                />
                {ttsEngine === 'supertonic' && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">
                      {t('editor.tts.expressiveTags', { defaultValue: 'Expressive tags' })}
                    </span>
                    {SUPERTONIC_TTS_EXPRESSIVE_TAG_OPTIONS.map((tag) => (
                      <Button
                        key={tag.value}
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-6 px-2 text-[11px]"
                        onClick={() =>
                          insertTextAtCursor({
                            input: ttsTextareaRef.current,
                            insertText: tag.value,
                            setText,
                            text,
                          })
                        }
                        disabled={isGenerating}
                      >
                        {tag.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>{t('editor.tts.engine')}</Label>
                  <Select
                    value={ttsEngine}
                    onValueChange={(value) => setTtsEngine(value as StoredTtsEngine)}
                    disabled={isGenerating}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kokoro" className="text-xs">
                        {t('editor.tts.kokoroOption')}
                      </SelectItem>
                      <SelectItem value="moss" className="text-xs">
                        {t('editor.tts.mossOption')}
                      </SelectItem>
                      <SelectItem value="supertonic" className="text-xs">
                        {t('editor.tts.supertonicOption', {
                          defaultValue: 'Supertonic 3 (31 languages, local ONNX)',
                        })}
                      </SelectItem>
                      <SelectItem value="genmax" className="text-xs">
                        Audio Gen (ElevenLabs, MiniMax, CapCut via GenMax)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t('editor.tts.voice')}</Label>
                    {ttsEngine === 'genmax' ? (
                      <div className="flex items-center gap-1.5">
                        <Select
                          value={selectedAudioGenVoice.id}
                          onValueChange={(val) => setAudioGenVoice(val)}
                          disabled={isGenerating}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {filteredAudioGenVoiceOptions.map((v) => (
                              <SelectItem key={v.id} value={v.id} className="text-xs">
                                {v.label} {v.language ? `[${v.language}]` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedAudioGenVoice.previewUrl && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 shrink-0 p-0"
                            onClick={() => togglePlayVoicePreview(selectedAudioGenVoice)}
                            title="Preview Voice Sample"
                          >
                            {audioGenPreviewPlayingId === selectedAudioGenVoice.id ? (
                              <Pause className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <Play className="h-3.5 w-3.5 text-primary ml-px" />
                            )}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <Select
                        value={voice}
                        onValueChange={(value) => {
                          if (ttsEngine === 'kokoro') {
                            setTtsKokoroVoice(value as KokoroTtsVoice)
                          } else if (ttsEngine === 'moss') {
                            setTtsMossVoice(value as MossTtsVoice)
                          } else {
                            setTtsSupertonicVoice(value as SupertonicTtsVoice)
                          }
                        }}
                        disabled={isGenerating}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {(ttsEngine === 'kokoro'
                            ? KOKORO_TTS_VOICE_OPTIONS
                            : ttsEngine === 'moss'
                              ? MOSS_TTS_VOICE_OPTIONS
                              : SUPERTONIC_TTS_VOICE_OPTIONS
                          ).map((option) => (
                            <SelectItem key={option.value} value={option.value} className="text-xs">
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  {ttsEngine === 'supertonic' && (
                    <div className="space-y-1.5">
                      <Label>{t('editor.tts.language', { defaultValue: 'Language' })}</Label>
                      <Select
                        value={ttsSupertonicLanguage}
                        onValueChange={(value) =>
                          setTtsSupertonicLanguage(value as SupertonicTtsLanguageSelection)
                        }
                        disabled={isGenerating}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {SUPERTONIC_TTS_LANGUAGE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value} className="text-xs">
                              {getLanguageDisplayName(
                                option.value,
                                option.label,
                                i18n.language,
                                t('editor.tts.autoDetectLanguage', {
                                  defaultValue: 'Auto detect',
                                }),
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {supportsNativeTtsSpeed && (
                  <SliderInput
                    label={t('editor.tts.speed')}
                    value={speed}
                    onChange={setSpeed}
                    min={ttsSpeedMin}
                    max={ttsSpeedMax}
                    step={0.05}
                    unit="x"
                    disabled={isGenerating}
                  />
                )}
                <Button
                  size="sm"
                  onClick={() => {
                    void handleGenerate()
                  }}
                  disabled={isGenerating || !trimmedText || !currentProjectId || !isTtsSupported}
                  className="h-7 shrink-0 gap-1.5"
                >
                  {isGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <WandSparkles className="h-3.5 w-3.5" />
                  )}
                  {isGenerating ? t('editor.tts.generating') : t('editor.tts.generate')}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t('editor.aiPanel.runsLocally', {
                  runtime: currentTtsRuntimeLabel,
                  backend: currentTtsBackendLabel,
                })}
              </p>

              {progress && (
                <div className="rounded-lg border border-border bg-secondary/20 p-3 text-xs text-muted-foreground">
                  {progress}
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  {error}
                </div>
              )}

              {generations.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t('editor.aiPanel.history', {
                        count: generations.length,
                        size: formatBytes(totalBytes),
                      })}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 px-2 text-[11px] text-muted-foreground"
                      onClick={handleClearAll}
                      disabled={anySaving}
                    >
                      <Trash2 className="h-3 w-3" />
                      {t('editor.aiPanel.clearAll')}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {generations.map((gen) => (
                      <GenerationRow
                        key={gen.id}
                        generation={gen}
                        onSave={handleSaveTtsGeneration}
                        onSaveAndInsert={handleSaveAndInsertTtsGeneration}
                        onRemove={handleRemoveGeneration}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {activeAiSection === 'music' && (
          <Collapsible open={musicSectionOpen} onOpenChange={setMusicSectionOpen}>
            <div className="-mx-3 bg-secondary/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex flex-1 items-center justify-between gap-2 text-left"
                    aria-label={
                      musicSectionOpen
                        ? t('editor.aiPanel.collapseMusicGeneration')
                        : t('editor.aiPanel.expandMusicGeneration')
                    }
                  >
                    <h2 className="text-sm font-medium">{t('editor.aiPanel.musicGeneration')}</h2>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform',
                        musicSectionOpen && 'rotate-180',
                      )}
                    />
                  </button>
                </CollapsibleTrigger>
                <Popover open={musicInfoOpen} onOpenChange={setMusicInfoOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                      aria-label={t('editor.aiPanel.musicGenerationInfo')}
                      onMouseEnter={() => setMusicInfoOpen(true)}
                      onMouseLeave={() => setMusicInfoOpen(false)}
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom"
                    align="start"
                    className="w-72 space-y-2 p-3 text-xs"
                    onMouseEnter={() => setMusicInfoOpen(true)}
                    onMouseLeave={() => setMusicInfoOpen(false)}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        WebGPU
                      </span>
                      <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        Local
                      </span>
                    </div>
                    <p className="leading-relaxed text-muted-foreground">
                      {t('editor.aiPanel.musicgenDescription')}
                    </p>
                    <table className="w-full text-[11px]">
                      <tbody>
                        {MUSICGEN_MODEL_OPTIONS.map((option) => (
                          <tr key={option.value} className="border-t border-border/50">
                            <td className="py-1 pr-2 font-medium text-foreground">
                              {option.label}
                            </td>
                            <td className="py-1 text-right text-muted-foreground">
                              {option.downloadLabel}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="leading-relaxed text-muted-foreground">
                      {t('editor.aiPanel.musicgenPromptHint')}
                    </p>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <CollapsibleContent className="space-y-4 pt-3">
              {!isMusicSupported && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                  {t('editor.aiPanel.musicgenUnsupported')}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ai-music-prompt">{t('editor.aiPanel.prompt')}</Label>
                  <Select
                    value=""
                    onValueChange={(value) => setMusicPrompt(value)}
                    disabled={isMusicGenerating}
                  >
                    <SelectTrigger className="h-6 w-auto gap-1 border-none bg-transparent px-1.5 text-[11px] text-muted-foreground shadow-none hover:text-foreground">
                      <SelectValue placeholder={t('editor.aiPanel.presets')} />
                    </SelectTrigger>
                    <SelectContent align="end">
                      {MUSIC_PROMPT_PRESETS.map((preset) => (
                        <SelectItem
                          key={preset.labelKey}
                          value={t(preset.promptKey)}
                          className="text-xs"
                        >
                          {t(preset.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  id="ai-music-prompt"
                  value={musicPrompt}
                  onChange={(event) => setMusicPrompt(event.target.value)}
                  placeholder={t('editor.aiPanel.musicPromptPlaceholder')}
                  className="min-h-24 resize-y bg-secondary/30 text-sm"
                  disabled={isMusicGenerating}
                />
              </div>

              <div className="flex items-center gap-2">
                <SliderInput
                  label={t('editor.aiPanel.length')}
                  value={musicDuration}
                  onChange={(value) => setMusicDuration(Math.round(value))}
                  min={currentMusicModel.minDurationSeconds}
                  max={currentMusicModel.maxDurationSeconds}
                  step={1}
                  unit="s"
                  disabled={isMusicGenerating}
                />
                {isMusicGenerating && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMusicCancel}
                    className="h-7 shrink-0 gap-1.5 text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                    {t('common.cancel')}
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => {
                    void handleMusicGenerate()
                  }}
                  disabled={
                    isMusicGenerating ||
                    !trimmedMusicPrompt ||
                    !currentProjectId ||
                    !isMusicSupported
                  }
                  className="h-7 shrink-0 gap-1.5"
                >
                  {isMusicGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <WandSparkles className="h-3.5 w-3.5" />
                  )}
                  {isMusicGenerating ? t('editor.tts.generating') : t('editor.tts.generate')}
                </Button>
              </div>

              {musicProgress && (
                <div className="space-y-2 rounded-lg border border-border bg-secondary/20 p-3">
                  <p className="text-xs text-muted-foreground">{musicProgress}</p>
                  {musicProgressPct != null && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300 ease-linear"
                        style={{ width: `${Math.round(musicProgressPct * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {musicError && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  {musicError}
                </div>
              )}

              {musicGenerations.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t('editor.aiPanel.musicHistory', {
                        count: musicGenerations.length,
                        size: formatBytes(totalMusicBytes),
                      })}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 px-2 text-[11px] text-muted-foreground"
                      onClick={() => clearGenerationList(setMusicGenerations)}
                      disabled={anyMusicSaving}
                    >
                      <Trash2 className="h-3 w-3" />
                      {t('editor.aiPanel.clearAll')}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {musicGenerations.map((generation) => (
                      <GenerationRow
                        key={generation.id}
                        generation={generation}
                        onSave={(entry) => handleSave(entry, setMusicGenerations, setMusicError)}
                        onSaveAndInsert={(entry) =>
                          handleSaveAndInsert(entry, setMusicGenerations, setMusicError)
                        }
                        onRemove={(id) => removeGenerationFromList(setMusicGenerations, id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      <VoiceLibraryDialog
        open={voiceLibraryOpen}
        onOpenChange={setVoiceLibraryOpen}
        selectedVoiceId={audioGenVoice}
        selectedProvider={audioGenProvider}
        onSelectVoice={handleSelectVoiceFromLibrary}
        voiceCatalog={genMaxVoiceCatalog}
        onReloadVoices={loadAllGenMaxVoices}
        isLoadingVoices={isLoadingAudioGenVoices}
        hasApiKey={Boolean(genMaxApiKey.trim())}
      />
    </div>
  )
})

// --- Row component ---

const GenerationRow = memo(function GenerationRow({
  generation: gen,
  onSave,
  onSaveAndInsert,
  onRemove,
}: {
  generation: Generation
  onSave: (gen: Generation) => Promise<void>
  onSaveAndInsert: (gen: Generation) => Promise<void>
  onRemove: (id: string) => void
}) {
  const { t } = useTranslation()
  const saved = gen.savedMediaId !== null

  return (
    <div
      className={`rounded-lg border p-3 space-y-2 ${
        saved ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-border bg-secondary/20'
      }`}
    >
      {/* Meta row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className="line-clamp-3 text-xs leading-relaxed" title={gen.textSnippet}>
            {gen.textSnippet}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {gen.voice} / {gen.model} / {gen.duration > 0 ? `${gen.duration.toFixed(1)}s` : '-'} /{' '}
            {formatBytes(gen.byteSize)}
          </p>
        </div>
        {!gen.saving && (
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
            onClick={() => onRemove(gen.id)}
            aria-label={t('editor.aiPanel.remove')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Audio player */}
      <MiniAudioPlayer src={gen.objectUrl} />

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-1.5">
        {saved ? (
          <span className="flex items-center gap-1 text-[11px] text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            {t('editor.aiPanel.saved')}
          </span>
        ) : (
          <>
            <Button
              variant="secondary"
              size="sm"
              className="h-7 gap-1 px-2 text-[11px]"
              onClick={() => {
                void onSaveAndInsert(gen)
              }}
              disabled={gen.saving}
            >
              {gen.saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ListPlus className="h-3 w-3" />
              )}
              {gen.saving ? t('editor.aiPanel.saving') : t('editor.aiPanel.saveAndInsert')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-[11px]"
              onClick={() => {
                void onSave(gen)
              }}
              disabled={gen.saving}
            >
              <Download className="h-3 w-3" />
              {t('editor.aiPanel.saveToLibrary')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
})
