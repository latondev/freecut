import { describe, expect, it } from 'vitest'
import { buildZoomAnchorKeyframes } from './zoom-anchor-keyframes'

describe('buildZoomAnchorKeyframes', () => {
  it('keeps the animated anchor at half the animated dimensions', () => {
    expect(
      buildZoomAnchorKeyframes([
        { itemId: 'image-1', property: 'width', frame: 0, value: 1020, easing: 'ease-in-out' },
        { itemId: 'image-1', property: 'height', frame: 0, value: 540, easing: 'ease-in-out' },
        { itemId: 'image-1', property: 'width', frame: 59, value: 1200, easing: 'linear' },
        { itemId: 'image-1', property: 'height', frame: 59, value: 630, easing: 'linear' },
      ]),
    ).toEqual([
      { itemId: 'image-1', property: 'anchorX', frame: 0, value: 510, easing: 'ease-in-out' },
      { itemId: 'image-1', property: 'anchorY', frame: 0, value: 270, easing: 'ease-in-out' },
      { itemId: 'image-1', property: 'anchorX', frame: 59, value: 600, easing: 'linear' },
      { itemId: 'image-1', property: 'anchorY', frame: 59, value: 315, easing: 'linear' },
    ])
  })
})
