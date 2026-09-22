import '@testing-library/jest-dom'
import { configure } from '@testing-library/react'
import { afterEach } from 'vite-plus/test'
import '@/i18n'
import { resetAutoKeyframeStore } from '@/features/keyframes/stores/auto-keyframe-store'

// Render-path tests wait on animation-frame chains and async render work. Under
// coverage instrumentation on a shared runner those legitimately take longer than
// the 1s default, which turned correct-but-slow waits into intermittent failures
// (the preview-sync suite in particular). A real hang still fails, just later.
configure({ asyncUtilTimeout: 5_000 })

// Mock ImageData for Canvas operations
type TestGlobalWithImageData = typeof globalThis & { ImageData?: typeof ImageData }
const testGlobal = globalThis as TestGlobalWithImageData

if (typeof testGlobal.ImageData === 'undefined') {
  class MockImageData {
    width: number
    height: number
    data: Uint8ClampedArray

    constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
      if (typeof dataOrWidth === 'number') {
        this.width = dataOrWidth
        this.height = widthOrHeight
        this.data = new Uint8ClampedArray(this.width * this.height * 4)
      } else {
        this.data = dataOrWidth
        this.width = widthOrHeight
        this.height = height ?? Math.floor(dataOrWidth.length / (widthOrHeight * 4))
      }
    }
  }

  testGlobal.ImageData = MockImageData as unknown as typeof ImageData
}

// Mock ResizeObserver — jsdom omits it; components that measure natural height
// (e.g. the shortcuts dialog command list) construct one on mount.
type TestGlobalWithResizeObserver = typeof globalThis & { ResizeObserver?: typeof ResizeObserver }
const testGlobalRO = globalThis as TestGlobalWithResizeObserver

if (typeof testGlobalRO.ResizeObserver === 'undefined') {
  class MockResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  testGlobalRO.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
}

afterEach(() => {
  resetAutoKeyframeStore()
})
