import { memo, useCallback, useMemo, useState } from 'react'
import {
  Zap,
  Mic,
  Sparkles,
  Shuffle,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Trash2,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  useTimelineStore,
  useItemsStore,
  useKeyframesStore,
  executeTimelineCommand,
  getTrackKind,
  generateTimelineCaptionsBatch,
  cancelBatchCaptionGeneration,
  type BatchCaptionProgress,
  TranscribeDialog,
  type TranscribeDialogValues,
} from '@/features/editor/deps/timeline-contract'
import type { TimelineItem, ImageItem } from '@/types/timeline'
import type { AnimatableProperty, EasingType } from '@/types/keyframe'
import { useSelectionStore } from '@/shared/state/selection'
import { useProjectStore } from '@/features/editor/deps/projects'
import { cn } from '@/shared/ui/cn'
import { toast } from 'sonner'

const RANDOM_TRANSITIONS = [
  { id: 'fade', label: 'Fade' },
  { id: 'dissolve', label: 'Dissolve' },
  { id: 'blurDissolve', label: 'Blur Dissolve' },
  { id: 'wipe', label: 'Wipe' },
  { id: 'slide', label: 'Slide' },
  { id: 'iris', label: 'Iris' },
  { id: 'clockWipe', label: 'Clock Wipe' },
  { id: 'radialBlur', label: 'Radial Blur' },
  { id: 'lensWarpZoom', label: 'Lens Warp' },
  { id: 'lightLeakBurn', label: 'Light Leak' },
  { id: 'sparkles', label: 'Sparkles' },
  { id: 'glitch', label: 'Glitch' },
  { id: 'pixelate', label: 'Pixelate' },
  { id: 'liquidDistort', label: 'Liquid' },
] as const

const SMOOTH_IDS = new Set(['dissolve', 'blurDissolve', 'fade'])
const MOTION_IDS = new Set(['wipe', 'slide', 'iris', 'clockWipe'])
const CREATIVE_IDS = new Set([
  'lensWarpZoom',
  'lightLeakBurn',
  'sparkles',
  'glitch',
  'pixelate',
  'liquidDistort',
  'radialBlur',
])
const DIRECTIONS = ['from-left', 'from-right', 'from-top', 'from-bottom'] as const

type TransitionCategoryMode = 'all' | 'smooth' | 'motion' | 'creative'
type MotionEasingMode = 'ease-in-out' | 'linear'
type ImageAnimPreset =
  | 'zoom-in'
  | 'zoom-out'
  | 'pan-left'
  | 'pan-right'
  | 'pan-up'
  | 'pan-down'
  | 'zoom-in-pan-left'
  | 'zoom-in-pan-right'
  | 'zoom-out-pan-left'
  | 'zoom-out-pan-right'

type ImageAnimType = 'random' | ImageAnimPreset

const ANIM_POOL: readonly ImageAnimPreset[] = [
  'zoom-in',
  'zoom-out',
  'pan-left',
  'pan-right',
  'pan-up',
  'pan-down',
  'zoom-in-pan-left',
  'zoom-in-pan-right',
  'zoom-out-pan-left',
  'zoom-out-pan-right',
]

interface KeyframePayload {
  itemId: string
  property: AnimatableProperty
  frame: number
  value: number
  easing?: EasingType
}

