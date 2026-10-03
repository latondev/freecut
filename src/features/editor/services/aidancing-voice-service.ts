import { sanitizeAiOutputFileNameSegment } from '@/shared/utils/ai-output-filename'

export interface GenerateAiDancingSpeechOptions {
  text: string
  previewUrl?: string
  voiceIndex?: string | number
  maxConcurrency?: number
  onProgress?: (msg: string) => void
  signal?: AbortSignal
}

const MAX_AI_DANCING_CONCURRENCY = 15

/**
 * Checks if a punctuation point is part of a number (e.g. 10.000, 2,000, 3.14)
 */
export function isNumberBoundary(text: string, index: number): boolean {
  const prevChar = text[index - 1]
  const nextChar = text[index + 1]
  return Boolean(prevChar && nextChar && /\d/.test(prevChar) && /\d/.test(nextChar))
}

/**
 * Splits text into smart chunks within [minLen, maxLen] characters (default 1200 - 1800).
 * Scans backward from maxLen looking for:
 * 1. Newline characters (\n)
 * 2. Sentence terminators (. ! ?) while ensuring not part of numbers (10.000) or abbreviations (TP.HCM, v.v.)
 * 3. Clause separators (, ; : — -) while ensuring not part of numbers (2,000)
 * 4. Word boundary (space)
 */
// fallow-ignore-next-line complexity
export function splitTextIntoSmartChunks(
  text: string,
  minLen: number = 1200,
  maxLen: number = 1800,
): string[] {
  const trimmed = text.trim()
  // If entire text fits within the API limit (2000 chars), process as a single chunk
  if (trimmed.length <= 2000) {
    return [trimmed]
  }

  const chunks: string[] = []
  let remaining = trimmed

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining.trim())
      break
    }

    const searchWindow = remaining.slice(0, maxLen)
    let splitIndex = -1

    // 1. Try finding paragraph / line breaks first
    for (let i = maxLen - 1; i >= minLen; i--) {
      if (searchWindow[i] === '\n') {
        splitIndex = i + 1
        break
      }
    }

    // 2. Sentence ending punctuation (. ! ?)
    if (splitIndex === -1) {
      for (let i = maxLen - 1; i >= minLen; i--) {
        const char = searchWindow[i]
        if (char === '.' || char === '!' || char === '?') {
          // Check if part of numbers like 10.000 or 3.14
          if (char === '.' && isNumberBoundary(searchWindow, i)) {
            continue
          }
          // Check if abbreviation or web domain followed immediately by a word character
          const nextChar = searchWindow[i + 1]
          if (nextChar && /[a-zA-Z0-9À-ỹ]/.test(nextChar)) {
            continue
          }
          splitIndex = i + 1
          break
        }
      }
    }

    // 3. Clause punctuation (, ; : — -)
    if (splitIndex === -1) {
      for (let i = maxLen - 1; i >= minLen; i--) {
        const char = searchWindow[i]
        if (char === ',' || char === ';' || char === ':' || char === '—' || char === '-') {
          if (char === ',' && isNumberBoundary(searchWindow, i)) {
            continue
          }
          splitIndex = i + 1
          break
        }
      }
    }

    // 4. Space boundary in [minLen, maxLen]
    if (splitIndex === -1) {
      for (let i = maxLen - 1; i >= minLen; i--) {
        if (searchWindow[i] === ' ') {
          splitIndex = i + 1
          break
        }
      }
    }

    // 5. Lookback from minLen down to 200 for sentence or newline
    if (splitIndex === -1) {
      for (let i = minLen - 1; i >= 200; i--) {
        const char = searchWindow[i]
        if (char === '.' || char === '!' || char === '?' || char === '\n') {
          if (char === '.' && isNumberBoundary(searchWindow, i)) continue
          const nextChar = searchWindow[i + 1]
          if (nextChar && /[a-zA-Z0-9À-ỹ]/.test(nextChar)) continue
          splitIndex = i + 1
          break
        }
      }
    }

    // 6. Hard cut if unbroken string
    if (splitIndex === -1) {
      splitIndex = maxLen
    }

    const chunk = remaining.slice(0, splitIndex).trim()
    if (chunk.length > 0) {
      chunks.push(chunk)
    }
    remaining = remaining.slice(splitIndex).trim()
  }

  return chunks
}

/**
 * Resolves preview audio URLs to use proxy in browser to bypass CORS and COEP restrictions.
 */
