import { memo, useState, useCallback, useMemo, useEffect } from 'react'
import {
  PlusCircle,
  Bookmark,
  Sparkles,
  Loader2,
  FileVideo,
  FileImage,
  ImageIcon,
  X,
  RotateCcw,
  Play,
  Pause,
} from 'lucide-react'
import { ModeSelector } from './components/mode-selector'
import { TemplateBar } from './components/template-bar'
import { TextTab } from './components/tabs/text-tab'
import { FontTab } from './components/tabs/font-tab'
import { MotionTab } from './components/tabs/motion-tab'
import { StyleTab } from './components/tabs/style-tab'
import { LayoutTab } from './components/tabs/layout-tab'
import { UserTemplatesDialog } from './components/user-templates-dialog'
import { TextRenderer } from './engine/renderer'
import { TEMPLATES, applyTemplateToScene, cloneScene } from './engine/presets'
import {
  exportTitleAsApng,
  exportTitleAsWebM,
  exportTitleStillPng,
  downloadBlob,
  type ExportProgress,
} from './engine/export-utils'
import type { TitleMode, TitleScene, TitleTemplateItem } from './types'
import { useTimelineStore } from '@/features/editor/deps/timeline-store'
import { usePlaybackStore } from '@/shared/state/playback'
import { useSelectionStore } from '@/shared/state/selection'
import { useProjectStore } from '@/features/editor/deps/projects'
import {
  createOverlayLayerTrack,
  getDefaultGeneratedLayerDurationInFrames,
} from '@/features/editor/deps/timeline-utils'
import { DEFAULT_PROJECT_HEIGHT, DEFAULT_PROJECT_WIDTH } from '@/shared/projects/defaults'
import type { TextItem } from '@/types/timeline'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { cn } from '@/shared/ui/cn'

type SubTab = 'text' | 'font' | 'motion' | 'style' | 'layout'
type BgOption = 'clear' | 'black' | 'white' | 'gray'

interface TitleMakerStudioDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scene: TitleScene
  onSceneChange: (scene: TitleScene) => void
}

