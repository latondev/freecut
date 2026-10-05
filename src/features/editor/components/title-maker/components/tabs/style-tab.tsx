import { memo } from 'react'
import type { TitleScene, DecoType } from '../../types'
import { STYLE_PRESETS } from '../../engine/presets'
import { cn } from '@/shared/ui/cn'

interface StyleTabProps {
  scene: TitleScene
  onChange: (patch: Partial<TitleScene>) => void
}

const DECO_TYPES: Array<{ id: DecoType; label: string }> = [
  { id: 'none', label: 'Không có (None)' },
  { id: 'box', label: 'Khung hộp (Box / Badge)' },
  { id: 'corners', label: 'Góc ngắm (Corners)' },
  { id: 'underline', label: 'Gạch chân (Underline)' },
  { id: 'sides', label: 'Hai bên cánh (Sides)' },
  { id: 'band', label: 'Dải băng nền (Band)' },
  { id: 'tape', label: 'Băng dán cảnh báo (Tape)' },
  { id: 'bar', label: 'Thanh dọc cạnh bên (Bar)' },
  { id: 'frame', label: 'Viền chữ nhật (Frame)' },
]

export const StyleTab = memo(function StyleTab({ scene, onChange }: StyleTabProps) {
  return (
    <div className="flex flex-col gap-3 py-1 text-xs">
      {/* Quick Style Presets Bar */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Style Presets (Mẫu màu nhanh)
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {STYLE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.patch)}
              className="px-2 py-1.5 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 text-foreground transition-all active:scale-95 text-center truncate font-medium text-[11px]"
            >
              {p.label.vi || p.label.en}
            </button>
          ))}
        </div>
      </div>

      {/* Fill Color */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Fill Color (Màu chữ)
        </span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={scene.fill?.color || '#ffffff'}
            onChange={(e) =>
              onChange({
                fill: {
                  ...scene.fill,
                  color: e.target.value,
                },
              })
            }
            className="w-8 h-8 rounded border border-border bg-transparent cursor-pointer"
          />
          <input
            type="text"
            value={scene.fill?.color || '#ffffff'}
            onChange={(e) =>
              onChange({
                fill: {
                  ...scene.fill,
                  color: e.target.value,
                },
              })
            }
            className="flex-1 px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono uppercase"
          />
        </div>
      </div>

      {/* Stroke 1 (Viền chữ chính) */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Stroke (Viền chữ)
          </span>
          <button
            type="button"
            onClick={() =>
              onChange({
                stroke: { ...scene.stroke, on: !scene.stroke.on },
              })
            }
            className={cn(
              'w-8 h-4 rounded-full p-0.5 transition-colors',
              scene.stroke.on ? 'bg-primary' : 'bg-secondary',
            )}
          >
            <div
              className={cn(
                'w-3 h-3 rounded-full bg-white transition-transform shadow-sm',
                scene.stroke.on ? 'translate-x-4' : 'translate-x-0',
              )}
            />
          </button>
        </div>

        {scene.stroke.on && (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={scene.stroke.color}
              onChange={(e) =>
                onChange({
                  stroke: { ...scene.stroke, color: e.target.value },
                })
              }
              className="w-8 h-8 rounded border border-border bg-transparent cursor-pointer"
            />
            <div className="flex-1 flex flex-col gap-0.5">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Độ dày viền</span>
                <span>{scene.stroke.width}px</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                value={scene.stroke.width}
                onChange={(e) =>
                  onChange({
                    stroke: { ...scene.stroke, width: parseInt(e.target.value, 10) },
                  })
                }
                className="w-full h-1.5 bg-secondary/80 rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
          </div>
        )}
      </div>

      {/* Shadow */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Shadow (Đổ bóng)
          </span>
          <button
            type="button"
            onClick={() =>
              onChange({
                shadow: { ...scene.shadow, on: !scene.shadow.on },
              })
            }
            className={cn(
              'w-8 h-4 rounded-full p-0.5 transition-colors',
              scene.shadow.on ? 'bg-primary' : 'bg-secondary',
            )}
          >
            <div
              className={cn(
                'w-3 h-3 rounded-full bg-white transition-transform shadow-sm',
                scene.shadow.on ? 'translate-x-4' : 'translate-x-0',
              )}
            />
          </button>
        </div>

        {scene.shadow.on && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Độ mờ bóng (Blur)</span>
              <span>{scene.shadow.blur}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={30}
              value={scene.shadow.blur}
              onChange={(e) =>
                onChange({
                  shadow: { ...scene.shadow, blur: parseInt(e.target.value, 10) },
                })
              }
              className="w-full h-1.5 bg-secondary/80 rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
        )}
      </div>

      {/* Glow (Neon) */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Neon Glow (Hào quang phát sáng)
          </span>
          <button
            type="button"
            onClick={() =>
              onChange({
                glow: { ...scene.glow, on: !scene.glow.on },
              })
            }
            className={cn(
              'w-8 h-4 rounded-full p-0.5 transition-colors',
              scene.glow.on ? 'bg-primary' : 'bg-secondary',
            )}
          >
            <div
              className={cn(
                'w-3 h-3 rounded-full bg-white transition-transform shadow-sm',
                scene.glow.on ? 'translate-x-4' : 'translate-x-0',
              )}
            />
          </button>
        </div>

        {scene.glow.on && (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={scene.glow.color}
              onChange={(e) =>
                onChange({
                  glow: { ...scene.glow, color: e.target.value },
                })
              }
              className="w-8 h-8 rounded border border-border bg-transparent cursor-pointer"
            />
            <div className="flex-1 flex flex-col gap-0.5">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Cường độ phát quang</span>
                <span>{scene.glow.size}px</span>
              </div>
              <input
                type="range"
                min={4}
                max={50}
                value={scene.glow.size}
                onChange={(e) =>
                  onChange({
                    glow: { ...scene.glow, size: parseInt(e.target.value, 10) },
                  })
                }
                className="w-full h-1.5 bg-secondary/80 rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
          </div>
        )}
      </div>

      {/* Decoration */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Decoration (Trang trí khung nền / gạch chân)
        </span>
        <select
          value={scene.deco?.type || 'none'}
          onChange={(e) =>
            onChange({
              deco: { ...scene.deco, type: e.target.value as DecoType },
            })
          }
          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {DECO_TYPES.map((dt) => (
            <option key={dt.id} value={dt.id}>
              {dt.label}
            </option>
          ))}
        </select>

        {scene.deco?.type && scene.deco.type !== 'none' && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">Màu đường nét viền</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={scene.deco.color2 || '#ffffff'}
                  onChange={(e) =>
                    onChange({
                      deco: { ...scene.deco, color2: e.target.value },
                    })
                  }
                  className="w-6 h-6 rounded border border-border bg-transparent cursor-pointer"
                />
                <span className="font-mono text-[10px] uppercase">
                  {scene.deco.color2 || '#ffffff'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">Màu nền khung</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={scene.deco.color || '#000000'}
                  onChange={(e) =>
                    onChange({
                      deco: { ...scene.deco, color: e.target.value },
                    })
                  }
                  className="w-6 h-6 rounded border border-border bg-transparent cursor-pointer"
                />
                <span className="font-mono text-[10px] uppercase">
                  {scene.deco.color || '#000000'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