export function resolveAiDancingPreviewUrl(url?: string): string {
  if (!url) return ''
  if (url.startsWith('/')) return url
  if (url.startsWith('https://video.aidancing.net')) {
    return url.replace('https://video.aidancing.net', '/api/aidancing-media')
  }
  if (url.startsWith('https://audio.aidancing.net')) {
    return url.replace('https://audio.aidancing.net', '/api/aidancing')
  }
  if (url.startsWith('https://api.genmax.io')) {
    return url.replace('https://api.genmax.io', '/api/genmax')
  }
  return `/api/audio-proxy?url=${encodeURIComponent(url)}`
}

/**
 * Calculates audio duration from a Blob using HTMLAudioElement.
 */
function getAudioBlobDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    try {
      const audio = document.createElement('audio')
      const url = URL.createObjectURL(blob)
      audio.preload = 'metadata'
      audio.src = url

      const cleanup = () => {
        URL.revokeObjectURL(url)
        audio.remove()
      }

      audio.onloadedmetadata = () => {
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0
        cleanup()
        resolve(duration)
      }

      audio.onerror = () => {
        cleanup()
        resolve(0)
      }

      setTimeout(() => {
        cleanup()
        resolve(0)
      }, 5000)
    } catch {
      resolve(0)
    }
  })
}

/**
 * Polls status for a single jobUid until COMPLETED or FAILED.
 */
// fallow-ignore-next-line complexity
async function pollJobUntilComplete(
  jobUid: string,
  signal?: AbortSignal,
  onProgress?: (msg: string) => void,
): Promise<string> {
  const maxWaitMs = 10 * 60 * 1000 // 10 minutes
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    if (signal?.aborted) {
      throw new DOMException('Generation cancelled by user', 'AbortError')
    }

    await new Promise((resolve) => setTimeout(resolve, 2500))

    const elapsed = Math.round((Date.now() - startTime) / 1000)
    onProgress?.(`Đang xử lý (${elapsed}s)...`)

    try {
      const statusRes = await fetch(`/api/aidancing/status?jobUid=${encodeURIComponent(jobUid)}`, {
        headers: { Accept: 'application/json' },
        signal,
      })

      if (!statusRes.ok) continue

      const statusData = (await statusRes.json()) as {
        status?: string
        outputUrl?: string
        error?: string
      }

      const status = (statusData.status || '').toUpperCase()

      if (status === 'COMPLETED' && statusData.outputUrl) {
        return statusData.outputUrl
      }

      if (status === 'FAILED') {
        throw new Error(statusData.error || 'Máy chủ AI Dancing báo lỗi xử lý thất bại.')
      }
    } catch (pollErr) {
      if (pollErr instanceof DOMException && pollErr.name === 'AbortError') {
        throw pollErr
      }
      if (pollErr instanceof Error && pollErr.message.includes('thất bại')) {
        throw pollErr
      }
    }
  }

  throw new Error('Quá thời gian chờ phản hồi từ AI Dancing.')
}

/**
 * Generates speech for a single chunk of text with automatic retry.
 */
// fallow-ignore-next-line complexity
async function generateSingleChunkSpeech(
  options: {
    text: string
    previewUrl?: string
    voiceIndex?: string | number
    signal?: AbortSignal
    onProgress?: (msg: string) => void
  },
  retriesLeft = 2,
): Promise<{ blob: Blob; duration: number }> {
  try {
    const cloneRes = await fetch('/api/aidancing/clone', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        text: options.text,
        previewUrl: options.previewUrl,
        voiceIndex: options.voiceIndex,
      }),
      signal: options.signal,
    })

    if (!cloneRes.ok) {
      const errText = await cloneRes.text().catch(() => '')
      let msg = errText
      try {
        const parsed = JSON.parse(errText) as { error?: string }
        if (parsed.error) msg = parsed.error
      } catch {}
      throw new Error(`Lỗi khởi tạo clone (${cloneRes.status}): ${msg || 'Không thể kết nối'}`)
    }

    const { jobUid } = (await cloneRes.json()) as { jobUid?: string }
    if (!jobUid) {
      throw new Error('Máy chủ không trả về mã tiến trình (jobUid) hợp lệ.')
    }

    const outputUrl = await pollJobUntilComplete(jobUid, options.signal, options.onProgress)

    const downloadUrl = `/api/aidancing/download?jobUid=${encodeURIComponent(jobUid)}&outputUrl=${encodeURIComponent(outputUrl)}`
    const audioRes = await fetch(downloadUrl, { signal: options.signal })
    if (!audioRes.ok) {
      throw new Error(`Không thể tải tệp âm thanh (${audioRes.status})`)
    }

    const blob = await audioRes.blob()
    const duration = await getAudioBlobDuration(blob)
    return { blob, duration }
  } catch (err) {
    if (options.signal?.aborted) throw err
    if (retriesLeft > 0) {
      await new Promise((r) => setTimeout(r, 2000))
      return generateSingleChunkSpeech(options, retriesLeft - 1)
    }
    throw err
  }
}

