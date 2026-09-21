/**
 * Decides what audio a composition has: segment extraction, whether the
 * windowed mixer can stream it, and whether a packet-copy passthrough is safe.
 */

import type { CompositionInputProps } from '@/types/export'
import type { AudioItem, CompositionItem, VideoItem } from '@/types/timeline'
import type { Transition } from '@/types/transition'
import { createLogger } from '@/shared/logging/logger'
import { useCompositionsStore } from '@/runtime/renderer/deps/timeline-compositions-contract'
import { getPropertyKeyframes } from '@/runtime/renderer/deps/keyframes-contract'
import { getMediaAudioCodecById } from '@/runtime/renderer/deps/media-library-contract'
import {
  getLinkedCompositionAudioCompanion,
  isCompositionAudioItem,
} from '@/shared/utils/linked-media'
import {
  appendResolvedAudioEqSources,
  getAudioEqSettings,
  isAudioEqStageActive,
} from '@/shared/utils/audio-eq'
import {
  getAudioPitchShiftSemitones,
  isAudioPitchShiftActive,
} from '@/shared/utils/audio-pitch'
import type { AudioPacketPassthroughPlan, AudioSegment } from './types'
import { buildClipFadeSpan } from './clip-fades'
import {
  getLinkedVideoIdsWithAudioForExport,
  getManagedLinkedAudioTransitionsForExport,
} from './linked-media'
import { appendCompositionAudioSegments } from './nested-composition'
import { buildManagedTransitionAudioSegments, type TransitionAudioEntry } from './transitions'

const log = createLogger('CanvasAudio/planning')

/**
 * Extract audio segments from composition.
 *
 * @param composition - The composition with tracks
 * @returns Array of audio segments to process
 */
