import { memo } from 'react'
import type { TitleScene, AnchorPosition } from '../../types'
import { SIZE_PRESETS } from '../../engine/presets'
import { cn } from '@/shared/ui/cn'

interface LayoutTabProps {
  scene: TitleScene
  onChange: (patch: Partial<TitleScene>) => void
}

const ANCHORS: Array<{ id: AnchorPosition; label: string }> = [
  { id: 'tl', label: 'TL' },
  { id: 'tc', label: 'TC' },
  { id: 'tr', label: 'TR' },
  { id: 'ml', label: 'ML' },
  { id: 'mc', label: 'MC' },
  { id: 'mr', label: 'MR' },
  { id: 'bl', label: 'BL' },
  { id: 'bc', label: 'BC' },
  { id: 'br', label: 'BR' },
]

export const LayoutTab = memo(function LayoutTab({ scene, onChange }: LayoutTabProps) {
  const handleSizePresetChange = (presetId: string) => {
    const preset = SIZE_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    onChange({
      sizePreset: preset.id,
      width: preset.w,
      height: preset.h,
    })
  }

  return (
    <div className="flex flex-col gap-3 py-1 text-xs">
      {/* Canvas Size Presets */}
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground font-medium">Độ phân giải / Kích thước khung</label>
        <select
          value={scene.sizePreset}
          onChange={(e) => handleSizePresetChange(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {SIZE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Anchor Position Grid */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-border/60">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Vị trí neo (Anchor Grid)
        </span>
        <div className="grid grid-cols-3 gap-1.5 w-36 mx-auto bg-secondary/30 p-1 rounded-lg border border-border">
          {ANCHORS.map((anc) => (
            <button
              key={anc.id}
              type="button"
              onClick={() => onChange({ anchor: anc.id })}
              className={cn(
                'aspect-square flex items-center justify-center rounded text-[10px] font-mono transition-all',
                scene.anchor === anc.id
                  ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                  : 'bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              {anc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Margins */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Margins (Khoảng cách mép)
        </span>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-muted-foreground">
            <span>Cách viền ngang (Margin X)</span>
            <span className="font-mono">{scene.marginX}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={200}
            value={scene.marginX}
            onChange={(e) => onChange({ marginX: parseInt(e.target.value, 10) })}
            className="w-full h-1.5 bg-secondary/80 rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-muted-foreground">
            <span>Cách viền dọc (Margin Y)</span>
            <span className="font-mono">{scene.marginY}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={200}
            value={scene.marginY}
            onChange={(e) => onChange({ marginY: parseInt(e.target.value, 10) })}
            className="w-full h-1.5 bg-secondary/80 rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>
      </div>

      {/* Offsets */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Tọa độ dịch chuyển (Offset)
        </span>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">X Offset</span>
            <input
              type="number"
              value={scene.offsetX}
              onChange={(e) => onChange({ offsetX: parseInt(e.target.value, 10) || 0 })}
              className="px-2 py-1 rounded-md border border-border bg-background text-foreground font-mono"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">Y Offset</span>
            <input
              type="number"
              value={scene.offsetY}
              onChange={(e) => onChange({ offsetY: parseInt(e.target.value, 10) || 0 })}
              className="px-2 py-1 rounded-md border border-border bg-background text-foreground font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  )
})
