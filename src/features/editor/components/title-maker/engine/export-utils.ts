import { ApngEncoder } from './apng-encoder'
import { TextRenderer } from './renderer'
import type { TitleScene } from '../types'

export interface ExportProgress {
  current: number
  total: number
  phase: 'rendering' | 'encoding' | 'done'
}

export async function exportTitleAsApng(
  scene: TitleScene,
  fps = 24,
  onProgress?: (progress: ExportProgress) => void,
): Promise<Blob> {
  const renderer = new TextRenderer()
  renderer.prepare(scene)
  const duration = renderer.getDuration()
  const totalFrames = Math.max(1, Math.ceil(duration * fps))

  const canvas = document.createElement('canvas')
  canvas.width = scene.width
  canvas.height = scene.height
  const ctx = canvas.getContext('2d')!

  const encoder = new ApngEncoder({
    width: scene.width,
    height: scene.height,
    fps,
    loops: 0,
  })

  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / fps
    renderer.render(ctx, t)
    const imgData = ctx.getImageData(0, 0, scene.width, scene.height)
    await encoder.addFrame(imgData, 1)

    if (onProgress) {
      onProgress({
        current: frame + 1,
        total: totalFrames,
        phase: 'rendering',
      })
    }
  }

  if (onProgress) {
    onProgress({
      current: totalFrames,
      total: totalFrames,
      phase: 'encoding',
    })
  }

  const blob = encoder.finish()

  if (onProgress) {
    onProgress({
      current: totalFrames,
      total: totalFrames,
      phase: 'done',
    })
  }

  return blob
}

export async function exportTitleStillPng(scene: TitleScene, time = 1.0): Promise<Blob> {
  const renderer = new TextRenderer()
  renderer.prepare(scene)

  const canvas = document.createElement('canvas')
  canvas.width = scene.width
  canvas.height = scene.height
  const ctx = canvas.getContext('2d')!

  renderer.render(ctx, time)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to generate PNG blob'))
    }, 'image/png')
  })
}

export async function exportTitleAsWebM(
  scene: TitleScene,
  fps = 30,
  onProgress?: (progress: ExportProgress) => void,
): Promise<Blob> {
  const renderer = new TextRenderer()
  renderer.prepare(scene)
  const duration = renderer.getDuration()

  const canvas = document.createElement('canvas')
  canvas.width = scene.width
  canvas.height = scene.height
  const ctx = canvas.getContext('2d')!

  const stream = canvas.captureStream(fps)
  const chunks: Blob[] = []

  let mimeType = 'video/webm;codecs=vp9'
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm'
  }

  const recorder = new MediaRecorder(stream, { mimeType })
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const recordPromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }))
    }
  })

  recorder.start()

  const totalFrames = Math.ceil(duration * fps)
  const interval = 1000 / fps

  for (let frame = 0; frame <= totalFrames; frame++) {
    const t = frame / fps
    renderer.render(ctx, t)
    if (onProgress) {
      onProgress({
        current: frame,
        total: totalFrames,
        phase: 'rendering',
      })
    }
    await new Promise((r) => setTimeout(r, interval))
  }

  recorder.stop()
  const blob = await recordPromise

  if (onProgress) {
    onProgress({
      current: totalFrames,
      total: totalFrames,
      phase: 'done',
    })
  }

  return blob
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
