/**
 * Expands clips that take part in a transition into audio segments, carrying
 * the pre-roll, overlap extension and crossfade fades the transition window
 * implies.
 */

import type { AudioEqSettings, ResolvedAudioEqSettings } from '@/types/audio'
import type { Keyframe as VolumeKeyframe } from '@/types/keyframe'
import type { AudioItem, VideoItem } from '@/types/timeline'
import type { Transition } from '@/types/transition'
import { resolveTransitionWindows } from '@/shared/timeline/transitions/transition-planner'
import {
  timelineToSourceFrames,
  sourceToTimelineFrames,
} from '@/runtime/renderer/deps/timeline-frame-contract'
import {
  appendResolvedAudioEqSources,
  areAudioEqStagesEqual,
  getAudioEqSettings,
} from '@/shared/utils/audio-eq'
import { getAudioPitchShiftSemitones } from '@/shared/utils/audio-pitch'
import type { AudioSegment } from './types'
import { buildClipFadeSpan } from './clip-fades'

type TransitionAudioItem = VideoItem | AudioItem

export interface TransitionAudioEntry<TItem extends TransitionAudioItem> {
  item: TItem
  trackId: string
  muted: boolean
  trackVolume: number
  trackAudioEq?: AudioEqSettings
  audioEqStages?: ResolvedAudioEqSettings[]
  type: 'video' | 'audio'
  audioCodec?: string
  volumeKeyframes?: VolumeKeyframe[]
  itemFrom: number
}

function getTransitionAudioTrimBefore(item: TransitionAudioItem): number {
  return item.sourceStart ?? item.trimStart ?? item.offset ?? 0
}

function hasExplicitTransitionAudioTrimStart(item: TransitionAudioItem): boolean {
  return item.sourceStart !== undefined || item.trimStart !== undefined || item.offset !== undefined
}

function isContinuousAudioTransition(
  left: TransitionAudioItem,
  right: TransitionAudioItem,
  fps: number,
): boolean {
  const leftSpeed = left.speed ?? 1
  const rightSpeed = right.speed ?? 1
  const leftSourceFps = left.sourceFps ?? fps
  if (Math.abs(leftSpeed - rightSpeed) > 0.0001) return false

  const sameMedia =
    (left.mediaId && right.mediaId && left.mediaId === right.mediaId) ||
    (!!left.src && !!right.src && left.src === right.src)
  if (!sameMedia) return false

  if (left.originId && right.originId && left.originId !== right.originId) return false

  if (Math.abs(getAudioPitchShiftSemitones(left) - getAudioPitchShiftSemitones(right)) > 0.0001)
    return false

  const expectedRightFrom = left.from + left.durationInFrames
  if (Math.abs(right.from - expectedRightFrom) > 2) return false

  const leftTrim = getTransitionAudioTrimBefore(left)
  const rightTrim = getTransitionAudioTrimBefore(right)
  const computedLeftSourceEnd =
    leftTrim + timelineToSourceFrames(left.durationInFrames, leftSpeed, fps, leftSourceFps)
  const storedLeftSourceEnd = left.sourceEnd
  const computedContinuous = Math.abs(rightTrim - computedLeftSourceEnd) <= 2
  const storedContinuous =
    storedLeftSourceEnd !== undefined ? Math.abs(rightTrim - storedLeftSourceEnd) <= 2 : false

  if (computedContinuous || storedContinuous) return true

  return !hasExplicitTransitionAudioTrimStart(right)
}

