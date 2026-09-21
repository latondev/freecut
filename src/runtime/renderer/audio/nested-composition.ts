/**
 * Expands pre-composition audio into parent-timeline segments, mapping each
 * nested item's visible window into parent frames.
 */

import type { ResolvedAudioEqSettings } from '@/types/audio'
import type { CompositionInputProps } from '@/types/export'
import type { AudioItem, CompositionItem, TimelineItem, TimelineTrack, VideoItem } from '@/types/timeline'
import {
  timelineToSourceFrames,
  sourceToTimelineFrames,
} from '@/runtime/renderer/deps/timeline-frame-contract'
import { useCompositionsStore } from '@/runtime/renderer/deps/timeline-compositions-contract'
import { getPropertyKeyframes } from '@/runtime/renderer/deps/keyframes-contract'
import { getMediaAudioCodecById } from '@/runtime/renderer/deps/media-library-contract'
import { blobUrlManager } from '@/infrastructure/browser/blob-url-manager'
import {
  getLinkedCompositionAudioCompanion,
  getLinkedVideoIdsWithAudio,
  isCompositionAudioItem,
} from '@/shared/utils/linked-media'
import { appendResolvedAudioEqSources, getAudioEqSettings } from '@/shared/utils/audio-eq'
import { getAudioPitchShiftSemitones } from '@/shared/utils/audio-pitch'
import type { AudioSegment } from './types'
import { buildClipFadeSpan } from './clip-fades'

/** The wrapper composition item's timing, resolved once per expansion. */
interface CompositionWrapperTiming {
  compFrom: number
  wrapperSpeed: number
  wrapperSourceFps: number
  sourceOffset: number
  wrapperSourceEnd: number
}

export function resolveCompositionWrapper(
  compositionItem: { from: number; durationInFrames: number } & Partial<{
    speed: number
    sourceFps: number
    sourceStart: number
    trimStart: number
    sourceEnd: number
  }>,
  fps: number,
): CompositionWrapperTiming {
  const wrapperSpeed = compositionItem.speed ?? 1
  const wrapperSourceFps = compositionItem.sourceFps ?? fps
  const sourceOffset = compositionItem.sourceStart ?? compositionItem.trimStart ?? 0
  return {
    compFrom: compositionItem.from,
    wrapperSpeed,
    wrapperSourceFps,
    sourceOffset,
    wrapperSourceEnd:
      compositionItem.sourceEnd ??
      sourceOffset +
        timelineToSourceFrames(compositionItem.durationInFrames, wrapperSpeed, fps, wrapperSourceFps),
  }
}

/** One nested item's visible window, expressed in PARENT timeline frames. */
interface NestedItemWindow {
  overlapStart: number
  overlapEnd: number
  effectiveStart: number
  effectiveEnd: number
  effectiveDuration: number
  effectiveSourceStart: number
}

/**
 * Map a sub-composition item into parent-timeline coordinates, honouring the
 * wrapper's trim, speed and source fps. Returns null when the item falls
 * entirely outside the wrapper's visible source range.
 *
 * Shared on purpose. The audio mix and the ducking-source scan both have to
 * agree on where a nested item sits, and a second implementation is how they
 * would silently drift apart — a source could be expanded into the mix while
 * not being seen as a duck source, which is precisely the bug this fixes.
 */
export function mapNestedItemWindow(
  subItem: TimelineItem,
  wrapper: CompositionWrapperTiming,
  fps: number,
): NestedItemWindow | null {
  const { compFrom, wrapperSpeed, wrapperSourceFps, sourceOffset, wrapperSourceEnd } = wrapper
  const overlapStart = Math.max(subItem.from, sourceOffset)
  const overlapEnd = Math.min(subItem.from + subItem.durationInFrames, wrapperSourceEnd)
  if (overlapEnd <= overlapStart) return null

  const effectiveStart =
    compFrom + sourceToTimelineFrames(overlapStart - sourceOffset, wrapperSpeed, wrapperSourceFps, fps)
  const effectiveEnd =
    compFrom + sourceToTimelineFrames(overlapEnd - sourceOffset, wrapperSpeed, wrapperSourceFps, fps)
  const effectiveDuration = Math.max(1, effectiveEnd - effectiveStart)

  const baseSourceStart = subItem.sourceStart ?? subItem.trimStart ?? 0
  const effectiveSourceStart =
    baseSourceStart +
    timelineToSourceFrames(
      overlapStart - subItem.from,
      subItem.speed ?? 1,
      wrapperSourceFps,
      subItem.sourceFps ?? wrapperSourceFps,
    )

  return {
    overlapStart,
    overlapEnd,
    effectiveStart,
    effectiveEnd,
    effectiveDuration,
    effectiveSourceStart,
  }
}

