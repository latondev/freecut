import { memo } from 'react'
import { MessageSquare, Clapperboard, MapPin } from 'lucide-react'
import type { TitleMode } from '../types'
import { cn } from '@/shared/ui/cn'

interface ModeSelectorProps {
  activeMode: TitleMode
  onSelectMode: (mode: TitleMode) => void
}

const MODES = [
  {
    id: 'message' as const,
    label: 'Message',
    sub: '"Battle Start" cut-ins',
    icon: MessageSquare,
  },
  {
    id: 'trailer' as const,
    label: 'Trailer',
    sub: 'Show longer text',
    icon: Clapperboard,
  },
  {
    id: 'caption' as const,
    label: 'Place & Time',
    sub: 'Place & scene captions',
    icon: MapPin,
  },
]

export const ModeSelector = memo(function ModeSelector({
  activeMode,
  onSelectMode,
}: ModeSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-1.5 p-1 bg-secondary/30 rounded-xl border border-border">
      {MODES.map((m) => {
        const Icon = m.icon
        const isActive = activeMode === m.id
        return (
          <button
            key={m.id}
            onClick={() => onSelectMode(m.id)}
            className={cn(
              'flex flex-col items-center justify-center p-2 rounded-lg transition-all text-center group border',
              isActive
                ? 'bg-card text-foreground border-primary/40 shadow-sm'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40',
            )}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <Icon
                className={cn(
                  'w-3.5 h-3.5 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                )}
              />
              <span className="text-xs font-semibold">{m.label}</span>
            </div>
            <span className="text-[9px] text-muted-foreground/80 line-clamp-1">{m.sub}</span>
          </button>
        )
      })}
    </div>
  )
})
