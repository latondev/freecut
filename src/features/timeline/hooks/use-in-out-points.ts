import { useTimelineStore } from '../stores/timeline-store'

/**
 * Subscribes to the in/out render-range points and their setters.
 * Shared by the timeline header and ruler markers so the store
 * subscription shape stays identical everywhere.
 */
export function useInOutPoints() {
  const inPoint = useTimelineStore((s) => s.inPoint)
  const outPoint = useTimelineStore((s) => s.outPoint)
  const setInPoint = useTimelineStore((s) => s.setInPoint)
  const setOutPoint = useTimelineStore((s) => s.setOutPoint)
  return { inPoint, outPoint, setInPoint, setOutPoint }
}
