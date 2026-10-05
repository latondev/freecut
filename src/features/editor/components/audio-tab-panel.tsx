import { memo, useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { Play, Pause, Plus, ArrowDownToLine, Search, X, Volume2, Music2 } from 'lucide-react'
import capcutAudioRaw from '@/shared/typography/capcut-audio.json'
import { useTimelineStore } from '@/features/editor/deps/timeline-store'
import { usePlaybackStore } from '@/shared/state/playback'
import { useSelectionStore } from '@/shared/state/selection'
import { createClassicTrack } from '@/features/editor/deps/timeline-utils'
import { setMediaDragData, clearMediaDragData } from '@/features/editor/deps/media-library'
import type { AudioItem } from '@/types/timeline'
import { cn } from '@/shared/ui/cn'

export interface CapCutAudioItem {
  id: string
  title: string
  author: string
  duration: number
  coverUrl: string
  audioUrl: string
  tag: string
  genres: string[]
  category: string
  categories: string[]
  isPro?: boolean
  badge?: string
}

const AUDIO_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'trending', label: 'Trending' },
  { id: 'chill', label: 'Chill & Lofi' },
  { id: 'vlog', label: 'Vlog & Travel' },
  { id: 'hiphop', label: 'Hip Hop' },
  { id: 'pop', label: 'Pop' },
  { id: 'electronic', label: 'Electronic' },
  { id: 'sfx', label: 'Sound Effects' },
  { id: 'happy', label: 'Happy' },
  { id: 'rock', label: 'Rock' },
  { id: 'jazz', label: 'Jazz' },
] as const

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export const AudioTabPanel = memo(function AudioTabPanel() {
  const [selectedCat, setSelectedCat] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set())

  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Ensure audio instance
  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio

    const handleEnded = () => setPlayingId(null)
    const handleError = () => setPlayingId(null)

    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.pause()
      audio.src = ''
    }
  }, [])

  const handleTogglePlay = useCallback(
    (item: CapCutAudioItem) => {
      const audio = audioRef.current
      if (!audio) return

      if (playingId === item.id) {
        audio.pause()
        setPlayingId(null)
      } else {
        audio.src = item.audioUrl
        audio.play().catch(() => setPlayingId(null))
        setPlayingId(item.id)
      }
    },
    [playingId],
  )

  const handleAddAudioToTimeline = useCallback((item: CapCutAudioItem) => {
    const { tracks, fps, addItemOnNewTrack } = useTimelineStore.getState()
    const from = Math.max(0, usePlaybackStore.getState().currentFrame)
    const durationInFrames = Math.max(1, Math.round(item.duration * fps))

    let audioTrack = tracks.find(
      (t) => t.kind === 'audio' || t.name?.toLowerCase().includes('audio'),
    )
    let updatedTracks = tracks

    if (!audioTrack) {
      const maxOrder = tracks.reduce((max, track) => Math.max(max, track.order ?? 0), 0)
      audioTrack = createClassicTrack({ tracks, kind: 'audio', order: maxOrder + 1 })
      updatedTracks = [...tracks, audioTrack]
    }

    const audioItem: AudioItem = {
      id: crypto.randomUUID(),
      type: 'audio',
      trackId: audioTrack.id,
      from,
      durationInFrames,
      label: item.title,
      src: item.audioUrl,
      sourceStart: 0,
      sourceEnd: durationInFrames,
      sourceDuration: durationInFrames,
      sourceFps: fps,
      trimStart: 0,
      trimEnd: 0,
    }

    addItemOnNewTrack(audioItem, updatedTracks)
    useSelectionStore.getState().selectItems([audioItem.id])
    setDownloadedIds((prev) => new Set(prev).add(item.id))
  }, [])

  const handleDragStart = useCallback(
    (item: CapCutAudioItem) => (event: DragEvent<HTMLDivElement>) => {
      event.dataTransfer.effectAllowed = 'copy'
      const dragData = {
        type: 'media-item' as const,
        mediaId: item.id,
        mediaType: 'audio',
        fileName: item.title,
        duration: item.duration,
      }
      event.dataTransfer.setData('application/json', JSON.stringify(dragData))
      setMediaDragData(dragData)
    },
    [],
  )

  const handleDragEnd = useCallback(() => {
    clearMediaDragData()
  }, [])

  const categoryCounts = useMemo(() => {
    const allItems = capcutAudioRaw as CapCutAudioItem[]
    const counts: Record<string, number> = { all: allItems.length }
    for (const it of allItems) {
      for (const cat of it.categories) {
        counts[cat] = (counts[cat] || 0) + 1
      }
    }
    return counts
  }, [])

  const filteredAudio = useMemo(() => {
    let list = capcutAudioRaw as CapCutAudioItem[]
    if (selectedCat !== 'all') {
      list = list.filter((it) => it.categories.includes(selectedCat) || it.category === selectedCat)
    }
    const q = searchQuery.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.author.toLowerCase().includes(q) ||
        it.tag.toLowerCase().includes(q) ||
        it.genres.some((g) => g.toLowerCase().includes(q)),
    )
  }, [selectedCat, searchQuery])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Top Search Bar */}
      <div className="p-2 border-b border-border/50">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${capcutAudioRaw.length} songs & sounds...`}
            className="w-full pl-8 pr-7 py-1.5 bg-secondary/50 hover:bg-secondary/70 focus:bg-secondary border border-border/60 focus:border-primary/60 rounded-md text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 p-0.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Category Chips Bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md px-2 py-1.5 flex items-center gap-1 overflow-x-auto scrollbar-none border-b border-border/30">
        {AUDIO_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCat(cat.id)}
            className={cn(
              'px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap transition-colors font-semibold border flex items-center gap-1',
              selectedCat === cat.id
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-secondary/40 text-muted-foreground border-border/60 hover:bg-secondary/80 hover:text-foreground',
            )}
          >
            <span>{cat.label}</span>
            <span className="text-[8.5px] opacity-75">({categoryCounts[cat.id] || 0})</span>
          </button>
        ))}
      </div>

      {/* Track List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredAudio.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No audio tracks found matching &quot;{searchQuery}&quot;
          </div>
        ) : (
          filteredAudio.map((item) => {
            const isPlaying = playingId === item.id
            const isDownloaded = downloadedIds.has(item.id)

            return (
              <div
                key={item.id}
                draggable={true}
                onDragStart={handleDragStart(item)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'group relative flex items-center gap-2.5 p-1.5 rounded-md border border-white/[0.05]',
                  'bg-[#191920] hover:bg-[#22222c] hover:border-white/[0.12] transition-colors select-none',
                  isPlaying && 'border-primary/50 bg-primary/10 shadow-sm',
                )}
              >
                {/* Album Cover with Play/Pause button */}
                <div
                  className="relative w-9 h-9 rounded bg-black/40 overflow-hidden shrink-0 flex items-center justify-center cursor-pointer group/cover"
                  onClick={() => handleTogglePlay(item)}
                  title={isPlaying ? 'Pause' : 'Play preview'}
                >
                  {item.coverUrl ? (
                    <img
                      src={item.coverUrl}
                      alt={item.title}
                      className="w-full h-full object-cover select-none pointer-events-none"
                      loading="lazy"
                    />
                  ) : (
                    <Music2 className="w-4 h-4 text-muted-foreground" />
                  )}

                  {/* Play Overlay */}
                  <div
                    className={cn(
                      'absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity',
                      isPlaying ? 'opacity-100' : 'opacity-0 group-hover/cover:opacity-100',
                    )}
                  >
                    {isPlaying ? (
                      <Pause className="w-3.5 h-3.5 text-white fill-white animate-pulse" />
                    ) : (
                      <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                    )}
                  </div>
                </div>

                {/* Track Details */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => handleTogglePlay(item)}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground truncate leading-tight">
                      {item.title}
                    </span>
                    {item.isPro && (
                      <span className="text-[7px] text-violet-400 font-bold leading-none shrink-0">
                        ◆
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                    <span className="truncate max-w-[110px]">{item.author}</span>
                    <span>•</span>
                    <span className="shrink-0">{formatDuration(item.duration)}</span>
                    {isPlaying && (
                      <span className="flex items-center gap-0.5 text-primary text-[9px] font-semibold animate-pulse shrink-0">
                        <Volume2 className="w-2.5 h-2.5" />
                        <span>Playing</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Button: Add to timeline */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAddAudioToTimeline(item)
                  }}
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-90 shadow-sm',
                    isDownloaded
                      ? 'bg-primary text-primary-foreground hover:scale-105'
                      : 'bg-black/60 text-white/90 hover:bg-black/85 hover:text-white',
                  )}
                  title={isDownloaded ? 'Added to track (+)' : 'Add to track'}
                >
                  {isDownloaded ? (
                    <Plus className="w-3 h-3 stroke-[2.5]" />
                  ) : (
                    <ArrowDownToLine className="w-2.5 h-2.5 stroke-[2.2]" />
                  )}
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
})
