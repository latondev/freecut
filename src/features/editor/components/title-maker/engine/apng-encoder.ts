const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array, start = 0, end = bytes.length, seed = 0): number {
  let crc = (seed ^ 0xffffffff) >>> 0
  for (let i = start; i < end; i++) {
    const b = bytes[i] ?? 0
    const entry = CRC_TABLE[(crc ^ b) & 0xff] ?? 0
    crc = entry ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out, 4, 8 + data.length))
  return out
}

async function deflateZlib(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as any]).stream().pipeThrough(new CompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function filterImage(src: Uint8Array, width: number, height: number): Uint8Array {
  const bpp = 4
  const rowBytes = width * bpp
  const out = new Uint8Array((rowBytes + 1) * height)
  for (let y = 0; y < height; y++) {
    const o = y * (rowBytes + 1)
    out[o] = 0 // Filter None
    out.set(src.subarray(y * rowBytes, (y + 1) * rowBytes), o + 1)
  }
  return out
}

export interface ApngEncoderOptions {
  width: number
  height: number
  fps: number
  loops?: number
}

export class ApngEncoder {
  private width: number
  private height: number
  private fps: number
  private loops: number
  private frames: Array<{ delay: number; data: Uint8Array }> = []

  constructor(options: ApngEncoderOptions) {
    this.width = options.width
    this.height = options.height
    this.fps = Math.max(1, Math.round(options.fps))
    this.loops = Math.max(0, Math.round(options.loops || 0))
  }

  async addFrame(imageData: ImageData | Uint8Array, delay = 1) {
    const bytes =
      imageData instanceof Uint8Array ? imageData : new Uint8Array(imageData.data.buffer)
    const filtered = filterImage(bytes, this.width, this.height)
    const compressed = await deflateZlib(filtered)
    this.frames.push({ delay, data: compressed })
  }

  finish(): Blob {
    if (!this.frames.length) throw new Error('No frames to encode')

    const parts: Uint8Array[] = [PNG_SIGNATURE]

    // 1. IHDR
    const ihdr = new Uint8Array(13)
    const ihdrView = new DataView(ihdr.buffer)
    ihdrView.setUint32(0, this.width)
    ihdrView.setUint32(4, this.height)
    ihdr[8] = 8 // bit depth
    ihdr[9] = 6 // color type RGBA
    parts.push(makeChunk('IHDR', ihdr))

    // 2. acTL
    const actl = new Uint8Array(8)
    const actlView = new DataView(actl.buffer)
    actlView.setUint32(0, this.frames.length)
    actlView.setUint32(4, this.loops)
    parts.push(makeChunk('acTL', actl))

    // 3. Frames
    let seq = 0
    this.frames.forEach((frame, index) => {
      // fcTL
      const fctl = new Uint8Array(26)
      const fctlView = new DataView(fctl.buffer)
      fctlView.setUint32(0, seq++)
      fctlView.setUint32(4, this.width)
      fctlView.setUint32(8, this.height)
      fctlView.setUint32(12, 0) // x_offset
      fctlView.setUint32(16, 0) // y_offset
      fctlView.setUint16(20, frame.delay)
      fctlView.setUint16(22, this.fps)
      fctl[24] = 0 // APNG_DISPOSE_OP_NONE
      fctl[25] = 0 // APNG_BLEND_OP_SOURCE
      parts.push(makeChunk('fcTL', fctl))

      if (index === 0) {
        // IDAT
        parts.push(makeChunk('IDAT', frame.data))
      } else {
        // fdAT
        const fdat = new Uint8Array(4 + frame.data.length)
        const fdatView = new DataView(fdat.buffer)
        fdatView.setUint32(0, seq++)
        fdat.set(frame.data, 4)
        parts.push(makeChunk('fdAT', fdat))
      }
    })

    // 4. IEND
    parts.push(makeChunk('IEND', new Uint8Array(0)))

    return new Blob(parts as any, { type: 'image/png' })
  }
}