export const TitleMakerStudioDialog = memo(function TitleMakerStudioDialog({
  open,
  onOpenChange,
  scene,
  onSceneChange,
}: TitleMakerStudioDialogProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('text')
  const [activeTemplateId, setActiveTemplateId] = useState<string>(scene.templateId || 'boxed')
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null)

  // Preview & Transport state
  const [isPlaying, setIsPlaying] = useState(true)
  const [loop, setLoop] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(3.0)
  const [bgOption, setBgOption] = useState<BgOption>('clear')
  const [timelineSegments, setTimelineSegments] = useState<{
    inEnd: number
    holdEnd: number
    outEnd: number
    duration: number
  }>({ inEnd: 0.8, holdEnd: 2.5, outEnd: 3.0, duration: 3.0 })

  // Export settings matching web tool
  const [exportFps, setExportFps] = useState<number>(24)
  const [exportLoopMode, setExportLoopMode] = useState<'once' | 'infinite'>('once')
  const [exportColors, setExportColors] = useState<'256' | 'full'>('256')
  const [fileName, setFileName] = useState(() => {
    return scene.text ? scene.text.trim().replace(/\s+/g, '_') : 'Title_CutIn'
  })

  const canvasRef = useMemo(() => ({ current: null as HTMLCanvasElement | null }), [])
  const rendererRef = useMemo(() => ({ current: new TextRenderer() }), [])
  const lastTimeRef = useMemo(() => ({ current: performance.now() }), [])

  // Sync timeline & renderer whenever scene changes
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
        duration: prep.timeline.duration || dur,
      })
    }
  }, [scene, rendererRef])

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
    [scene.width, canvasRef, rendererRef],
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
  }, [isPlaying, loop, duration, lastTimeRef])

  // Re-render frame when time changes
  useEffect(() => {
    renderFrame(currentTime)
  }, [currentTime, renderFrame])

  // Handle Mode Change
  const handleSelectMode = useCallback(
    (mode: TitleMode) => {
      const tplList = TEMPLATES[mode] || []
      const firstTpl = tplList[0]
      if (firstTpl) {
        setActiveTemplateId(firstTpl.id)
        const next = cloneScene(scene)
        next.mode = mode
        onSceneChange(applyTemplateToScene(next, firstTpl, 'vi'))
      } else {
        onSceneChange({ ...scene, mode })
      }
    },
    [scene, onSceneChange],
  )

  // Handle Template Selection
  const handleSelectTemplate = useCallback(
    (template: TitleTemplateItem) => {
      setActiveTemplateId(template.id)
      onSceneChange(applyTemplateToScene(scene, template, 'vi'))
      toast.success(`Đã áp dụng mẫu "${template.label.vi || template.label.en}"`)
    },
    [scene, onSceneChange],
  )

  // Handle Reset Template
  const handleResetTemplate = useCallback(() => {
    const list = TEMPLATES[scene.mode] || []
    const first = list[0]
    if (first) {
      setActiveTemplateId(first.id)
      onSceneChange(applyTemplateToScene(scene, first, 'vi'))
      toast.info('Đã thiết lập lại mẫu mặc định')
    }
  }, [scene, onSceneChange])

  // Handle Patch
  const handlePatchScene = useCallback(
    (patch: Partial<TitleScene>) => {
      onSceneChange({ ...scene, ...patch })
    },
    [scene, onSceneChange],
  )

  // Auto filename
  const handleAutoFileName = useCallback(() => {
    const base = scene.text
      ? scene.text
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '_')
      : 'Title'
    const suffix = scene.inFx ? `_${scene.inFx}` : ''
    setFileName(`${base}${suffix}`)
  }, [scene.text, scene.inFx])

  // Add to Timeline
  const handleAddToTimeline = useCallback(() => {
    const { tracks, fps, addItemOnNewTrack } = useTimelineStore.getState()
    const { activeTrackId, selectItems, setActiveTrack } = useSelectionStore.getState()
    const currentProject = useProjectStore.getState().currentProject

    const newTrack = createOverlayLayerTrack({ tracks, activeTrackId })
    if (!newTrack) {
      toast.error('Không thể tạo track mới trên timeline')
      return
    }

    const canvasWidth = currentProject?.metadata.width || DEFAULT_PROJECT_WIDTH
    const canvasHeight = currentProject?.metadata.height || DEFAULT_PROJECT_HEIGHT
    const currentFrame = Math.max(0, usePlaybackStore.getState().currentFrame)
    const baseDuration = getDefaultGeneratedLayerDurationInFrames(fps)
    const durationInFrames = Math.max(
      baseDuration,
      Math.round((scene.inDur + scene.hold + scene.outDur) * fps),
    )

    const label = scene.text ? scene.text.slice(0, 20) : 'Title'
    const mappedWeight =
      scene.weight >= 700
        ? 'bold'
        : scene.weight >= 600
          ? 'semibold'
          : scene.weight >= 500
            ? 'medium'
            : 'normal'
    const mappedAlign =
      scene.align === 'start' ? 'left' : scene.align === 'end' ? 'right' : 'center'

    const textItem: TextItem = {
      id: crypto.randomUUID(),
      type: 'text',
      trackId: newTrack.trackId,
      from: currentFrame,
      durationInFrames,
      label,
      text: scene.subText ? `${scene.text}\n${scene.subText}` : scene.text,
      color: scene.fill?.color || '#ffffff',
      fontSize: Math.min(scene.fontSize, 120),
      fontFamily: scene.fontId || 'Inter',
      fontWeight: mappedWeight,
      fontStyle: scene.italic ? 'italic' : 'normal',
      textAlign: mappedAlign,
      letterSpacing: scene.letterSpacing,
      lineHeight: scene.lineHeight,
      stroke:
        scene.stroke && scene.stroke.on
          ? {
              width: scene.stroke.width,
              color: scene.stroke.color,
            }
          : undefined,
      textShadow:
        scene.shadow && scene.shadow.on
          ? {
              color: scene.shadow.color,
              blur: scene.shadow.blur,
              offsetX: scene.shadow.x,
              offsetY: scene.shadow.y,
            }
          : undefined,
      backgroundColor: scene.deco?.type === 'box' ? scene.deco.color || '#000000' : undefined,
      transform: {
        x: 0,
        y: 0,
        width: canvasWidth * 0.8,
        height: canvasHeight * 0.3,
        rotation: 0,
        opacity: 1,
      },
    }

    addItemOnNewTrack(textItem, newTrack.tracks)
    setActiveTrack(newTrack.trackId)
    selectItems([textItem.id])
    toast.success(`Đã thêm "${label}" vào Timeline!`)
    onOpenChange(false)
  }, [scene, onOpenChange])

  // Exporters
  const handleExportApng = useCallback(async () => {
    setIsExporting(true)
    setExportProgress(null)
    try {
      toast.info('Đang render & nén file APNG trong suốt...')
      const blob = await exportTitleAsApng(scene, exportFps, (prog) => {
        setExportProgress(prog)
      })
      downloadBlob(blob, `${fileName || 'title_cutin'}.png`)
      toast.success('Xuất file APNG thành công!')
    } catch (e: any) {
      console.error(e)
      toast.error(`Xuất APNG thất bại: ${e?.message || 'Lỗi không xác định'}`)
    } finally {
      setIsExporting(false)
      setExportProgress(null)
    }
  }, [scene, exportFps, fileName])

  const handleExportWebM = useCallback(async () => {
    setIsExporting(true)
    setExportProgress(null)
    try {
      toast.info('Đang render video WebM trong suốt...')
      const blob = await exportTitleAsWebM(scene, exportFps, (prog) => {
        setExportProgress(prog)
      })
      downloadBlob(blob, `${fileName || 'title_cutin'}.webm`)
      toast.success('Xuất file WebM trong suốt thành công!')
    } catch (e: any) {
      console.error(e)
      toast.error(`Xuất WebM thất bại: ${e?.message || 'Lỗi không xác định'}`)
    } finally {
      setIsExporting(false)
      setExportProgress(null)
    }
  }, [scene, exportFps, fileName])

  const handleExportStill = useCallback(async () => {
    try {
      const blob = await exportTitleStillPng(scene, currentTime)
      downloadBlob(blob, `${fileName || 'title_still'}.png`)
      toast.success('Đã lưu ảnh tĩnh PNG!')
    } catch (e: any) {
      console.error(e)
      toast.error('Lưu ảnh tĩnh thất bại')
    }
  }, [scene, currentTime, fileName])

  if (!open) return null

  // Timeline segment percentages
  const durSafe = Math.max(0.1, timelineSegments.duration)
  const inPct = Math.min(100, Math.max(0, (timelineSegments.inEnd / durSafe) * 100))
  const holdPct = Math.min(
    100 - inPct,
    Math.max(0, ((timelineSegments.holdEnd - timelineSegments.inEnd) / durSafe) * 100),
  )
  const outPct = Math.max(0, 100 - inPct - holdPct)
  const thumbPct = Math.min(100, Math.max(0, (currentTime / durSafe) * 100))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-[1520px] h-[92vh] max-h-[960px] bg-background text-foreground rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-card/90">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-primary/90">
                  TRPG WEB TOOLS OBSERVATORY
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-secondary text-muted-foreground font-mono">
                  v1.08 / 2026
                </span>
              </div>
              <h1 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                Text Image APNG Maker
                <span className="text-xs font-normal text-muted-foreground hidden sm:inline">
                  — Animated Cut-in & Motion Title Studio
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTemplatesDialogOpen(true)}
              className="h-8 text-xs px-3 flex items-center gap-1.5"
            >
              <Bookmark className="w-3.5 h-3.5 text-primary" />
              <span>Mẫu của tôi (My Templates)</span>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Studio 2-Column Main Workspace */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* LEFT COLUMN: Controls & Customization */}
          <div className="w-full md:w-[460px] flex-shrink-0 border-r border-border bg-card/40 flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* 1. Mode Selector */}
              <ModeSelector activeMode={scene.mode} onSelectMode={handleSelectMode} />

              {/* 2. Template Bar */}
              <TemplateBar
                mode={scene.mode}
                activeTemplateId={activeTemplateId}
                onSelectTemplate={handleSelectTemplate}
                onReset={handleResetTemplate}
              />

              {/* 3. Subtabs Bar */}
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-5 gap-1 bg-secondary/50 p-1 rounded-xl border border-border">
                  {(['text', 'font', 'motion', 'style', 'layout'] as SubTab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveSubTab(tab)}
                      className={cn(
                        'py-1.5 rounded-lg text-xs font-semibold capitalize transition-all',
                        activeSubTab === tab
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60',
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Subtab Contents Card */}
                <div className="p-4 rounded-xl border border-border bg-card/60 shadow-sm">
                  {activeSubTab === 'text' && <TextTab scene={scene} onChange={handlePatchScene} />}
                  {activeSubTab === 'font' && <FontTab scene={scene} onChange={handlePatchScene} />}
                  {activeSubTab === 'motion' && (
                    <MotionTab scene={scene} onChange={handlePatchScene} />
                  )}
                  {activeSubTab === 'style' && (
                    <StyleTab scene={scene} onChange={handlePatchScene} />
                  )}
                  {activeSubTab === 'layout' && (
                    <LayoutTab scene={scene} onChange={handlePatchScene} />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Large Canvas Preview, Scrub Timeline & Export */}
          <div className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto p-5 md:p-6 space-y-4 bg-muted/15">
            {/* Preview Top Header: Preview label & Background Selector */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-foreground tracking-wide">Preview</span>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="text-xs font-medium mr-1">Preview background</span>
                <div className="flex items-center gap-1 bg-secondary/50 p-0.5 rounded-lg border border-border">
                  {(['clear', 'black', 'white', 'gray'] as const).map((bg) => (
                    <button
                      key={bg}
                      onClick={() => setBgOption(bg)}
                      className={cn(
                        'px-2.5 py-1 rounded text-xs font-medium capitalize transition-all',
                        bgOption === bg
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40',
                      )}
                    >
                      {bg}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Large Canvas Viewport with transparent checkerboard */}
            <div
              className={cn(
                'relative w-full rounded-2xl overflow-hidden border border-border flex items-center justify-center shadow-inner transition-colors',
                bgOption === 'clear' &&
                  'bg-[conic-gradient(#f0f0f2_90deg,#ffffff_90deg_180deg,#f0f0f2_180deg_270deg,#ffffff_270deg)] [background-size:24px_24px] dark:bg-[conic-gradient(#202024_90deg,#141416_90deg_180deg,#202024_180deg_270deg,#141416_270deg)]',
                bgOption === 'black' && 'bg-black',
                bgOption === 'white' && 'bg-white',
                bgOption === 'gray' && 'bg-zinc-700',
              )}
              style={{ aspectRatio: `${scene.width} / ${scene.height}`, maxHeight: '520px' }}
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

            {/* Transport Bar (matching screenshot: Pause/Play, Reset, Switches, Time) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-3">
                {/* Play/Pause Blue Pill Button */}
                <Button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="h-9 px-4 rounded-full font-semibold gap-1.5 shadow-sm text-xs"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Play</span>
                    </>
                  )}
                </Button>

                {/* Reset button */}
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    setCurrentTime(0)
                    setIsPlaying(true)
                    lastTimeRef.current = performance.now()
                  }}
                  className="h-9 w-9 rounded-full"
                  title="Reset to 0s"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>

                {/* Loop Switch */}
                <div className="flex items-center gap-2 pl-2">
                  <Switch id="loop-switch" checked={loop} onCheckedChange={setLoop} />
                  <label
                    htmlFor="loop-switch"
                    className="text-xs font-medium cursor-pointer text-foreground"
                  >
                    Loop
                  </label>
                </div>

                {/* Entrance Animation Switch */}
                <div className="flex items-center gap-2">
                  <Switch
                    id="entrance-switch"
                    checked={scene.inEnabled !== false}
                    onCheckedChange={(val) => onSceneChange({ ...scene, inEnabled: val })}
                  />
                  <label
                    htmlFor="entrance-switch"
                    className="text-xs font-medium cursor-pointer text-foreground"
                  >
                    Entrance animation
                  </label>
                </div>

                {/* Exit Animation Switch */}
                <div className="flex items-center gap-2">
                  <Switch
                    id="exit-switch"
                    checked={scene.outEnabled !== false}
                    onCheckedChange={(val) => onSceneChange({ ...scene, outEnabled: val })}
                  />
                  <label
                    htmlFor="exit-switch"
                    className="text-xs font-medium cursor-pointer text-foreground"
                  >
                    Exit animation
                  </label>
                </div>
              </div>

              {/* Time display */}
              <div className="font-mono text-xs font-semibold text-muted-foreground">
                {currentTime.toFixed(2)} / {duration.toFixed(2)} s
              </div>
            </div>

            {/* Segmented Color Timeline Scrub Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="relative w-full h-3 rounded-full overflow-hidden bg-secondary/80 flex cursor-pointer">
                {/* Blue In segment */}
                <div
                  style={{ width: `${inPct}%` }}
                  className="h-full bg-blue-500 transition-all opacity-85 hover:opacity-100"
                  title={`In Phase: 0 - ${timelineSegments.inEnd.toFixed(2)}s`}
                />
                {/* Slate/Hold segment */}
                <div
                  style={{ width: `${holdPct}%` }}
                  className="h-full bg-slate-400 dark:bg-slate-600 transition-all opacity-85 hover:opacity-100"
                  title={`Hold Phase: ${timelineSegments.inEnd.toFixed(2)}s - ${timelineSegments.holdEnd.toFixed(2)}s`}
                />
                {/* Orange/Out segment */}
                <div
                  style={{ width: `${outPct}%` }}
                  className="h-full bg-orange-500 transition-all opacity-85 hover:opacity-100"
                  title={`Out Phase: ${timelineSegments.holdEnd.toFixed(2)}s - ${timelineSegments.duration.toFixed(2)}s`}
                />

                {/* Invisible native range input for scrubbing overlay */}
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.02}
                  value={currentTime}
                  onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />

                {/* Current Playhead Thumb Indicator */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-white shadow-lg pointer-events-none z-20 -translate-x-1/2"
                  style={{ left: `${thumbPct}%` }}
                />
              </div>

              {/* Legend: In / Hold / Out */}
              <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  <span>In</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-600 inline-block" />
                  <span>Hold</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
                  <span>Out</span>
                </div>
              </div>
            </div>

            {/* Export & Action Bottom Section (matching web screenshot bottom bar) */}
            <div className="pt-2 border-t border-border space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-sm text-foreground">Export</span>
                <span className="font-mono text-muted-foreground">
                  {scene.width} × {scene.height} • {duration.toFixed(2)} s • {exportFps} FPS •{' '}
                  {Math.round(duration * exportFps)} frames
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                {/* FPS */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-muted-foreground">FPS</label>
                  <select
                    value={exportFps}
                    onChange={(e) => setExportFps(parseInt(e.target.value, 10))}
                    className="h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                  >
                    <option value={24}>24 (Light, Standard APNG)</option>
                    <option value={30}>30 (Smooth)</option>
                    <option value={60}>60 (Ultra Smooth)</option>
                  </select>
                </div>

                {/* Loop */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Loop</label>
                  <select
                    value={exportLoopMode}
                    onChange={(e) => setExportLoopMode(e.target.value as any)}
                    className="h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                  >
                    <option value="once">Play once (stop at the end)</option>
                    <option value="infinite">Loop indefinitely</option>
                  </select>
                </div>

                {/* Colors */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Colors</label>
                  <select
                    value={exportColors}
                    onChange={(e) => setExportColors(e.target.value as any)}
                    className="h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                  >
                    <option value="256">256 colors (light, recommended)</option>
                    <option value="full">Full Color (32-bit RGBA)</option>
                  </select>
                </div>
              </div>

              {/* File name row */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="Tên file khi xuất..."
                  className="flex-1 h-8 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAutoFileName}
                  className="h-8 text-xs whitespace-nowrap"
                >
                  Auto from settings
                </Button>
              </div>

              {/* Big Action Buttons Row */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {/* 1. Add to Timeline FreeCut */}
                <Button
                  onClick={handleAddToTimeline}
                  className="flex-1 min-w-[200px] h-10 text-xs font-bold gap-2 shadow-md"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Thêm vào Timeline FreeCut</span>
                </Button>

                {/* 2. Export APNG */}
                <Button
                  variant="outline"
                  disabled={isExporting}
                  onClick={handleExportApng}
                  className="h-10 px-3.5 text-xs font-semibold gap-1.5 border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-500/10 text-blue-400"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>
                        {exportProgress
                          ? `${Math.round((exportProgress.current / exportProgress.total) * 100)}%`
                          : 'Đang xuất...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <FileImage className="w-4 h-4" />
                      <span>Xuất APNG (.png)</span>
                    </>
                  )}
                </Button>

                {/* 3. Export WebM */}
                <Button
                  variant="outline"
                  disabled={isExporting}
                  onClick={handleExportWebM}
                  className="h-10 px-3.5 text-xs font-semibold gap-1.5 border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/10 text-emerald-400"
                >
                  <FileVideo className="w-4 h-4" />
                  <span>Xuất WebM (.webm)</span>
                </Button>

                {/* 4. Still PNG */}
                <Button
                  variant="outline"
                  onClick={handleExportStill}
                  className="h-10 px-3 text-xs gap-1.5"
                  title="Chụp khung hình tĩnh tại thời điểm hiện tại"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Ảnh tĩnh</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Saved Templates Dialog */}
      <UserTemplatesDialog
        open={templatesDialogOpen}
        onOpenChange={setTemplatesDialogOpen}
        currentScene={scene}
        onLoadTemplate={(s) => {
          onSceneChange(s)
          setActiveTemplateId(s.templateId || '')
        }}
      />
    </div>
  )
})
