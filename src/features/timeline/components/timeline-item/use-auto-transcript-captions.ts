import { useEffect, useRef } from 'react'
import type { TimelineItem as TimelineItemType } from '@/types/timeline'
import { mediaTranscriptionService } from '../../deps/media-transcription-service'
import type { CaptionDialogState } from './use-caption-dialog-state'

interface UseAutoTranscriptCaptionsParams {
  item: TimelineItemType
  caption: CaptionDialogState
  hasGeneratedCaptions: boolean
  isBroken: boolean
}

/**
 * Inserts transcript-backed captions on a visible timeline track the first time
 * a video/audio clip's media has a transcript, or converts its existing virtual
 * captions. Runs once per item+media pair and stays silent on failure.
 */
export function useAutoTranscriptCaptions({
  item,
  caption,
  hasGeneratedCaptions,
  isBroken,
}: UseAutoTranscriptCaptionsParams): void {
  const attemptRef = useRef<string | null>(null)

  useEffect(() => {
    const hasVirtualCaptions =
      item.transcriptCaptions?.type === 'transcript' && item.transcriptCaptions.enabled

    if (
      !caption.canManageCaptions ||
      !caption.mediaHasTranscript ||
      (hasGeneratedCaptions && !hasVirtualCaptions) ||
      isBroken ||
      (item.type !== 'video' && item.type !== 'audio') ||
      !item.mediaId
    ) {
      return
    }

    const attemptKey = `${item.id}:${item.mediaId}`
    if (attemptRef.current === attemptKey) {
      return
    }
    attemptRef.current = attemptKey

    void mediaTranscriptionService
      .insertTranscriptAsCaptions(item.mediaId, {
        clipIds: [item.id],
        replaceExisting: true,
        selectUpdatedClips: false,
        splitPhrases: true,
      })
      .catch(() => {
        // Keep this silent: the explicit Generate Captions action remains the user-facing fallback.
      })
  }, [
    caption.canManageCaptions,
    caption.mediaHasTranscript,
    hasGeneratedCaptions,
    isBroken,
    item.transcriptCaptions,
    item.id,
    item.mediaId,
    item.type,
  ])
}
