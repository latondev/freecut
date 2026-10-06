import capcutCaptionTemplatesRaw from './capcut-caption-templates.json'
import type { TextFontWeight } from '@/types/text'

export type CaptionTemplateCategory =
  | 'all'
  | 'vietnamese'
  | 'karaoke'
  | 'bounce'
  | 'glow'
  | 'box'
  | 'cinema'
  | 'retro'
  | 'fade'
  | 'trending'

export interface CaptionTemplateCategoryOption {
  id: CaptionTemplateCategory
  label: string
}

export const CAPTION_TEMPLATE_CATEGORIES: readonly CaptionTemplateCategoryOption[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'vietnamese', label: 'Tiếng Việt Hot 🇻🇳' },
  { id: 'karaoke', label: 'Karaoke & Highlight 🎤' },
  { id: 'bounce', label: 'Pop & Bounce ⚡' },
  { id: 'glow', label: 'Neon & Phát Sáng ✨' },
  { id: 'box', label: 'Khung Nền Pill 📦' },
  { id: 'cinema', label: 'Điện Ảnh Movie 🎬' },
  { id: 'retro', label: 'Retro & Y2K 👾' },
  { id: 'fade', label: 'Chuyển Động Mềm 🌊' },
  { id: 'trending', label: 'Thịnh Hành Shorts 🔥' },
]

export interface CaptionTemplateStylePatch {
  color?: string
  gradient?: string
  fontFamily?: string
  fontWeight?: TextFontWeight
  fontStyle?: 'normal' | 'italic'
  fontSize?: number
  textAlign?: 'left' | 'center' | 'right'
  lineHeight?: number
  letterSpacing?: number
  stroke?: {
    width: number
    color: string
  }
  textShadow?: {
    offsetX: number
    offsetY: number
    blur: number
    color: string
    raw?: string
  }
  backgroundColor?: string
  backgroundRadius?: number
  textPadding?: number
  motionPresetId?: string
  highlightColor?: string
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
}

export interface CaptionTemplateCardItem {
  id: string
  label: string
  category: CaptionTemplateCategory
  categories: string[]
  isPro?: boolean
  badge?: string
  previewImage?: string
  animatedPreviewImage?: string
  patch: CaptionTemplateStylePatch
}

export const CAPTION_TEMPLATES_CATALOG: CaptionTemplateCardItem[] =
  capcutCaptionTemplatesRaw as CaptionTemplateCardItem[]
