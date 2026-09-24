// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { fetchIconScoutFreeAnimations, ICONSCOUNT_SUB_CATEGORIES } from './iconscout-free-lottie'

describe('iconscout-free-lottie', () => {
  it('returns items from the IconScout catalog with provider set to IconScout', () => {
    const result = fetchIconScoutFreeAnimations({ limit: 10 })
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items.length).toBeLessThanOrEqual(10)
    expect(result.totalCount).toBeGreaterThan(0)

    const first = result.items[0]!
    expect(first.provider).toBe('IconScout')
    expect(first.id).toMatch(/^iconscout-/)
    expect(first.gifUrl).toBeTruthy()
    expect(first.lottieUrl).toBeTruthy()
  })

  it('filters items by query', () => {
    const fireResult = fetchIconScoutFreeAnimations({ query: 'fire' })
    expect(fireResult.items.length).toBeGreaterThan(0)
    expect(
      fireResult.items.every(
        (it) =>
          it.name.toLowerCase().includes('fire') ||
          it.author?.toLowerCase().includes('fire') ||
          it.id.includes('fire'),
      ),
    ).toBe(true)
  })

  it('filters items by subCategory', () => {
    const socialResult = fetchIconScoutFreeAnimations({ subCategory: 'social' })
    expect(socialResult.items.length).toBeGreaterThan(0)
    expect(socialResult.totalCount).toBeLessThan(fetchIconScoutFreeAnimations({}).totalCount)
  })

  it('handles pagination with offset and limit', () => {
    const page1 = fetchIconScoutFreeAnimations({ offset: 0, limit: 12 })
    const page2 = fetchIconScoutFreeAnimations({ offset: 12, limit: 12 })

    expect(page1.items.length).toBe(12)
    expect(page2.items.length).toBeGreaterThan(0)
    expect(page1.items[0]?.id).not.toBe(page2.items[0]?.id)
  })

  it('has valid predefined sub-categories', () => {
    expect(ICONSCOUNT_SUB_CATEGORIES.length).toBeGreaterThan(3)
    expect(ICONSCOUNT_SUB_CATEGORIES[0]?.id).toBe('all')
  })
})
