import { describe, expect, it } from 'vite-plus/test'
import { createTextTemplateMotion, getTextTemplateMotionPresetId } from './text-template-motion'

describe('text template motion', () => {
  it('uses the template category for a matching entrance animation', () => {
    expect(getTextTemplateMotionPresetId({ category: 'sale' })).toBe('pop')
    expect(getTextTemplateMotionPresetId({ category: 'subtitles' })).toBe('typewriter')
  })

  it('allows a template to override its category animation', () => {
    expect(getTextTemplateMotionPresetId({ category: 'sale', motionPresetId: 'fade-up' })).toBe(
      'fade-up',
    )
    expect(
      createTextTemplateMotion({ category: 'sale', motionPresetId: 'fade-up' }).in?.presetId,
    ).toBe('fade-up')
  })
})