export function extractAudioSegments(
  composition: CompositionInputProps,
  fps: number,
): AudioSegment[] {
  const { tracks = [], transitions = [] } = composition
  const segments: AudioSegment[] = []
  const audioOnlySegments: AudioSegment[] = []
  const videoById = new Map<string, TransitionAudioEntry<VideoItem>>()
  const audioById = new Map<string, TransitionAudioEntry<AudioItem>>()
  const managedLinkedAudioById = new Map<string, TransitionAudioEntry<AudioItem>>()
  const timelineItems = tracks.flatMap((track) => track.items)
  const linkedRootVideoIds = getLinkedVideoIdsWithAudioForExport(timelineItems)
  const managedLinkedAudioTransitions = getManagedLinkedAudioTransitionsForExport(
    timelineItems,
    transitions,
  )
  const managedLinkedAudioIds = new Set<string>()
  for (const managed of managedLinkedAudioTransitions) {
    managedLinkedAudioIds.add(managed.leftAudio.id)
    managedLinkedAudioIds.add(managed.rightAudio.id)
  }
  const managedLinkedAudioTransitionDefs: Transition[] = managedLinkedAudioTransitions.map(
    ({ transition, leftAudio, rightAudio }) => ({
      ...transition,
      leftClipId: leftAudio.id,
      rightClipId: rightAudio.id,
      trackId: leftAudio.trackId,
    }),
  )
  const busAudioEqStages = appendResolvedAudioEqSources(undefined, composition.busAudioEq)
  const audioTransitionItemIds = new Set<string>()
  const audioTransitionDefs: Transition[] = transitions.filter((transition) => {
    const leftItem = timelineItems.find((item) => item.id === transition.leftClipId)
    const rightItem = timelineItems.find((item) => item.id === transition.rightClipId)
    if (leftItem?.type !== 'audio' || rightItem?.type !== 'audio') {
      return false
    }
    if (isCompositionAudioItem(leftItem) || isCompositionAudioItem(rightItem)) {
      return false
    }
    audioTransitionItemIds.add(leftItem.id)
    audioTransitionItemIds.add(rightItem.id)
    return true
  })

  for (const track of tracks) {
    if (track.visible === false) continue

    for (const item of track.items) {
      if (item.type === 'video') {
        const videoItem = item as VideoItem
        if (linkedRootVideoIds.has(videoItem.id)) continue
        if (videoItem.embeddedAudioMuted) continue
        if (!videoItem.src) continue
        videoById.set(item.id, {
          item: videoItem,
          trackId: track.id,
          muted: track.muted ?? false,
          trackVolume: track.volume ?? 0,
          trackAudioEq: track.audioEq,
          audioEqStages: busAudioEqStages,
          type: 'video',
          audioCodec: getMediaAudioCodecById(videoItem.mediaId),
          volumeKeyframes: (() => {
            const videoItemKeyframes = composition.keyframes?.find((k) => k.itemId === item.id)
            const videoVolumeKfs = getPropertyKeyframes(videoItemKeyframes, 'volume')
            return videoVolumeKfs.length > 0 ? videoVolumeKfs : undefined
          })(),
          itemFrom: videoItem.from,
        })
      } else if (item.type === 'audio') {
        const audioItem = item as AudioItem
        if (isCompositionAudioItem(audioItem)) {
          const subComp = useCompositionsStore.getState().getComposition(audioItem.compositionId)
          if (!subComp) continue
          appendCompositionAudioSegments({
            segments: audioOnlySegments,
            track,
            compositionItem: audioItem,
            subComp,
            fps,
            audioEqStages: appendResolvedAudioEqSources(busAudioEqStages, track.audioEq),
          })
          continue
        }
        if (!audioItem.src) continue

        // Use sourceStart as primary for consistency with video items
        // This ensures split audio clips and IO markers work correctly
        const audioItemKeyframes = composition.keyframes?.find((k) => k.itemId === item.id)
        const audioVolumeKfs = getPropertyKeyframes(audioItemKeyframes, 'volume')
        const audioEntry: TransitionAudioEntry<AudioItem> = {
          item: audioItem,
          trackId: track.id,
          muted: track.muted ?? false,
          trackVolume: track.volume ?? 0,
          trackAudioEq: track.audioEq,
          audioEqStages: busAudioEqStages,
          type: 'audio',
          audioCodec: getMediaAudioCodecById(item.mediaId),
          volumeKeyframes: audioVolumeKfs.length > 0 ? audioVolumeKfs : undefined,
          itemFrom: item.from,
        }

        if (managedLinkedAudioIds.has(item.id)) {
          managedLinkedAudioById.set(item.id, audioEntry)
          continue
        }

        if (audioTransitionItemIds.has(item.id)) {
          audioById.set(item.id, audioEntry)
          continue
        }

        audioOnlySegments.push({
          itemId: item.id,
          trackId: track.id,
          src: audioItem.src,
          startFrame: item.from,
          durationFrames: item.durationInFrames,
          sourceStartFrame: audioItem.sourceStart ?? item.trimStart ?? 0,
          sourceFps: audioItem.sourceFps ?? fps,
          volume: (item.volume ?? 0) + (track.volume ?? 0),
          fadeInFrames: (item.audioFadeIn ?? 0) * fps,
          fadeOutFrames: (item.audioFadeOut ?? 0) * fps,
          fadeInCurve: item.audioFadeInCurve ?? 0,
          fadeOutCurve: item.audioFadeOutCurve ?? 0,
          fadeInCurveX: item.audioFadeInCurveX ?? 0.52,
          fadeOutCurveX: item.audioFadeOutCurveX ?? 0.52,
          pitchShiftSemitones: getAudioPitchShiftSemitones(item),
          audioEqStages: appendResolvedAudioEqSources(
            busAudioEqStages,
            track.audioEq,
            getAudioEqSettings(item),
          ),
          contentStartOffsetFrames: 0,
          contentEndOffsetFrames: 0,
          fadeInDelayFrames: 0,
          fadeOutLeadFrames: 0,
          clipFadeSpans: [
            buildClipFadeSpan({
              startFrame: 0,
              durationInFrames: item.durationInFrames,
              fadeInFrames: (item.audioFadeIn ?? 0) * fps,
              fadeOutFrames: (item.audioFadeOut ?? 0) * fps,
              fadeInCurve: item.audioFadeInCurve,
              fadeOutCurve: item.audioFadeOutCurve,
              fadeInCurveX: item.audioFadeInCurveX,
              fadeOutCurveX: item.audioFadeOutCurveX,
            }),
          ],
          speed: audioItem.speed ?? 1,
          isReversed: audioItem.isReversed === true,
          muted: track.muted ?? false,
          type: 'audio',
          audioCodec: audioEntry.audioCodec,
          volumeKeyframes: audioEntry.volumeKeyframes,
          itemFrom: item.from,
        })
      }
    }
  }

  const managedVideoSegments = buildManagedTransitionAudioSegments(videoById, transitions, fps)
  const managedAudioSegments = buildManagedTransitionAudioSegments(
    audioById,
    audioTransitionDefs,
    fps,
  )
  const managedLinkedAudioSegments = buildManagedTransitionAudioSegments(
    managedLinkedAudioById,
    managedLinkedAudioTransitionDefs,
    fps,
  )

  segments.push(
    ...managedVideoSegments,
    ...managedAudioSegments,
    ...managedLinkedAudioSegments,
    ...audioOnlySegments,
  )

  // === Extract audio from sub-compositions (pre-comps) ===
  // Composition items reference sub-comps that may contain video/audio items with audio.
  // We offset each sub-comp audio segment by the composition item's timeline position.
  for (const track of tracks) {
    if (track.visible === false) continue
    for (const item of track.items) {
      if (item.type !== 'composition') continue
      const compItem = item as CompositionItem
      if (getLinkedCompositionAudioCompanion(timelineItems, compItem)) continue
      const subComp = useCompositionsStore.getState().getComposition(compItem.compositionId)
      if (!subComp) continue
      appendCompositionAudioSegments({
        segments,
        track,
        compositionItem: compItem,
        subComp,
        fps,
        audioEqStages: appendResolvedAudioEqSources(busAudioEqStages, track.audioEq),
      })
    }
  }

  log.info('Extracted audio segments', {
    count: segments.length,
    videoCount: segments.filter((s) => s.type === 'video').length,
    audioCount: segments.filter((s) => s.type === 'audio').length,
  })

  return segments
}

