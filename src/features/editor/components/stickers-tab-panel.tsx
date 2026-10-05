import { memo, useCallback, useMemo, useState } from 'react'
import { Plus, ArrowDownToLine, Search, X } from 'lucide-react'
import capcutStickersRaw from '@/shared/typography/capcut-stickers.json'
import { useTimelineStore } from '@/features/editor/deps/timeline-store'
import { usePlaybackStore } from '@/shared/state/playback'
import { useSelectionStore } from '@/shared/state/selection'
import { useProjectStore } from '@/features/editor/deps/projects'
import { createOverlayLayerTrack } from '@/features/editor/deps/timeline-utils'
import { setMediaDragData, clearMediaDragData } from '@/features/editor/deps/media-library'
import { DEFAULT_PROJECT_WIDTH } from '@/shared/projects/defaults'
import type { ImageItem } from '@/types/timeline'
import { cn } from '@/shared/ui/cn'

export interface CapCutStickerItem {
  id: string
  label: string
  category: string
  categories: string[]
  badge?: string
  isPro?: boolean
  previewImage: string
  animatedPreviewImage?: string
  mediaUrl: string
  width: number
  height: number
}

const STICKER_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'trending', label: 'Trending' },
  { id: 'bduck', label: 'B.Duck 🐣' },
  { id: 'new', label: 'NEW' },
  { id: 'emoji', label: 'Emoji' },
  { id: 'love', label: 'Love' },
  { id: 'mood', label: 'Mood' },
  { id: 'cartoon', label: 'Cartoon' },
  { id: 'animal', label: 'Animal' },
  { id: 'birthday', label: 'Birthday' },
  { id: 'neon', label: 'Neon' },
  { id: 'food', label: 'Food' },
  { id: 'vlog', label: 'Vlog' },
  { id: 'gaming', label: 'Gaming' },
] as const

interface StickerCardProps {
  sticker: CapCutStickerItem
  onApply: (sticker: CapCutStickerItem) => void
}

const StickerCard = memo(function StickerCard({ sticker, onApply }: StickerCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isDownloaded, setIsDownloaded] = useState(false)
  const isPro = sticker.isPro || sticker.badge === 'PRO'

  return (
    <button
      type="button"
      draggable={true}
      title={sticker.label}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'copy'
        const dragData = {
          type: 'media-item' as const,
          mediaId: sticker.id,
          mediaType: 'image' as const,
          fileName: sticker.label,
        }
        e.dataTransfer.setData('application/json', JSON.stringify(dragData))
        setMediaDragData(dragData)
      }}
      onDragEnd={() => clearMediaDragData()}
      onClick={() => {
        setIsDownloaded(true)
        onApply(sticker)
      }}
      className={cn(
        'group relative aspect-square w-full rounded-md border border-white/[0.06]',
        'bg-[#1a1a21] hover:bg-[#252530] hover:border-white/[0.14] hover:shadow-md',
        'transition-[transform,border-color,background-color,box-shadow]',
        'active:scale-[0.95] text-left overflow-hidden flex items-center justify-center p-0 cursor-pointer select-none',
      )}
    >
      {/* Top Left: PRO Badge */}
      {isPro && (
        <span
          className="absolute top-1 left-1 z-10 text-[7px] leading-none font-bold text-violet-400 drop-shadow-[0_0_2px_rgba(167,139,250,0.6)]"
          title="PRO"
        >
          ◆
        </span>
      )}

      {/* Main Sticker Preview */}
      <div className="w-full h-full flex items-center justify-center p-1.5 relative">
        <img
          src={sticker.previewImage}
          alt={sticker.label}
          className="max-w-[82%] max-h-[82%] object-contain pointer-events-none select-none transition-transform duration-200 group-hover:scale-105 drop-shadow-sm"
          loading="lazy"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement
            target.style.display = 'none'
          }}
        />
        {isHovered && sticker.animatedPreviewImage && (
          <img
            src={sticker.animatedPreviewImage}
            alt={sticker.label}
            className="absolute inset-0 m-auto max-w-[82%] max-h-[82%] object-contain pointer-events-none select-none transition-transform duration-200 group-hover:scale-105 drop-shadow-sm"
          />
        )}
      </div>

      {/* Bottom Right: Circular Download / Add Button */}
      <div
        className={cn(
          'absolute bottom-1 right-1 z-10 w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all shadow-sm',
          isDownloaded
            ? 'bg-primary text-primary-foreground group-hover:scale-110'
            : 'bg-black/60 text-white/90 group-hover:bg-black/85 group-hover:text-white',
        )}
        onClick={(e) => {
          e.stopPropagation()
          setIsDownloaded(true)
          onApply(sticker)
        }}
        title={isDownloaded ? 'Add to track (+)' : 'Add sticker (↓)'}
      >
        {isDownloaded ? (
          <Plus className="w-2 h-2 stroke-[2.5]" />
        ) : (
          <ArrowDownToLine className="w-1.5 h-1.5 stroke-[2.2]" />
        )}
      </div>
    </button>
  )
})

