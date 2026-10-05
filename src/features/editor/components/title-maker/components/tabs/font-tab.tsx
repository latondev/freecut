import { memo } from 'react'
import type { TitleScene } from '../../types'

interface FontTabProps {
  scene: TitleScene
  onChange: (patch: Partial<TitleScene>) => void
}

const COMMON_FONTS = [
  'Inter',
  'Cinzel',
  'Orbitron',
  'Oswald',
  'Anton',
  'Playfair Display',
  'Bebas Neue',
  'Montserrat',
  'Caveat',
  'Special Elite',
  'Permanent Marker',
]

export const FontTab = memo(function FontTab({ scene, onChange }: FontTabProps) {
  return (
    <div className="flex flex-col gap-3 py-1 text-xs">
      {/* Font Family */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground font-medium">Font Family</label>
        <select
          value={scene.fontId}
          onChange={(e) => onChange({ fontId: e.target.value })}
          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {COMMON_FONTS.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </select>
      </div>

      {/* Font Weight & Italic */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">Độ đậm (Weight)</label>
          <select
            value={scene.weight}
            onChange={(e) => onChange({ weight: parseInt(e.target.value, 10) })}
            className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value={400}>400 (Regular)</option>
            <option value={600}>600 (Semibold)</option>
            <option value={700}>700 (Bold)</option>
            <option value={800}>800 (Extra Bold)</option>
            <option value={900}>900 (Black)</option>
          </select>
        </div>

        <div className="flex flex-col justify-end">
          <button
            type="button"
            onClick={() => onChange({ italic: !scene.italic })}
            className={`w-full py-1.5 rounded-lg border transition-colors ${
              scene.italic
                ? 'bg-primary text-primary-foreground font-medium border-primary'
                : 'bg-secondary/40 border-border text-foreground hover:bg-secondary'
            }`}
          >
            Chữ nghiêng (Italic)
          </button>
        </div>
      </div>

      {/* Font Size */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Kích thước chữ (Font Size)</span>
          <span className="font-mono text-foreground">{scene.fontSize}px</span>
        </div>
        <input
          type="range"
          min={24}
          max={240}
          step={2}
          value={scene.fontSize}
          onChange={(e) => onChange({ fontSize: parseInt(e.target.value, 10) })}
          className="w-full h-1.5 bg-secondary/80 rounded-lg appearance-none cursor-pointer accent-primary"
        />
      </div>

      {/* Letter Spacing */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Khoảng cách chữ (Tracking)</span>
          <span className="font-mono text-foreground">{scene.letterSpacing.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={0.6}
          step={0.02}
          value={scene.letterSpacing}
          onChange={(e) => onChange({ letterSpacing: parseFloat(e.target.value) })}
          className="w-full h-1.5 bg-secondary/80 rounded-lg appearance-none cursor-pointer accent-primary"
        />
      </div>

      {/* Line Height */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Độ cao dòng (Line Height)</span>
          <span className="font-mono text-foreground">{scene.lineHeight.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={1}
          max={2.5}
          step={0.05}
          value={scene.lineHeight}
          onChange={(e) => onChange({ lineHeight: parseFloat(e.target.value) })}
          className="w-full h-1.5 bg-secondary/80 rounded-lg appearance-none cursor-pointer accent-primary"
        />
      </div>

      {/* Sub text size & gap */}
      {scene.mode !== 'trailer' && (
        <div className="pt-2 border-t border-border/60 flex flex-col gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Sub Text Typography
          </span>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Tỉ lệ cỡ chữ phụ</span>
              <span className="font-mono text-foreground">{Math.round(scene.subSize * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.15}
              max={0.7}
              step={0.02}
              value={scene.subSize}
              onChange={(e) => onChange({ subSize: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-secondary/80 rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
        </div>
      )}
    </div>
  )
})
