// @vitest-environment node

import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { makeTimelineTrack, makeTimelineVideoItem } from '../../test-helpers'
import { useItemsStore } from '../items-store'
import { useKeyframesStore } from '../keyframes-store'
import { useMarkersStore } from '../markers-store'
import { useTransitionsStore } from '../transitions-store'
import { useTimelineCommandStore } from '../timeline-command-store'
import { useTimelineSettingsStore } from '../timeline-settings-store'
import {
  clearTimeline,
  markClean,
  markDirty,
  toggleSnap,
  toggleAutoSnapToStart,
} from './settings-actions'

describe('settings actions', () => {
  beforeEach(() => {
    useTimelineCommandStore.getState().clearHistory()
    useTimelineSettingsStore.setState({ fps: 30, isDirty: false, snapEnabled: true })
    useItemsStore
      .getState()
      .setTracks([makeTimelineTrack({ id: 'track-v1', name: 'V1', kind: 'video', order: 0 })])
    useItemsStore.getState().setItems([makeTimelineVideoItem({ id: 'a' })])
    useTransitionsStore.getState().setTransitions([])
    useKeyframesStore.getState().setKeyframes([])
    useMarkersStore.getState().setMarkers([])
    useMarkersStore.getState().setInOutPoints(null, null)
  })

  it('toggleSnap flips the snap setting with an undo entry', () => {
    const undoDepth = useTimelineCommandStore.getState().undoStack.length

    toggleSnap()
    expect(useTimelineSettingsStore.getState().snapEnabled).toBe(false)
    expect(useTimelineCommandStore.getState().undoStack.length).toBe(undoDepth + 1)

    useTimelineCommandStore.getState().undo()
    expect(useTimelineSettingsStore.getState().snapEnabled).toBe(true)
  })

  it('markDirty / markClean flip the dirty flag without undo entries', () => {
    const undoDepth = useTimelineCommandStore.getState().undoStack.length

    markDirty()
    expect(useTimelineSettingsStore.getState().isDirty).toBe(true)
    markClean()
    expect(useTimelineSettingsStore.getState().isDirty).toBe(false)
    expect(useTimelineCommandStore.getState().undoStack.length).toBe(undoDepth)
  })

  it('clearTimeline empties every domain store and the undo history', () => {
    useKeyframesStore.getState()._addKeyframe('a', 'opacity', 0, 1)
    useMarkersStore.getState().addMarker(10)
    useMarkersStore.getState().setInOutPoints(0, 30)
    // Generate some history first
    toggleSnap()
    expect(useTimelineCommandStore.getState().undoStack.length).toBeGreaterThan(0)

    clearTimeline()

    expect(useItemsStore.getState().items).toHaveLength(0)
    expect(useItemsStore.getState().tracks).toHaveLength(0)
    expect(useTransitionsStore.getState().transitions).toHaveLength(0)
    expect(useKeyframesStore.getState().keyframes).toHaveLength(0)
    expect(useMarkersStore.getState().markers).toHaveLength(0)
    expect(useMarkersStore.getState().inPoint).toBeNull()
    expect(useMarkersStore.getState().outPoint).toBeNull()
    expect(useTimelineSettingsStore.getState().isDirty).toBe(false)
    expect(useTimelineCommandStore.getState().undoStack).toHaveLength(0)
  })

  it('toggleAutoSnapToStart flips the setting with an undo entry and automatically closes gaps across all tracks', () => {
    useTimelineSettingsStore.setState({ autoSnapToStart: false })
    useItemsStore
      .getState()
      .setTracks([
        makeTimelineTrack({ id: 'track-v1', name: 'V1', kind: 'video', order: 0 }),
        makeTimelineTrack({ id: 'track-v2', name: 'V2', kind: 'video', order: 1 }),
      ])
    useItemsStore.getState().setItems([
      makeTimelineVideoItem({
        id: 'clip-1',
        trackId: 'track-v1',
        from: 30,
        durationInFrames: 60,
      }),
      makeTimelineVideoItem({
        id: 'clip-2',
        trackId: 'track-v1',
        from: 120,
        durationInFrames: 60,
      }),
      makeTimelineVideoItem({
        id: 'overlay-1',
        trackId: 'track-v2',
        from: 20,
        durationInFrames: 50,
      }),
    ])

    toggleAutoSnapToStart()
    expect(useTimelineSettingsStore.getState().autoSnapToStart).toBe(true)

    // Verify clips on all tracks were snapped to 0:0:0
    const items = useItemsStore.getState().items
    const clip1 = items.find((i) => i.id === 'clip-1')
    const clip2 = items.find((i) => i.id === 'clip-2')
    const overlay1 = items.find((i) => i.id === 'overlay-1')

    expect(clip1?.from).toBe(0)
    expect(clip2?.from).toBe(60) // Gap between clip 1 and 2 closed
    expect(overlay1?.from).toBe(0) // Overlay snapped to 0

    // Toggle off
    toggleAutoSnapToStart()
    expect(useTimelineSettingsStore.getState().autoSnapToStart).toBe(false)
  })
})
