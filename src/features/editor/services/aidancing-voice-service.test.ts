import { describe, expect, it } from 'vitest'
import { isNumberBoundary, splitTextIntoSmartChunks } from './aidancing-voice-service'

describe('aidancing-voice-service smart chunking', () => {
  it('detects number boundaries with dots and commas', () => {
    const text1 = 'Giá 10.000 đồng'
    const dotIndex = text1.indexOf('.')
    expect(isNumberBoundary(text1, dotIndex)).toBe(true)

    const text2 = 'Dân số 2,000 người'
    const commaIndex = text2.indexOf(',')
    expect(isNumberBoundary(text2, commaIndex)).toBe(true)

    const text3 = 'Hết câu. Bắt đầu mới'
    const sentenceDot = text3.indexOf('.')
    expect(isNumberBoundary(text3, sentenceDot)).toBe(false)

    const text4 = 'Từ này, từ kia'
    const clauseComma = text4.indexOf(',')
    expect(isNumberBoundary(text4, clauseComma)).toBe(false)
  })

  it('keeps short text under 1800 as a single chunk', () => {
    const shortText = 'Đây là một đoạn văn bản ngắn không cần cắt đoạn.'
    const chunks = splitTextIntoSmartChunks(shortText, 1200, 1800)
    expect(chunks).toEqual([shortText])
  })

  it('splits long text without breaking numbers or mid-word', () => {
    const sentence =
      'Trong năm 2026, sản phẩm đạt 100.000.000 lượt tải với hơn 2,500 đánh giá tích cực từ cộng đồng. '
    const longText = sentence.repeat(50) // ~5,000 chars

    const chunks = splitTextIntoSmartChunks(longText, 1200, 1800)
    expect(chunks.length).toBeGreaterThan(2)

    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1800)
      // Must not end with a lone digit or broken number dot/comma
      expect(chunk).not.toMatch(/\d\.$/)
      expect(chunk).not.toMatch(/\d,\s*$/)
      // Must not start with broken number suffix
      expect(chunk).not.toMatch(/^\d{3}/)
    }

    // Every chunk should end with punctuation or space
    for (let i = 0; i < chunks.length - 1; i++) {
      const endChar = (chunks[i] ?? '').slice(-1)
      expect(['.', '!', '?', ',', ';', ':', '—', '-']).toContain(endChar)
    }
  })

  it('correctly segments a 20,000 character script into valid chunks', () => {
    const unit =
      'Hôm nay chúng ta sẽ khám phá giải pháp công nghệ mới. Dự án có tổng kinh phí là 500.000.000 đồng, phục vụ hơn 10,000 người dùng hàng ngày! '
    const script20k = unit.repeat(150) // ~21,000 chars

    const chunks = splitTextIntoSmartChunks(script20k, 1200, 1800)
    expect(chunks.length).toBeGreaterThanOrEqual(10)
    expect(chunks.length).toBeLessThanOrEqual(18)

    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1800)
      expect(chunk.length).toBeGreaterThan(0)
    }
  })
})
