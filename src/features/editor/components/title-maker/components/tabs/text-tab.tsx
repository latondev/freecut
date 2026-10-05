import { memo } from 'react'
import type { TitleScene, SubPosition, WritingDirection, TextAlignment } from '../../types'
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/shared/ui/cn'

interface TextTabProps {
  scene: TitleScene
  onChange: (patch: Partial<TitleScene>) => void
}

export const TextTab = memo(function TextTab({ scene, onChange }: TextTabProps) {
  const isVertical = scene.writing === 'v'

  return (
    <div className="flex flex-col gap-3 py-1">
      {/* Main Text */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-foreground">Main text</label>
        <textarea
          rows={2}
          value={scene.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Nhập nội dung tiêu đề chính..."
          className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary text-foreground resize-none"
        />
      </div>

      {/* Sub Text */}
      {scene.mode !== 'trailer' && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-foreground">Sub text (optional)</label>
          <input
            type="text"
            value={scene.subText}
            onChange={(e) => onChange({ subText: e.target.value })}
            placeholder="Nhập nội dung phụ (ví dụ ngày tháng, địa điểm)..."
            className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
          />
        </div>
      )}

      {/* Sub text position */}
      {scene.mode !== 'trailer' && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">Sub text position</label>
          <div className="grid grid-cols-2 gap-1 bg-secondary/30 p-0.5 rounded-lg border border-border">
            {(['above', 'below'] as SubPosition[]).map((pos) => {
              const label = isVertical
                ? pos === 'above'
                  ? 'Right (before)'
                  : 'Left (after)'
                : pos === 'above'
                  ? 'Above'
                  : 'Below'
              return (
                <button
                  key={pos}
                  type="button"
                  onClick={() => onChange({ subPosition: pos })}
                  className={cn(
                    'py-1 rounded text-xs transition-colors',
                    scene.subPosition === pos
                      ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Writing direction */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground font-medium">Writing direction</label>
        <div className="grid grid-cols-2 gap-1 bg-secondary/30 p-0.5 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => onChange({ writing: 'h' as WritingDirection })}
            className={cn(
              'py-1 rounded text-xs transition-colors',
              !isVertical
                ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Horizontal
          </button>
          <button
            type="button"
            onClick={() => onChange({ writing: 'v' as WritingDirection })}
            className={cn(
              'py-1 rounded text-xs transition-colors',
              isVertical
                ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Vertical
          </button>
        </div>
      </div>

      {/* Alignment */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground font-medium">Alignment</label>
        <div className="grid grid-cols-3 gap-1 bg-secondary/30 p-0.5 rounded-lg border border-border">
          {[
            {
              id: 'start' as TextAlignment,
              label: isVertical ? 'Top' : 'Left',
              icon: isVertical ? AlignVerticalJustifyStart : AlignLeft,
            },
            {
              id: 'center' as TextAlignment,
              label: 'Center',
              icon: isVertical ? AlignVerticalJustifyCenter : AlignCenter,
            },
            {
              id: 'end' as TextAlignment,
              label: isVertical ? 'Bottom' : 'Right',
              icon: isVertical ? AlignVerticalJustifyEnd : AlignRight,
            },
          ].map((align) => {
            const Icon = align.icon
            const isSel = scene.align === align.id
            return (
              <button
                key={align.id}
                type="button"
                onClick={() => onChange({ align: align.id })}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-1 rounded text-xs transition-colors',
                  isSel
                    ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{align.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Auto-shrink switch */}
      <div className="flex items-center justify-between pt-1 gap-2">
        <label
          htmlFor="auto-shrink-switch"
          className="text-xs text-muted-foreground cursor-pointer"
        >
          Shrink automatically when the text overflows
        </label>
        <Switch
          id="auto-shrink-switch"
          checked={scene.autoFit}
          onCheckedChange={(v) => onChange({ autoFit: v })}
        />
      </div>
    </div>
  )
})
