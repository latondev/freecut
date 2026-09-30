// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TimelineItem } from '@/types/timeline'
import type { CaptionDialogState } from './use-caption-dialog-state'
import { useAutoTranscriptCaptions } from './use-auto-transcript-captions'
import { mediaTranscriptionService } from '../../deps/media-transcription-service'

vi.mock('../../deps/media-transcription-service', () => ({
  mediaTranscriptionService: {
    insertTranscriptAsCaptions: vi.fn().mockResolvedValue({
      insertedItemCount: 1,
      removedItemCount: 0,
    }),
  },
}))

describe('useAutoTranscriptCaptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('converts existing virtual captions into visible timeline items', async () => {
    const item = {
      id: 'clip-1',
      type: 'video',
      mediaId: 'media-1',
      transcriptCaptions: {
        type: 'transcript',
        enabled: true,
        cues: [{ id: 'cue-1', startSeconds: 0, endSeconds: 1, text: 'Hello' }],
      },
    } as TimelineItem
    const caption = {
      canManageCaptions: true,
      mediaHasTranscript: true,
    } as CaptionDialogState

    renderHook(() =>
      useAutoTranscriptCaptions({
        item,
        caption,
        hasGeneratedCaptions: true,
        isBroken: false,
      }),
    )

    await waitFor(() => {
      expect(mediaTranscriptionService.insertTranscriptAsCaptions).toHaveBeenCalledWith('media-1', {
        clipIds: ['clip-1'],
        replaceExisting: true,
        selectUpdatedClips: false,
        splitPhrases: true,
      })
    })
  })
})