/**
 * Rebuild a nested composition item as a wrapper expressed in PARENT coordinates.
 *
 * Shared with the duck-source scan for the same reason the window mapping is: the
 * `sourceEnd` remap in particular is easy to omit, and omitting it makes a
 * clipped intermediate composition report a different window on each side.
 */
export function buildNestedWrapper(
  subItem: TimelineItem,
  window: NestedItemWindow,
  wrapper: CompositionWrapperTiming,
): CompositionItem | (AudioItem & { compositionId: string }) {
  const { wrapperSpeed, wrapperSourceFps } = wrapper
  return {
    ...subItem,
    from: window.effectiveStart,
    durationInFrames: window.effectiveDuration,
    speed: (subItem.speed ?? 1) * wrapperSpeed,
    sourceStart: window.effectiveSourceStart,
    sourceFps: subItem.sourceFps ?? wrapperSourceFps,
    ...(subItem.sourceEnd !== undefined && {
      sourceEnd: Math.max(
        window.effectiveSourceStart + 1,
        subItem.sourceEnd -
          timelineToSourceFrames(
            subItem.from + subItem.durationInFrames - window.overlapEnd,
            subItem.speed ?? 1,
            wrapperSourceFps,
            subItem.sourceFps ?? wrapperSourceFps,
          ),
      ),
    }),
  } as CompositionItem | (AudioItem & { compositionId: string })
}

