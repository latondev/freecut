import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, Trash2, Search, X, Captions } from 'lucide-react'
import { useTimelineStore, useTimelineViewportStore } from '@/features/editor/deps/timeline-store'
import { usePlaybackStore } from '@/shared/state/playback'
import { useSelectionStore } from '@/shared/state/selection'
import { cn } from '@/shared/ui/cn'
import type { SubtitleSegmentItem, TextItem, TimelineItem } from '@/types/timeline'

interface CaptionEntry {
  id: string // Unique key for rendering
  itemId: string // Underlying timeline item id
  cueId?: string // If part of multiple cues in a segment
  index: number // 1-based order in video
  fromFrame: number
  toFrame: number
  startSeconds: number
  endSeconds: number
  text: string
}

function formatSecondsToTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`
}

// Retain scroll position across any re-renders
let lastCaptionsScrollTop = 0

export const CaptionsTabContent = memo(function CaptionsTabContent() {
  const items = useTimelineStore((s) => s.items)
  const fps = useTimelineStore((s) => s.fps || 30)
  const updateItem = useTimelineStore((s) => s.updateItem)
  const removeItems = useTimelineStore((s) => s.removeItems)

  const currentFrame = usePlaybackStore((s) => s.currentFrame)
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const setCurrentFrame = usePlaybackStore((s) => s.setCurrentFrame)
  const play = usePlaybackStore((s) => s.play)
  const pause = usePlaybackStore((s) => s.pause)

  const selectedItemIds = useSelectionStore((s) => s.selectedItemIds)

  const [searchQuery, setSearchQuery] = useState('')
  const [playingItemId, setPlayingItemId] = useState<string | null>(null)
  const [clickedCaptionId, setClickedCaptionId] = useState<string | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Restore scroll position immediately before paint
  useLayoutEffect(() => {
    if (scrollContainerRef.current && lastCaptionsScrollTop > 0) {
      scrollContainerRef.current.scrollTop = lastCaptionsScrollTop
    }
  }, [])

  // 1. Gather all captions across the timeline in chronological order
  const allCaptions = useMemo(() => {
    const rawList: CaptionEntry[] = []

    for (const item of items) {
      if (item.type === 'subtitle') {
        const sub = item as SubtitleSegmentItem
        const firstCue = sub.cues?.[0]
        if (sub.cues && sub.cues.length > 0 && firstCue) {
          if (sub.cues.length === 1 && firstCue.startSeconds === 0) {
            // standard individual subtitle segment
            const startSec = item.from / fps
            const endSec = (item.from + item.durationInFrames) / fps
            rawList.push({
              id: item.id,
              itemId: item.id,
              cueId: firstCue.id,
              index: 0,
              fromFrame: item.from,
              toFrame: item.from + item.durationInFrames,
              startSeconds: startSec,
              endSeconds: endSec,
              text: firstCue.text || sub.label || '',
            })
          } else {
            // Multi-cue segment with relative offsets
            for (const cue of sub.cues) {
              const startSec = item.from / fps + cue.startSeconds
              const endSec = item.from / fps + cue.endSeconds
              rawList.push({
                id: `${item.id}-${cue.id}`,
                itemId: item.id,
                cueId: cue.id,
                index: 0,
                fromFrame: Math.round(startSec * fps),
                toFrame: Math.round(endSec * fps),
                startSeconds: startSec,
                endSeconds: endSec,
                text: cue.text,
              })
            }
          }
        } else {
          // Subtitle segment without cues
          const startSec = item.from / fps
          const endSec = (item.from + item.durationInFrames) / fps
          rawList.push({
            id: item.id,
            itemId: item.id,
            index: 0,
            fromFrame: item.from,
            toFrame: item.from + item.durationInFrames,
            startSeconds: startSec,
            endSeconds: endSec,
            text: sub.label || '',
          })
        }
      } else if (item.type === 'text' && (item as TextItem).textRole === 'caption') {
        const textItem = item as TextItem
        const startSec = item.from / fps
        const endSec = (item.from + item.durationInFrames) / fps
        rawList.push({
          id: item.id,
          itemId: item.id,
          index: 0,
          fromFrame: item.from,
          toFrame: item.from + item.durationInFrames,
          startSeconds: startSec,
          endSeconds: endSec,
          text: textItem.text || textItem.label || '',
        })
      }
    }

    // Sort chronologically by start time
    rawList.sort((a, b) => a.startSeconds - b.startSeconds)
    // Assign 1-based index
    return rawList.map((entry, idx) => ({
      ...entry,
      index: idx + 1,
    }))
  }, [items, fps])

  // Filter by search query
  const filteredCaptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return allCaptions
    return allCaptions.filter(
      (c) =>
        c.text.toLowerCase().includes(q) ||
        c.index.toString() === q ||
        formatSecondsToTimestamp(c.startSeconds).includes(q),
    )
  }, [allCaptions, searchQuery])

  // Identify currently active caption at playhead
  const currentActiveEntry = useMemo(() => {
    return allCaptions.find((c) => currentFrame >= c.fromFrame && currentFrame < c.toFrame)
  }, [allCaptions, currentFrame])

  // Handle clicking a caption: instant timeline jump & center without list scrolling
  const handleSelectCaption = useCallback(
    (entry: CaptionEntry) => {
      setClickedCaptionId(entry.id)
      setCurrentFrame(entry.fromFrame)
      useTimelineViewportStore.getState().requestScrollToFrame(entry.fromFrame)
    },
    [setCurrentFrame],
  )

  // Handle play/preview specific caption
  const handlePlayCaption = useCallback(
    (entry: CaptionEntry, e: React.MouseEvent) => {
      e.stopPropagation()
      if (isPlaying && playingItemId === entry.id) {
        pause()
        setPlayingItemId(null)
      } else {
        setClickedCaptionId(entry.id)
        setCurrentFrame(entry.fromFrame)
        useTimelineViewportStore.getState().requestScrollToFrame(entry.fromFrame)
        play()
        setPlayingItemId(entry.id)
      }
    },
    [isPlaying, playingItemId, pause, setCurrentFrame, play],
  )

  // Handle text edit
  const handleTextChange = useCallback(
    (entry: CaptionEntry, newText: string) => {
      const targetItem = items.find((it) => it.id === entry.itemId)
      if (!targetItem) return

      if (targetItem.type === 'subtitle') {
        const sub = targetItem as SubtitleSegmentItem
        if (entry.cueId && sub.cues) {
          const updatedCues = sub.cues.map((c) =>
            c.id === entry.cueId ? { ...c, text: newText } : c,
          )
          updateItem(entry.itemId, { cues: updatedCues } as Partial<TimelineItem>)
        } else {
          const currentCue = sub.cues?.[0]
          const updatedCues = currentCue
            ? [{ ...currentCue, text: newText }]
            : [
                {
                  id: crypto.randomUUID(),
                  startSeconds: 0,
                  endSeconds: sub.durationInFrames / fps,
                  text: newText,
                },
              ]
          updateItem(entry.itemId, {
            cues: updatedCues,
            label: newText,
          } as Partial<TimelineItem>)
        }
      } else if (targetItem.type === 'text') {
        updateItem(entry.itemId, {
          text: newText,
          label: newText,
        } as Partial<TimelineItem>)
      }
    },
    [items, fps, updateItem],
  )

  // Handle delete caption
  const handleDeleteCaption = useCallback(
    (entry: CaptionEntry, e: React.MouseEvent) => {
      e.stopPropagation()
      removeItems([entry.itemId])
    },
    [removeItems],
  )

  return (
    <div className="flex flex-col h-full min-h-0 space-y-2">
      {/* Header Info & Search */}
      <div className="space-y-1.5 pb-1 border-b border-border/40">
        <div className="flex items-center justify-between text-xs px-0.5">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Captions className="w-3.5 h-3.5 text-amber-400" />
            <span>Danh Sách Phụ Đề</span>
            <span className="text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 px-1.5 py-0.2 rounded-full border border-amber-500/20">
              {allCaptions.length}
            </span>
          </div>

          {currentActiveEntry && (
            <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Đang phát #{currentActiveEntry.index}
            </span>
          )}
        </div>

        {/* Compact Search bar */}
        <div className="relative flex items-center">
          <Search className="w-3 h-3 absolute left-2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Tìm trong ${allCaptions.length} câu...`}
            className="w-full pl-6 pr-6 py-1 text-xs bg-secondary/40 focus:bg-secondary/80 border border-border/50 focus:border-amber-500/60 rounded text-foreground placeholder:text-muted-foreground/60 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-1.5 p-0.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Subtitles List (Scrollable, Compact, Clear, Preserves Scroll) */}
      <div
        ref={scrollContainerRef}
        onScroll={(e) => {
          lastCaptionsScrollTop = e.currentTarget.scrollTop
        }}
        className="flex-1 min-h-[300px] max-h-[580px] overflow-y-auto space-y-1 pr-1 -mr-1"
      >
        {filteredCaptions.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground space-y-1">
            <p>Không tìm thấy câu phụ đề nào.</p>
            {allCaptions.length === 0 && (
              <p className="text-[11px] text-amber-400/80">
                Hãy vào tab <strong>Action ➔ Tạo Caption Tự Động</strong> để tạo phụ đề!
              </p>
            )}
          </div>
        ) : (
          filteredCaptions.map((entry) => {
            const isSelected = clickedCaptionId
              ? clickedCaptionId === entry.id
              : selectedItemIds.includes(entry.itemId)
            const isAtPlayhead = currentFrame >= entry.fromFrame && currentFrame < entry.toFrame

            return (
              <div
                key={entry.id}
                onClick={() => handleSelectCaption(entry)}
                className={cn(
                  'group relative flex items-start gap-1.5 px-2 py-1.5 rounded-md border text-left transition-all cursor-pointer select-none',
                  isSelected
                    ? 'border-amber-500/80 bg-amber-500/10 shadow-xs'
                    : isAtPlayhead
                      ? 'border-emerald-500/60 bg-emerald-500/10'
                      : 'border-border/40 bg-card/30 hover:bg-secondary/50 hover:border-border/80',
                )}
              >
                {/* Col 1: Number badge + start time */}
                <div className="flex flex-col items-start gap-0.5 shrink-0 pt-0.5 min-w-[48px]">
                  <span
                    className={cn(
                      'px-1 py-0.2 rounded text-[10px] font-mono font-bold leading-none',
                      isSelected
                        ? 'bg-amber-500 text-black'
                        : isAtPlayhead
                          ? 'bg-emerald-500 text-black'
                          : 'bg-secondary text-muted-foreground group-hover:text-foreground',
                    )}
                  >
                    #{entry.index}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground/70 leading-tight">
                    {formatSecondsToTimestamp(entry.startSeconds)}
                  </span>
                </div>

                {/* Col 2: Text input (Inline, auto-compact) */}
                <div className="flex-1 min-w-0">
                  <textarea
                    rows={1}
                    value={entry.text}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      handleTextChange(entry, e.target.value)
                      e.target.style.height = 'auto'
                      e.target.style.height = `${e.target.scrollHeight}px`
                    }}
                    ref={(el) => {
                      if (el) {
                        el.style.height = 'auto'
                        el.style.height = `${el.scrollHeight}px`
                      }
                    }}
                    className={cn(
                      'w-full text-xs font-medium py-0.5 px-1 bg-transparent focus:bg-background/80 border border-transparent focus:border-amber-500/50 rounded resize-none focus:outline-none transition-colors leading-snug',
                      isSelected ? 'text-amber-100 font-semibold' : 'text-foreground',
                    )}
                    placeholder="Nội dung phụ đề..."
                  />
                </div>

                {/* Col 3: Actions (Play & Delete) */}
                <div className="flex items-center gap-0.5 shrink-0 pt-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => handlePlayCaption(entry, e)}
                    className={cn(
                      'p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer',
                      isPlaying && playingItemId === entry.id && 'text-amber-400',
                    )}
                    title={
                      isPlaying && playingItemId === entry.id ? 'Tạm dừng' : 'Nghe thử câu này'
                    }
                  >
                    {isPlaying && playingItemId === entry.id ? (
                      <Pause className="w-3 h-3 fill-current" />
                    ) : (
                      <Play className="w-3 h-3 fill-current" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteCaption(entry, e)}
                    className="p-1 rounded hover:bg-rose-500/10 hover:text-rose-400 text-muted-foreground transition-colors cursor-pointer"
                    title="Xóa câu này"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer helper */}
      <div className="pt-1 border-t border-border/30 flex items-center justify-between text-[10px] text-muted-foreground/80">
        <span>* Bấm câu để timeline tự cuộn tới</span>
        <span>
          {filteredCaptions.length}/{allCaptions.length} câu
        </span>
      </div>
    </div>
  )
})
