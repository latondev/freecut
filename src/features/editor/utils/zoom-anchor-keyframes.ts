import type { EasingType } from '@/types/keyframe'

export interface ZoomDimensionKeyframe {
  itemId: string
  property: 'width' | 'height'
  frame: number
  value: number
  easing?: EasingType
}

export interface ZoomAnchorKeyframe extends Omit<ZoomDimensionKeyframe, 'property' | 'value'> {
  property: 'anchorX' | 'anchorY'
  value: number
}

/** Keep an animated zoom's transform origin at the changing bounds' center. */
export function buildZoomAnchorKeyframes(
  keyframes: readonly ZoomDimensionKeyframe[],
): ZoomAnchorKeyframe[] {
  return keyframes.map(({ property, value, ...keyframe }) => ({
    ...keyframe,
    property: property === 'width' ? 'anchorX' : 'anchorY',
    value: value / 2,
  }))
}
