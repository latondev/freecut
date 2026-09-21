/**
 * Builds the `AudioClipFadeSpan` attached to every segment, so plain,
 * transition and nested segments resolve their fade curves identically.
 */

import type { AudioClipFadeSpan } from '@/shared/utils/audio-fade-curve'

export function buildClipFadeSpan(params: {
  startFrame: number
  durationInFrames: number
  fadeInFrames?: number
  fadeOutFrames?: number
  fadeInCurve?: number
  fadeOutCurve?: number
  fadeInCurveX?: number
  fadeOutCurveX?: number
}): AudioClipFadeSpan {
  return {
    startFrame: params.startFrame,
    durationInFrames: params.durationInFrames,
    fadeInFrames: params.fadeInFrames ?? 0,
    fadeOutFrames: params.fadeOutFrames ?? 0,
    fadeInCurve: params.fadeInCurve ?? 0,
    fadeOutCurve: params.fadeOutCurve ?? 0,
    fadeInCurveX: params.fadeInCurveX ?? 0.52,
    fadeOutCurveX: params.fadeOutCurveX ?? 0.52,
  }
}
