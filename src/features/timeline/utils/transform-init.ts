import type { TransformProperties } from '@/types/transform'

/**
 * Compute initial fit-to-canvas transform for an item.
 * This locks in the initial size so it doesn't change when canvas changes.
 */
export function computeInitialTransform(
  sourceWidth: number,
  sourceHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): TransformProperties {
  const scaleX = canvasWidth / sourceWidth
  const scaleY = canvasHeight / sourceHeight
  const fitScale = Math.min(scaleX, scaleY)

  // Note: opacity is intentionally omitted - undefined means "use default (1.0)"
  // Only set opacity explicitly when user changes it, so we can distinguish
  // between "default 100%" and "explicitly set to 100%"
  return {
    x: 0,
    y: 0,
    width: Math.round(sourceWidth * fitScale),
    height: Math.round(sourceHeight * fitScale),
    rotation: 0,
  }
}

/**
 * Compute initial overlay transform for a Lottie animation.
 * Unlike full-screen video/background images, Lottie animations are overlay elements
 * (stickers, icons, badges) that should preserve their native aspect ratio and not
 * fill or squash into the full canvas.
 */
export function computeInitialLottieTransform(
  sourceWidth: number,
  sourceHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): TransformProperties {
  const validSource = sourceWidth > 0 && sourceHeight > 0
  const w = validSource ? sourceWidth : 400
  const h = validSource ? sourceHeight : 400

  // Sensible max size for an overlay sticker/animation: ~40% of canvas
  const maxInitialHeight = Math.round(canvasHeight * 0.4)
  const maxInitialWidth = Math.round(canvasWidth * 0.4)

  let finalWidth = w
  let finalHeight = h

  if (finalWidth > maxInitialWidth || finalHeight > maxInitialHeight) {
    const scale = Math.min(maxInitialWidth / finalWidth, maxInitialHeight / finalHeight)
    finalWidth = Math.round(finalWidth * scale)
    finalHeight = Math.round(finalHeight * scale)
  }

  return {
    x: 0,
    y: 0,
    width: Math.max(1, finalWidth),
    height: Math.max(1, finalHeight),
    rotation: 0,
  }
}
