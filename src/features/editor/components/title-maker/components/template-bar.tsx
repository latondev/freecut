import { memo } from 'react'
import {
  RotateCcw,
  Sparkles,
  MoveUp,
  Sliders,
  Clock,
  Underline as UnderlineIcon,
  Columns2,
  Box,
  Swords,
  AlertTriangle,
  Play,
  Terminal,
} from 'lucide-react'
import { TEMPLATES } from '../engine/presets'
import type { TitleMode, TitleTemplateItem } from '../types'
import { cn } from '@/shared/ui/cn'

interface TemplateBarProps {
  mode: TitleMode
  activeTemplateId?: string
  onSelectTemplate: (template: TitleTemplateItem) => void
  onReset: () => void
}

const TEMPLATE_ICONS: Record<string, any> = {
  converge: Sliders,
  floatUp: MoveUp,
  spacing: Sparkles,
  stopwatch: Clock,
  underline: UnderlineIcon,
  vertical: Columns2,
  frame: Box,
  swords: Swords,
  chip: Sparkles,
  warning: AlertTriangle,
  play: Play,
  typewriter: Terminal,
}

export const TemplateBar = memo(function TemplateBar({
  mode,
  activeTemplateId,
  onSelectTemplate,
  onReset,
}: TemplateBarProps) {
  const templates = TEMPLATES[mode] || []

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
        <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">
          Templates
        </span>
        <button
          onClick={onReset}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors active:scale-95"
          title="Reset to default template"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
        {templates.map((tpl) => {
          const Icon = (tpl.icon && TEMPLATE_ICONS[tpl.icon]) || Sparkles
          const isActive = activeTemplateId === tpl.id
          return (
            <button
              key={tpl.id}
              onClick={() => onSelectTemplate(tpl)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all group active:scale-95',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-secondary/40 border-border text-foreground hover:bg-secondary hover:border-primary/40',
              )}
            >
              <Icon
                className={cn(
                  'w-3 h-3 transition-colors',
                  isActive ? 'text-primary-foreground' : 'text-primary group-hover:scale-110',
                )}
              />
              <span>{tpl.label.vi || tpl.label.en}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
})