// fallow-ignore-next-line complexity
function buildImageMotionKeyframes(
  itemId: string,
  duration: number,
  anim: ImageAnimPreset,
  baseW: number,
  baseH: number,
  baseX: number,
  baseY: number,
  easingMode: MotionEasingMode = 'ease-in-out',
): KeyframePayload[] {
  const end = Math.max(1, duration - 1)
  const ease = easingMode

  // Safe scale for pan motions: 1.15 gives 7.5% margin on each side to guarantee no black borders
  const panScale = 1.15
  const panW = Math.round(baseW * panScale)
  const panH = Math.round(baseH * panScale)

  // Dynamic safe pan distance proportional to dimensions (4%, safely inside 7.5% margin)
  const dx = Math.max(24, Math.round(baseW * 0.04))
  const dy = Math.max(20, Math.round(baseH * 0.04))

  // Zoom dimensions (1.15x)
  const zoomW = Math.round(baseW * 1.15)
  const zoomH = Math.round(baseH * 1.15)

  if (anim === 'zoom-in') {
    return [
      { itemId, property: 'width', frame: 0, value: baseW, easing: ease },
      { itemId, property: 'height', frame: 0, value: baseH, easing: ease },
      { itemId, property: 'x', frame: 0, value: baseX, easing: ease },
      { itemId, property: 'y', frame: 0, value: baseY, easing: ease },
      { itemId, property: 'width', frame: end, value: zoomW, easing: 'linear' },
      { itemId, property: 'height', frame: end, value: zoomH, easing: 'linear' },
      { itemId, property: 'x', frame: end, value: baseX, easing: 'linear' },
      { itemId, property: 'y', frame: end, value: baseY, easing: 'linear' },
    ]
  }

  if (anim === 'zoom-out') {
    return [
      { itemId, property: 'width', frame: 0, value: zoomW, easing: ease },
      { itemId, property: 'height', frame: 0, value: zoomH, easing: ease },
      { itemId, property: 'x', frame: 0, value: baseX, easing: ease },
      { itemId, property: 'y', frame: 0, value: baseY, easing: ease },
      { itemId, property: 'width', frame: end, value: baseW, easing: 'linear' },
      { itemId, property: 'height', frame: end, value: baseH, easing: 'linear' },
      { itemId, property: 'x', frame: end, value: baseX, easing: 'linear' },
      { itemId, property: 'y', frame: end, value: baseY, easing: 'linear' },
    ]
  }

  if (anim === 'pan-left') {
    return [
      { itemId, property: 'width', frame: 0, value: panW, easing: ease },
      { itemId, property: 'height', frame: 0, value: panH, easing: ease },
      { itemId, property: 'x', frame: 0, value: baseX + dx, easing: ease },
      { itemId, property: 'y', frame: 0, value: baseY, easing: ease },
      { itemId, property: 'width', frame: end, value: panW, easing: 'linear' },
      { itemId, property: 'height', frame: end, value: panH, easing: 'linear' },
      { itemId, property: 'x', frame: end, value: baseX - dx, easing: 'linear' },
      { itemId, property: 'y', frame: end, value: baseY, easing: 'linear' },
    ]
  }

  if (anim === 'pan-right') {
    return [
      { itemId, property: 'width', frame: 0, value: panW, easing: ease },
      { itemId, property: 'height', frame: 0, value: panH, easing: ease },
      { itemId, property: 'x', frame: 0, value: baseX - dx, easing: ease },
      { itemId, property: 'y', frame: 0, value: baseY, easing: ease },
      { itemId, property: 'width', frame: end, value: panW, easing: 'linear' },
      { itemId, property: 'height', frame: end, value: panH, easing: 'linear' },
      { itemId, property: 'x', frame: end, value: baseX + dx, easing: 'linear' },
      { itemId, property: 'y', frame: end, value: baseY, easing: 'linear' },
    ]
  }

  if (anim === 'pan-up') {
    return [
      { itemId, property: 'width', frame: 0, value: panW, easing: ease },
      { itemId, property: 'height', frame: 0, value: panH, easing: ease },
      { itemId, property: 'x', frame: 0, value: baseX, easing: ease },
      { itemId, property: 'y', frame: 0, value: baseY + dy, easing: ease },
      { itemId, property: 'width', frame: end, value: panW, easing: 'linear' },
      { itemId, property: 'height', frame: end, value: panH, easing: 'linear' },
      { itemId, property: 'x', frame: end, value: baseX, easing: 'linear' },
      { itemId, property: 'y', frame: end, value: baseY - dy, easing: 'linear' },
    ]
  }

  if (anim === 'pan-down') {
    return [
      { itemId, property: 'width', frame: 0, value: panW, easing: ease },
      { itemId, property: 'height', frame: 0, value: panH, easing: ease },
      { itemId, property: 'x', frame: 0, value: baseX, easing: ease },
      { itemId, property: 'y', frame: 0, value: baseY - dy, easing: ease },
      { itemId, property: 'width', frame: end, value: panW, easing: 'linear' },
      { itemId, property: 'height', frame: end, value: panH, easing: 'linear' },
      { itemId, property: 'x', frame: end, value: baseX, easing: 'linear' },
      { itemId, property: 'y', frame: end, value: baseY + dy, easing: 'linear' },
    ]
  }

  const halfDx = Math.round(dx * 0.7)

  if (anim === 'zoom-in-pan-left') {
    return [
      { itemId, property: 'width', frame: 0, value: baseW, easing: ease },
      { itemId, property: 'height', frame: 0, value: baseH, easing: ease },
      { itemId, property: 'x', frame: 0, value: baseX + halfDx, easing: ease },
      { itemId, property: 'y', frame: 0, value: baseY, easing: ease },
      { itemId, property: 'width', frame: end, value: zoomW, easing: 'linear' },
      { itemId, property: 'height', frame: end, value: zoomH, easing: 'linear' },
      { itemId, property: 'x', frame: end, value: baseX - halfDx, easing: 'linear' },
      { itemId, property: 'y', frame: end, value: baseY, easing: 'linear' },
    ]
  }

  if (anim === 'zoom-in-pan-right') {
    return [
      { itemId, property: 'width', frame: 0, value: baseW, easing: ease },
      { itemId, property: 'height', frame: 0, value: baseH, easing: ease },
      { itemId, property: 'x', frame: 0, value: baseX - halfDx, easing: ease },
      { itemId, property: 'y', frame: 0, value: baseY, easing: ease },
      { itemId, property: 'width', frame: end, value: zoomW, easing: 'linear' },
      { itemId, property: 'height', frame: end, value: zoomH, easing: 'linear' },
      { itemId, property: 'x', frame: end, value: baseX + halfDx, easing: 'linear' },
      { itemId, property: 'y', frame: end, value: baseY, easing: 'linear' },
    ]
  }

  if (anim === 'zoom-out-pan-left') {
    return [
      { itemId, property: 'width', frame: 0, value: zoomW, easing: ease },
      { itemId, property: 'height', frame: 0, value: zoomH, easing: ease },
      { itemId, property: 'x', frame: 0, value: baseX - halfDx, easing: ease },
      { itemId, property: 'y', frame: 0, value: baseY, easing: ease },
      { itemId, property: 'width', frame: end, value: Math.round(baseW * 1.05), easing: 'linear' },
      { itemId, property: 'height', frame: end, value: Math.round(baseH * 1.05), easing: 'linear' },
      { itemId, property: 'x', frame: end, value: baseX + halfDx, easing: 'linear' },
      { itemId, property: 'y', frame: end, value: baseY, easing: 'linear' },
    ]
  }

  // zoom-out-pan-right
  return [
    { itemId, property: 'width', frame: 0, value: zoomW, easing: ease },
    { itemId, property: 'height', frame: 0, value: zoomH, easing: ease },
    { itemId, property: 'x', frame: 0, value: baseX + halfDx, easing: ease },
    { itemId, property: 'y', frame: 0, value: baseY, easing: ease },
    { itemId, property: 'width', frame: end, value: Math.round(baseW * 1.05), easing: 'linear' },
    { itemId, property: 'height', frame: end, value: Math.round(baseH * 1.05), easing: 'linear' },
    { itemId, property: 'x', frame: end, value: baseX - halfDx, easing: 'linear' },
    { itemId, property: 'y', frame: end, value: baseY, easing: 'linear' },
  ]
}

