import type { TextMotionSpec } from '@/types/text-motion'
import type { TextMotionInPresetId } from './text-motion/text-motion-preset-ids'
import { createTextMotionEffect } from './text-motion'
import type { TextTemplateCardItem, TextTemplateCategory } from './text-templates-catalog'

type AnimatedTemplateCategory = Exclude<TextTemplateCategory, 'all'>

type TemplateMotionSource = Pick<TextTemplateCardItem, 'category' | 'motionPresetId'>

const MOTION_BY_CATEGORY: Record<AnimatedTemplateCategory, TextMotionInPresetId> = {
  trending: 'pop',
  vietnamese: 'cascade',
  titles: 'fade-up',
  subtitles: 'typewriter',
  sale: 'pop',
  social: 'cascade',
  food: 'rise',
  travel: 'slide-mask',
  fitness: 'rise',
  tech: 'blur-in',
  vlog: 'fade-up',
  gaming: 'wave-in',
  cute: 'pop',
  retro: 'cascade',
  celebration: 'wave-in',
  whimsical: 'rise',
}

export function getTextTemplateMotionPresetId(
  template: TemplateMotionSource,
): TextMotionInPresetId {
  return template.motionPresetId ?? MOTION_BY_CATEGORY[template.category]
}

export function createTextTemplateMotion(template: TemplateMotionSource): TextMotionSpec {
  return { in: createTextMotionEffect(getTextTemplateMotionPresetId(template)) }
}

function parseHexOrRgb(color: string): [number, number, number] {
  if (color.startsWith('#')) {
    let c = color.slice(1)
    if (c.length === 3)
      c = c
        .split('')
        .map((x) => x + x)
        .join('')
    if (c.length === 8) c = c.slice(0, 6)
    const num = parseInt(c, 16)
    if (!Number.isNaN(num)) {
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
    }
  }
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (match) {
    return [parseInt(match[1]!, 10), parseInt(match[2]!, 10), parseInt(match[3]!, 10)]
  }
  return [255, 255, 255]
}

// fallow-ignore-next-line complexity
export function getCapcutAlphaTextGradient(baseColor?: string): string {
  const color = baseColor || '#ffffff'
  const [r, g, b] = parseHexOrRgb(color)
  const brightness = r * 0.299 + g * 0.587 + b * 0.114

  if (brightness < 50) {
    return 'linear-gradient(180deg, #f8fafc 0%, #94a3b8 50%, #334155 100%)'
  }

  // Yellow / Gold
  if (r > 200 && g > 160 && b < 100) {
    return 'linear-gradient(180deg, #fffbeb 0%, #fde047 30%, #f59e0b 70%, #b45309 100%)'
  }
  // Pink / Magenta / Rose
  if (r > 210 && b > 140 && g < 180) {
    return 'linear-gradient(180deg, #fff1f2 0%, #f472b6 35%, #ec4899 70%, #be185d 100%)'
  }
  // Cyan / Sky
  if (b > 200 && g > 180 && r < 140) {
    return 'linear-gradient(180deg, #f0fdfa 0%, #67e8f9 35%, #06b6d4 70%, #0369a1 100%)'
  }
  // Red / Orange
  if (r > 210 && g < 130 && b < 120) {
    return 'linear-gradient(180deg, #fffbeb 0%, #fde047 25%, #f97316 65%, #dc2626 100%)'
  }
  // Purple / Violet
  if (r > 140 && b > 200 && g < 140) {
    return 'linear-gradient(180deg, #faf5ff 0%, #d8b4fe 35%, #9333ea 70%, #581c87 100%)'
  }
  // Pure White / Near-White
  if (r > 240 && g > 240 && b > 240) {
    return 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 45%, #cbd5e1 75%, #94a3b8 100%)'
  }

  const topR = Math.min(255, Math.round(r + (255 - r) * 0.42))
  const topG = Math.min(255, Math.round(g + (255 - g) * 0.42))
  const topB = Math.min(255, Math.round(b + (255 - b) * 0.42))

  const botR = Math.max(0, Math.round(r * 0.68))
  const botG = Math.max(0, Math.round(g * 0.68))
  const botB = Math.max(0, Math.round(b * 0.68))

  return `linear-gradient(180deg, rgb(${topR}, ${topG}, ${topB}) 0%, rgb(${r}, ${g}, ${b}) 50%, rgb(${botR}, ${botG}, ${botB}) 100%)`
}
