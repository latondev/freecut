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
