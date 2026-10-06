import React, { useMemo } from 'react'

import { useSequenceContext } from '@/runtime/composition-runtime/deps/player'
import { parseSubtitleCueText } from '@/shared/utils/subtitle-cue-format'
import type { SubtitleSegmentItem, TextItem } from '@/types/timeline'

import { useVideoConfig } from '../hooks/use-player-compat'
import { TextContent } from './text-content'

/**
 * Renders the active cue of a {@link SubtitleSegmentItem} per frame.
 *
 * A subtitle segment owns its full cue list — instead of stamping out N
 * TextItems, we resolve the cue active at the current sequence frame and
 * reuse {@link TextContent} so all of TextItem's styling (font loading,
 * text shadow, stroke, alignment) Just Works.
 */
export const SubtitleSegmentContent: React.FC<{
  item: SubtitleSegmentItem & { _sequenceFrameOffset?: number }
}> = ({ item }) => {
  const sequenceContext = useSequenceContext()
  const { fps } = useVideoConfig()
  const relativeFrame = (sequenceContext?.localFrame ?? 0) - (item._sequenceFrameOffset ?? 0)
  const secondsIntoSegment = relativeFrame / fps

  const activeCue = useMemo(() => {
    if (item.cues.length === 1) return item.cues[0] ?? null
    return (
      findActiveCue(item.cues, secondsIntoSegment) ??
      (secondsIntoSegment <= (item.cues[0]?.startSeconds ?? 0) ? item.cues[0] : null)
    )
  }, [item.cues, secondsIntoSegment])

  // Parse inline markup (<i>, <b>, <u>, <font color>) into formatted spans
  // and pull off any ASS `{\anN}` positioning override so the cue can land
  // top-of-screen (used for sign translations / on-screen labels).
  const parsed = useMemo(
    () => (activeCue ? parseSubtitleCueText(activeCue.text) : null),
    [activeCue],
  )

  // Word-by-word active highlight (Alex Hormozi / Karaoke style jump)
  // fallow-ignore-next-line complexity
  const highlightedSpans = useMemo(() => {
    if (!activeCue || !parsed || parsed.isEmpty) return undefined

    const highlightColor = item.highlightColor || '#facc15'
    const wordHighlightEnabled = item.wordHighlightEnabled !== false

    if (!wordHighlightEnabled || !highlightColor) {
      return parsed.spans
    }

    const isSingleCue = item.cues.length === 1
    const clipDurationSec = item.durationInFrames / fps
    const cueDuration = Math.max(
      0.08,
      isSingleCue ? clipDurationSec : activeCue.endSeconds - activeCue.startSeconds,
    )
    const elapsed = isSingleCue
      ? Math.max(0, Math.min(cueDuration, secondsIntoSegment))
      : Math.max(0, Math.min(cueDuration, secondsIntoSegment - activeCue.startSeconds))
    // Scale progress slightly so last words complete comfortably within spoken duration
    const effectiveSpeechDuration = Math.max(0.08, cueDuration * 0.94)
    const progress = Math.max(0, Math.min(1, elapsed / effectiveSpeechDuration))

    // Tokenize cue plainText into words and whitespace runs
    const rawTokens = parsed.plainText.match(/\S+|\s+/g) || []
    const wordTokenIndices: number[] = []
    rawTokens.forEach((tok, idx) => {
      if (/\S/.test(tok)) {
        wordTokenIndices.push(idx)
      }
    })

    if (wordTokenIndices.length === 0) {
      return parsed.spans
    }

    // Weight word duration by character length so short conjunctions ("và", "là")
    // don't linger disproportionately compared to multi-syllable phrases.
    const wordWeights = wordTokenIndices.map((idx) => {
      const text = rawTokens[idx] ?? ''
      return Math.max(2, text.length)
    })
    const totalWeight = wordWeights.reduce((sum, w) => sum + w, 0)

    let accumulated = 0
    let activeWordSlot = 0
    const targetWeight = progress * totalWeight
    for (let i = 0; i < wordWeights.length; i++) {
      accumulated += wordWeights[i]!
      if (targetWeight <= accumulated || i === wordWeights.length - 1) {
        activeWordSlot = i
        break
      }
    }
    const activeRawIndex = wordTokenIndices[activeWordSlot] ?? -1

    return rawTokens.map((tok, idx) => {
      const isWord = /\S/.test(tok)
      const isActive = isWord && activeRawIndex >= 0 && idx === activeRawIndex
      return {
        text: tok,
        color: isActive ? highlightColor : item.color || '#ffffff',
        gradient: isActive ? undefined : item.gradient,
        fontWeight: isActive ? ('bold' as const) : item.fontWeight,
        textTransform: item.textTransform,
        isHighlight: isActive,
      }
    })
  }, [
    activeCue,
    fps,
    item.cues.length,
    item.durationInFrames,
    item.color,
    item.gradient,
    item.textTransform,
    item.fontWeight,
    item.highlightColor,
    item.wordHighlightEnabled,
    parsed,
    secondsIntoSegment,
  ])

  // Synthesize an ephemeral TextItem that carries the active cue's text and
  // the segment's typography. Keyframe/gizmo lookups by id will miss (the
  // segment isn't a TextItem) — that's fine for now; segment-level keyframes
  // are a planned follow-up.
  const syntheticTextItem = useMemo<TextItem & { _sequenceFrameOffset?: number }>(
    // fallow-ignore-next-line complexity
    () => ({
      id: item.id,
      type: 'text',
      trackId: item.trackId,
      from: item.from,
      durationInFrames: item.durationInFrames,
      label: item.label,
      mediaId: item.mediaId,
      transform: item.transform,
      text: parsed?.plainText ?? '',
      // Inline flow allows individual words to recolor/highlight in real-time
      spanLayout: 'inline',
      textSpans: highlightedSpans ?? parsed?.spans,
      fontSize: item.fontSize,
      fontFamily: item.fontFamily,
      fontWeight: item.fontWeight,
      fontStyle: item.fontStyle,
      underline: item.underline,
      color: item.color,
      gradient: item.gradient,
      textTransform: item.textTransform,
      backgroundColor: item.backgroundColor,
      backgroundRadius: item.backgroundRadius,
      textAlign: parsed?.alignment?.textAlign ?? item.textAlign,
      verticalAlign: parsed?.alignment?.verticalAlign ?? item.verticalAlign,
      lineHeight: item.lineHeight,
      letterSpacing: item.letterSpacing,
      textPadding: item.textPadding,
      textShadow: item.textShadow,
      stroke: item.stroke ?? { width: 2.5, color: '#000000' },
      textMotion: item.textMotion,
      _sequenceFrameOffset: item._sequenceFrameOffset,
    }),
    [parsed, item, highlightedSpans],
  )

  if (!activeCue || !parsed || parsed.isEmpty) return null
  return <TextContent item={syntheticTextItem} />
}

/**
 * Binary search for the cue whose `[startSeconds, endSeconds)` window
 * contains `seconds`. Cues are pre-sorted by startSeconds at insertion
 * time, so we can cut the per-frame cost from O(n) to O(log n) — meaningful
 * on a 65-min episode with 600+ cues.
 */
function findActiveCue<T extends { startSeconds: number; endSeconds: number }>(
  cues: readonly T[],
  seconds: number,
): T | null {
  if (cues.length === 0) return null
  let lo = 0
  let hi = cues.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const cue = cues[mid]!
    if (seconds < cue.startSeconds) {
      hi = mid - 1
    } else if (seconds >= cue.endSeconds) {
      lo = mid + 1
    } else {
      return cue
    }
  }
  return null
}
