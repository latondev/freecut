import { memo, useCallback } from 'react'
import {
  Minimize2,
  Maximize2,
  Volume2,
  Video,
  Layers,
  Sparkles,
  CheckSquare,
  Square,
  Wand2,
  ArrowRightToLine,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useTimelineStore,
  useItemsStore,
  useZoomStore,
} from '@/features/editor/deps/timeline-store'
import {
  closeAllGapsOnTrack,
  getTrackKind,
  getZoomToFitLevel,
} from '@/features/editor/deps/timeline-utils'
import { useSelectionStore } from '@/shared/state/selection'
import { toast } from 'sonner'

export const ActionPanel = memo(function ActionPanel() {
  // 1. Close gaps on all audio tracks
  const handleCloseAudioGaps = useCallback(() => {
    const tracks = useTimelineStore.getState().tracks
    const audioTracks = tracks.filter((t) => getTrackKind(t) === 'audio')
    if (audioTracks.length === 0) {
      toast.warning('Không tìm thấy track Audio nào trên timeline.')
      return
    }

    let closedCount = 0
    for (const track of audioTracks) {
      closeAllGapsOnTrack(track.id)
      closedCount++
    }
    toast.success(`Đã tự động dồn khoảng trống trên ${closedCount} track Audio!`)
  }, [])

  // 2. Close gaps on all video tracks
  const handleCloseVideoGaps = useCallback(() => {
    const tracks = useTimelineStore.getState().tracks
    const videoTracks = tracks.filter((t) => getTrackKind(t) === 'video')
    if (videoTracks.length === 0) {
      toast.warning('Không tìm thấy track Video nào trên timeline.')
      return
    }

    let closedCount = 0
    for (const track of videoTracks) {
      closeAllGapsOnTrack(track.id)
      closedCount++
    }
    toast.success(`Đã tự động dồn khoảng trống trên ${closedCount} track Video!`)
  }, [])

  // 3. Close gaps across all tracks
  const handleCloseAllGaps = useCallback(() => {
    const tracks = useTimelineStore.getState().tracks
    if (tracks.length === 0) {
      toast.warning('Timeline hiện tại chưa có track nào.')
      return
    }

    for (const track of tracks) {
      closeAllGapsOnTrack(track.id)
    }
    toast.success(`Đã tự động dồn tất cả khoảng trống trên toàn bộ Timeline!`)
  }, [])

  // 4. Zoom to fit
  const handleZoomToFit = useCallback(() => {
    const container = document.querySelector('.timeline-container') as HTMLDivElement | null
    const containerWidth = container?.clientWidth ?? 1920
    const items = useItemsStore.getState().items
    const fps = useTimelineStore.getState().fps || 30
    const maxFrame = items.reduce(
      (max, item) => Math.max(max, item.from + item.durationInFrames),
      0,
    )
    const contentDuration = Math.max(maxFrame / fps, 10)

    const level = getZoomToFitLevel(containerWidth, contentDuration)
    useZoomStore.getState().setZoomLevelSynchronized(level)
    if (container) {
      container.scrollLeft = 0
    }
    toast.info('Đã vừa khít toàn bộ Timeline')
  }, [])

  // 5. Reset zoom 100%
  const handleResetZoom = useCallback(() => {
    useZoomStore.getState().setZoomLevelSynchronized(1)
    toast.info('Đã đặt lại mức Zoom chuẩn (100%)')
  }, [])

  // 6. Max zoom
  const handleMaxZoom = useCallback(() => {
    useZoomStore.getState().setZoomLevelSynchronized(2)
    toast.info('Đã phóng to tối đa')
  }, [])

  // 7. Select All
  const handleSelectAll = useCallback(() => {
    const items = useItemsStore.getState().items
    if (items.length === 0) {
      toast.warning('Timeline chưa có clip nào.')
      return
    }
    useSelectionStore.getState().selectItems(items.map((it) => it.id))
    toast.success(`Đã chọn tất cả ${items.length} clips`)
  }, [])

  // 8. Deselect All
  const handleDeselectAll = useCallback(() => {
    useSelectionStore.getState().clearItemSelection()
    toast.info('Đã bỏ chọn toàn bộ')
  }, [])

  return (
    <div className="h-full flex flex-col min-h-0 overflow-y-auto p-3 space-y-4">
      {/* Group: Close Gaps (Khép khoảng trống) */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
          <ArrowRightToLine className="w-3.5 h-3.5" />
          <span>Dồn clip & Khép khoảng trống</span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">
          Tự động dồn các clip về bên trái để lấp đầy toàn bộ khoảng hở trống trên timeline.
        </p>
        <div className="grid grid-cols-1 gap-1.5 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCloseAudioGaps}
            className="justify-start gap-2 h-9 text-xs border-border bg-secondary/30 hover:bg-secondary/70 hover:border-primary/50 text-foreground transition-colors"
          >
            <Volume2 className="w-4 h-4 text-orange-400 shrink-0" />
            <div className="flex flex-col text-left">
              <span className="font-medium">Dồn tất cả Audio (Close Audio Gaps)</span>
              <span className="text-[10px] text-muted-foreground">
                Xóa toàn bộ khe hở trên các track âm thanh
              </span>
            </div>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCloseVideoGaps}
            className="justify-start gap-2 h-9 text-xs border-border bg-secondary/30 hover:bg-secondary/70 hover:border-primary/50 text-foreground transition-colors"
          >
            <Video className="w-4 h-4 text-sky-400 shrink-0" />
            <div className="flex flex-col text-left">
              <span className="font-medium">Dồn tất cả Video (Close Video Gaps)</span>
              <span className="text-[10px] text-muted-foreground">
                Xóa khoảng trống trên các track hình ảnh
              </span>
            </div>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCloseAllGaps}
            className="justify-start gap-2 h-9 text-xs border-border bg-secondary/30 hover:bg-secondary/70 hover:border-primary/50 text-foreground transition-colors"
          >
            <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="flex flex-col text-left">
              <span className="font-medium">Dồn toàn bộ Timeline (All Tracks)</span>
              <span className="text-[10px] text-muted-foreground">
                Khép tất cả khoảng trống trên mọi track
              </span>
            </div>
          </Button>
        </div>
      </div>

      {/* Group: Timeline View & Zoom */}
      <div className="space-y-2 pt-2 border-t border-border">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Thu phóng Timeline</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomToFit}
            className="h-8 text-[11px] gap-1 px-2 border-border bg-secondary/30 hover:bg-secondary/70 hover:border-primary/50"
            title="Xem toàn bộ video vừa vặn trên màn hình"
          >
            <Minimize2 className="w-3 h-3 text-primary shrink-0" />
            <span>Vừa khít</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetZoom}
            className="h-8 text-[11px] gap-1 px-2 border-border bg-secondary/30 hover:bg-secondary/70 hover:border-primary/50"
            title="Đặt lại mức zoom chuẩn 100%"
          >
            <RefreshCw className="w-3 h-3 text-sky-400 shrink-0" />
            <span>Chuẩn 1x</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleMaxZoom}
            className="h-8 text-[11px] gap-1 px-2 border-border bg-secondary/30 hover:bg-secondary/70 hover:border-primary/50"
            title="Phóng to tối đa để cắt chính xác"
          >
            <Maximize2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Max 2x</span>
          </Button>
        </div>
      </div>

      {/* Group: Selection Helpers */}
      <div className="space-y-2 pt-2 border-t border-border">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Chọn Clips</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            className="h-8 text-xs gap-1.5 border-border bg-secondary/30 hover:bg-secondary/70 hover:border-primary/50"
          >
            <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
            <span>Chọn tất cả</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeselectAll}
            className="h-8 text-xs gap-1.5 border-border bg-secondary/30 hover:bg-secondary/70 hover:border-primary/50"
          >
            <Square className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Bỏ chọn</span>
          </Button>
        </div>
      </div>

      {/* Group: Custom Actions / Automation Hub */}
      <div className="space-y-2 pt-2 border-t border-border">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
          <Wand2 className="w-3.5 h-3.5" />
          <span>Tự động hóa & Tùy biến</span>
        </div>
        <div className="rounded-lg border border-dashed border-border/80 bg-secondary/20 p-2.5 text-center">
          <Sparkles className="w-5 h-5 text-primary/70 mx-auto mb-1" />
          <p className="text-xs font-medium text-foreground">Khu vực Hành động mở rộng</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Bạn có thể thêm bất kỳ nút chức năng hoặc kịch bản tự động hóa nào vào đây (như khớp ảnh
            theo voice, tách cảnh, đồng bộ kịch bản, chạy script...)
          </p>
        </div>
      </div>
    </div>
  )
})