/**
 * Generates speech using AI Dancing Voice Clone API with multi-threaded concurrent pool (max 15 workers).
 * Automatically splits long text (e.g. 20,000 characters) into smart sentence chunks without breaking
 * numbers (10.000, 2,000) or abbreviations, processes in parallel, and merges in exact sequential order.
 */
// fallow-ignore-next-line complexity
export async function generateAiDancingSpeech(
  options: GenerateAiDancingSpeechOptions,
): Promise<{ blob: Blob; file: File; duration: number }> {
  const trimmedText = options.text.trim()
  if (!trimmedText) {
    throw new Error('Vui lòng nhập văn bản cần đọc.')
  }

  // Split into smart chunks (1200 - 1800 chars)
  const chunks = splitTextIntoSmartChunks(trimmedText, 1200, 1800)
  const totalChunks = chunks.length

  if (totalChunks === 1) {
    const firstChunk = chunks[0] ?? trimmedText
    options.onProgress?.('Đang gửi yêu cầu Clone giọng tới máy chủ AI Dancing...')
    const singleResult = await generateSingleChunkSpeech({
      text: firstChunk,
      previewUrl: options.previewUrl,
      voiceIndex: options.voiceIndex,
      signal: options.signal,
      onProgress: options.onProgress,
    })

    const file = new File(
      [singleResult.blob],
      `aidancing-clone-${sanitizeAiOutputFileNameSegment(trimmedText.slice(0, 30), 'audio')}.mp3`,
      { type: 'audio/mpeg', lastModified: Date.now() },
    )
    return { blob: singleResult.blob, file, duration: singleResult.duration }
  }

  // Multi-chunk concurrent worker pool
  const maxConcurrency = Math.min(options.maxConcurrency ?? MAX_AI_DANCING_CONCURRENCY, 15)
  const activeWorkers = Math.min(totalChunks, maxConcurrency)
  options.onProgress?.(
    `Đã chia văn bản thành ${totalChunks} đoạn. Đang chạy song song ${activeWorkers} luồng...`,
  )

  const results: Array<{ blob: Blob; duration: number } | null> = new Array(totalChunks).fill(null)
  let nextChunkIndex = 0
  let completedCount = 0

  async function worker() {
    while (nextChunkIndex < totalChunks) {
      if (options.signal?.aborted) {
        throw new DOMException('Generation cancelled by user', 'AbortError')
      }
      const index = nextChunkIndex++
      const chunkText = chunks[index] ?? ''
      if (!chunkText) continue

      const chunkResult = await generateSingleChunkSpeech({
        text: chunkText,
        previewUrl: options.previewUrl,
        voiceIndex: options.voiceIndex,
        signal: options.signal,
        onProgress: (status) => {
          options.onProgress?.(
            `Đoạn ${index + 1}/${totalChunks}: ${status} [Đã xong ${completedCount}/${totalChunks}]`,
          )
        },
      })

      results[index] = chunkResult
      completedCount++
      const percent = Math.round((completedCount / totalChunks) * 100)
      options.onProgress?.(
        `Đa luồng AI Dancing: Đã xong ${completedCount}/${totalChunks} đoạn (${percent}%)`,
      )
    }
  }

  const workers = Array.from({ length: activeWorkers }, () => worker())
  await Promise.all(workers)

  options.onProgress?.(`Đang ghép ${totalChunks} đoạn âm thanh theo đúng thứ tự...`)

  // Ensure all chunks were completed
  for (let i = 0; i < totalChunks; i++) {
    if (!results[i]) {
      throw new Error(`Đoạn số ${i + 1} chưa hoàn thành thành công.`)
    }
  }

  // Merge all MP3 blobs in exact sequence 0..N-1
  const orderedBlobs = results.map((r) => r!.blob)
  const finalBlob = new Blob(orderedBlobs, { type: 'audio/mpeg' })
  const totalDuration = results.reduce((sum, r) => sum + r!.duration, 0)

  const file = new File(
    [finalBlob],
    `aidancing-clone-${sanitizeAiOutputFileNameSegment(trimmedText.slice(0, 30), 'audio')}.mp3`,
    { type: 'audio/mpeg', lastModified: Date.now() },
  )

  return { blob: finalBlob, file, duration: totalDuration }
}
