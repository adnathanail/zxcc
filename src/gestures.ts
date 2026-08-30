// Pointer-gesture plumbing, shared by the two painters.
//
// Every gesture is pointer events, so one set of handlers serves mouse, pen and
// finger alike.

/** Called when the gesture ends. `cancelled` is true when the browser took the
 *  gesture away rather than the pointer being lifted, which is what happens
 *  once it decides a touch was a scroll after all. */
type OnEnd = (cancelled: boolean) => void

interface TrackOptions {
  /** Suppress the browser's own touch gesture for the length of this one. The
   *  painters sit in a scroll container, so a finger that starts moving a mark
   *  pans the picture instead and the pan cancels the drag. It is a non-passive
   *  `touchmove` handler rather than `touch-action: none` on the shapes because
   *  the same drag on empty canvas is *meant* to pan — the block belongs to the
   *  gesture, not to the element. It goes on at the press, while the first
   *  `touchmove` is still cancellable; once a pan has begun it can no longer be
   *  stopped. */
  blockScroll?: boolean
  onEnd?: OnEnd
}

/**
 * Run `onMove` for the rest of the gesture `start` began, and return a function
 * that ends it. The returned function is idempotent, and calling it runs
 * `onEnd`.
 *
 * The listeners are on window, so a drag stays alive when the pointer leaves
 * the SVG — and so every pointer on the screen reports to them, which is why
 * the gesture is pinned to the id of the pointer that began it. Without that, a
 * second finger's moves would drag whatever the first one picked up to wherever
 * the second is, and its lift would end a drag still under way.
 */
export function trackPointer(
  start: PointerEvent,
  onMove: (e: PointerEvent) => void,
  { blockScroll = false, onEnd }: TrackOptions = {},
): OnEnd {
  const mine = (e: PointerEvent) => e.pointerId === start.pointerId
  const move = (e: PointerEvent) => {
    if (mine(e)) onMove(e)
  }
  const end = (e: PointerEvent) => {
    if (mine(e)) stop(e.type === 'pointercancel')
  }
  const hold = (e: TouchEvent) => e.preventDefault()

  let running = true
  const stop: OnEnd = cancelled => {
    if (!running) return
    running = false
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', end)
    window.removeEventListener('touchmove', hold)
    onEnd?.(cancelled)
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', end)
  if (blockScroll) window.addEventListener('touchmove', hold, { passive: false })
  return stop
}
