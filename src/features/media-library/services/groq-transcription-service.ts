import { saveTranscript } from '@/infrastructure/storage'
import { importMediaLibraryService } from './media-library-service-loader'
import { mediaTranscriptionService } from './media-transcription-service'
import { useMediaLibraryStore } from '../stores/media-library-store'
import { audioBufferToWavBlob } from '@/runtime/composition-runtime/utils/audio-buffer-wav'
import type { MediaTranscript, MediaTranscriptSegment, MediaTranscriptWord } from '@/types/storage'

export type GroqWhisperModel =
  | 'whisper-large-v3-turbo'
  | 'whisper-large-v3'
  | 'distil-whisper-large-v3-en'

export interface GroqTranscribeOptions {
  apiKey: string
  model?: GroqWhisperModel
  language?: string
  prompt?: string
  onProgress?: (stage: string, progress: number) => void
}

interface GroqWord {
  word?: string
  text?: string
  start?: number
  end?: number
}

interface GroqSegment {
  id?: number
  start?: number
  end?: number
  text?: string
  words?: GroqWord[]
}

interface GroqResponse {
  text?: string
  language?: string
  duration?: number
  segments?: GroqSegment[]
  words?: GroqWord[]
  error?: {
    message?: string
    type?: string
    code?: string
  }
}

/**
 * Prepares audio for Groq Speech-to-Text API.
 * Groq has a 25MB file upload limit.
 * If audio is already an audio file < 24MB, we keep it as is.
 * Otherwise, we resample to 16kHz mono WAV using Web Audio API.
 */
async function prepareAudioBlobForGroq(
  sourceBlob: Blob,
  mimeType: string,
  fileName: string,
): Promise<{ blob: Blob; fileName: string }> {
  // If it's already an audio file and under 24MB, upload directly
  if (
    mimeType.startsWith('audio/') &&
    !fileName.endsWith('.webm') &&
    sourceBlob.size < 24 * 1024 * 1024
  ) {
    return { blob: sourceBlob, fileName }
  }

  // Decode audio using Web Audio API
  const arrayBuffer = await sourceBlob.arrayBuffer()
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext

  if (!AudioContextClass) {
    return { blob: sourceBlob, fileName }
  }

  const audioCtx = new AudioContextClass()
  let decodedBuffer: AudioBuffer
  try {
    decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer)
  } catch (err) {
    console.warn('[GroqTranscribe] Web Audio decode failed, falling back to raw blob:', err)
    return { blob: sourceBlob, fileName }
  } finally {
    void audioCtx.close().catch(() => {})
  }

  // Calculate target sample rate to ensure the mono 16-bit WAV is <= 23MB
  // 16-bit mono = 2 bytes per sample
  const duration = decodedBuffer.duration
  let sampleRate = 16000
  if (duration * sampleRate * 2 > 23 * 1024 * 1024) {
    sampleRate = Math.max(8000, Math.floor((23 * 1024 * 1024) / (duration * 2)))
  }

  const targetFrames = Math.max(1, Math.ceil(duration * sampleRate))
  const offlineCtx = new OfflineAudioContext(1, targetFrames, sampleRate)
  const source = offlineCtx.createBufferSource()
  source.buffer = decodedBuffer
  source.connect(offlineCtx.destination)
  source.start(0)

  const resampled = await offlineCtx.startRendering()
  const wavBlob = audioBufferToWavBlob(resampled)
  const baseName = fileName.replace(/\.[^/.]+$/, '')
  return { blob: wavBlob, fileName: `${baseName}.wav` }
}

/**
 * Transcribes a media item using Groq Cloud Whisper API (Ultra fast ~2 seconds).
 */