function pickRandomTransition(category: TransitionCategoryMode): {
  id: string
  direction?: (typeof DIRECTIONS)[number]
} {
  let pool: readonly { id: string; label: string }[] = RANDOM_TRANSITIONS
  if (category === 'smooth') {
    pool = RANDOM_TRANSITIONS.filter((t) => SMOOTH_IDS.has(t.id))
  } else if (category === 'motion') {
    pool = RANDOM_TRANSITIONS.filter((t) => MOTION_IDS.has(t.id))
  } else if (category === 'creative') {
    pool = RANDOM_TRANSITIONS.filter((t) => CREATIVE_IDS.has(t.id))
  }

  const picked = pool[Math.floor(Math.random() * pool.length)]!
  const hasDir = picked.id === 'wipe' || picked.id === 'slide'
  return {
    id: picked.id,
    direction: hasDir ? DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)] : undefined,
  }
}

function connectAdjacentClipsWithTransition(
  left: TimelineItem,
  right: TimelineItem,
  category: TransitionCategoryMode,
  requestedDuration: number,
  timelineStore: ReturnType<typeof useTimelineStore.getState>,
): boolean {
  const leftEnd = left.from + left.durationInFrames
  if (Math.abs(leftEnd - right.from) > 1) return false

  const existing = timelineStore.transitions.find(
    (t) => t.leftClipId === left.id && t.rightClipId === right.id,
  )
  if (existing) {
    timelineStore.removeTransition(existing.id)
  }

  const { id, direction } = pickRandomTransition(category)
  const maxDur = Math.floor(Math.min(left.durationInFrames, right.durationInFrames) - 1)
  const duration = Math.max(2, Math.min(requestedDuration, maxDur))

  return timelineStore.addTransition(left.id, right.id, 'crossfade', duration, id, direction)
}

function getBatchStageLabel(stage?: string): string {
  if (!stage) return 'Đang xử lý...'
  switch (stage) {
    case 'queued':
      return 'Chờ hàng đợi'
    case 'downloading':
      return 'Tải model Whisper'
    case 'loading-model':
      return 'Khởi tạo AI Engine'
    case 'extracting-audio':
      return 'Tách âm thanh'
    case 'transcribing':
      return 'Đang nhận diện giọng'
    default:
      return 'Đang xử lý'
  }
}

