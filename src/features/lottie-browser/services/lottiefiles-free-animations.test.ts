import { describe, expect, it } from 'vitest'
import {
  LOTTIEFILES_FREE_SUB_CATEGORIES,
  getLottieFilesSubCategoryQuery,
} from './lottiefiles-free-animations'

describe('lottiefiles-free-animations', () => {
  it('contains expected categories including youtube and subscribe', () => {
    const ids = LOTTIEFILES_FREE_SUB_CATEGORIES.map((c) => c.id)
    expect(ids).toContain('all')
    expect(ids).toContain('youtube')
    expect(ids).toContain('subscribe')
    expect(ids).toContain('social')
    expect(ids).toContain('loading')
  })

  it('maps subcategory IDs to search queries correctly', () => {
    expect(getLottieFilesSubCategoryQuery('all')).toBe('')
    expect(getLottieFilesSubCategoryQuery('youtube')).toBe('youtube')
    expect(getLottieFilesSubCategoryQuery('social')).toBe('social media')
    expect(getLottieFilesSubCategoryQuery('non-existent')).toBe('')
  })
})
