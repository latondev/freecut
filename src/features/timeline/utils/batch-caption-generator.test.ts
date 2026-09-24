// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cancelBatchCaptionGeneration,
  generateTimelineCaptionsBatch,
} from './batch-caption-generator'
import { useTimelineStore } from '../stores/timeline-store'
import { useMediaLibraryStore } from '../deps/media-library-store'
import {
  mediaTranscriptionService,
  runMediaTranscriptionJob,
} from '../deps/media-transcription-service'

vi.mock('../deps/media-transcription-service', () => ({
  mediaTranscriptionService: {
    getTranscript: vi.fn(),
    enableTranscriptCaptions: vi.fn(),
  },
  runMediaTranscriptionJob: vi.fn(),
  cancelMediaTranscriptionJob: vi.fn(),
}))

describe('batch-caption-generator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useTimelineStore.setState({
      items: [],
      tracks: [],
      transitions: [],
    })
    useMediaLibraryStore.setState({
      mediaById: {},
    })
  })

  it('throws an error if timeline has no audio or video items', async () => {
    useTimelineStore.setState({
      items: [
        {
          id: 'img-1',
          type: 'image',
          trackId: 'track-1',
          from: 0,
          durationInFrames: 100,
          label: 'Photo',
        } as any,
      ],
    })

    await expect(
      generateTimelineCaptionsBatch({
        model: 'whisper-base',
      }),
    ).rejects.toThrow('Không tìm thấy clip Audio hoặc Video nào trên Timeline')
  })

  it('uses cached transcript and enables captions directly without running Whisper job', async () => {
    useTimelineStore.setState({
      items: [
        {
          id: 'audio-1',
          type: 'audio',
          trackId: 'track-1',
          mediaId: 'media-audio-1',
          from: 0,
          durationInFrames: 150,
          label: 'Voice 1',
        } as any,
        {
          id: 'audio-2',
          type: 'audio',
          trackId: 'track-1',
          mediaId: 'media-audio-1',
          from: 150,
          durationInFrames: 150,
          label: 'Voice 2',
        } as any,
      ],
    })

    const cachedTranscript = { id: 't-1', words: [] } as any
    vi.mocked(mediaTranscriptionService.getTranscript).mockResolvedValue(cachedTranscript)
    vi.mocked(mediaTranscriptionService.enableTranscriptCaptions).mockResolvedValue({
      updatedClipCount: 2,
      removedItemCount: 0,
    })

    const onProgress = vi.fn()
    const result = await generateTimelineCaptionsBatch({
      model: 'whisper-base',
      onProgress,
    })

    expect(mediaTranscriptionService.getTranscript).toHaveBeenCalledTimes(1)
    expect(mediaTranscriptionService.getTranscript).toHaveBeenCalledWith('media-audio-1')
    expect(runMediaTranscriptionJob).not.toHaveBeenCalled()
    expect(mediaTranscriptionService.enableTranscriptCaptions).toHaveBeenCalledTimes(1)
    expect(mediaTranscriptionService.enableTranscriptCaptions).toHaveBeenCalledWith(
      'media-audio-1',
      expect.objectContaining({
        clipIds: ['audio-1', 'audio-2'],
      }),
    )

    expect(result.totalClipsUpdated).toBe(2)
    expect(result.mediaProcessed).toBe(1)
  })

  it('runs Whisper job when transcript is not cached and reports progress', async () => {
    useTimelineStore.setState({
      items: [
        {
          id: 'audio-1',
          type: 'audio',
          trackId: 'track-1',
          mediaId: 'media-fresh',
          from: 0,
          durationInFrames: 120,
          label: 'Fresh Voice',
        } as any,
      ],
    })

    useMediaLibraryStore.setState({
      mediaById: {
        'media-fresh': { fileName: 'voice-speech.mp3' } as any,
      },
    })

    vi.mocked(mediaTranscriptionService.getTranscript).mockResolvedValue(undefined)
    vi.mocked(runMediaTranscriptionJob).mockResolvedValue({
      status: 'completed',
      transcript: { id: 'trans-new', words: [] } as any,
    })
    vi.mocked(mediaTranscriptionService.enableTranscriptCaptions).mockResolvedValue({
      updatedClipCount: 1,
      removedItemCount: 0,
    })

    const progressReports: any[] = []
    const result = await generateTimelineCaptionsBatch({
      model: 'whisper-base',
      language: 'vi',
      onProgress: (p) => progressReports.push(p),
    })

    expect(runMediaTranscriptionJob).toHaveBeenCalledTimes(1)
    expect(runMediaTranscriptionJob).toHaveBeenCalledWith(
      'media-fresh',
      expect.objectContaining({
        model: 'whisper-base',
        language: 'vi',
      }),
    )
    expect(mediaTranscriptionService.enableTranscriptCaptions).toHaveBeenCalledWith(
      'media-fresh',
      expect.objectContaining({
        clipIds: ['audio-1'],
      }),
    )
    expect(result.totalClipsUpdated).toBe(1)
    expect(progressReports.length).toBeGreaterThan(0)
    expect(progressReports[0].currentMediaName).toBe('voice-speech.mp3')
  })

  it('supports cancellation via cancelBatchCaptionGeneration', () => {
    expect(() => cancelBatchCaptionGeneration()).not.toThrow()
  })
})
