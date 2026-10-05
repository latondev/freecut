import type { TextMotionSpec } from '@/types/text-motion'
import type { TextMotionInPresetId } from './text-motion/text-motion-preset-ids'
import { createTextMotionEffect } from './text-motion'
import type { TextTemplateCardItem, TextTemplateCategory } from './text-templates-catalog'

type AnimatedTemplateCategory = Exclude<TextTemplateCategory, 'all'>

type TemplateMotionSource = Pick<TextTemplateCardItem, 'category' | 'motionPresetId'>

const MOTION_BY_CATEGORY: Record<AnimatedTemplateCategory, TextMotionInPresetId> = {
  trending: 'pop',
  bduck: 'pop',
  blackfriday: 'pop',
  whimsical: 'rise',
  pixelbead: 'wave-in',
  classic: 'fade-up',
  new: 'pop',
  hits: 'cascade',
  freefire: 'wave-in',
  nailoong: 'pop',
  icons: 'pop',
  daily: 'fade-up',
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

export type TextTemplateLoopClass =
  | 'capcut-loop-glitch'
  | 'capcut-loop-neon'
  | 'capcut-loop-gold'
  | 'capcut-loop-heart'
  | 'capcut-loop-sparkle'
  | 'capcut-loop-bounce'
  | 'capcut-loop-wave'
  | 'capcut-loop-typewriter'

export function getTextTemplateLoopClass(template: TextTemplateCardItem): TextTemplateLoopClass {
  const id = template.id.toLowerCase()
  const icon = template.icon || ''

  if (
    id.includes('glitch') ||
    id.includes('cyber') ||
    icon === 'zap' ||
    template.category === 'gaming' ||
    template.category === 'tech'
  ) {
    return 'capcut-loop-glitch'
  }
  if (
    id.includes('neon') ||
    id.includes('cassette') ||
    id.includes('retro') ||
    id.includes('shibuya') ||
    template.category === 'retro' ||
    template.category === 'vietnamese' ||
    icon === 'music'
  ) {
    return 'capcut-loop-neon'
  }
  if (
    id.includes('gold') ||
    id.includes('sunburst') ||
    id.includes('cinema') ||
    id.includes('hollywood') ||
    id.includes('luxury') ||
    id.includes('award') ||
    template.category === 'titles'
  ) {
    return 'capcut-loop-gold'
  }
  if (
    id.includes('heart') ||
    id.includes('love') ||
    icon === 'heart' ||
    template.category === 'cute'
  ) {
    return 'capcut-loop-heart'
  }
  if (id.includes('star') || id.includes('perfecto') || icon === 'sparkle' || icon === 'star') {
    return 'capcut-loop-sparkle'
  }
  if (template.category === 'subtitles' || id.includes('typewriter') || id.includes('caption')) {
    return 'capcut-loop-typewriter'
  }
  if (
    template.category === 'sale' ||
    template.category === 'trending' ||
    template.category === 'fitness' ||
    template.badge === 'HOT' ||
    template.badge === 'VIRAL'
  ) {
    return 'capcut-loop-bounce'
  }
  if (
    template.category === 'whimsical' ||
    template.category === 'food' ||
    template.category === 'travel' ||
    template.category === 'vlog'
  ) {
    return 'capcut-loop-wave'
  }
  return 'capcut-loop-gold'
}

export type TemplateMotionKind =
  | 'word-reveal'
  | 'word-bounce'
  | 'typewriter'
  | 'wave'
  | 'neon-flicker'
  | 'glitch-split'
  | 'karaoke-sweep'
  | 'cascade-drop'
  | 'zoom-slam'
  | 'heartbeat-pulse'
  | 'gold-sweep'

// fallow-ignore-next-line complexity
export function getTemplateMotionKind(template: TextTemplateCardItem): TemplateMotionKind {
  const id = template.id.toLowerCase()
  const icon = template.icon || ''
  const cat = template.category

  if (id.includes('typewriter') || (cat === 'subtitles' && id.includes('letter'))) {
    return 'typewriter'
  }
  if (cat === 'subtitles' || id.includes('caption') || id.includes('podcast')) {
    return 'word-reveal'
  }
  if (id.includes('glitch') || id.includes('cyber') || icon === 'zap' || cat === 'gaming') {
    return 'glitch-split'
  }
  if (
    id.includes('neon') ||
    id.includes('shibuya') ||
    id.includes('cassette') ||
    id.includes('tokyo') ||
    cat === 'retro'
  ) {
    return 'neon-flicker'
  }
  if (id.includes('heart') || id.includes('love') || icon === 'heart' || cat === 'cute') {
    return 'heartbeat-pulse'
  }
  if (
    id.includes('gold') ||
    id.includes('sunburst') ||
    id.includes('cinema') ||
    id.includes('hollywood') ||
    id.includes('luxury') ||
    id.includes('award') ||
    cat === 'titles'
  ) {
    return 'gold-sweep'
  }
  if (id.includes('music') || id.includes('nhac') || cat === 'vietnamese' || icon === 'music') {
    return 'karaoke-sweep'
  }
  if (
    cat === 'sale' ||
    id.includes('sale') ||
    id.includes('deal') ||
    id.includes('promo') ||
    template.badge === 'HOT'
  ) {
    return 'word-bounce'
  }
  if (cat === 'fitness' || id.includes('gym') || id.includes('slam')) {
    return 'zoom-slam'
  }
  if (cat === 'food' || cat === 'travel' || cat === 'whimsical' || id.includes('wave')) {
    return 'wave'
  }
  if (cat === 'social' || template.badge === 'VIRAL' || id.includes('trend')) {
    return 'cascade-drop'
  }

  // Fallback: if multi-word, reveal word-by-word; if single word, gold-sweep
  if (template.sample.title.includes(' ')) {
    return 'word-reveal'
  }
  return 'gold-sweep'
}

// fallow-ignore-next-line complexity
export function getCapcutAlphaTextGradient(input?: TextTemplateCardItem | string): string {
  if (input && typeof input === 'object') {
    const id = input.id.toLowerCase()
    const cat = input.category

    if (id.includes('cassette') || id.includes('retro')) {
      return 'linear-gradient(115deg, #00f2fe 0%, #38bdf8 25%, #ffffff 48%, #f43f5e 72%, #ec4899 100%)'
    }
    if (id.includes('glitch') || id.includes('tiktok')) {
      return 'linear-gradient(110deg, #00f5d4 0%, #38bdf8 25%, #ffffff 50%, #ff007f 75%, #7928ca 100%)'
    }
    if (
      id.includes('sunburst') ||
      id.includes('cinema') ||
      id.includes('hollywood') ||
      id.includes('award') ||
      cat === 'titles'
    ) {
      return 'linear-gradient(105deg, #fffbeb 0%, #fef08a 22%, #ffffff 46%, #f59e0b 68%, #b45309 88%, #fef08a 100%)'
    }
    if (id.includes('perfecto')) {
      return 'linear-gradient(110deg, #ffffff 0%, #fef08a 25%, #ffffff 50%, #eab308 72%, #a16207 100%)'
    }
    if (id.includes('heart') || id.includes('love') || cat === 'cute') {
      return 'linear-gradient(115deg, #ffe4e6 0%, #fbcfe8 25%, #ffffff 48%, #f43f5e 72%, #e11d48 100%)'
    }
    if (id.includes('shibuya') || id.includes('neon') || id.includes('tokyo') || cat === 'retro') {
      return 'linear-gradient(115deg, #38bdf8 0%, #818cf8 28%, #ffffff 48%, #c084fc 72%, #ec4899 100%)'
    }
    if (id.includes('nordic') || id.includes('aesthetic') || id.includes('clean')) {
      return 'linear-gradient(115deg, #ffffff 0%, #e2e8f0 28%, #ffffff 50%, #cbd5e1 72%, #94a3b8 100%)'
    }

    if (cat === 'fitness') {
      return 'linear-gradient(110deg, #fef08a 0%, #bef264 30%, #ffffff 50%, #84cc16 75%, #4d7c0f 100%)'
    }
    if (cat === 'sale' || cat === 'trending') {
      return 'linear-gradient(110deg, #fef08a 0%, #f97316 30%, #ffffff 50%, #ef4444 75%, #b91c1c 100%)'
    }
    if (cat === 'food') {
      return 'linear-gradient(110deg, #fed7aa 0%, #fbbf24 30%, #ffffff 50%, #d97706 75%, #92400e 100%)'
    }
    if (cat === 'travel') {
      return 'linear-gradient(115deg, #a7f3d0 0%, #38bdf8 30%, #ffffff 50%, #06b6d4 75%, #0284c7 100%)'
    }
    if (cat === 'gaming' || cat === 'tech') {
      return 'linear-gradient(110deg, #6ee7b7 0%, #22c55e 30%, #ffffff 50%, #06b6d4 75%, #3b82f6 100%)'
    }

    // Default to the template's color patch
    return getCapcutAlphaTextGradient(input.patch.color)
  }

  const color = input || '#ffffff'
  const [r, g, b] = parseHexOrRgb(color)
  const brightness = r * 0.299 + g * 0.587 + b * 0.114

  if (brightness < 50) {
    return 'linear-gradient(110deg, #f8fafc 0%, #cbd5e1 25%, #ffffff 50%, #94a3b8 75%, #475569 100%)'
  }

  // Yellow / Gold
  if (r > 200 && g > 160 && b < 100) {
    return 'linear-gradient(110deg, #fffbeb 0%, #fef08a 22%, #ffffff 48%, #f59e0b 70%, #d97706 88%, #fef08a 100%)'
  }
  // Pink / Magenta / Rose
  if (r > 210 && b > 140 && g < 180) {
    return 'linear-gradient(110deg, #ffe4e6 0%, #fbcfe8 25%, #ffffff 48%, #ec4899 72%, #db2777 100%)'
  }
  // Cyan / Sky
  if (b > 200 && g > 180 && r < 140) {
    return 'linear-gradient(110deg, #ecfeff 0%, #a5f3fc 25%, #ffffff 48%, #06b6d4 72%, #0284c7 100%)'
  }
  // Red / Orange
  if (r > 210 && g < 130 && b < 120) {
    return 'linear-gradient(110deg, #fff7ed 0%, #fed7aa 25%, #ffffff 48%, #f97316 72%, #dc2626 100%)'
  }
  // Purple / Violet
  if (r > 140 && b > 200 && g < 140) {
    return 'linear-gradient(110deg, #faf5ff 0%, #f3e8ff 25%, #ffffff 48%, #a855f7 72%, #7e22ce 100%)'
  }
  // Pure White / Near-White
  if (r > 230 && g > 230 && b > 230) {
    return 'linear-gradient(110deg, #ffffff 0%, #e2e8f0 25%, #ffffff 50%, #cbd5e1 75%, #ffffff 100%)'
  }

  const topR = Math.min(255, Math.round(r + (255 - r) * 0.45))
  const topG = Math.min(255, Math.round(g + (255 - g) * 0.45))
  const topB = Math.min(255, Math.round(b + (255 - b) * 0.45))

  const botR = Math.max(0, Math.round(r * 0.65))
  const botG = Math.max(0, Math.round(g * 0.65))
  const botB = Math.max(0, Math.round(b * 0.65))

  return `linear-gradient(110deg, rgb(${topR}, ${topG}, ${topB}) 0%, rgb(${r}, ${g}, ${b}) 25%, #ffffff 50%, rgb(${botR}, ${botG}, ${botB}) 75%, rgb(${topR}, ${topG}, ${topB}) 100%)`
}
