import { create } from 'zustand'

/**
 * Timeline settings state - FPS, scroll position, snap, dirty tracking.
 * These are UI/editor settings, not timeline content.
 */

interface TimelineSettingsState {
  fps: number
  scrollPosition: number
  snapEnabled: boolean
  autoSnapToStart: boolean
  audioSkimmingEnabled: boolean
  timelineSkimmingEnabled: boolean
  isDirty: boolean
  /** True while loadTimeline() is in progress - used to coordinate initial player sync */
  isTimelineLoading: boolean
}

interface TimelineSettingsActions {
  setFps: (fps: number) => void
  setScrollPosition: (position: number) => void
  setSnapEnabled: (enabled: boolean) => void
  toggleSnap: () => void
  setAutoSnapToStart: (enabled: boolean) => void
  toggleAutoSnapToStart: () => void
  setAudioSkimmingEnabled: (enabled: boolean) => void
  toggleAudioSkimming: () => void
  setTimelineSkimmingEnabled: (enabled: boolean) => void
  toggleTimelineSkimming: () => void
  setIsDirty: (dirty: boolean) => void
  markDirty: () => void
  markClean: () => void
  setTimelineLoading: (loading: boolean) => void
}

export const useTimelineSettingsStore = create<TimelineSettingsState & TimelineSettingsActions>()(
  (set, get) => ({
    // State
    fps: 30,
    scrollPosition: 0,
    snapEnabled: true,
    autoSnapToStart: false,
    audioSkimmingEnabled: true,
    timelineSkimmingEnabled: false,
    isDirty: false,
    isTimelineLoading: true, // Start true - set false after loadTimeline completes

    // Actions
    setFps: (fps) => set({ fps }),
    setScrollPosition: (position) => set({ scrollPosition: position }),
    setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
    toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),
    setAutoSnapToStart: (enabled) => set({ autoSnapToStart: enabled }),
    toggleAutoSnapToStart: () => set((state) => ({ autoSnapToStart: !state.autoSnapToStart })),
    setAudioSkimmingEnabled: (enabled) => set({ audioSkimmingEnabled: enabled }),
    toggleAudioSkimming: () =>
      set((state) => ({ audioSkimmingEnabled: !state.audioSkimmingEnabled })),
    setTimelineSkimmingEnabled: (enabled) => set({ timelineSkimmingEnabled: enabled }),
    toggleTimelineSkimming: () =>
      set((state) => ({ timelineSkimmingEnabled: !state.timelineSkimmingEnabled })),
    setIsDirty: (dirty) => set({ isDirty: dirty }),
    markDirty: () => {
      if (!get().isDirty) set({ isDirty: true })
    },
    markClean: () => set({ isDirty: false }),
    setTimelineLoading: (loading) => set({ isTimelineLoading: loading }),
  }),
)
