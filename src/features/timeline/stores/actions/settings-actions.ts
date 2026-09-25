/**
 * Settings & Persistence Actions - Timeline settings and bulk operations.
 */

import { useItemsStore } from '../items-store'
import { useTransitionsStore } from '../transitions-store'
import { useKeyframesStore } from '../keyframes-store'
import { useMarkersStore } from '../markers-store'
import { useTimelineSettingsStore } from '../timeline-settings-store'
import { useTimelineCommandStore } from '../timeline-command-store'
import { execute } from './shared'
import { emitUiSound } from '@/shared/ui/ui-sound'
import { usePlaybackStore } from '@/shared/state/playback'

import { closeAllTimelineGaps } from './item-actions'

export function toggleSnap(): void {
  execute('TOGGLE_SNAP', () => {
    useTimelineSettingsStore.getState().toggleSnap()
  })
  emitUiSound(useTimelineSettingsStore.getState().snapEnabled ? 'toggleOn' : 'toggleOff')
}

export function toggleAutoSnapToStart(): void {
  execute('TOGGLE_AUTO_SNAP_TO_START', () => {
    useTimelineSettingsStore.getState().toggleAutoSnapToStart()
  })
  const isEnabled = useTimelineSettingsStore.getState().autoSnapToStart
  emitUiSound(isEnabled ? 'toggleOn' : 'toggleOff')
  if (isEnabled) {
    closeAllTimelineGaps()
  }
}

export function toggleAudioSkimming(): void {
  execute('TOGGLE_AUDIO_SKIMMING', () => {
    useTimelineSettingsStore.getState().toggleAudioSkimming()
  })
  emitUiSound(useTimelineSettingsStore.getState().audioSkimmingEnabled ? 'toggleOn' : 'toggleOff')
}

export function toggleTimelineSkimming(): void {
  execute('TOGGLE_TIMELINE_SKIMMING', () => {
    useTimelineSettingsStore.getState().toggleTimelineSkimming()
    if (!useTimelineSettingsStore.getState().timelineSkimmingEnabled) {
      usePlaybackStore.getState().setPreviewFrame(null)
    }
  })
  emitUiSound(
    useTimelineSettingsStore.getState().timelineSkimmingEnabled ? 'toggleOn' : 'toggleOff',
  )
}

export function setScrollPosition(position: number): void {
  // No undo for scroll position - it's UI state
  useTimelineSettingsStore.getState().setScrollPosition(position)
}

// =============================================================================
// PERSISTENCE ACTIONS (no individual undo - these are bulk operations)
// =============================================================================

export function clearTimeline(): void {
  execute('CLEAR_TIMELINE', () => {
    useItemsStore.getState().setItems([])
    useItemsStore.getState().setTracks([])
    useTransitionsStore.getState().setTransitions([])
    useKeyframesStore.getState().setKeyframes([])
    useMarkersStore.getState().setMarkers([])
    useMarkersStore.getState().clearInOutPoints()
    useTimelineSettingsStore.getState().markClean()
  })

  // Clear undo history when clearing timeline
  useTimelineCommandStore.getState().clearHistory()
}

// Mark dirty/clean (no undo)
export function markDirty(): void {
  useTimelineSettingsStore.getState().markDirty()
}

export function markClean(): void {
  useTimelineSettingsStore.getState().markClean()
}
