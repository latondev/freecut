import type {
  MediaTranscript,
  MediaTranscriptModel,
  MediaTranscriptQuantization,
} from '@/types/storage'
import type { TimelineItem } from '@/types/timeline'
import {
  cancelMediaTranscriptionJob,
  mediaTranscriptionService,
  runMediaTranscriptionJob,
} from '../deps/media-transcription-service'
import { useTimelineStore } from '../stores/timeline-store'
import { useMediaLibraryStore } from '../deps/media-library-store'

export interface BatchCaptionProgress {
  currentMediaIndex: number
  totalMediaCount: number
  currentMediaName: string
  stage: string
  overallPercent: number
  mediaPercent: number
}

let activeAbortController: AbortController | null = null
let activeMediaId: string | null = null

export function cancelBatchCaptionGeneration(): void {
  if (activeMediaId) {
    cancelMediaTranscriptionJob(activeMediaId)
    activeMediaId = null
  }
  if (activeAbortController) {
    activeAbortController.abort()
    activeAbortController = null
  }
}

function collectTargetMediaMap(targetItemIds?: string[]): Map<string, string[]> {
  const timeline = useTimelineStore.getState()
  let targetItems = timeline.items.filter(
    (it): it is TimelineItem & { mediaId: string } =>
      (it.type === 'audio' || it.type === 'video') && typeof it.mediaId === 'string',
  )

  if (targetItemIds && targetItemIds.length > 0) {
    const filterSet = new Set(targetItemIds)
    const filtered = targetItems.filter((it) => filterSet.has(it.id))
    if (filtered.length > 0) {
      targetItems = filtered
    }
  }

  const mediaMap = new Map<string, string[]>()
  for (const it of targetItems) {
    const list = mediaMap.get(it.mediaId) ?? []
    list.push(it.id)
    mediaMap.set(it.mediaId, list)
  }
  return mediaMap
}

async function processSingleMediaCaption(
  mediaId: string,
  clipIds: string[],
  options: {
    model: MediaTranscriptModel
    quantization?: MediaTranscriptQuantization
    language?: string
    onProgress?: (stage: string, progress: number) => void
  },
  signal: AbortSignal,
): Promise<number> {
  if (signal.aborted) return 0

  // 1. Instant cache check: if transcript already exists, don't run Whisper
  let transcript: MediaTranscript | null | undefined =
    await mediaTranscriptionService.getTranscript(mediaId)

  // 2. If not cached, run Whisper transcription in Web Worker
  if (!transcript && !signal.aborted) {
    try {
      activeMediaId = mediaId
      const jobResult = await runMediaTranscriptionJob(mediaId, {
        model: options.model,
        quantization: options.quantization,
        language: options.language,
        onProgress: (p) => {
          options.onProgress?.(p.stage, p.progress)
        },
      })

      if (jobResult.status === 'completed') {
        transcript = jobResult.transcript
      }
    } finally {
      if (activeMediaId === mediaId) {
        activeMediaId = null
      }
    }
  }

  // 3. Enable captions on the timeline clips in real-time
  if (transcript && !signal.aborted) {
    try {
      const res = await mediaTranscriptionService.enableTranscriptCaptions(mediaId, {
        clipIds,
        replaceExisting: true,
        selectUpdatedClips: false,
      })
      return res.updatedClipCount
    } catch (err) {
      console.warn(`Failed to enable transcript captions for media ${mediaId}`, err)
    }
  }

  return 0
}

export async function generateTimelineCaptionsBatch(options: {
  model: MediaTranscriptModel
  quantization?: MediaTranscriptQuantization
  language?: string
  targetItemIds?: string[]
  onProgress?: (progress: BatchCaptionProgress) => void
}): Promise<{ totalClipsUpdated: number; mediaProcessed: number }> {
  cancelBatchCaptionGeneration()
  const abortController = new AbortController()
  activeAbortController = abortController

  const mediaMap = collectTargetMediaMap(options.targetItemIds)
  const mediaEntries = Array.from(mediaMap.entries())
  const totalMedia = mediaEntries.length

  if (totalMedia === 0) {
    throw new Error('Không tìm thấy clip Audio hoặc Video nào trên Timeline')
  }

  let totalClipsUpdated = 0
  let mediaProcessed = 0
  const mediaLib = useMediaLibraryStore.getState()

  for (let i = 0; i < totalMedia; i++) {
    if (abortController.signal.aborted) break

    const [mediaId, clipIds] = mediaEntries[i]!
    const mediaName = mediaLib.mediaById[mediaId]?.fileName ?? `Audio ${i + 1}`

    options.onProgress?.({
      currentMediaIndex: i + 1,
      totalMediaCount: totalMedia,
      currentMediaName: mediaName,
      stage: 'queued',
      overallPercent: Math.round((i / totalMedia) * 100),
      mediaPercent: 0,
    })

    const updated = await processSingleMediaCaption(
      mediaId,
      clipIds,
      {
        model: options.model,
        quantization: options.quantization,
        language: options.language,
        onProgress: (stage, progress) => {
          const mediaPct = Math.round(progress * 100)
          const basePct = (i / totalMedia) * 100
          const weightedPct = Math.min(100, Math.round(basePct + (progress / totalMedia) * 100))
          options.onProgress?.({
            currentMediaIndex: i + 1,
            totalMediaCount: totalMedia,
            currentMediaName: mediaName,
            stage,
            overallPercent: weightedPct,
            mediaPercent: mediaPct,
          })
        },
      },
      abortController.signal,
    )

    if (updated > 0) {
      totalClipsUpdated += updated
      mediaProcessed++
    }
  }

  activeAbortController = null
  return { totalClipsUpdated, mediaProcessed }
}