export async function transcribeMediaWithGroq(
  mediaId: string,
  options: GroqTranscribeOptions,
): Promise<MediaTranscript> {
  const apiKey = options.apiKey.trim()
  if (!apiKey) {
    throw new Error('Chưa nhập Groq API Key! Vui lòng lấy key miễn phí tại console.groq.com.')
  }

  const { mediaLibraryService } = await importMediaLibraryService()
  const media = await mediaLibraryService.getMedia(mediaId)
  if (!media) {
    throw new Error(`Media not found: ${mediaId}`)
  }

  const sourceBlob = await mediaLibraryService.getMediaFile(mediaId)
  if (!sourceBlob) {
    throw new Error(`Could not load media file: ${media.fileName}`)
  }

  options.onProgress?.('extracting-audio', 0.15)
  const { blob: uploadBlob, fileName } = await prepareAudioBlobForGroq(
    sourceBlob,
    media.mimeType,
    media.fileName,
  )

  options.onProgress?.('uploading', 0.35)

  const formData = new FormData()
  const uploadFile = new File([uploadBlob], fileName, {
    type: uploadBlob.type || 'audio/wav',
  })
  formData.append('file', uploadFile)
  formData.append('model', options.model || 'whisper-large-v3-turbo')
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'word')
  formData.append('timestamp_granularities[]', 'segment')
  formData.append('temperature', '0')

  if (options.language && options.language !== 'auto') {
    formData.append('language', options.language)
  }
  if (options.prompt) {
    formData.append('prompt', options.prompt)
  }

  options.onProgress?.('transcribing', 0.6)

  let response: Response
  try {
    response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    })
  } catch (netErr) {
    throw new Error(
      `Không thể kết nối đến Groq API: ${
        netErr instanceof Error ? netErr.message : 'Lỗi mạng hoặc bị chặn kết nối'
      }`,
    )
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        'Groq API Key không hợp lệ hoặc đã hết hạn! Vui lòng kiểm tra lại tại console.groq.com.',
      )
    }
    if (response.status === 429) {
      throw new Error(
        'Groq API đang bị giới hạn tần suất (Rate Limit)! Vui lòng đợi khoảng 15-30 giây rồi thử lại.',
      )
    }
    if (response.status === 413) {
      throw new Error('Dung lượng audio vượt quá giới hạn 25MB của Groq Cloud.')
    }

    let errorMsg = `Groq API Error (${response.status})`
    try {
      const errJson = (await response.json()) as GroqResponse
      if (errJson?.error?.message) {
        errorMsg = errJson.error.message
      }
    } catch {
      // ignore
    }
    throw new Error(errorMsg)
  }

  options.onProgress?.('transcribing', 0.9)
  const data = (await response.json()) as GroqResponse

  // Collect word timestamps
  const allWords: MediaTranscriptWord[] = []
  const rawWordsSource = Array.isArray(data.words) ? data.words : []
  for (const w of rawWordsSource) {
    const text = (w.word ?? w.text ?? '').trim()
    const start = Number(w.start ?? 0)
    const end = Number(w.end ?? start + 0.3)
    if (text.length > 0 && end >= start) {
      allWords.push({ text, start, end })
    }
  }

  // Build segments with words
  const segments: MediaTranscriptSegment[] = []
  if (Array.isArray(data.segments) && data.segments.length > 0) {
    for (const s of data.segments) {
      const segStart = Number(s.start ?? 0)
      const segEnd = Number(s.end ?? segStart + 1)
      const segText = (s.text ?? '').trim()

      let segWords: MediaTranscriptWord[] = []
      if (Array.isArray(s.words) && s.words.length > 0) {
        segWords = s.words
          .map((w) => ({
            text: (w.word ?? w.text ?? '').trim(),
            start: Number(w.start ?? segStart),
            end: Number(w.end ?? segEnd),
          }))
          .filter((w) => w.text.length > 0)
      } else if (allWords.length > 0) {
        segWords = allWords.filter((w) => w.start >= segStart - 0.08 && w.end <= segEnd + 0.08)
      }

      if (segText.length > 0 || segWords.length > 0) {
        segments.push({
          text: segText || segWords.map((w) => w.text).join(' '),
          start: segStart,
          end: segEnd,
          words: segWords.length > 0 ? segWords : undefined,
        })
      }
    }
  } else if (allWords.length > 0) {
    // If no segments returned, group into rhythmic chunks of 4-6 words
    const CHUNK_SIZE = 5
    for (let i = 0; i < allWords.length; i += CHUNK_SIZE) {
      const slice = allWords.slice(i, i + CHUNK_SIZE)
      segments.push({
        text: slice.map((w) => w.text).join(' '),
        start: slice[0]!.start,
        end: slice[slice.length - 1]!.end,
        words: slice,
      })
    }
  } else if (data.text) {
    segments.push({
      text: data.text.trim(),
      start: 0,
      end: Number(data.duration ?? 5),
    })
  }

  const transcript: MediaTranscript = {
    id: mediaId,
    mediaId,
    model: 'whisper-large',
    language: options.language || data.language || 'vi',
    quantization: 'fp16',
    text: data.text ? data.text.trim() : segments.map((s) => s.text).join(' '),
    segments,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  await saveTranscript(transcript)
  mediaTranscriptionService.syncExistingTranscriptCaptions(mediaId, transcript)
  useMediaLibraryStore.getState().setTranscriptStatus(mediaId, 'ready')
  useMediaLibraryStore.getState().clearTranscriptProgress(mediaId)

  options.onProgress?.('completed', 1.0)
  return transcript
}
