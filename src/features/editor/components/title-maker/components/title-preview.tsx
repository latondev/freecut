import { memo, useEffect, useRef, useState, useCallback } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { TextRenderer } from '../engine/renderer'
import type { TitleScene } from '../types'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/shared/ui/cn'

interface TitlePreviewProps {
  scene: TitleScene
  onSceneChange: (scene: TitleScene) => void
}

type BgOption = 'clear' | 'black' | 'white' | 'gray'

export const TitlePreview = memo(function TitlePreview({
  scene,
  onSceneChange,
}: TitlePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [loop, setLoop] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(3.0)
  const [bgOption, setBgOption] = useState<BgOption>('clear')
  const [timelineSegments, setTimelineSegments] = useState<{
    inEnd: number
    holdEnd: number
    outEnd: number
  }>({ inEnd: 0.8, holdEnd: 2.5, outEnd: 3.0 })

  const rendererRef = useRef<TextRenderer>(new TextRenderer())
  const lastTimeRef = useRef<number>(performance.now())

  // Re-prepare renderer whenever scene changes
  useEffect(() => {
    const renderer = rendererRef.current
    const prep = renderer.prepare(scene)
    const dur = renderer.getDuration()
    setDuration(dur)
    if (prep?.timeline) {
      setTimelineSegments({
        inEnd: prep.timeline.inEnd,
        holdEnd: prep.timeline.holdEnd,
        outEnd: prep.timeline.outEnd,
      })
    }
  }, [scene])

  // Animation Loop
  const renderFrame = useCallback(
    (time: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const scale = canvas.width / scene.width
      rendererRef.current.render(ctx, time, { scale })
    },
    [scene.width],
  )

  useEffect(() => {
    let animId: number
    const tick = (now: number) => {
      if (isPlaying) {
        const delta = (now - lastTimeRef.current) / 1000
        setCurrentTime((prev) => {
          let next = prev + delta
          if (next >= duration) {
            if (loop) {
              next = 0
            } else {
              next = duration
              setIsPlaying(false)
            }
          }
          return next
        })
      }
      lastTimeRef.current = now
      animId = requestAnimationFrame(tick)
    }

    lastTimeRef.current = performance.now()
    animId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animId)
  }, [isPlaying, loop, duration])

  useEffect(() => {
    renderFrame(currentTime)
  }, [currentTime, renderFrame])

  const handleRestart = () => {
    setCurrentTime(0)
    setIsPlaying(true)
    lastTimeRef.current = performance.now()
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setCurrentTime(val)
  }

  const toggleInAnim = (val: boolean) => {
    onSceneChange({
      ...scene,
      inEnabled: val,
    })
  }

  const toggleOutAnim = (val: boolean) => {
    onSceneChange({
      ...scene,
      outEnabled: val,
    })
  }

  // Segment percentages for visual timeline
  const durSafe = Math.max(0.1, duration)
  const inPct = Math.min(100, Math.max(0, (timelineSegments.inEnd / durSafe) * 100))
  const holdPct = Math.min(
    100 - inPct,
    Math.max(0, ((timelineSegments.holdEnd - timelineSegments.inEnd) / durSafe) * 100),
  )
  const outPct = Math.max(0, 100 - inPct - holdPct)
  const thumbPct = Math.min(100, Math.max(0, (currentTime / durSafe) * 100))

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-card/60 p-3 shadow-sm">
      {/* Top Header: Preview Background Toggle */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-semibold text-foreground tracking-wide">Preview</span>
        <div className="flex items-center gap-1 bg-secondary/50 p-0.5 rounded-lg border border-border">
          {(['clear', 'black', 'white', 'gray'] as const).map((bg) => (
            <button
              key={bg}
              onClick={() => setBgOption(bg)}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-medium capitalize transition-all',
                bgOption === bg
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {bg}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas Viewport with transparent checkerboard */}
      <div
        className={cn(
          'relative w-full rounded-lg overflow-hidden border border-border flex items-center justify-center transition-colors shadow-inner',
          bgOption === 'clear' &&
            'bg-[conic-gradient(#f0f0f2_90deg,#ffffff_90deg_180deg,#f0f0f2_180deg_270deg,#ffffff_270deg)] [background-size:20px_20px] dark:bg-[conic-gradient(#202024_90deg,#141416_90deg_180deg,#202024_180deg_270deg,#141416_270deg)]',
          bgOption === 'black' && 'bg-black',
          bgOption === 'white' && 'bg-white',
          bgOption === 'gray' && 'bg-zinc-700',
        )}
        style={{ aspectRatio: `${scene.width} / ${scene.height}` }}
      >
        <canvas
          ref={(node) => {
            canvasRef.current = node
            if (node) {
              node.width = scene.width
              node.height = scene.height
              renderFrame(currentTime)
            }
          }}
          className="w-full h-full object-contain"
        />
      </div>

      {/* Playback Controls (Matching reference: Pause button, Reset, Switches, Time) */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-2.5 py-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95 text-xs font-semibold flex items-center gap-1 shadow-sm"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3 h-3" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  <span>Play</span>
                </>
              )}
            </button>
            <button
              onClick={handleRestart}
              className="p-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground transition-all active:scale-95"
              title="Restart"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <Switch id="sb-loop" checked={loop} onCheckedChange={setLoop} />
              <label htmlFor="sb-loop" className="text-[11px] text-muted-foreground cursor-pointer">
                Loop
              </label>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground font-semibold">
              {currentTime.toFixed(2)} / {duration.toFixed(2)}s
            </span>
          </div>
        </div>

        {/* Entrance & Exit Switch Row */}
        <div className="flex items-center justify-between text-[11px] px-0.5">
          <div className="flex items-center gap-1.5">
            <Switch id="sb-in" checked={scene.inEnabled !== false} onCheckedChange={toggleInAnim} />
            <label htmlFor="sb-in" className="text-[11px] text-muted-foreground cursor-pointer">
              Entrance
            </label>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch
              id="sb-out"
              checked={scene.outEnabled !== false}
              onCheckedChange={toggleOutAnim}
            />
            <label htmlFor="sb-out" className="text-[11px] text-muted-foreground cursor-pointer">
              Exit
            </label>
          </div>
        </div>

        {/* Timeline Multi-color Segmented Scrubber */}
        <div className="space-y-1 pt-0.5">
          <div className="relative w-full h-2 rounded-full overflow-hidden bg-secondary/80 flex cursor-pointer">
            {/* Blue In segment */}
            <div style={{ width: `${inPct}%` }} className="h-full bg-blue-500 opacity-85" />
            {/* Slate/Hold segment */}
            <div
              style={{ width: `${holdPct}%` }}
              className="h-full bg-slate-400 dark:bg-slate-600 opacity-85"
            />
            {/* Orange/Out segment */}
            <div style={{ width: `${outPct}%` }} className="h-full bg-orange-500 opacity-85" />

            {/* Invisible native range input overlay */}
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.02}
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />

            {/* Thumb Indicator */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-white shadow pointer-events-none z-20 -translate-x-1/2"
              style={{ left: `${thumbPct}%` }}
            />
          </div>

          {/* Phase Legend */}
          <div className="flex items-center gap-3 text-[9px] text-muted-foreground font-mono">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
              <span>In</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-600 inline-block" />
              <span>Hold</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
              <span>Out</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
