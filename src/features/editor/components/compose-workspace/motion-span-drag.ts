import type { TimelineItem } from '@/types/timeline'

export interface SpanDragState {
  pointerId: number
  startX: number
  laneWidth: number
  deltaFrames: number
  items: Array<{ id: string; from: number; durationInFrames: number }>
}

export function setSpanDragVisualOffset(
  elements: readonly HTMLElement[],
  offsetPx: number,
): void {
  const transform = `translateX(${offsetPx}px)`
  for (const element of elements) element.style.transform = transform
}

export function clearSpanDragVisuals(elements: readonly HTMLElement[]): void {
  for (const element of elements) {
    element.style.removeProperty('transform')
    element.style.removeProperty('will-change')
  }
}

/** Ref slots the drag owns; they live with the component so its render tree can share them. */
export interface MotionSpanDragState {
  dragRef: { current: SpanDragState | null }
  visualsRef: { current: HTMLElement[] }
  animationFrameRef: { current: number | null }
}

export interface MotionSpanDragDeps {
  items: TimelineItem[]
  durationInFrames: number
  visibleFrameRange: number
  pause: () => void
  selectLayer: (itemId: string, modifiers: { toggle?: boolean; range?: boolean }) => void
  selectItems: (itemIds: string[]) => void
  moveItems: (updates: Array<{ id: string; from: number }>) => void
  expandLayerItemIds: (itemIds: string[]) => string[]
  getScrollArea: () => HTMLElement | null
}

export interface MotionSpanDragCommands {
  begin: (event: React.PointerEvent<HTMLButtonElement>, itemIds: string[]) => void
  move: (event: React.PointerEvent<HTMLButtonElement>) => void
  end: (event: React.PointerEvent<HTMLButtonElement>) => void
  cancel: (event: React.PointerEvent<HTMLButtonElement>) => void
}

/** The drag's fixed geometry: the items moving and every visual that previews them. */
function collectDragVisuals(
  origin: HTMLElement,
  itemIds: string[],
  scrollArea: HTMLElement | null,
): HTMLElement[] {
  const itemIdSet = new Set(itemIds)
  const visuals = new Set<HTMLElement>([origin])
  for (const row of scrollArea?.querySelectorAll<HTMLElement>('[data-motion-layer-item-id]') ?? []) {
    if (!itemIdSet.has(row.dataset.motionLayerItemId ?? '')) continue
    for (const visual of row.querySelectorAll<HTMLElement>('[data-motion-span-drag-visual]')) {
      visuals.add(visual)
    }
  }
  return [...visuals]
}

/** Touching a span selects it (or the whole dragged set) before the drag starts. */
function selectDraggedItems(
  deps: MotionSpanDragDeps,
  event: React.PointerEvent<HTMLButtonElement>,
  itemIds: string[],
): void {
  if (itemIds.length !== 1) {
    deps.selectItems(itemIds)
    return
  }
  deps.selectLayer(itemIds[0]!, {
    toggle: event.metaKey || event.ctrlKey,
    range: event.shiftKey,
  })
}

/**
 * Dragging one or more layer spans along the time axis.
 *
 * The drag previews by writing inline transforms to the row's drag visuals and
 * commits a single `moveItems` on release, so a drag is one undoable step. The
 * delta is clamped per drag to the group's own bounds: no item may start before
 * frame 0 or end past the composition, which is why the clamp is computed from
 * every dragged item rather than the one under the pointer.
 */
export function createMotionSpanDragCommands(input: {
  state: MotionSpanDragState
  deps: MotionSpanDragDeps
}): MotionSpanDragCommands {
  const { state, deps } = input
  const { dragRef, visualsRef, animationFrameRef } = state

  const cancelPreviewFrame = (): void => {
    if (animationFrameRef.current === null) return
    cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = null
  }

  const release = (): void => {
    cancelPreviewFrame()
    clearSpanDragVisuals(visualsRef.current)
    visualsRef.current = []
    dragRef.current = null
  }

  const begin = (event: React.PointerEvent<HTMLButtonElement>, itemIds: string[]): void => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const lane = event.currentTarget.parentElement
    const laneWidth = lane?.getBoundingClientRect().width ?? 0
    if (laneWidth <= 0) return
    const itemIdSet = new Set(deps.expandLayerItemIds(itemIds))
    const dragItems = deps.items
      .filter((item) => itemIdSet.has(item.id))
      .map((item) => ({
        id: item.id,
        from: item.from,
        durationInFrames: item.durationInFrames,
      }))
    if (dragItems.length === 0) return
    deps.pause()
    selectDraggedItems(deps, event, itemIds)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      laneWidth,
      deltaFrames: 0,
      items: dragItems,
    }
    visualsRef.current = collectDragVisuals(event.currentTarget, itemIds, deps.getScrollArea())
    for (const visual of visualsRef.current) visual.style.willChange = 'transform'
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const move = (event: React.PointerEvent<HTMLButtonElement>): void => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const rawDelta = Math.round(((event.clientX - drag.startX) / drag.laneWidth) * deps.visibleFrameRange)
    const minDelta = -Math.min(...drag.items.map((item) => item.from))
    const maxDelta = Math.min(
      ...drag.items.map((item) => deps.durationInFrames - item.from - 1),
    )
    const deltaFrames = Math.max(minDelta, Math.min(maxDelta, rawDelta))
    if (deltaFrames === drag.deltaFrames) return
    const next = { ...drag, deltaFrames }
    dragRef.current = next
    if (animationFrameRef.current !== null) return
    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null
      const latestDrag = dragRef.current
      if (!latestDrag) return
      setSpanDragVisualOffset(
        visualsRef.current,
        (latestDrag.deltaFrames / deps.visibleFrameRange) * latestDrag.laneWidth,
      )
    })
  }

  const end = (event: React.PointerEvent<HTMLButtonElement>): void => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    release()
    if (drag.deltaFrames !== 0) {
      deps.moveItems(drag.items.map((item) => ({ id: item.id, from: item.from + drag.deltaFrames })))
    }
  }

  const cancel = (event: React.PointerEvent<HTMLButtonElement>): void => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    release()
  }

  return { begin, move, end, cancel }
}
