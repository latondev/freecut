import type { TitleScene } from '../types'

const TAU = Math.PI * 2
const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v)

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInCubic = (t: number) => t * t * t
const easeOutBack = (t: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

function hash32(a: number, b: number, c: number): number {
  let h =
    Math.imul(a | 0, 0x27d4eb2d) ^
    Math.imul((b | 0) + 0x632be5ab, 0x165667b1) ^
    Math.imul((c | 0) + 0x5bd1e995, 0x9e3779b1)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

function rnd(a: number, b = 0, c = 0): number {
  return hash32(a, b, c) / 4294967296
}

function graphemes(text: string): string[] {
  if (!text) return []
  if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
    const segmenter = new (Intl as any).Segmenter('ja', { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text), (s: any) => s.segment)
  }
  return Array.from(text)
}

function isBlank(ch: string): boolean {
  return ch === ' ' || ch === '　' || ch === '\t' || /^\s+$/.test(ch)
}

function colorWithAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  if (!m || !m[1]) return hex
  const v = parseInt(m[1], 16)
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${clamp(alpha)})`
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
  return c
}

export interface RenderOptions {
  scale?: number
}

export class TextRenderer {
  private measureCanvas = makeCanvas(8, 8)
  private mctx = this.measureCanvas.getContext('2d')!

  private prepared: {
    scene: TitleScene
    layout: any
    timeline: any
  } | null = null

  private spriteCache = new Map<string, any>()
  private lastSpriteKey = ''

  prepare(scene: TitleScene) {
    const fonts = {
      mainFont: (size: number) =>
        `${scene.italic ? 'italic ' : ''}${scene.weight || 700} ${Math.max(1, size)}px "${scene.fontId}", Inter, sans-serif`,
      subFont: (size: number) =>
        `${scene.subItalic ? 'italic ' : ''}${scene.subWeight || 400} ${Math.max(1, size)}px "${scene.subFontId === 'same' ? scene.fontId : scene.subFontId}", Inter, sans-serif`,
    }

    const layout = this.computeLayout(scene, fonts)
    const timeline = this.buildTimeline(scene, layout)

    const spriteKey = JSON.stringify([
      scene.text,
      scene.subText,
      scene.mode,
      scene.fontId,
      scene.subFontId,
      scene.fontSize,
      scene.subSize,
      scene.fill,
      scene.fillOpacity,
      scene.stroke,
      scene.stroke2,
      scene.shadow,
      scene.glow,
      scene.subColorOn,
      scene.subColor,
      scene.writing,
      layout.size,
    ])

    if (spriteKey !== this.lastSpriteKey) {
      this.spriteCache.clear()
      this.lastSpriteKey = spriteKey
    }

    this.attachSprites(scene, layout, fonts)

    this.prepared = { scene, layout, timeline }
    return this.prepared
  }

  getDuration(): number {
    return this.prepared ? this.prepared.timeline.duration : 3
  }

  private computeLayout(scene: TitleScene, fonts: any) {
    const W = scene.width
    const H = scene.height
    const vertical = scene.writing === 'v'
    const mainLines = (scene.text || '').split('\n').map((line) => graphemes(line))
    const subLines = (scene.subText || '').trim()
      ? (scene.subText || '').split('\n').map((line) => graphemes(line))
      : []

    const baseSize = Math.max(12, scene.fontSize || 96)
    const subSize = baseSize * (scene.subSize || 0.35)

    const mainLayout = this.layoutGroup(mainLines, {
      font: fonts.mainFont(baseSize),
      size: baseSize,
      ls: scene.letterSpacing || 0,
      lh: scene.lineHeight || 1.4,
      align: scene.align || 'center',
      vertical,
    })

    let subLayout: any = null
    if (subLines.length > 0) {
      subLayout = this.layoutGroup(subLines, {
        font: fonts.subFont(subSize),
        size: subSize,
        ls: scene.subLetterSpacing || 0,
        lh: scene.lineHeight || 1.4,
        align: scene.align || 'center',
        vertical,
      })
    }

    const gap = (scene.subGap || 0.3) * baseSize
    const alignF = scene.align === 'start' ? 0 : scene.align === 'end' ? 1 : 0.5

    if (subLayout) {
      if (!vertical) {
        const w = Math.max(
          mainLayout.box.x1 - mainLayout.box.x0,
          subLayout.box.x1 - subLayout.box.x0,
        )
        const subDx = (w - (subLayout.box.x1 - subLayout.box.x0)) * alignF - subLayout.box.x0
        if (scene.subPosition === 'above') {
          this.shiftGroup(subLayout, subDx, mainLayout.box.y0 - gap - subLayout.box.y1)
        } else {
          this.shiftGroup(subLayout, subDx, mainLayout.box.y1 + gap - subLayout.box.y0)
        }
      } else {
        const h = Math.max(
          mainLayout.box.y1 - mainLayout.box.y0,
          subLayout.box.y1 - subLayout.box.y0,
        )
        const subDy = (h - (subLayout.box.y1 - subLayout.box.y0)) * alignF - subLayout.box.y0
        if (scene.subPosition === 'above') {
          this.shiftGroup(subLayout, mainLayout.box.x1 + gap - subLayout.box.x0, subDy)
        } else {
          this.shiftGroup(subLayout, mainLayout.box.x0 - gap - subLayout.box.x1, subDy)
        }
      }
    }

    const union = (a: any, b: any) => ({
      x0: Math.min(a.x0, b.x0),
      y0: Math.min(a.y0, b.y0),
      x1: Math.max(a.x1, b.x1),
      y1: Math.max(a.y1, b.y1),
    })

    const box = subLayout ? union(mainLayout.box, subLayout.box) : { ...mainLayout.box }

    // Place anchor
    const anchor = scene.anchor || 'mc'
    const row = anchor[0]
    const col = anchor[1]
    const mx = scene.marginX || 0
    const my = scene.marginY || 0
    let dx = 0
    let dy = 0

    if (col === 'l') dx = mx - box.x0
    else if (col === 'r') dx = W - mx - box.x1
    else dx = W / 2 - (box.x0 + box.x1) / 2

    if (row === 't') dy = my - box.y0
    else if (row === 'b') dy = H - my - box.y1
    else dy = H / 2 - (box.y0 + box.y1) / 2

    dx += scene.offsetX || 0
    dy += scene.offsetY || 0

    this.shiftGroup(mainLayout, dx, dy)
    if (subLayout) this.shiftGroup(subLayout, dx, dy)
    box.x0 += dx
    box.y0 += dy
    box.x1 += dx
    box.y1 += dy

    const allGlyphs: any[] = []
    ;[mainLayout, subLayout].filter(Boolean).forEach((grp, grpIdx) => {
      grp.glyphs.forEach((g: any, seq: number) => {
        g.group = grpIdx
        g.seq = seq
        g.index = allGlyphs.length
        allGlyphs.push(g)
      })
    })

    return {
      W,
      H,
      vertical,
      size: baseSize,
      subSize,
      box,
      mainBox: mainLayout.box,
      subBox: subLayout ? subLayout.box : null,
      mainLayout,
      subLayout,
      glyphs: allGlyphs,
    }
  }

  private layoutGroup(lines: string[][], spec: any) {
    const { font, size, ls, lh, align, vertical } = spec
    const lsPx = ls * size
    const alignF = align === 'start' ? 0 : align === 'end' ? 1 : 0.5
    this.mctx.font = font
    const glyphs: any[] = []

    if (!vertical) {
      this.mctx.textAlign = 'left'
      this.mctx.textBaseline = 'alphabetic'
      const pitch = lh * size
      let maxW = 0
      const rows = lines.map((chars, li) => {
        const widths = [0]
        let acc = ''
        chars.forEach((ch) => {
          acc += ch
          widths.push(this.mctx.measureText(acc).width)
        })
        const lastW = widths[chars.length] ?? 0
        const lineW = chars.length ? lastW + lsPx * (chars.length - 1) : 0
        maxW = Math.max(maxW, lineW)
        return { chars, widths, lineW, baseline: li * pitch }
      })

      const y0 = -size * 0.8
      const y1 = (rows.length - 1) * pitch + size * 0.2

      rows.forEach((row, li) => {
        const x0 = (maxW - row.lineW) * alignF
        const lineCenter = x0 + row.lineW / 2
        row.chars.forEach((ch, i) => {
          const wI = row.widths[i] ?? 0
          const wNext = row.widths[i + 1] ?? wI
          const penX = x0 + wI + lsPx * i
          const adv = wNext - wI
          const cx = penX + adv / 2
          const cy = row.baseline - size * 0.35
          glyphs.push({
            ch,
            blank: isBlank(ch),
            line: li,
            col: i,
            size,
            vertical: false,
            cx,
            cy,
            adv,
            lineOffset: cx - lineCenter,
            penX,
            baseline: row.baseline,
          })
        })
      })

      return { glyphs, box: { x0: 0, y0, x1: maxW, y1 } }
    } else {
      this.mctx.textAlign = 'center'
      this.mctx.textBaseline = 'middle'
      const pitch = lh * size
      const maxChars = Math.max(...lines.map((l) => l.length), 1)
      const maxLen = maxChars * (size + lsPx)
      const cols = lines

      cols.forEach((chars, ci) => {
        const cxCol = -ci * pitch
        const top = (maxLen - chars.length * (size + lsPx)) * alignF
        const lineCenter = top + (chars.length * (size + lsPx)) / 2
        let pos = top
        chars.forEach((ch, j) => {
          const adv = size
          const center = pos + adv / 2
          glyphs.push({
            ch,
            blank: isBlank(ch),
            line: ci,
            col: j,
            size,
            vertical: true,
            cx: cxCol,
            cy: center,
            adv,
            lineOffset: center - lineCenter,
            penX: cxCol,
            baseline: pos,
          })
          pos += adv + lsPx
        })
      })

      const x0 = cols.length ? -(cols.length - 1) * pitch - size / 2 : -size / 2
      return { glyphs, box: { x0, y0: 0, x1: size / 2, y1: maxLen } }
    }
  }

  private shiftGroup(group: any, dx: number, dy: number) {
    group.glyphs.forEach((g: any) => {
      g.cx += dx
      g.cy += dy
      g.penX += dx
      g.baseline += dy
    })
    group.box = {
      x0: group.box.x0 + dx,
      y0: group.box.y0 + dy,
      x1: group.box.x1 + dx,
      y1: group.box.y1 + dy,
    }
  }

  private buildTimeline(scene: TitleScene, layout: any) {
    const glyphs = layout.glyphs
    const n = glyphs.length
    const inStart = new Float64Array(n)
    const inDur = new Float64Array(n)
    const outStart = new Float64Array(n)
    const outDur = new Float64Array(n)

    const noIn = scene.inEnabled === false
    const t0 = noIn ? 0 : Math.max(0, scene.startDelay || 0)
    const durIn = Math.max(0.1, scene.inDur || 0.6)
    const durOut = Math.max(0.1, scene.outDur || 0.6)
    const hold = Math.max(0.2, scene.hold || 1.5)
    const stagger = scene.inStagger || 0

    let inEnd = t0
    glyphs.forEach((_g: any, i: number) => {
      if (noIn) {
        inStart[i] = t0
        inDur[i] = 0
      } else {
        const orderIdx =
          scene.inOrder === 'reverse'
            ? n - 1 - i
            : scene.inOrder === 'center'
              ? Math.abs(i - (n - 1) / 2)
              : i
        inStart[i] = t0 + orderIdx * stagger
        inDur[i] = durIn
        inEnd = Math.max(inEnd, inStart[i] + durIn)
      }
    })

    const holdEnd = inEnd + hold
    let outEnd = holdEnd

    if (scene.outEnabled !== false && scene.outFx !== 'none') {
      const outStagger = scene.outStagger || 0
      glyphs.forEach((_g: any, i: number) => {
        const orderIdx = scene.outOrder === 'reverse' ? n - 1 - i : i
        outStart[i] = holdEnd + orderIdx * outStagger
        outDur[i] = durOut
        outEnd = Math.max(outEnd, outStart[i] + durOut)
      })
    } else {
      glyphs.forEach((_: any, i: number) => {
        outStart[i] = Infinity
        outDur[i] = 0
      })
      outEnd = holdEnd + 0.5
    }

    const duration = outEnd + (scene.endDelay || 0.2)

    return {
      inStart,
      inDur,
      outStart,
      outDur,
      inEnd,
      holdEnd,
      outEnd,
      duration,
    }
  }

  private attachSprites(scene: TitleScene, layout: any, fonts: any) {
    layout.glyphs.forEach((g: any) => {
      if (g.blank) return
      const key = `${g.group}|${g.ch}|${g.size}`
      if (!this.spriteCache.has(key)) {
        const font = g.group === 1 ? fonts.subFont(g.size) : fonts.mainFont(g.size)
        const sprite = this.renderGlyphSprite(g.ch, font, g.size, scene, g.group)
        this.spriteCache.set(key, sprite)
      }
      g.sprite = this.spriteCache.get(key)
    })
  }

  private renderGlyphSprite(
    ch: string,
    font: string,
    size: number,
    scene: TitleScene,
    group: number,
  ) {
    this.mctx.font = font
    const m = this.mctx.measureText(ch)
    const pad = Math.ceil(size * 0.8)
    const w = Math.ceil(m.width + pad * 2)
    const h = Math.ceil(size * 1.5 + pad * 2)
    const c = makeCanvas(w, h)
    const ctx = c.getContext('2d')!

    ctx.font = font
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    const x = pad
    const y = pad + size * 0.9

    // Glow
    if (scene.glow && scene.glow.on) {
      ctx.save()
      ctx.shadowColor = scene.glow.color
      ctx.shadowBlur = scene.glow.size
      ctx.fillStyle = scene.glow.color
      ctx.fillText(ch, x, y)
      ctx.restore()
    }

    // Shadow
    if (scene.shadow && scene.shadow.on) {
      ctx.save()
      ctx.shadowColor = colorWithAlpha(scene.shadow.color, scene.shadow.opacity)
      ctx.shadowBlur = scene.shadow.blur
      ctx.shadowOffsetX = scene.shadow.x
      ctx.shadowOffsetY = scene.shadow.y
      ctx.fillStyle = '#000000'
      ctx.fillText(ch, x, y)
      ctx.restore()
    }

    // Outer Stroke (stroke2)
    if (scene.stroke2 && scene.stroke2.on && scene.stroke2.width > 0) {
      ctx.save()
      const totalStroke = ((scene.stroke?.on ? scene.stroke.width : 0) + scene.stroke2.width) * 2
      ctx.strokeStyle = scene.stroke2.color
      ctx.lineWidth = totalStroke
      ctx.strokeText(ch, x, y)
      ctx.restore()
    }

    // Inner Stroke (stroke)
    if (scene.stroke && scene.stroke.on && scene.stroke.width > 0) {
      ctx.save()
      ctx.strokeStyle = scene.stroke.color
      ctx.lineWidth = scene.stroke.width * 2
      ctx.strokeText(ch, x, y)
      ctx.restore()
    }

    // Fill
    ctx.save()
    ctx.globalAlpha = scene.fillOpacity ?? 1
    if (group === 1 && scene.subColorOn) {
      ctx.fillStyle = scene.subColor
    } else if (scene.fill?.type === 'gradient' && scene.fill.color2) {
      const grad = ctx.createLinearGradient(x, y - size, x, y)
      grad.addColorStop(0, scene.fill.color)
      grad.addColorStop(0.5, scene.fill.color2)
      if (scene.fill.color3) grad.addColorStop(1, scene.fill.color3)
      ctx.fillStyle = grad
    } else {
      ctx.fillStyle = scene.fill?.color || '#ffffff'
    }
    ctx.fillText(ch, x, y)
    ctx.restore()

    return { canvas: c, ox: pad + m.width / 2, oy: y - size * 0.35, w, h }
  }

  render(targetCtx: CanvasRenderingContext2D, t: number, options: RenderOptions = {}) {
    if (!this.prepared) return
    const { scene, layout, timeline } = this.prepared
    const scale = options.scale || 1
    const cw = targetCtx.canvas.width
    const ch = targetCtx.canvas.height

    targetCtx.save()
    targetCtx.setTransform(1, 0, 0, 1, 0, 0)
    targetCtx.clearRect(0, 0, cw, ch)

    // 1. Draw Background
    this.drawBackground(targetCtx, t, scale, scene)

    // 2. Draw Decorations (Under text)
    this.drawDeco(targetCtx, t, scale, scene, layout, timeline)

    // 3. Draw Text Glyphs Directly to Target Context
    layout.glyphs.forEach((g: any, i: number) => {
      if (g.blank || !g.sprite) return
      const tIn = timeline.inStart[i]
      const durIn = timeline.inDur[i]
      const tOut = timeline.outStart[i]
      const durOut = timeline.outDur[i]

      if (t < tIn) return
      if (t >= tOut + durOut) return

      let alpha = 1
      let dx = 0
      let dy = 0
      let sx = 1
      let sy = 1
      let blur = 0

      // In Animation
      if (durIn > 0 && t < tIn + durIn) {
        const p = clamp((t - tIn) / durIn)
        const e = easeOutCubic(p)
        switch (scene.inFx) {
          case 'fade':
            alpha = e
            break
          case 'rise':
            alpha = e
            dy = (1 - e) * g.size * 0.5
            break
          case 'drop':
            alpha = e
            dy = -(1 - e) * g.size * 0.5
            break
          case 'converge': {
            alpha = e
            const sign = i % 2 === 0 ? 1 : -1
            if (layout.vertical) dx = (1 - e) * g.size * 0.6 * sign
            else dy = (1 - e) * g.size * 0.6 * sign
            break
          }
          case 'slide': {
            alpha = e
            const d = (1 - e) * g.size * 1.1
            if (scene.inDir === 'right') dx = d
            else if (scene.inDir === 'up') dy = -d
            else if (scene.inDir === 'down') dy = d
            else dx = -d
            break
          }
          case 'tracking': {
            alpha = e
            const d = g.lineOffset * (1 - e) * 1.5
            if (layout.vertical) dy = d
            else dx = d
            break
          }
          case 'blurIn':
            alpha = e
            blur = (1 - e) * 8
            break
          case 'pop':
            alpha = clamp(p * 3)
            sx = sy = easeOutBack(p)
            break
          case 'flicker':
            alpha = rnd(Math.floor(p * 16), g.seq) > 0.4 ? 1 : 0.1
            break
          default:
            alpha = e
        }
      }

      // Out Animation
      if (t >= tOut && durOut > 0) {
        const p = clamp((t - tOut) / durOut)
        const e = easeInCubic(p)
        switch (scene.outFx) {
          case 'fade':
            alpha *= 1 - e
            break
          case 'rise':
            alpha *= 1 - e
            dy -= e * g.size * 0.5
            break
          case 'sink':
            alpha *= 1 - e
            dy += e * g.size * 0.5
            break
          case 'slide': {
            alpha *= 1 - e
            const d = e * g.size * 1.1
            if (scene.outDir === 'right') dx += d
            else if (scene.outDir === 'up') dy -= d
            else if (scene.outDir === 'down') dy += d
            else dx -= d
            break
          }
          case 'blurOut':
            alpha *= 1 - e
            blur += e * 8
            break
          default:
            alpha *= 1 - e
        }
      }

      // Hold Animation
      if (t >= timeline.inEnd && t < timeline.holdEnd) {
        const ht = t - timeline.inEnd
        if (scene.holdFx === 'float') {
          dy += Math.sin((TAU * ht) / 2.5) * g.size * 0.04
        } else if (scene.holdFx === 'wave') {
          dy += Math.sin((TAU * ht) / 1.5 - i * 0.5) * g.size * 0.06
        } else if (scene.holdFx === 'pulse') {
          const s = 1 + Math.sin(TAU * ht * 1.2) * 0.03
          sx *= s
          sy *= s
        } else if (scene.holdFx === 'shake') {
          const f = Math.floor(ht * 20)
          dx += (rnd(f, 1) - 0.5) * g.size * 0.04
          dy += (rnd(f, 2) - 0.5) * g.size * 0.04
        }
      }

      if (alpha <= 0.01) return

      targetCtx.save()
      const posX = (g.cx + dx) * scale
      const posY = (g.cy + dy) * scale
      targetCtx.translate(posX, posY)
      if (sx !== 1 || sy !== 1) targetCtx.scale(sx, sy)
      targetCtx.globalAlpha = clamp(alpha)
      if (blur > 0) targetCtx.filter = `blur(${blur.toFixed(1)}px)`
      targetCtx.drawImage(
        g.sprite.canvas,
        -g.sprite.ox * scale,
        -g.sprite.oy * scale,
        g.sprite.w * scale,
        g.sprite.h * scale,
      )
      targetCtx.restore()
    })

    targetCtx.restore()
  }

  private drawBackground(
    ctx: CanvasRenderingContext2D,
    _t: number,
    scale: number,
    scene: TitleScene,
  ) {
    const bg = scene.bg
    if (!bg || bg.type === 'none') return
    const W = scene.width * scale
    const H = scene.height * scale
    const alpha = clamp(bg.opacity ?? 0.5)

    ctx.save()
    if (bg.type === 'solid') {
      ctx.fillStyle = colorWithAlpha(bg.color || '#000000', alpha)
      ctx.fillRect(0, 0, W, H)
    } else if (bg.type === 'vignette') {
      const g = ctx.createRadialGradient(
        W / 2,
        H / 2,
        Math.min(W, H) * 0.2,
        W / 2,
        H / 2,
        Math.hypot(W, H) / 2,
      )
      g.addColorStop(0, colorWithAlpha(bg.color || '#000000', 0))
      g.addColorStop(1, colorWithAlpha(bg.color || '#000000', alpha))
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
    }
    ctx.restore()
  }

  private drawDeco(
    ctx: CanvasRenderingContext2D,
    t: number,
    scale: number,
    scene: TitleScene,
    layout: any,
    timeline: any,
  ) {
    const d = scene.deco
    if (!d || d.type === 'none') return

    const tIn = timeline.inStart[0]
    const durIn = d.dur || 0.5
    if (t < tIn) return

    let alpha = 1
    let grow = 1
    if (t < tIn + durIn) {
      const p = clamp((t - tIn) / durIn)
      const e = easeOutCubic(p)
      if (d.anim === 'grow') grow = e
      alpha = e
    }

    const tOut = timeline.outStart[0]
    if (t >= tOut && timeline.outDur[0] > 0) {
      const p = clamp((t - tOut) / timeline.outDur[0])
      alpha *= 1 - easeInCubic(p)
    }

    if (alpha <= 0.01) return

    const b = layout.box
    const pad = (d.pad || 0.4) * layout.size
    const x0 = (b.x0 - pad) * scale
    const y0 = (b.y0 - pad) * scale
    const w = (b.x1 - b.x0 + pad * 2) * scale
    const h = (b.y1 - b.y0 + pad * 2) * scale

    ctx.save()
    ctx.globalAlpha = clamp(alpha)

    const lineColor = d.color2 || '#ffffff'
    const fillColor = colorWithAlpha(d.color || '#000000', d.opacity ?? 0.6)
    const strokeWidth = (d.thickness || 2) * scale

    switch (d.type) {
      case 'box': {
        const radius = (d.radius || 0.12) * Math.min(w, h)
        ctx.fillStyle = fillColor
        ctx.beginPath()
        ctx.roundRect(x0, y0, w, h, radius)
        ctx.fill()
        if (strokeWidth > 0 && d.color2) {
          ctx.strokeStyle = lineColor
          ctx.lineWidth = strokeWidth
          ctx.stroke()
        }
        break
      }
      case 'corners': {
        const arm = Math.min(w, h) * 0.25 * grow
        ctx.strokeStyle = lineColor
        ctx.lineWidth = strokeWidth
        ctx.lineCap = 'square'

        // TL
        ctx.beginPath()
        ctx.moveTo(x0, y0 + arm)
        ctx.lineTo(x0, y0)
        ctx.lineTo(x0 + arm, y0)
        ctx.stroke()

        // TR
        ctx.beginPath()
        ctx.moveTo(x0 + w - arm, y0)
        ctx.lineTo(x0 + w, y0)
        ctx.lineTo(x0 + w, y0 + arm)
        ctx.stroke()

        // BR
        ctx.beginPath()
        ctx.moveTo(x0 + w, y0 + h - arm)
        ctx.lineTo(x0 + w, y0 + h)
        ctx.lineTo(x0 + w - arm, y0 + h)
        ctx.stroke()

        // BL
        ctx.beginPath()
        ctx.moveTo(x0 + arm, y0 + h)
        ctx.lineTo(x0, y0 + h)
        ctx.lineTo(x0, y0 + h - arm)
        ctx.stroke()
        break
      }
      case 'underline': {
        const curW = w * grow
        ctx.strokeStyle = lineColor
        ctx.lineWidth = strokeWidth
        ctx.beginPath()
        ctx.moveTo(x0, y0 + h)
        ctx.lineTo(x0 + curW, y0 + h)
        ctx.stroke()
        break
      }
      case 'sides': {
        const arm = (d.extend || 1) * layout.size * scale * grow
        ctx.strokeStyle = lineColor
        ctx.lineWidth = strokeWidth
        const midY = y0 + h / 2
        // Left
        ctx.beginPath()
        ctx.moveTo(x0 - arm, midY)
        ctx.lineTo(x0, midY)
        ctx.stroke()
        // Right
        ctx.beginPath()
        ctx.moveTo(x0 + w, midY)
        ctx.lineTo(x0 + w + arm, midY)
        ctx.stroke()
        break
      }
      case 'band': {
        ctx.fillStyle = fillColor
        ctx.fillRect(0, y0, scene.width * scale, h)
        break
      }
      case 'frame': {
        ctx.strokeStyle = lineColor
        ctx.lineWidth = strokeWidth
        ctx.strokeRect(x0, y0, w, h)
        break
      }
      case 'tape': {
        // Warning diagonal hazard tape
        ctx.save()
        ctx.fillStyle = d.tapeColor || '#f5c400'
        ctx.fillRect(0, y0, scene.width * scale, h)
        ctx.fillStyle = d.tapeStripe || '#151515'
        const stripeW = 30 * scale
        const offset = ((t * (d.tapeSpeed || 90)) % (stripeW * 2)) * scale
        for (
          let sx = -stripeW * 2 + offset;
          sx < scene.width * scale + stripeW * 2;
          sx += stripeW * 2
        ) {
          ctx.beginPath()
          ctx.moveTo(sx, y0 + h)
          ctx.lineTo(sx + stripeW, y0 + h)
          ctx.lineTo(sx + stripeW * 1.8, y0)
          ctx.lineTo(sx + stripeW * 0.8, y0)
          ctx.closePath()
          ctx.fill()
        }
        ctx.restore()
        break
      }
    }

    ctx.restore()
  }
}