export const StickersTabPanel = memo(function StickersTabPanel() {
  const [selectedCat, setSelectedCat] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const handleApplySticker = useCallback((sticker: CapCutStickerItem) => {
    const { tracks, fps, addItemOnNewTrack } = useTimelineStore.getState()
    const { activeTrackId, selectItems, setActiveTrack } = useSelectionStore.getState()
    const currentProject = useProjectStore.getState().currentProject

    const newTrack = createOverlayLayerTrack({ tracks, activeTrackId })
    if (!newTrack) return

    const canvasWidth = currentProject?.metadata.width || DEFAULT_PROJECT_WIDTH
    const durationInFrames = Math.max(1, Math.round(fps * 3))
    const currentFrame = Math.max(0, usePlaybackStore.getState().currentFrame)

    const stickerWidth = Math.min(canvasWidth * 0.35, 360)
    const stickerHeight = stickerWidth * ((sticker.height || 1) / (sticker.width || 1))

    const newItem: ImageItem = {
      id: crypto.randomUUID(),
      type: 'image',
      src: sticker.mediaUrl || sticker.previewImage,
      trackId: newTrack.trackId,
      from: currentFrame,
      durationInFrames,
      label: sticker.label || 'Sticker',
      sourceWidth: sticker.width,
      sourceHeight: sticker.height,
      transform: {
        x: 0,
        y: 0,
        width: stickerWidth,
        height: stickerHeight,
        rotation: 0,
        opacity: 1,
      },
    }

    addItemOnNewTrack(newItem, newTrack.tracks)
    setActiveTrack(newTrack.trackId)
    selectItems([newItem.id])
  }, [])

  const categoryCounts = useMemo(() => {
    const allStickers = capcutStickersRaw as CapCutStickerItem[]
    const counts: Record<string, number> = { all: allStickers.length }
    for (const it of allStickers) {
      for (const cat of it.categories) {
        counts[cat] = (counts[cat] || 0) + 1
      }
    }
    return counts
  }, [])

  const filteredStickers = useMemo(() => {
    let list = capcutStickersRaw as CapCutStickerItem[]
    if (selectedCat !== 'all') {
      list = list.filter((it) => it.categories.includes(selectedCat) || it.category === selectedCat)
    }
    const q = searchQuery.trim().toLowerCase()
    if (!q) return list
    return list.filter((it) => it.label.toLowerCase().includes(q))
  }, [selectedCat, searchQuery])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Search Bar */}
      <div className="p-2 border-b border-border/50">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${capcutStickersRaw.length} stickers...`}
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
        {STICKER_CATEGORIES.map((cat) => (
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

      {/* Stickers Responsive Auto-fill Grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredStickers.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No stickers found matching &quot;{searchQuery}&quot;
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1.5">
            {filteredStickers.map((sticker) => (
              <StickerCard key={sticker.id} sticker={sticker} onApply={handleApplySticker} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
})