export function supportsWindowedAudioSegment(segment: AudioSegment): boolean {
  return (
    Math.abs(segment.speed - 1) <= 0.0001 &&
    !segment.isReversed &&
    !isAudioPitchShiftActive(segment.pitchShiftSemitones) &&
    !segment.audioEqStages?.some(isAudioEqStageActive)
  )
}

/**
 * Long, ordinary clips can be mixed in bounded windows. Stateful DSP paths
 * retain the full-segment implementation so speed/pitch/EQ continuity remains
 * identical to preview.
 */
export function supportsWindowedAudioProcessing(composition: CompositionInputProps): boolean {
  const segments = extractAudioSegments(composition, composition.fps).filter(
    (segment) => !segment.muted,
  )
  return segments.length > 0 && segments.every(supportsWindowedAudioSegment)
}

function hasPacketCopyTimingChanges(segment: AudioSegment, durationInFrames: number): boolean {
  return (
    segment.startFrame !== 0 ||
    segment.durationFrames !== durationInFrames ||
    segment.sourceStartFrame !== 0 ||
    Math.abs(segment.speed - 1) > 0.0001 ||
    segment.isReversed
  )
}

function hasPacketCopyGainChanges(segment: AudioSegment): boolean {
  return (
    segment.volume !== 0 ||
    Boolean(segment.volumeKeyframes?.length) ||
    segment.fadeInFrames !== 0 ||
    segment.fadeOutFrames !== 0 ||
    (segment.crossfadeFadeInFrames ?? 0) !== 0 ||
    (segment.crossfadeFadeOutFrames ?? 0) !== 0
  )
}

function hasPacketCopyContentOffsets(segment: AudioSegment): boolean {
  return (
    (segment.contentStartOffsetFrames ?? 0) !== 0 ||
    (segment.contentEndOffsetFrames ?? 0) !== 0 ||
    (segment.fadeInDelayFrames ?? 0) !== 0 ||
    (segment.fadeOutLeadFrames ?? 0) !== 0
  )
}

function hasPacketCopyFadeSpans(segment: AudioSegment, durationInFrames: number): boolean {
  if ((segment.clipFadeSpans?.length ?? 0) > 1) return true
  return Boolean(
    segment.clipFadeSpans?.some(
      (span) =>
        span.startFrame !== 0 ||
        span.durationInFrames !== durationInFrames ||
        span.fadeInFrames !== 0 ||
        span.fadeOutFrames !== 0,
    ),
  )
}

function hasPacketCopyEffects(segment: AudioSegment): boolean {
  return (
    isAudioPitchShiftActive(segment.pitchShiftSemitones) ||
    segment.audioEqStages.some(isAudioEqStageActive)
  )
}

/**
 * Return a packet-copy plan only when the composition's audio is one continuous,
 * untouched source starting at timestamp zero. Any gain, fade, DSP, speed,
 * reverse, trim-at-start, overlap, or master-bus change requires PCM processing.
 */
export function getAudioPacketPassthroughPlan(
  composition: CompositionInputProps,
): AudioPacketPassthroughPlan | null {
  const durationInFrames = composition.durationInFrames ?? 0
  if (durationInFrames <= 0 || composition.fps <= 0 || (composition.masterBusDb ?? 0) !== 0) {
    return null
  }

  // Ducking needs no guard here: passthrough requires exactly ONE audible
  // segment, and a lone duck source has nothing to duck.
  const segments = extractAudioSegments(composition, composition.fps).filter(
    (segment) => !segment.muted,
  )
  if (segments.length !== 1) return null

  const segment = segments[0]!
  const hasProcessing = [
    hasPacketCopyTimingChanges(segment, durationInFrames),
    hasPacketCopyGainChanges(segment),
    hasPacketCopyContentOffsets(segment),
    hasPacketCopyFadeSpans(segment, durationInFrames),
    hasPacketCopyEffects(segment),
  ].some(Boolean)

  if (hasProcessing) return null
  return { src: segment.src, durationSeconds: durationInFrames / composition.fps }
}
