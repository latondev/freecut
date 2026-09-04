import type { AnimatableProperty, Keyframe, KeyframeRef } from '@/types/keyframe'
import type { KeyframeMeta } from './dopesheet-types'

interface DopesheetPropertyRowLike {
  property: AnimatableProperty
  keyframes: Keyframe[]
}

interface CurrentGroupKeyframeLike {
  property: AnimatableProperty
  keyframe: Keyframe
}

export function buildRowKeyframeRefs<TRow extends DopesheetPropertyRowLike>(
  itemId: string,
  rows: TRow[],
): KeyframeRef[] {
  return rows.flatMap((row) =>
    row.keyframes.map((keyframe) => ({
      itemId,
      property: row.property,
      keyframeId: keyframe.id,
    })),
  )
}

export function buildPropertyKeyframeRefs(
  itemId: string,
  property: AnimatableProperty,
  keyframes: Keyframe[],
): KeyframeRef[] {
  return keyframes.map((keyframe) => ({
    itemId,
    property,
    keyframeId: keyframe.id,
  }))
}

export function removeSelectionIds(
  selectedKeyframeIds: Set<string>,
  removedKeyframeIds: Iterable<string>,
): Set<string> {
  const nextSelection = new Set(selectedKeyframeIds)
  for (const keyframeId of removedKeyframeIds) {
    nextSelection.delete(keyframeId)
  }
  return nextSelection
}

export function buildGroupAddEntries<TRow extends DopesheetPropertyRowLike>(
  rows: TRow[],
  currentFrame: number,
  canAddKeyframeForRow: (row: TRow) => boolean,
): Array<{ property: AnimatableProperty; frame: number }> {
  return rows.flatMap((row) =>
    canAddKeyframeForRow(row) ? [{ property: row.property, frame: currentFrame }] : [],
  )
}

export function getRemovableGroupCurrentKeyframes(
  currentKeyframes: CurrentGroupKeyframeLike[],
  isPropertyLocked: (property: AnimatableProperty) => boolean,
): CurrentGroupKeyframeLike[] {
  return currentKeyframes.filter(({ property }) => !isPropertyLocked(property))
}

/**
 * Shift-click range selection: selects every keyframe between the clicked
 * keyframe and the anchor (inclusive). Falls back to selecting just the
 * clicked keyframe when either endpoint has no index.
 */
export function resolveShiftRangeSelection(
  propertyKeyframes: readonly Keyframe[],
  clickedKeyframeId: string,
  anchorKeyframeId: string | undefined,
  selectedKeyframeIds: ReadonlySet<string>,
): Set<string> {
  const nextSelection = new Set(selectedKeyframeIds)
  const clickedIndex = propertyKeyframes.findIndex((keyframe) => keyframe.id === clickedKeyframeId)
  const anchorIndex = anchorKeyframeId
    ? propertyKeyframes.findIndex((keyframe) => keyframe.id === anchorKeyframeId)
    : -1
  if (clickedIndex >= 0 && anchorIndex >= 0) {
    const start = Math.min(clickedIndex, anchorIndex)
    const end = Math.max(clickedIndex, anchorIndex)
    for (let i = start; i <= end; i++) {
      const keyframe = propertyKeyframes[i]
      if (keyframe) nextSelection.add(keyframe.id)
    }
  } else {
    nextSelection.add(clickedKeyframeId)
  }
  return nextSelection
}

/** Ctrl/Cmd-click: toggles a single keyframe in the selection. */
export function toggleKeyframeInSelection(
  selectedKeyframeIds: ReadonlySet<string>,
  keyframeId: string,
): Set<string> {
  const nextSelection = new Set(selectedKeyframeIds)
  if (nextSelection.has(keyframeId)) {
    nextSelection.delete(keyframeId)
  } else {
    nextSelection.add(keyframeId)
  }
  return nextSelection
}

/** Ctrl/Cmd-click on a group: toggles every keyframe in the group. */
export function toggleKeyframesInSelection(
  selectedKeyframeIds: ReadonlySet<string>,
  keyframeIds: readonly string[],
): Set<string> {
  const nextSelection = new Set(selectedKeyframeIds)
  for (const keyframeId of keyframeIds) {
    if (nextSelection.has(keyframeId)) {
      nextSelection.delete(keyframeId)
    } else {
      nextSelection.add(keyframeId)
    }
  }
  return nextSelection
}

/** Resolves drag-start frames for a keyframe id list, skipping unknown ids. */
export function collectInitialFrames(
  keyframeIds: readonly string[],
  metaById: ReadonlyMap<string, KeyframeMeta>,
): Map<string, number> {
  const initialFrames = new Map<string, number>()
  for (const keyframeId of keyframeIds) {
    const meta = metaById.get(keyframeId)
    if (!meta) continue
    initialFrames.set(keyframeId, meta.keyframe.frame)
  }
  return initialFrames
}
