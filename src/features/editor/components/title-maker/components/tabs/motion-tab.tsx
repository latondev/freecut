import { memo } from 'react'
import type { TitleScene, InEffectType, OutEffectType, HoldEffectType } from '../../types'

interface MotionTabProps {
  scene: TitleScene
  onChange: (patch: Partial<TitleScene>) => void
}

const IN_EFFECTS: Array<{ id: InEffectType; label: string }> = [
  { id: 'fade', label: 'Fade (Mờ dần)' },
  { id: 'rise', label: 'Rise (Trồi lên)' },
  { id: 'drop', label: 'Drop (Rơi xuống)' },
  { id: 'converge', label: 'Converge (Hội tụ 2 bên)' },
  { id: 'slide', label: 'Slide (Trượt ngang)' },
  { id: 'tracking', label: 'Tracking (Dãn khoảng cách chữ)' },
  { id: 'blurIn', label: 'Blur In (Hiện từ nhòe)' },
  { id: 'pop', label: 'Pop (Bật nảy)' },
  { id: 'flicker', label: 'Flicker (Nhấp nháy bóng đèn)' },
  { id: 'glitch', label: 'Glitch (Nhiễu điện tử)' },
  { id: 'slam', label: 'Slam (Đập mạnh)' },
]

const OUT_EFFECTS: Array<{ id: OutEffectType; label: string }> = [
  { id: 'none', label: 'Không có (Dừng ở kết)' },
  { id: 'fade', label: 'Fade (Mờ dần)' },
  { id: 'rise', label: 'Rise (Bay lên)' },
  { id: 'sink', label: 'Sink (Chìm xuống)' },
  { id: 'slide', label: 'Slide (Trượt biến mất)' },
  { id: 'blurOut', label: 'Blur Out (Nhòe dần biến mất)' },
  { id: 'glitch', label: 'Glitch (Nhiễu biến mất)' },
]

const HOLD_EFFECTS: Array<{ id: HoldEffectType; label: string }> = [
  { id: 'none', label: 'Đứng yên (None)' },
  { id: 'float', label: 'Float (Bập bênh bồng bềnh)' },
  { id: 'wave', label: 'Wave (Lượn sóng từng chữ)' },
  { id: 'pulse', label: 'Pulse (Nhịp thở đập nhẹ)' },
  { id: 'shake', label: 'Shake (Rung rinh nhẹ)' },
  { id: 'glow', label: 'Glow (Hào quang lóe sáng)' },
  { id: 'blink', label: 'Blink (Chớp tắt)' },
]

export const MotionTab = memo(function MotionTab({ scene, onChange }: MotionTabProps) {
  return (
    <div className="flex flex-col gap-3 py-1 text-xs">
      {/* IN ANIMATION */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
          Entrance Motion (Hiệu ứng Xuất Hiện)
        </span>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground font-medium">Kiểu xuất hiện</label>
          <select
            value={scene.inFx}
            onChange={(e) => onChange({ inFx: e.target.value as InEffectType })}
            className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {IN_EFFECTS.map((fx) => (
              <option key={fx.id} value={fx.id}>
                {fx.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Thời lượng xuất hiện</span>
            <span className="font-mono text-foreground">{scene.inDur.toFixed(2)}s</span>
          </div>
          <input
            type="range"
            min={0.1}
            max={2.5}
            step={0.05}
            value={scene.inDur}
            onChange={(e) => onChange({ inDur: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-secondary/80 rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Độ trễ từng ký tự (Stagger)</span>
            <span className="font-mono text-foreground">{scene.inStagger.toFixed(2)}s</span>
          </div>
          <input
            type="range"
            min={0}
            max={0.2}
            step={0.01}
            value={scene.inStagger}
            onChange={(e) => onChange({ inStagger: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-secondary/80 rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>
      </div>

      {/* HOLD ANIMATION */}
      <div className="pt-2 border-t border-border/60 flex flex-col gap-2">
        <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
          Hold Phase (Giai đoạn Hiển Thị)
        </span>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground font-medium">Chuyển động lúc hiển thị</label>
          <select
            value={scene.holdFx}
            onChange={(e) => onChange({ holdFx: e.target.value as HoldEffectType })}
            className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {HOLD_EFFECTS.map((fx) => (
              <option key={fx.id} value={fx.id}>
                {fx.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Thời gian dừng hiển thị (Hold)</span>
            <span className="font-mono text-foreground">{scene.hold.toFixed(2)}s</span>
          </div>
          <input
            type="range"
            min={0.2}
            max={5.0}
            step={0.1}
            value={scene.hold}
            onChange={(e) => onChange({ hold: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-secondary/80 rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>
      </div>

      {/* OUT ANIMATION */}
      <div className="pt-2 border-t border-border/60 flex flex-col gap-2">
        <span className="text-[11px] font-semibold text-orange-400 uppercase tracking-wider">
          Exit Motion (Hiệu ứng Biến Mất)
        </span>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground font-medium">Kiểu biến mất</label>
          <select
            value={scene.outFx}
            onChange={(e) => onChange({ outFx: e.target.value as OutEffectType })}
            className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {OUT_EFFECTS.map((fx) => (
              <option key={fx.id} value={fx.id}>
                {fx.label}
              </option>
            ))}
          </select>
        </div>

        {scene.outFx !== 'none' && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Thời lượng biến mất</span>
              <span className="font-mono text-foreground">{scene.outDur.toFixed(2)}s</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={2.5}
              step={0.05}
              value={scene.outDur}
              onChange={(e) => onChange({ outDur: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-secondary/80 rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
        )}
      </div>
    </div>
  )
})