export function buildManagedTransitionAudioSegments<TItem extends TransitionAudioItem>(
  entriesById: Map<string, TransitionAudioEntry<TItem>>,
  transitions: Transition[],
  fps: number,
): AudioSegment[] {
  // Entries that don't participate in any transition still yield plain segments below
  // (zero extensions) — bailing out on empty `transitions` would silently drop the
  // embedded audio of every video item in compositions without transitions.
  if (entriesById.size === 0) return []

  const extensionByClipId = new Map<
    string,
    {
      before: number
      after: number
      overlapFadeOut: number
      overlapFadeIn: number
      fadeInDelay: number
      fadeOutLead: number
    }
  >()
  const ensureExtension = (
    clipId: string,
  ): {
    before: number
    after: number
    overlapFadeOut: number
    overlapFadeIn: number
    fadeInDelay: number
    fadeOutLead: number
  } => {
    const existing = extensionByClipId.get(clipId)
    if (existing) return existing
    const created = {
      before: 0,
      after: 0,
      overlapFadeOut: 0,
      overlapFadeIn: 0,
      fadeInDelay: 0,
      fadeOutLead: 0,
    }
    extensionByClipId.set(clipId, created)
    return created
  }

  const clipsById = new Map<string, TItem>()
  for (const [id, entry] of entriesById) {
    clipsById.set(id, entry.item)
  }

  const resolvedWindows = resolveTransitionWindows(transitions, clipsById)
  for (const window of resolvedWindows) {
    const leftEntry = entriesById.get(window.transition.leftClipId)
    const rightEntry = entriesById.get(window.transition.rightClipId)
    if (!leftEntry || !rightEntry) continue

    const left = leftEntry.item
    const right = rightEntry.item
    if (isContinuousAudioTransition(left, right, fps)) continue

    const rightPreRoll = Math.max(0, right.from - window.startFrame)
    const leftPostRoll = Math.max(0, window.endFrame - (left.from + left.durationInFrames))

    if (rightPreRoll > 0) {
      const rightExt = ensureExtension(right.id)
      rightExt.before = Math.max(rightExt.before, rightPreRoll)
    }

    if (leftPostRoll > 0) {
      const leftExt = ensureExtension(left.id)
      leftExt.after = Math.max(leftExt.after, leftPostRoll)
    }

    if (window.durationInFrames > 0) {
      const leftExt = ensureExtension(left.id)
      leftExt.overlapFadeOut = Math.max(leftExt.overlapFadeOut, window.durationInFrames)
      leftExt.fadeOutLead = Math.max(leftExt.fadeOutLead, window.leftPortion)
      const rightExt = ensureExtension(right.id)
      rightExt.overlapFadeIn = Math.max(rightExt.overlapFadeIn, window.durationInFrames)
      rightExt.fadeInDelay = Math.max(rightExt.fadeInDelay, window.rightPortion)
    }
  }

  const resolvedTrimBeforeById = new Map<string, number>()
  const sortedByTrackAndTime = Array.from(entriesById.entries())
    .map(([id, entry]) => ({
      id,
      trackId: entry.trackId,
      item: entry.item,
    }))
    .toSorted((a, b) => {
      if (a.trackId !== b.trackId) return a.trackId.localeCompare(b.trackId)
      if (a.item.from !== b.item.from) return a.item.from - b.item.from
      return a.id.localeCompare(b.id)
    })

  const previousByTrack = new Map<string, TItem>()
  for (const entry of sortedByTrackAndTime) {
    const clip = entry.item
    const explicitTrimBefore = getTransitionAudioTrimBefore(clip)
    let resolvedTrimBefore = explicitTrimBefore

    if (!hasExplicitTransitionAudioTrimStart(clip)) {
      const previous = previousByTrack.get(entry.trackId)
      if (previous && isContinuousAudioTransition(previous, clip, fps)) {
        const previousTrimBefore =
          resolvedTrimBeforeById.get(previous.id) ?? getTransitionAudioTrimBefore(previous)
        resolvedTrimBefore =
          previousTrimBefore +
          timelineToSourceFrames(
            previous.durationInFrames,
            previous.speed ?? 1,
            fps,
            previous.sourceFps ?? fps,
          )
      }
    }

    resolvedTrimBeforeById.set(clip.id, resolvedTrimBefore)
    previousByTrack.set(entry.trackId, clip)
  }

  type ExpandedTransitionAudioSegment = AudioSegment & {
    clip: TransitionAudioItem
    beforeFrames: number
    afterFrames: number
  }

  const expandedSegments: ExpandedTransitionAudioSegment[] = []
  for (const [, entry] of entriesById) {
    const item = entry.item
    const speed = item.speed ?? 1
    const sourceFps = item.sourceFps ?? fps
    const baseTrimBefore = resolvedTrimBeforeById.get(item.id) ?? getTransitionAudioTrimBefore(item)
    const extension = extensionByClipId.get(item.id) ?? {
      before: 0,
      after: 0,
      overlapFadeOut: 0,
      overlapFadeIn: 0,
      fadeInDelay: 0,
      fadeOutLead: 0,
    }
    const maxBeforeBySource =
      speed > 0 ? sourceToTimelineFrames(baseTrimBefore, speed, sourceFps, fps) : 0
    const before = Math.max(0, Math.min(extension.before, maxBeforeBySource))
    const after = Math.max(0, extension.after)
    const crossfadeFadeInFrames =
      extension.overlapFadeIn > 0 ? extension.overlapFadeIn : before > 0 ? before : undefined
    const crossfadeFadeOutFrames =
      extension.overlapFadeOut > 0 ? extension.overlapFadeOut : after > 0 ? after : undefined

    expandedSegments.push({
      itemId: item.id,
      trackId: entry.trackId,
      clip: item,
      src: item.src,
      startFrame: item.from - before,
      durationFrames: item.durationInFrames + before + after,
      sourceStartFrame: baseTrimBefore - timelineToSourceFrames(before, speed, fps, sourceFps),
      sourceFps,
      volume: (item.volume ?? 0) + entry.trackVolume,
      fadeInFrames: (item.audioFadeIn ?? 0) * fps,
      fadeOutFrames: (item.audioFadeOut ?? 0) * fps,
      fadeInCurve: item.audioFadeInCurve ?? 0,
      fadeOutCurve: item.audioFadeOutCurve ?? 0,
      fadeInCurveX: item.audioFadeInCurveX ?? 0.52,
      fadeOutCurveX: item.audioFadeOutCurveX ?? 0.52,
      pitchShiftSemitones: getAudioPitchShiftSemitones(item),
      contentStartOffsetFrames: before,
      contentEndOffsetFrames: after,
      fadeInDelayFrames: extension.fadeInDelay,
      fadeOutLeadFrames: extension.fadeOutLead,
      clipFadeSpans: [
        buildClipFadeSpan({
          startFrame: before,
          durationInFrames: item.durationInFrames,
          fadeInFrames: (item.audioFadeIn ?? 0) * fps,
          fadeOutFrames: (item.audioFadeOut ?? 0) * fps,
          fadeInCurve: item.audioFadeInCurve,
          fadeOutCurve: item.audioFadeOutCurve,
          fadeInCurveX: item.audioFadeInCurveX,
          fadeOutCurveX: item.audioFadeOutCurveX,
        }),
      ],
      crossfadeFadeInFrames,
      crossfadeFadeOutFrames,
      speed,
      isReversed: item.isReversed === true,
      muted: entry.muted,
      type: entry.type,
      audioCodec: entry.audioCodec,
      audioEqStages: appendResolvedAudioEqSources(
        entry.audioEqStages,
        entry.trackAudioEq,
        getAudioEqSettings(item),
      ),
      beforeFrames: before,
      afterFrames: after,
      volumeKeyframes: entry.volumeKeyframes,
      itemFrom: entry.itemFrom,
    })
  }

  const sortedSegments = expandedSegments.toSorted((a, b) => {
    if (a.startFrame !== b.startFrame) return a.startFrame - b.startFrame
    return a.itemId.localeCompare(b.itemId)
  })

  const mergedSegments: AudioSegment[] = []
  let active: ExpandedTransitionAudioSegment | null = null

  const canMergeContinuousBoundary = (
    left: ExpandedTransitionAudioSegment,
    right: ExpandedTransitionAudioSegment,
  ): boolean => {
    if (!isContinuousAudioTransition(left.clip, right.clip, fps)) return false
    if (left.src !== right.src) return false
    if (Math.abs(left.speed - right.speed) > 0.0001) return false
    if (left.isReversed !== right.isReversed) return false
    if (Math.abs(left.volume - right.volume) > 0.0001) return false
    if (left.muted !== right.muted) return false
    if (!areAudioEqStagesEqual(left.audioEqStages, right.audioEqStages)) return false
    if (Math.abs(left.pitchShiftSemitones - right.pitchShiftSemitones) > 0.0001) return false
    if (left.afterFrames !== 0 || right.beforeFrames !== 0) return false
    if (left.volumeKeyframes || right.volumeKeyframes) return false
    return true
  }

  const toAudioSegment = (segment: ExpandedTransitionAudioSegment): AudioSegment => ({
    itemId: segment.itemId,
    trackId: segment.trackId,
    src: segment.src,
    startFrame: segment.startFrame,
    durationFrames: segment.durationFrames,
    sourceStartFrame: segment.sourceStartFrame,
    sourceFps: segment.sourceFps,
    volume: segment.volume,
    fadeInFrames: segment.fadeInFrames,
    fadeOutFrames: segment.fadeOutFrames,
    fadeInCurve: segment.fadeInCurve,
    fadeOutCurve: segment.fadeOutCurve,
    fadeInCurveX: segment.fadeInCurveX,
    fadeOutCurveX: segment.fadeOutCurveX,
    pitchShiftSemitones: segment.pitchShiftSemitones,
    audioEqStages: segment.audioEqStages,
    contentStartOffsetFrames: segment.contentStartOffsetFrames,
    contentEndOffsetFrames: segment.contentEndOffsetFrames,
    fadeInDelayFrames: segment.fadeInDelayFrames,
    fadeOutLeadFrames: segment.fadeOutLeadFrames,
    clipFadeSpans: segment.clipFadeSpans,
    crossfadeFadeInFrames: segment.crossfadeFadeInFrames,
    crossfadeFadeOutFrames: segment.crossfadeFadeOutFrames,
    speed: segment.speed,
    isReversed: segment.isReversed,
    muted: segment.muted,
    type: segment.type,
    audioCodec: segment.audioCodec,
    volumeKeyframes: segment.volumeKeyframes,
    itemFrom: segment.itemFrom,
  })

  for (const segment of sortedSegments) {
    if (!active) {
      active = { ...segment }
      continue
    }

    if (canMergeContinuousBoundary(active, segment)) {
      const activeStartFrame = active.startFrame
      const mergedEnd = segment.startFrame + segment.durationFrames
      active.durationFrames = mergedEnd - active.startFrame
      active.fadeOutFrames = segment.fadeOutFrames
      active.fadeOutCurve = segment.fadeOutCurve
      active.fadeOutCurveX = segment.fadeOutCurveX
      active.contentEndOffsetFrames = segment.contentEndOffsetFrames
      active.fadeOutLeadFrames = segment.fadeOutLeadFrames
      active.crossfadeFadeOutFrames = segment.crossfadeFadeOutFrames
      active.clipFadeSpans = [
        ...(active.clipFadeSpans ?? []),
        ...(segment.clipFadeSpans ?? []).map((span) => ({
          ...span,
          startFrame: span.startFrame + (segment.startFrame - activeStartFrame),
        })),
      ]
      active.clip = segment.clip
      active.afterFrames = segment.afterFrames
      continue
    }

    mergedSegments.push(toAudioSegment(active))
    active = { ...segment }
  }

  if (active) {
    mergedSegments.push(toAudioSegment(active))
  }

  return mergedSegments
}
