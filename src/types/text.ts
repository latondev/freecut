export type TextFontWeight = 'normal' | 'medium' | 'semibold' | 'bold'
export type TextFontStyle = 'normal' | 'italic'
export type TextHorizontalAlign = 'left' | 'center' | 'right'
export type TextVerticalAlign = 'top' | 'middle' | 'bottom'

export type TextInlineStyleFields = {
  fontSize?: number
  fontFamily?: string
  fontWeight?: TextFontWeight
  fontStyle?: TextFontStyle
  underline?: boolean
  color?: string
  gradient?: string
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  letterSpacing?: number
  isHighlight?: boolean
}

export type TextSpan = TextInlineStyleFields & {
  text: string
}

export type TextSingleLayoutDraft = TextSpan

export type TextLayoutDrafts = {
  single?: TextSingleLayoutDraft
  twoSpans?: TextSpan[]
  threeSpans?: TextSpan[]
}

export type TextShadow = {
  offsetX: number
  offsetY: number
  blur: number
  color: string
  raw?: string
}

export type TextStroke = {
  width: number
  color: string
}

export type TextVisualStyleFields = {
  backgroundColor?: string
  backgroundRadius?: number
  textAlign?: TextHorizontalAlign
  verticalAlign?: TextVerticalAlign
  lineHeight?: number
  textPadding?: number
  textShadow?: TextShadow
  stroke?: TextStroke
  highlightColor?: string
  wordHighlightEnabled?: boolean
  gradient?: string
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
}

export type TextStyleFields = TextInlineStyleFields & TextVisualStyleFields