export const ActionPanel = memo(function ActionPanel() {
  const [fillVoiceGaps, setFillVoiceGaps] = useState(true)
  const [motionEasing, setMotionEasing] = useState<MotionEasingMode>('ease-in-out')
  const [transitionDuration, setTransitionDuration] = useState(15)
  const [transitionCategory, setTransitionCategory] = useState<TransitionCategoryMode>('all')
  const [transcribeDialogOpen, setTranscribeDialogOpen] = useState(false)
  const [isBatchTranscribing, setIsBatchTranscribing] = useState(false)
  const [batchProgress, setBatchProgress] = useState<BatchCaptionProgress | null>(null)

  const items = useTimelineStore((s) => s.items)
  const transitions = useTimelineStore((s) => s.transitions)

  const audioCount = useMemo(() => items.filter((it) => it.type === 'audio').length, [items])
  const voiceClipsCount = useMemo(
    () =>
      items.filter(
        (it) =>
          (it.type === 'audio' || it.type === 'video') &&
          typeof it.mediaId === 'string' &&
          it.mediaId.length > 0,
      ).length,
    [items],
  )
  const imageCount = useMemo(() => items.filter((it) => it.type === 'image').length, [items])
  const transitionCount = transitions.length

  // ==========================================
  // BATCH CAPTION GENERATION (1-Click Captions)
  // ==========================================
  const handleStartBatchCaptions = useCallback(async (values: TranscribeDialogValues) => {
    setTranscribeDialogOpen(false)
    setIsBatchTranscribing(true)
    setBatchProgress({
      currentMediaIndex: 0,
      totalMediaCount: 0,
      currentMediaName: '',
      stage: 'queued',
      overallPercent: 0,
      mediaPercent: 0,
    })

    try {
      const result = await generateTimelineCaptionsBatch({
        model: values.model,
        quantization: values.quantization,
        language: values.language,
        onProgress: (p) => {
          setBatchProgress(p)
        },
      })

      toast.success(
        `Đã tạo caption word-by-word thành công cho ${result.totalClipsUpdated} clip trên Timeline!`,
      )
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'))) {
        toast.info('Đã dừng tiến trình tạo caption.')
      } else {
        const msg = err instanceof Error ? err.message : 'Có lỗi khi tạo caption'
        toast.error(msg)
      }
    } finally {
      setIsBatchTranscribing(false)
      setBatchProgress(null)
    }
  }, [])

  const handleCancelBatchCaptions = useCallback(() => {
    cancelBatchCaptionGeneration()
    setIsBatchTranscribing(false)
    setBatchProgress(null)
    toast.info('Đã dừng tiến trình tạo caption.')
  }, [])

  // ==========================================
  // ACTION 1: Khớp hình theo Voice
  // ==========================================
  const handleSyncImageVoice = useCallback(() => {
    const currentItems = useItemsStore.getState().items
    const selectedIds = useSelectionStore.getState().selectedItemIds

    let audioItems = currentItems.filter((it) => it.type === 'audio')
    let imageItems = currentItems.filter((it) => it.type === 'image')

    if (selectedIds.length > 0) {
      const selItems = currentItems.filter((it) => selectedIds.includes(it.id))
      const selAudio = selItems.filter((it) => it.type === 'audio')
      const selImg = selItems.filter((it) => it.type === 'image')
      if (selAudio.length > 0) audioItems = selAudio
      if (selImg.length > 0) imageItems = selImg
    }

    if (audioItems.length === 0) {
      toast.warning('Không tìm thấy đoạn Voice (Audio) nào trên Timeline!')
      return
    }
    if (imageItems.length === 0) {
      toast.warning('Không tìm thấy đoạn Ảnh (Image) nào trên Timeline!')
      return
    }

    audioItems.sort((a, b) => a.from - b.from)
    imageItems.sort((a, b) => a.from - b.from)

    const syncCount = Math.min(audioItems.length, imageItems.length)

    executeTimelineCommand('SYNC_IMAGE_VOICE', () => {
      const itemsStore = useItemsStore.getState()
      for (let i = 0; i < syncCount; i++) {
        const voice = audioItems[i]!
        const img = imageItems[i]!

        let duration = voice.durationInFrames
        if (fillVoiceGaps && i < audioItems.length - 1) {
          const nextVoice = audioItems[i + 1]!
          if (nextVoice.from > voice.from) {
            duration = nextVoice.from - voice.from
          }
        }

        itemsStore._updateItem(img.id, {
          from: voice.from,
          durationInFrames: Math.max(1, duration),
        })
      }
    })

    if (imageItems.length < audioItems.length) {
      toast.success(
        `Đã khớp ${syncCount} ảnh theo ${syncCount}/${audioItems.length} câu Voice! (Thêm ${audioItems.length - imageItems.length} ảnh để phủ hết)`,
      )
    } else {
      toast.success(`Đã tự động khớp toàn bộ ${syncCount} ảnh theo nhịp Voice!`)
    }
  }, [fillVoiceGaps])

  // fallow-ignore-next-line complexity
  function applyImageAnimationBatch(
    images: TimelineItem[],
    type: ImageAnimType,
    keyframesStore: ReturnType<typeof useKeyframesStore.getState>,
    easingMode: MotionEasingMode = 'ease-in-out',
  ): void {
    const payloads: KeyframePayload[] = []
    let lastAnim = ''

    const projectMeta = useProjectStore.getState().currentProject?.metadata
    const defaultW = projectMeta?.width ?? 1920
    const defaultH = projectMeta?.height ?? 1080

    for (const img of images) {
      if (img.durationInFrames < 2) continue

      keyframesStore._removeKeyframesForProperty(img.id, 'width')
      keyframesStore._removeKeyframesForProperty(img.id, 'height')
      keyframesStore._removeKeyframesForProperty(img.id, 'x')
      keyframesStore._removeKeyframesForProperty(img.id, 'y')

      const chosen =
        type === 'random'
          ? (ANIM_POOL.filter((a) => a !== lastAnim)[
              Math.floor(Math.random() * (ANIM_POOL.length - 1))
            ] ?? ANIM_POOL[0]!)
          : type
      lastAnim = chosen

      const imageItem = img as ImageItem
      const baseW = img.transform?.width ?? imageItem.sourceWidth ?? defaultW
      const baseH = img.transform?.height ?? imageItem.sourceHeight ?? defaultH
      const baseX = img.transform?.x ?? 0
      const baseY = img.transform?.y ?? 0

      payloads.push(
        ...buildImageMotionKeyframes(
          img.id,
          img.durationInFrames,
          chosen,
          baseW,
          baseH,
          baseX,
          baseY,
          easingMode,
        ),
      )
    }

    if (payloads.length > 0) {
      keyframesStore._addKeyframes(payloads)
    }
  }

  // ==========================================
  // ACTION 2: Key-frame Animation Image
  // ==========================================
  const handleApplyImageAnimation = useCallback(
    (type: ImageAnimType) => {
      const currentItems = useItemsStore.getState().items
      const selectedIds = useSelectionStore.getState().selectedItemIds

      let targetImages: TimelineItem[] = currentItems.filter((it) => it.type === 'image')
      if (selectedIds.length > 0) {
        const selImg = currentItems.filter(
          (it) => selectedIds.includes(it.id) && it.type === 'image',
        )
        if (selImg.length > 0) targetImages = selImg
      }

      if (targetImages.length === 0) {
        toast.warning('Không tìm thấy clip Ảnh nào trên Timeline.')
        return
      }

      executeTimelineCommand('APPLY_IMAGE_ANIMATION', () => {
        applyImageAnimationBatch(targetImages, type, useKeyframesStore.getState(), motionEasing)
      })

      const easingLabel =
        motionEasing === 'ease-in-out' ? 'mượt mà (Ease In-Out)' : 'trôi đều (Linear)'
      toast.success(
        `Đã tạo keyframe animation Ken Burns (${easingLabel}) cho ${targetImages.length} ảnh!`,
      )
    },
    [motionEasing],
  )

  const handleResetImageAnimation = useCallback(() => {
    const currentItems = useItemsStore.getState().items
    const selectedIds = useSelectionStore.getState().selectedItemIds

    let targetImages: TimelineItem[] = currentItems.filter((it) => it.type === 'image')
    if (selectedIds.length > 0) {
      const selImg = currentItems.filter((it) => selectedIds.includes(it.id) && it.type === 'image')
      if (selImg.length > 0) targetImages = selImg
    }

    if (targetImages.length === 0) {
      toast.warning('Không tìm thấy clip Ảnh nào.')
      return
    }

    executeTimelineCommand('RESET_IMAGE_ANIMATION', () => {
      const keyframesStore = useKeyframesStore.getState()
      for (const img of targetImages) {
        keyframesStore._removeKeyframesForProperty(img.id, 'width')
        keyframesStore._removeKeyframesForProperty(img.id, 'height')
        keyframesStore._removeKeyframesForProperty(img.id, 'x')
        keyframesStore._removeKeyframesForProperty(img.id, 'y')
        keyframesStore._removeKeyframesForProperty(img.id, 'rotation')
        keyframesStore._removeKeyframesForProperty(img.id, 'opacity')
      }
    })

    toast.info(`Đã gỡ bỏ chuyển động keyframe của ${targetImages.length} ảnh.`)
  }, [])

  // ==========================================
  // ACTION 3: Transition Scene Random
  // ==========================================
  const handleRandomTransitions = useCallback(() => {
    const timelineStore = useTimelineStore.getState()
    const visualTracks = timelineStore.tracks.filter((t) => getTrackKind(t) === 'video')
    if (visualTracks.length === 0) {
      toast.warning('Không tìm thấy track hình ảnh/video nào trên Timeline.')
      return
    }

    let totalAdded = 0

    executeTimelineCommand('RANDOM_TRANSITIONS', () => {
      for (const track of visualTracks) {
        const trackClips = timelineStore.items
          .filter((it) => it.trackId === track.id && (it.type === 'video' || it.type === 'image'))
          .sort((a, b) => a.from - b.from)

        if (trackClips.length < 2) continue

        for (let i = 0; i < trackClips.length - 1; i++) {
          const success = connectAdjacentClipsWithTransition(
            trackClips[i]!,
            trackClips[i + 1]!,
            transitionCategory,
            transitionDuration,
            timelineStore,
          )
          if (success) totalAdded++
        }
      }
    })

    if (totalAdded > 0) {
      toast.success(`Đã tự động chèn ${totalAdded} hiệu ứng chuyển cảnh ngẫu nhiên!`)
    } else {
      toast.warning('Không tìm thấy điểm cắt liền kề nào đủ điều kiện để chèn chuyển cảnh.')
    }
  }, [transitionCategory, transitionDuration])

  const handleClearAllTransitions = useCallback(() => {
    const timelineStore = useTimelineStore.getState()
    const allTransitions = timelineStore.transitions
    if (allTransitions.length === 0) {
      toast.info('Timeline hiện tại chưa có chuyển cảnh nào.')
      return
    }

    executeTimelineCommand('CLEAR_ALL_TRANSITIONS', () => {
      for (const t of allTransitions) {
        timelineStore.removeTransition(t.id)
      }
    })

    toast.info(`Đã xóa sạch tất cả ${allTransitions.length} hiệu ứng chuyển cảnh.`)
  }, [])

  return (
    <div className="h-full overflow-y-auto p-3.5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-foreground tracking-tight">
              Trung tâm Action
            </h3>
            <p className="text-[10px] text-muted-foreground">Tự động hóa dựng video nhanh</p>
          </div>
        </div>

        {/* Live Timeline Status Badges */}
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="px-1.5 py-0.5 rounded bg-secondary/50 border border-border/50">
            🎤 {audioCount}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-secondary/50 border border-border/50">
            🖼️ {imageCount}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-secondary/50 border border-border/50">
            ⚡ {transitionCount}
          </span>
        </div>
      </div>

      {/* 🌟 TẠO CAPTION CHO TOÀN BỘ AUDIO (Khuyên dùng - Tiện nhất) */}
      <div className="rounded-xl border border-amber-500/35 bg-gradient-to-b from-amber-500/10 via-secondary/25 to-secondary/15 p-3.5 space-y-3 shadow-sm relative">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400/30" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5 flex-wrap">
                <span>Tạo Caption Tự Động</span>
                <span className="text-[9px] font-semibold uppercase tracking-wider bg-amber-500/25 text-amber-200 px-1.5 py-0.5 rounded-full border border-amber-500/40 shrink-0">
                  Khuyên dùng
                </span>
              </div>
            </div>
          </div>
          <span className="text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded flex items-center gap-1 font-medium shrink-0">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Word-by-word</span>
          </span>
        </div>

        <p className="text-[11px] text-muted-foreground leading-snug">
          Quét toàn bộ Voice/Audio trên Timeline, chọn Model Whisper &amp; Ngôn ngữ 1 lần duy nhất.
          Xử lý nền qua Web Worker chống giật lag, tự động bật phụ đề chạy chữ đồng bộ theo giọng
          nói.
        </p>

        {isBatchTranscribing && batchProgress ? (
          <div className="space-y-2 rounded-lg border border-amber-500/40 bg-background/70 p-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 font-medium text-amber-300 truncate max-w-[210px]">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-amber-400" />
                <span className="truncate">
                  {batchProgress.currentMediaName || 'Đang chuẩn bị...'}
                </span>
              </div>
              <span className="text-[10px] font-mono text-amber-400 font-bold">
                {batchProgress.overallPercent}%
              </span>
            </div>

            <Progress value={batchProgress.overallPercent} className="h-1.5 bg-secondary" />

            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
              <span>
                Clip {batchProgress.currentMediaIndex}/{batchProgress.totalMediaCount} •{' '}
                <span className="text-foreground/80">
                  {getBatchStageLabel(batchProgress.stage)}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelBatchCaptions}
                className="h-5 px-2 text-[10px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
              >
                Hủy
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
              <span>
                🎯 Tìm thấy:{' '}
                <strong className="text-foreground">
                  {voiceClipsCount > 0 ? `${voiceClipsCount} đoạn Voice/Audio` : '0 audio'}
                </strong>
              </span>
              <span className="text-[10px] text-amber-400/80">⚡ Không lag timeline</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={voiceClipsCount === 0 || isBatchTranscribing}
              onClick={() => setTranscribeDialogOpen(true)}
              className="w-full h-9 text-xs font-semibold gap-1.5 border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 hover:border-amber-500/60 shadow-sm transition-all"
            >
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400/50" />
              <span>Tạo Caption cho toàn bộ Audio</span>
            </Button>
          </div>
        )}
      </div>

      {/* 1. KHỚP HÌNH THEO VOICE (Sync Image-Voice) */}
      <div className="rounded-xl border border-border/70 bg-secondary/20 p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400">
            <Mic className="w-3.5 h-3.5" />
            <span>1. Khớp hình theo Voice</span>
          </div>
          <span className="text-[10px] text-muted-foreground bg-sky-500/10 text-sky-300 px-1.5 py-0.5 rounded border border-sky-500/20">
            Sync Image-Voice
          </span>
        </div>

        <p className="text-[11px] text-muted-foreground leading-snug">
          Tự động căn chỉnh vị trí và co giãn thời lượng của các ảnh trên timeline để khớp chính xác
          từng đoạn câu thoại của Voice.
        </p>

        <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-foreground/90 pt-0.5">
          <input
            type="checkbox"
            checked={fillVoiceGaps}
            onChange={(e) => setFillVoiceGaps(e.target.checked)}
            className="rounded border-border bg-background text-primary focus:ring-1 focus:ring-primary w-3.5 h-3.5"
          />
          <span>Lấp đầy khoảng hở giữa các câu (tránh màn hình đen)</span>
        </label>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSyncImageVoice}
          className="w-full h-8 text-xs font-medium gap-1.5 border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-200 hover:border-sky-500/50 transition-colors"
        >
          <Zap className="w-3.5 h-3.5 text-sky-400" />
          <span>Khớp hình theo Voice ngay</span>
        </Button>
      </div>

      {/* 2. KEY-FRAME ANIMATION IMAGE (Ken Burns) */}
      <div className="rounded-xl border border-border/70 bg-secondary/20 p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>2. Key-frame Animation Image</span>
          </div>
          <span className="text-[10px] text-muted-foreground bg-violet-500/10 text-violet-300 px-1.5 py-0.5 rounded border border-violet-500/20">
            Ken Burns Motion
          </span>
        </div>

        <p className="text-[11px] text-muted-foreground leading-snug">
          Tạo chuyển động mượt mà cho ảnh tĩnh (phóng to, thu nhỏ, lia máy quay) chuẩn điện ảnh.
        </p>

        {/* Easing Mode Selector */}
        <div className="flex items-center justify-between text-[11px] px-2 py-1 bg-background/50 rounded-lg border border-border/40">
          <span className="text-muted-foreground flex items-center gap-1 font-medium text-[11px]">
            <span>Kiểu lướt:</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMotionEasing('ease-in-out')}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-medium transition-all',
                motionEasing === 'ease-in-out'
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40 border border-transparent',
              )}
              title="Tăng tốc và giảm tốc êm ái, mượt mà chuẩn điện ảnh"
            >
              Mượt mà (Ease)
            </button>
            <button
              type="button"
              onClick={() => setMotionEasing('linear')}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-medium transition-all',
                motionEasing === 'linear'
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40 border border-transparent',
              )}
              title="Chuyển động liên tục, tốc độ đồng đều như camera trượt"
            >
              Trôi đều (Linear)
            </button>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleApplyImageAnimation('random')}
          className="w-full h-8 text-xs font-medium gap-1.5 border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-200 hover:border-violet-500/50 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          <span>🎲 Ngẫu nhiên Ken Burns cho toàn bộ ảnh</span>
        </Button>

        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleApplyImageAnimation('zoom-in')}
            className="h-7 text-[11px] justify-start gap-1.5 px-2 border border-border/50 bg-background/40 hover:bg-secondary"
            title="Từ từ phóng to nhẹ (100% -> 115%)"
          >
            <ZoomIn className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Zoom In nhẹ</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleApplyImageAnimation('zoom-out')}
            className="h-7 text-[11px] justify-start gap-1.5 px-2 border border-border/50 bg-background/40 hover:bg-secondary"
            title="Từ từ thu nhỏ (115% -> 100%)"
          >
            <ZoomOut className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Zoom Out nhẹ</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleApplyImageAnimation('pan-left')}
            className="h-7 text-[11px] justify-start gap-1.5 px-2 border border-border/50 bg-background/40 hover:bg-secondary"
            title="Lia máy sang trái"
          >
            <ArrowLeft className="w-3 h-3 text-sky-400 shrink-0" />
            <span>Lia Trái (Pan Left)</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleApplyImageAnimation('pan-right')}
            className="h-7 text-[11px] justify-start gap-1.5 px-2 border border-border/50 bg-background/40 hover:bg-secondary"
            title="Lia máy sang phải"
          >
            <ArrowRight className="w-3 h-3 text-sky-400 shrink-0" />
            <span>Lia Phải (Pan Right)</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleApplyImageAnimation('pan-up')}
            className="h-7 text-[11px] justify-start gap-1.5 px-2 border border-border/50 bg-background/40 hover:bg-secondary"
            title="Lia máy lên trên"
          >
            <ArrowUp className="w-3 h-3 text-indigo-400 shrink-0" />
            <span>Lia Lên (Pan Up)</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleApplyImageAnimation('pan-down')}
            className="h-7 text-[11px] justify-start gap-1.5 px-2 border border-border/50 bg-background/40 hover:bg-secondary"
            title="Lia máy xuống dưới"
          >
            <ArrowDown className="w-3 h-3 text-indigo-400 shrink-0" />
            <span>Lia Xuống (Pan Down)</span>
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleResetImageAnimation}
          className="w-full h-7 text-[11px] text-muted-foreground hover:text-foreground justify-center gap-1.5"
        >
          <RotateCcw className="w-3 h-3 text-muted-foreground" />
          <span>Gỡ bỏ animation (Reset ảnh tĩnh)</span>
        </Button>
      </div>

      {/* 3. TRANSITION SCENE RANDOM (Chuyển cảnh ngẫu nhiên) */}
      <div className="rounded-xl border border-border/70 bg-secondary/20 p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
            <Shuffle className="w-3.5 h-3.5" />
            <span>3. Transition Scene Random</span>
          </div>
          <span className="text-[10px] text-muted-foreground bg-rose-500/10 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/20">
            Auto Cut Transitions
          </span>
        </div>

        <p className="text-[11px] text-muted-foreground leading-snug">
          Tự động chèn các hiệu ứng chuyển cảnh ngẫu nhiên vào giữa các đoạn cắt liền kề trên toàn
          bộ video/ảnh.
        </p>

        {/* Category Filters */}
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            Phong cách:
          </span>
          <div className="grid grid-cols-4 gap-1">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'smooth', label: 'Mượt mà' },
              { id: 'motion', label: 'Động' },
              { id: 'creative', label: 'Độc lạ' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setTransitionCategory(cat.id as TransitionCategoryMode)}
                className={`h-6 text-[10px] rounded border transition-colors ${
                  transitionCategory === cat.id
                    ? 'border-rose-500 bg-rose-500/20 text-rose-300 font-medium'
                    : 'border-border/60 bg-background/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Duration selection */}
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            Thời lượng chuyển cảnh:
          </span>
          <div className="grid grid-cols-4 gap-1">
            {[
              { val: 10, label: '10f (0.3s)' },
              { val: 15, label: '15f (0.5s)' },
              { val: 20, label: '20f (0.7s)' },
              { val: 30, label: '30f (1.0s)' },
            ].map((dur) => (
              <button
                key={dur.val}
                type="button"
                onClick={() => setTransitionDuration(dur.val)}
                className={`h-6 text-[10px] rounded border transition-colors ${
                  transitionDuration === dur.val
                    ? 'border-rose-500 bg-rose-500/20 text-rose-300 font-medium'
                    : 'border-border/60 bg-background/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                {dur.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRandomTransitions}
          className="w-full h-8 text-xs font-medium gap-1.5 border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-200 hover:border-rose-500/50 transition-colors"
        >
          <Shuffle className="w-3.5 h-3.5 text-rose-400" />
          <span>🎲 Chèn Chuyển Cảnh Ngẫu Nhiên</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearAllTransitions}
          className="w-full h-7 text-[11px] text-muted-foreground hover:text-rose-400 justify-center gap-1.5"
        >
          <Trash2 className="w-3 h-3 text-muted-foreground" />
          <span>Xóa sạch tất cả Transition ({transitionCount})</span>
        </Button>
      </div>

      <TranscribeDialog
        open={transcribeDialogOpen}
        onOpenChange={setTranscribeDialogOpen}
        fileName={`Toàn bộ Audio trên Timeline (${voiceClipsCount} clips)`}
        hasTranscript={false}
        isRunning={isBatchTranscribing}
        progressPercent={batchProgress?.overallPercent ?? null}
        progressLabel={
          batchProgress
            ? `Đang xử lý ${batchProgress.currentMediaIndex}/${batchProgress.totalMediaCount}: ${batchProgress.currentMediaName}`
            : ''
        }
        onStart={handleStartBatchCaptions}
        onCancel={handleCancelBatchCaptions}
      />
    </div>
  )
})
