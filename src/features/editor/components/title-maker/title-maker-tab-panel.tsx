import { memo, useState, useCallback, useMemo } from 'react'
import {
  Download,
  PlusCircle,
  Bookmark,
  Sparkles,
  Loader2,
  FileVideo,
  FileImage,
  ImageIcon,
  Maximize2,
} from 'lucide-react'
import { ModeSelector } from './components/mode-selector'
import { TemplateBar } from './components/template-bar'
import { TitlePreview } from './components/title-preview'
import { TextTab } from './components/tabs/text-tab'
import { FontTab } from './components/tabs/font-tab'
import { MotionTab } from './components/tabs/motion-tab'
import { StyleTab } from './components/tabs/style-tab'
import { LayoutTab } from './components/tabs/layout-tab'
import { UserTemplatesDialog } from './components/user-templates-dialog'
import { TitleMakerStudioDialog } from './title-maker-studio-dialog'
import { BASE_SCENE, TEMPLATES, applyTemplateToScene, cloneScene } from './engine/presets'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { cn } from '@/shared/ui/cn'

type SubTab = 'text' | 'font' | 'motion' | 'style' | 'layout'

export const TitleMakerTabPanel = memo(function TitleMakerTabPanel() {
  // Initialize with Place & Time / Boxed template as in user's reference screenshot
  const initialTemplate = useMemo(() => {
    const list = TEMPLATES.caption || []
    return list.find((t) => t.id === 'boxed') || list[0] || TEMPLATES.caption[0]!
  }, [])

  const [activeMode, setActiveMode] = useState<TitleMode>('caption')
  const [scene, setScene] = useState<TitleScene>(() => {
    const initial = cloneScene(BASE_SCENE)
    initial.mode = 'caption'
    return applyTemplateToScene(initial, initialTemplate, 'vi')
  })
  const [activeTemplateId, setActiveTemplateId] = useState<string>(initialTemplate.id)
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('text')
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false)
  const [studioDialogOpen, setStudioDialogOpen] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null)

  // Handle Mode Change
  const handleSelectMode = useCallback((mode: TitleMode) => {
    setActiveMode(mode)
    const tplList = TEMPLATES[mode] || []
    const firstTpl = tplList[0]
    if (firstTpl) {
      setActiveTemplateId(firstTpl.id)
      setScene((prev) => {
        const next = cloneScene(prev)
        next.mode = mode
        return applyTemplateToScene(next, firstTpl, 'vi')
      })
    } else {
      setScene((prev) => ({ ...prev, mode }))
    }
  }, [])

  // Handle Template Selection
  const handleSelectTemplate = useCallback((template: TitleTemplateItem) => {
    setActiveTemplateId(template.id)
    setScene((prev) => applyTemplateToScene(prev, template, 'vi'))
    toast.success(`Đã áp dụng mẫu "${template.label.vi || template.label.en}"`)
  }, [])

  // Handle Reset Template
  const handleResetTemplate = useCallback(() => {
    const tplList = TEMPLATES[activeMode] || []
    const currentTpl = tplList.find((t) => t.id === activeTemplateId) || tplList[0]
    if (currentTpl) {
      setScene((prev) => applyTemplateToScene(prev, currentTpl, 'vi'))
      toast.success('Đã đặt lại thông số theo mẫu gốc')
    }
  }, [activeMode, activeTemplateId])

  // Patch Scene
  const handlePatchScene = useCallback((patch: Partial<TitleScene>) => {
    setScene((prev) => ({ ...prev, ...patch }))
  }, [])

  // Load from User Saved Template
  const handleLoadUserTemplate = useCallback((savedScene: TitleScene) => {
    setActiveMode(savedScene.mode)
    setActiveTemplateId(savedScene.templateId || '')
    setScene(cloneScene(savedScene))
  }, [])

  // Add to Timeline Action
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

    // Create rich text item with styles, stroke, and shadow
    const newItem: TextItem = {
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

    addItemOnNewTrack(newItem, newTrack.tracks)
    setActiveTrack(newTrack.trackId)
    selectItems([newItem.id])
    toast.success(`Đã thêm "${label}" vào timeline!`)
  }, [scene])

  // Export handlers
  const handleExportApng = async () => {
    try {
      setIsExporting(true)
      const blob = await exportTitleAsApng(scene, 24, (prog) => setExportProgress(prog))
      const safeName = (scene.text || 'title')
        .replace(/[^a-zA-Z0-9_\u00C0-\u024F]/g, '_')
        .slice(0, 30)
      downloadBlob(blob, `${safeName}_animated.png`)
      toast.success('Xuất file APNG thành công!')
    } catch (e: any) {
      console.error(e)
      toast.error(`Xuất APNG thất bại: ${e.message}`)
    } finally {
      setIsExporting(false)
      setExportProgress(null)
    }
  }

  const handleExportWebM = async () => {
    try {
      setIsExporting(true)
      const blob = await exportTitleAsWebM(scene, 30, (prog) => setExportProgress(prog))
      const safeName = (scene.text || 'title')
        .replace(/[^a-zA-Z0-9_\u00C0-\u024F]/g, '_')
        .slice(0, 30)
      downloadBlob(blob, `${safeName}_transparent.webm`)
      toast.success('Xuất Video WebM trong suốt thành công!')
    } catch (e: any) {
      console.error(e)
      toast.error(`Xuất WebM thất bại: ${e.message}`)
    } finally {
      setIsExporting(false)
      setExportProgress(null)
    }
  }

  const handleExportStill = async () => {
    try {
      const blob = await exportTitleStillPng(scene, 1.0)
      const safeName = (scene.text || 'title')
        .replace(/[^a-zA-Z0-9_\u00C0-\u024F]/g, '_')
        .slice(0, 30)
      downloadBlob(blob, `${safeName}_still.png`)
      toast.success('Đã tải khung hình tĩnh PNG!')
    } catch (e: any) {
      toast.error(`Lỗi tải ảnh: ${e.message}`)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Motion Title & Cut-in Studio
            </h3>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTemplatesDialogOpen(true)}
            className="h-6 text-[11px] px-2 flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Bookmark className="w-3 h-3 text-primary" />
            <span>My Templates</span>
          </Button>
        </div>

        {/* Full Studio Workspace Button */}
        <Button
          onClick={() => setStudioDialogOpen(true)}
          className="w-full h-9 text-xs font-bold gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-400 text-white shadow-md border-0"
        >
          <Maximize2 className="w-4 h-4" />
          <span>Mở Full Studio (2 cột như Web)</span>
        </Button>

        {/* 1. Mode Selector (Message, Trailer, Place & Time) */}
        <ModeSelector activeMode={activeMode} onSelectMode={handleSelectMode} />

        {/* 2. Preset Templates Bar */}
        <TemplateBar
          mode={activeMode}
          activeTemplateId={activeTemplateId}
          onSelectTemplate={handleSelectTemplate}
          onReset={handleResetTemplate}
        />

        {/* 3. Live Canvas Preview */}
        <TitlePreview scene={scene} onSceneChange={setScene} />

        {/* 4. Customization Sub-Tabs */}
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-3 shadow-sm">
          {/* Subtabs bar */}
          <div className="grid grid-cols-5 gap-1 bg-secondary/40 p-1 rounded-lg border border-border">
            {(['text', 'font', 'motion', 'style', 'layout'] as SubTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSubTab(tab)}
                className={cn(
                  'py-1 rounded text-[11px] font-semibold capitalize transition-all',
                  activeSubTab === tab
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40',
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Active Tab Panel */}
          <div>
            {activeSubTab === 'text' && <TextTab scene={scene} onChange={handlePatchScene} />}
            {activeSubTab === 'font' && <FontTab scene={scene} onChange={handlePatchScene} />}
            {activeSubTab === 'motion' && <MotionTab scene={scene} onChange={handlePatchScene} />}
            {activeSubTab === 'style' && <StyleTab scene={scene} onChange={handlePatchScene} />}
            {activeSubTab === 'layout' && <LayoutTab scene={scene} onChange={handlePatchScene} />}
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="p-3 border-t border-border bg-card/80 backdrop-blur-sm flex items-center gap-2">
        <Button
          onClick={handleAddToTimeline}
          className="flex-1 h-9 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Thêm vào Timeline</span>
        </Button>

        {/* Export Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              disabled={isExporting}
              className="h-9 px-3 text-xs flex items-center gap-1.5"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    {exportProgress
                      ? `${Math.round((exportProgress.current / exportProgress.total) * 100)}%`
                      : 'Đang xuất...'}
                  </span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Xuất file</span>
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 text-xs">
            <DropdownMenuItem onClick={handleExportApng} className="flex items-center gap-2">
              <FileImage className="w-4 h-4 text-blue-400" />
              <span>APNG (Ảnh động trong suốt)</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportWebM} className="flex items-center gap-2">
              <FileVideo className="w-4 h-4 text-emerald-400" />
              <span>WebM Video (Trong suốt)</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportStill} className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-amber-400" />
              <span>Khung hình tĩnh (PNG)</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* User Saved Templates Dialog */}
      <UserTemplatesDialog
        open={templatesDialogOpen}
        onOpenChange={setTemplatesDialogOpen}
        currentScene={scene}
        onLoadTemplate={handleLoadUserTemplate}
      />

      {/* Full 2-Column Studio Workspace Dialog (Like Web Tool) */}
      <TitleMakerStudioDialog
        open={studioDialogOpen}
        onOpenChange={setStudioDialogOpen}
        scene={scene}
        onSceneChange={setScene}
      />
    </div>
  )
})
