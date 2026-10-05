import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  BASE_SCENE,
  TEMPLATES,
  applyTemplateToScene,
  cloneScene,
  deepMerge,
} from './engine/presets'
import { getUserTemplates, saveUserTemplates } from './engine/user-templates'
import { TextRenderer } from './engine/renderer'
import type { TitleScene } from './types'

describe('Title Maker Engine', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('Presets & Templates', () => {
    it('clones scene without mutating original', () => {
      const cloned = cloneScene(BASE_SCENE)
      cloned.text = 'Modified'
      expect(BASE_SCENE.text).not.toBe('Modified')
    })

    it('deep merges objects correctly', () => {
      const target = { a: 1, nested: { b: 2, c: 3 } }
      const patch = { nested: { b: 99 } }
      const result = deepMerge(target, patch)
      expect(result.nested.b).toBe(99)
      expect(result.nested.c).toBe(3)
    })

    it('applies template to current scene with locale text fallback', () => {
      const convergeTpl = TEMPLATES.caption.find((t) => t.id === 'converge')!
      expect(convergeTpl).toBeDefined()

      const scene = applyTemplateToScene(BASE_SCENE, convergeTpl, 'vi')
      expect(scene.templateId).toBe('converge')
      expect(scene.inFx).toBe('converge')
      expect(scene.text).toBe(convergeTpl.text.vi)
    })
  })

  describe('User Saved Templates', () => {
    it('saves and retrieves user templates from localStorage', () => {
      expect(getUserTemplates()).toEqual([])

      const dummy: TitleScene = {
        ...BASE_SCENE,
        text: 'Custom Title',
        templateId: 'user_saved_1',
      }

      saveUserTemplates([
        {
          id: 'test_1',
          name: 'My Custom Template',
          createdAt: Date.now(),
          scene: dummy,
        },
      ])

      const loaded = getUserTemplates()
      expect(loaded.length).toBe(1)
      expect(loaded[0]!.name).toBe('My Custom Template')
      expect(loaded[0]!.scene.text).toBe('Custom Title')
    })
  })

  describe('TextRenderer', () => {
    it('prepares and renders without throwing in node/canvas environment', () => {
      const mockCtx = {
        canvas: { width: 1280, height: 720 },
        font: '',
        measureText: (text: string) => ({ width: text.length * 10 }),
        fillText: vi.fn(),
        strokeText: vi.fn(),
        drawImage: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        roundRect: vi.fn(),
        strokeRect: vi.fn(),
        setTransform: vi.fn(),
        createLinearGradient: () => ({ addColorStop: vi.fn() }),
        createRadialGradient: () => ({ addColorStop: vi.fn() }),
      } as unknown as CanvasRenderingContext2D

      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any)

      const renderer = new TextRenderer()
      const scene: TitleScene = {
        ...BASE_SCENE,
        text: 'FreeCut Studio',
        subText: 'TRPG Subtitle',
      }

      const prep = renderer.prepare(scene)
      expect(prep.timeline.duration).toBeGreaterThan(0)
      expect(prep.layout.glyphs.length).toBeGreaterThan(0)
      expect(prep.layout.glyphs[0].sprite).toBeDefined()

      renderer.render(mockCtx, 1.0)
      expect(mockCtx.save).toHaveBeenCalled()
      expect(mockCtx.drawImage).toHaveBeenCalled()
    })
  })
})