export function appendCompositionAudioSegments(params: {
  segments: AudioSegment[]
  track: CompositionInputProps['tracks'][number]
  compositionItem: CompositionItem | (AudioItem & { compositionId: string })
  subComp: {
    items: TimelineItem[]
    tracks: TimelineTrack[]
    keyframes?: CompositionInputProps['keyframes']
    durationInFrames: number
  }
  fps: number
  audioEqStages?: ResolvedAudioEqSettings[]
  audioPitchShiftSemitones?: number
  visited?: Set<string>
}): void {
  const { segments, track, compositionItem, subComp, fps } = params
  const visited = params.visited ?? new Set<string>()
  const wrapperAudioEqStages = appendResolvedAudioEqSources(
    params.audioEqStages,
    getAudioEqSettings(compositionItem),
  )
  const wrapperAudioPitchShiftSemitones =
    (params.audioPitchShiftSemitones ?? 0) + getAudioPitchShiftSemitones(compositionItem)
  const linkedSubCompVideoIds = getLinkedVideoIdsWithAudio(subComp.items)
  const wrapper = resolveCompositionWrapper(compositionItem, fps)
  const { wrapperSpeed, wrapperSourceFps } = wrapper
  const trackMuted = track.muted ?? false

  for (const subItem of subComp.items) {
    const subTrack = subComp.tracks.find((candidate) => candidate.id === subItem.trackId)
    const subTrackMuted = subTrack?.muted ?? false
    const window = mapNestedItemWindow(subItem, wrapper, fps)
    if (!window) continue
    const { overlapStart, overlapEnd, effectiveStart, effectiveDuration } = window

    const speed = (subItem.speed ?? 1) * wrapperSpeed
    const effectiveSourceStart = window.effectiveSourceStart

    if (subItem.type === 'composition' || isCompositionAudioItem(subItem)) {
      if (
        subItem.type === 'composition' &&
        getLinkedCompositionAudioCompanion(subComp.items, subItem)
      )
        continue
      if (visited.has(subItem.compositionId)) continue

      const nestedSubComp = useCompositionsStore.getState().getComposition(subItem.compositionId)
      if (!nestedSubComp) continue

      const nestedWrapper = buildNestedWrapper(subItem, window, wrapper)

      // Volumes are dB offsets — sum them so nested levels accumulate correctly.
      const nestedVisited = new Set(visited)
      nestedVisited.add(subItem.compositionId)
      appendCompositionAudioSegments({
        segments,
        track: {
          ...track,
          muted: trackMuted || subTrackMuted,
          volume: (track.volume ?? 0) + (subTrack?.volume ?? 0),
        },
        compositionItem: nestedWrapper,
        subComp: nestedSubComp,
        fps,
        audioEqStages: appendResolvedAudioEqSources(wrapperAudioEqStages, subTrack?.audioEq),
        audioPitchShiftSemitones: wrapperAudioPitchShiftSemitones,
        visited: nestedVisited,
      })
      continue
    }

    if (subItem.type !== 'video' && subItem.type !== 'audio') continue
    if (subItem.type === 'video' && linkedSubCompVideoIds.has(subItem.id)) continue
    const src =
      (subItem.mediaId ? blobUrlManager.get(subItem.mediaId) : null) ??
      (subItem as VideoItem | AudioItem).src ??
      ''
    if (!src) continue

    const subItemKeyframes = subComp.keyframes?.find((keyframe) => keyframe.itemId === subItem.id)
    const subVolumeKfs = getPropertyKeyframes(subItemKeyframes, 'volume')

    const rawFadeInFrames = sourceToTimelineFrames(
      (subItem.audioFadeIn ?? 0) * wrapperSourceFps,
      wrapperSpeed,
      wrapperSourceFps,
      fps,
    )
    const rawFadeOutFrames = sourceToTimelineFrames(
      (subItem.audioFadeOut ?? 0) * wrapperSourceFps,
      wrapperSpeed,
      wrapperSourceFps,
      fps,
    )
    const clippedStartFrames = sourceToTimelineFrames(
      overlapStart - subItem.from,
      wrapperSpeed,
      wrapperSourceFps,
      fps,
    )
    const clippedEndFrames = sourceToTimelineFrames(
      subItem.from + subItem.durationInFrames - overlapEnd,
      wrapperSpeed,
      wrapperSourceFps,
      fps,
    )
    const adjustedFadeInFrames = Math.max(0, rawFadeInFrames - clippedStartFrames)
    const adjustedFadeOutFrames = Math.max(0, rawFadeOutFrames - clippedEndFrames)

    segments.push({
      itemId: subItem.id,
      trackId: track.id,
      src,
      startFrame: effectiveStart,
      durationFrames: effectiveDuration,
      sourceStartFrame: effectiveSourceStart,
      sourceFps: subItem.sourceFps ?? fps,
      volume: (subItem.volume ?? 0) + (track.volume ?? 0) + (subTrack?.volume ?? 0),
      fadeInFrames: adjustedFadeInFrames,
      fadeOutFrames: adjustedFadeOutFrames,
      fadeInCurve: subItem.audioFadeInCurve ?? 0,
      fadeOutCurve: subItem.audioFadeOutCurve ?? 0,
      fadeInCurveX: subItem.audioFadeInCurveX ?? 0.52,
      fadeOutCurveX: subItem.audioFadeOutCurveX ?? 0.52,
      pitchShiftSemitones: wrapperAudioPitchShiftSemitones + getAudioPitchShiftSemitones(subItem),
      audioEqStages: appendResolvedAudioEqSources(
        wrapperAudioEqStages,
        subTrack?.audioEq,
        getAudioEqSettings(subItem),
      ),
      contentStartOffsetFrames: 0,
      contentEndOffsetFrames: 0,
      fadeInDelayFrames: 0,
      fadeOutLeadFrames: 0,
      clipFadeSpans: [
        buildClipFadeSpan({
          startFrame: 0,
          durationInFrames: effectiveDuration,
          fadeInFrames: adjustedFadeInFrames,
          fadeOutFrames: adjustedFadeOutFrames,
          fadeInCurve: subItem.audioFadeInCurve,
          fadeOutCurve: subItem.audioFadeOutCurve,
          fadeInCurveX: subItem.audioFadeInCurveX,
          fadeOutCurveX: subItem.audioFadeOutCurveX,
        }),
      ],
      speed,
      isReversed: subItem.isReversed === true,
      muted: trackMuted || subTrackMuted,
      type: subItem.type as 'video' | 'audio',
      audioCodec: getMediaAudioCodecById(subItem.mediaId),
      volumeKeyframes: subVolumeKfs.length > 0 ? subVolumeKfs : undefined,
      itemFrom: effectiveStart,
    })
  }
}
