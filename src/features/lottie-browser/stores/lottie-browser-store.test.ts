import { describe, expect, it } from 'vitest'
import { findImportedMediaForAnimation } from './lottie-browser-store'
import type { MediaMetadata } from '@/types/storage'

describe('findImportedMediaForAnimation', () => {
  const dummyMedia: MediaMetadata = {
    id: 'media-123',
    storageType: 'workspace',
    fileName: 'cat_animation.lottie',
    mimeType: 'application/lottie+json',
    fileSize: 1024,
    duration: 3,
    width: 500,
    height: 500,
    fps: 30,
    codec: 'lottie',
    bitrate: 0,
    tags: [],
    createdAt: 0,
    updatedAt: 0,
    attribution: {
      provider: 'IconScout',
      sourceId: '12345',
      sourceUrl: 'https://iconscout.com',
    },
  }

  it('finds media directly from importedMediaMap', () => {
    const map = { 'item-1': dummyMedia }
    const result = findImportedMediaForAnimation('item-1', 'Item 1', map, [])
    expect(result).toBe(dummyMedia)
  })

  it('matches media in mediaItems by exact attribution sourceId', () => {
    const result = findImportedMediaForAnimation('12345', 'Cat', {}, [dummyMedia])
    expect(result?.id).toBe('media-123')
  })

  it('matches media in mediaItems by prefix-stripped sourceId (iconscout-)', () => {
    const result = findImportedMediaForAnimation('iconscout-12345', 'Cat', {}, [dummyMedia])
    expect(result?.id).toBe('media-123')
  })

  it('matches media by fileName and mimeType as fallback', () => {
    const fallbackMedia: MediaMetadata = {
      id: 'media-fallback',
      storageType: 'workspace',
      fileName: 'cat_animation.lottie',
      mimeType: 'application/lottie+json',
      fileSize: 1024,
      duration: 3,
      width: 500,
      height: 500,
      fps: 30,
      codec: 'lottie',
      bitrate: 0,
      tags: [],
      createdAt: 0,
      updatedAt: 0,
    }
    const result = findImportedMediaForAnimation('unknown-id', 'cat_animation', {}, [fallbackMedia])
    expect(result?.id).toBe('media-fallback')
  })

  it('returns undefined when no match exists', () => {
    const result = findImportedMediaForAnimation('other-id', 'Dog', {}, [dummyMedia])
    expect(result).toBeUndefined()
  })
})
