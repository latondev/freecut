export type TitleMode = 'message' | 'trailer' | 'caption'

export type SubPosition = 'above' | 'below'
export type WritingDirection = 'h' | 'v'
export type TextAlignment = 'start' | 'center' | 'end'
export type AnchorPosition = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br'

export interface ColorFill {
  type: 'solid' | 'gradient'
  color: string
  color2?: string
  color3?: string
  dir?: 'h' | 'v' | 'd'
}

export interface StrokeStyle {
  on: boolean
  width: number
  color: string
}

export interface ShadowStyle {
  on: boolean
  color: string
  opacity: number
  blur: number
  x: number
  y: number
}

export interface GlowStyle {
  on: boolean
  color: string
  size: number
  strength: number
}

export type DecoType =
  | 'none'
  | 'box'
  | 'corners'
  | 'lines'
  | 'underline'
  | 'sides'
  | 'bar'
  | 'band'
  | 'tape'
  | 'frame'

export interface DecoStyle {
  type: DecoType
  color?: string
  color2?: string
  opacity?: number
  pad?: number
  extend?: number
  thickness?: number
  radius?: number
  outline?: boolean
  soft?: number
  sideFade?: number
  anim?: 'none' | 'grow' | 'fade'
  dur?: number
  tapeColor?: string
  tapeStripe?: string
  tapeSize?: number
  tapeSpeed?: number
  tapeBlink?: number
}

export interface BackgroundStyle {
  type: 'none' | 'solid' | 'vignette' | 'top' | 'bottom'
  color?: string
  opacity?: number
  sync?: boolean
}

export type InEffectType =
  | 'fade'
  | 'rise'
  | 'drop'
  | 'converge'
  | 'slide'
  | 'tracking'
  | 'spread'
  | 'blurIn'
  | 'pop'
  | 'shrinkIn'
  | 'spin'
  | 'flip'
  | 'bounce'
  | 'scatter'
  | 'typewriter'
  | 'flicker'
  | 'slam'
  | 'zoomIn'
  | 'emerge'
  | 'wipe'
  | 'shutter'
  | 'glitch'
  | 'flash'

export type OutEffectType =
  | 'none'
  | 'fade'
  | 'rise'
  | 'sink'
  | 'diverge'
  | 'slide'
  | 'tracking'
  | 'blurOut'
  | 'growOut'
  | 'shrink'
  | 'scatter'
  | 'erase'
  | 'flicker'
  | 'zoomThrough'
  | 'recede'
  | 'wipe'
  | 'shutter'
  | 'glitch'

export type HoldEffectType =
  | 'none'
  | 'float'
  | 'wave'
  | 'pulse'
  | 'shake'
  | 'glow'
  | 'flicker'
  | 'blink'
  | 'glitch'

export interface TitleScene {
  mode: TitleMode
  text: string
  subText: string
  subPosition: SubPosition
  width: number
  height: number
  sizePreset: string
  anchor: AnchorPosition
  marginX: number
  marginY: number
  offsetX: number
  offsetY: number
  writing: WritingDirection
  align: TextAlignment
  autoFit: boolean
  wrapChars: number
  fontId: string
  weight: number
  italic: boolean
  fontSize: number
  letterSpacing: number
  lineHeight: number
  subFontId: string
  subWeight: number
  subItalic: boolean
  subSize: number
  subLetterSpacing: number
  subGap: number
  fill: ColorFill
  fillOpacity: number
  stroke: StrokeStyle
  stroke2: StrokeStyle
  shadow: ShadowStyle
  glow: GlowStyle
  subColorOn: boolean
  subColor: string
  deco: DecoStyle
  bg: BackgroundStyle
  inFx: InEffectType
  inDur: number
  inStagger: number
  inOrder: 'forward' | 'reverse' | 'center' | 'edges' | 'random'
  inEase: string
  inPower: number
  inDir: 'left' | 'right' | 'up' | 'down' | 'lr' | 'rl' | 'tb' | 'bt' | 'center' | 'v' | 'h'
  holdFx: HoldEffectType
  hold: number
  holdPower: number
  glitchColor: string
  glitchColor2: string
  inEnabled: boolean
  outEnabled: boolean
  outFx: OutEffectType
  outDur: number
  outStagger: number
  outOrder: 'forward' | 'reverse' | 'center' | 'edges' | 'random'
  outEase: string
  outPower: number
  outDir: 'left' | 'right' | 'up' | 'down' | 'lr' | 'rl' | 'tb' | 'bt' | 'center' | 'v' | 'h'
  subFx: string
  subDelay: number
  startDelay: number
  endDelay: number
  reveal?: 'char' | 'line' | 'sweep' | 'spread' | 'all' | 'scroll' | 'solo'
  cps?: number
  glyphDur?: number
  linePause?: number
  punctPause?: number
  lineInterval?: number
  sweepDur?: number
  pageSplit?: boolean
  pageGap?: number
  cursor?: boolean
  cursorColor?: string
  scrollSpeed?: number
  scrollFade?: boolean
  soloSize?: number
  soloPause?: number
  soloImpact?: number
  spreadHold?: number
  spreadDur?: number
  templateId?: string
}

export interface TitleTemplateItem {
  id: string
  group?: string
  system?: string
  icon?: string
  label: { vi: string; en: string; ja?: string }
  text: { vi: string; en: string; ja?: string }
  subText: { vi: string; en: string; ja?: string }
  patch: Partial<TitleScene>
  loop?: 'once' | 'infinite'
}

export interface UserSavedTemplate {
  id: string
  name: string
  createdAt: number
  scene: TitleScene
  thumbnailUrl?: string
}
