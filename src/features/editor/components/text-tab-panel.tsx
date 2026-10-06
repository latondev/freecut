import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Sparkles,
  Type,
  Heading,
  Flame,
  Check,
  Music,
  Heart,
  Smile,
  Tag,
  Sun,
  Gamepad2,
  Star,
  Film,
  Tv,
  Gift,
  Coffee,
  Camera,
  Zap,
  Subtitles,
  Utensils,
  Plane,
  Dumbbell,
  Laptop,
  Search,
  X,
  ArrowDownToLine,
  Plus,
} from 'lucide-react'
import { useTimelineStore } from '@/features/editor/deps/timeline-store'
import { usePlaybackStore } from '@/shared/state/playback'
import { useSelectionStore } from '@/shared/state/selection'
import { useProjectStore } from '@/features/editor/deps/projects'
import {
  setMediaDragData,
  clearMediaDragData,
  type TimelineTemplateDragData,
} from '@/features/editor/deps/media-library'
import {
  createOverlayLayerTrack,
  getDefaultGeneratedLayerDurationInFrames,
} from '@/features/editor/deps/timeline-utils'
import { ensureFontsLoaded } from '@/shared/typography/font-loader'
import { DEFAULT_PROJECT_HEIGHT, DEFAULT_PROJECT_WIDTH } from '@/shared/projects/defaults'
import type { TextItem } from '@/types/timeline'
import { cn } from '@/shared/ui/cn'
import {
  TEXT_EFFECTS_CATALOG,
  TEXT_EFFECT_CATEGORIES,
  type TextEffectCategory,
  type TextEffectItem,
} from '@/shared/typography/text-effects-catalog'
import {
  TEXT_TEMPLATES_CATALOG,
  TEXT_TEMPLATE_CATEGORIES,
  type TextTemplateCategory,
  type TextTemplateCardItem,
} from '@/shared/typography/text-templates-catalog'
import {
  createTextTemplateMotion,
  getCapcutAlphaTextGradient,
  getTemplateMotionKind,
  getTextTemplateMotionPresetId,
} from '@/shared/typography/text-template-motion'
import './text-template-preview.css'

type MainTextTab = 'templates' | 'effects'

interface TextTabPanelProps {
  onSuppressClick?: () => boolean
}

const ALL_CATALOG_FONTS = [
  'CapCut Sans Text',
  'Anton',
  'Bebas Neue',
  'Bangers',
  'Russo One',
  'Fredoka',
  'Luckiest Guy',
  'Permanent Marker',
  'Pacifico',
  'Lobster',
  'Orbitron',
  'Cinzel',
  'Playfair Display',
  'Press Start 2P',
  'Syne',
  'Righteous',
  'Caveat',
  'Black Ops One',
  'Montserrat',
  'Bungee',
  'Rubik Glitch',
  'Oswald',
] as const

const BASE_TEXT_DEFAULTS = {
  fontSize: 60,
  fontFamily: 'Inter',
  fontWeight: 'normal' as const,
  fontStyle: 'normal' as const,
  underline: false,
  color: '#ffffff',
  textAlign: 'center' as const,
  lineHeight: 1.2,
  letterSpacing: 0,
}

const CARD_ICONS: Record<string, React.ReactNode> = {
  music: <Music className="w-2.5 h-2.5 text-fuchsia-400" />,
  star: <Star className="w-2.5 h-2.5 text-amber-300 fill-amber-300" />,
  heart: <Heart className="w-2.5 h-2.5 text-rose-400 fill-rose-400" />,
  duck: <Smile className="w-2.5 h-2.5 text-yellow-400" />,
  flame: <Flame className="w-2.5 h-2.5 text-red-500 fill-red-500" />,
  tag: <Tag className="w-2.5 h-2.5 text-amber-400" />,
  flower: <Sun className="w-2.5 h-2.5 text-emerald-400" />,
  game: <Gamepad2 className="w-2.5 h-2.5 text-green-400" />,
  sparkle: <Sparkles className="w-2.5 h-2.5 text-amber-300" />,
  film: <Film className="w-2.5 h-2.5 text-blue-400" />,
  tv: <Tv className="w-2.5 h-2.5 text-rose-500" />,
  gift: <Gift className="w-2.5 h-2.5 text-pink-400" />,
  coffee: <Coffee className="w-2.5 h-2.5 text-amber-600" />,
  camera: <Camera className="w-2.5 h-2.5 text-purple-400" />,
  zap: <Zap className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />,
  subtitles: <Subtitles className="w-2.5 h-2.5 text-sky-400" />,
  food: <Utensils className="w-2.5 h-2.5 text-amber-500" />,
  travel: <Plane className="w-2.5 h-2.5 text-cyan-400" />,
  fitness: <Dumbbell className="w-2.5 h-2.5 text-lime-400" />,
  tech: <Laptop className="w-2.5 h-2.5 text-indigo-400" />,
  sun: <Sun className="w-2.5 h-2.5 text-amber-400" />,
}

function renderCardIcon(icon?: TextTemplateCardItem['icon']): React.ReactNode {
  return (icon && CARD_ICONS[icon]) || CARD_ICONS.sparkle
}

// fallow-ignore-next-line complexity
function renderTemplatePreview(template: TextTemplateCardItem, isHovered = false) {
  const { stroke, textShadow } = template.patch
  const fontSize = Math.max(7, Math.min(10, (template.patch.fontSize ?? 60) * 0.14))
  const strokeWidth = stroke ? Math.min(0.5, Math.max(0.2, stroke.width * 0.18)) : 0
  const webkitStroke = stroke ? `${strokeWidth}px ${stroke.color}` : undefined
  const shadow = textShadow
    ? `${textShadow.offsetX * 0.2}px ${textShadow.offsetY * 0.2}px ${textShadow.blur * 0.2}px ${textShadow.color}`
    : undefined
  const textGradient = getCapcutAlphaTextGradient(template)
  const motionKind = getTemplateMotionKind(template)

  return (
    <div className="capcut-alpha-canvas relative flex h-full flex-1 items-center justify-center overflow-hidden p-1 w-full">
      <div className="capcut-template-preview__shine" />
      <div
        className="capcut-template-preview__copy relative z-1 flex max-w-full flex-col items-center text-center px-0.5"
        data-template-motion={getTextTemplateMotionPresetId(template)}
      >
        {(template.sample.tag || template.icon) && (
          <div className="mb-0.5 flex items-center justify-center gap-0.5">
            {renderCardIcon(template.icon)}
            {template.sample.tag && (
              <span className="text-[5.5px] font-bold uppercase tracking-wider text-zinc-300/80 drop-shadow-sm line-clamp-1">
                {template.sample.tag}
              </span>
            )}
          </div>
        )}
        <span
          className={cn(
            'capcut-alpha-text line-clamp-2 max-w-full text-balance font-extrabold leading-tight antialiased',
            isHovered && `capcut-motion-${motionKind}`,
          )}
          style={{
            backgroundImage: textGradient,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
            WebkitTextStroke: webkitStroke,
            paintOrder: 'stroke fill',
            filter: shadow ? `drop-shadow(${shadow})` : undefined,
            fontFamily: `"${template.patch.fontFamily}", "CapCut Sans Text", sans-serif`,
            fontSize: `${fontSize}px`,
            fontWeight: template.patch.fontWeight,
            fontStyle: template.patch.fontStyle,
            letterSpacing: `${(template.patch.letterSpacing ?? 0) * 0.15}px`,
          }}
        >
          {template.sample.title}
        </span>
        {template.sample.subtitle && (
          <span className="mt-0.5 max-w-full truncate text-[5.5px] font-semibold text-zinc-300/90 drop-shadow-sm">
            {template.sample.subtitle}
          </span>
        )}
      </div>
    </div>
  )
}

interface TemplateCardProps {
  template: TextTemplateCardItem
  onApply: (template: TextTemplateCardItem) => void
  onDragStart: (
    template: TextTemplateCardItem,
  ) => (event: React.DragEvent<HTMLButtonElement>) => void
  onDragEnd: () => void
}

const TextTemplateCard = memo(function TextTemplateCard({
  template,
  onApply,
  onDragStart,
  onDragEnd,
}: TemplateCardProps) {
  const [isDownloaded, setIsDownloaded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const isPro = template.isPro || template.badge === 'PRO'

  return (
    <button
      type="button"
      draggable={true}
      title={template.label}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragStart={onDragStart(template)}
      onDragEnd={onDragEnd}
      onClick={() => {
        setIsDownloaded(true)
        onApply(template)
      }}
      className={cn(
        'group relative aspect-square w-full rounded-md border border-white/[0.06]',
        'bg-[#1a1a21] hover:bg-[#252530] hover:border-white/[0.14] hover:shadow-md',
        'transition-[transform,border-color,background-color,box-shadow]',
        'active:scale-[0.95] text-left overflow-hidden flex items-center justify-center p-0 cursor-pointer select-none',
      )}
    >
      {/* Top Left: CapCut Pro Diamond Badge */}
      {isPro && (
        <span
          className="absolute top-1 left-1 z-10 text-[7px] leading-none font-bold text-violet-400 drop-shadow-[0_0_2px_rgba(167,139,250,0.6)]"
          title="PRO"
        >
          ◆
        </span>
      )}

      {/* Main Visual Preview */}
      {template.previewImage ? (
        <div className="w-full h-full flex items-center justify-center p-1 relative">
          <img
            src={template.previewImage}
            alt={template.label}
            className="max-w-[82%] max-h-[82%] object-contain pointer-events-none select-none transition-transform duration-200 group-hover:scale-105 drop-shadow-sm"
            loading="lazy"
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement
              target.style.display = 'none'
            }}
          />
          {isHovered && template.animatedPreviewImage && (
            <img
              src={template.animatedPreviewImage}
              alt={template.label}
              className="absolute inset-0 m-auto max-w-[82%] max-h-[82%] object-contain pointer-events-none select-none transition-transform duration-200 group-hover:scale-105 drop-shadow-sm"
            />
          )}
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center p-1">
          {renderTemplatePreview(template, isHovered)}
        </div>
      )}

      {/* Bottom Right: Circular Download / Add Button */}
      <div
        className={cn(
          'absolute bottom-1 right-1 z-10 w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all shadow-sm',
          isDownloaded
            ? 'bg-primary text-primary-foreground group-hover:scale-110'
            : 'bg-black/60 text-white/90 group-hover:bg-black/85 group-hover:text-white',
        )}
        onClick={(e) => {
          e.stopPropagation()
          setIsDownloaded(true)
          onApply(template)
        }}
        title={isDownloaded ? 'Add to track (+)' : 'Download & Add (↓)'}
      >
        {isDownloaded ? (
          <Plus className="w-2 h-2 stroke-[2.5]" />
        ) : (
          <ArrowDownToLine className="w-1.5 h-1.5 stroke-[2.2]" />
        )}
      </div>
    </button>
  )
})

interface EffectTileProps {
  effect: TextEffectItem
  isApplied: boolean
  onApply: (effect: TextEffectItem) => void
  onDragStart: (effect: TextEffectItem) => (event: React.DragEvent<HTMLButtonElement>) => void
  onDragEnd: () => void
}

const TextEffectTile = memo(function TextEffectTile({
  effect,
  isApplied,
  onApply,
  onDragStart,
  onDragEnd,
}: EffectTileProps) {
  const [isHovered, setIsHovered] = useState(false)
  const isPro = effect.isPro || effect.badge === 'PRO'

  return (
    <button
      type="button"
      draggable={true}
      title={effect.label}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragStart={onDragStart(effect)}
      onDragEnd={onDragEnd}
      onClick={() => onApply(effect)}
      className={cn(
        'group relative flex flex-col items-center justify-center rounded-md border transition-[transform,background-color,border-color,box-shadow] active:scale-95 text-center overflow-hidden aspect-square select-none cursor-pointer p-0',
        isApplied
          ? 'border-emerald-500 bg-emerald-950/40 shadow-sm shadow-emerald-500/20'
          : 'border-white/[0.06] bg-[#1a1a21] hover:bg-[#252530] hover:border-white/[0.14] hover:shadow-md',
      )}
    >
      {/* CapCut Pro / Diamond Badge at top-left */}
      {isPro && (
        <span className="absolute top-1 left-1 z-10 text-[7px] text-violet-400 select-none leading-none drop-shadow">
          ◆
        </span>
      )}

      {/* Applied indicator or Download icon at bottom-right */}
      {isApplied ? (
        <span className="absolute top-1 right-1 z-10 p-0.5 rounded-full bg-emerald-500 text-white animate-in zoom-in-50">
          <Check className="w-2 h-2" />
        </span>
      ) : (
        <span className="absolute bottom-1 right-1 z-10 w-3.5 h-3.5 rounded-full bg-black/60 flex items-center justify-center text-zinc-300 group-hover:text-white transition-colors">
          <ArrowDownToLine className="w-1.5 h-1.5" />
        </span>
      )}

      {/* Main preview */}
      {effect.previewImage ? (
        <div className="w-full h-full flex items-center justify-center p-1 relative">
          <img
            src={effect.previewImage}
            alt={effect.label}
            className="max-w-[82%] max-h-[82%] object-contain pointer-events-none select-none transition-transform duration-200 group-hover:scale-105 drop-shadow-sm"
            loading="lazy"
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement
              target.style.display = 'none'
            }}
          />
          {isHovered && effect.animatedPreviewImage && (
            <img
              src={effect.animatedPreviewImage}
              alt={effect.label}
              className="absolute inset-0 m-auto max-w-[82%] max-h-[82%] object-contain pointer-events-none select-none transition-transform duration-200 group-hover:scale-105 drop-shadow-sm"
            />
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-1 w-full h-full overflow-hidden">
          <span
            className="text-xs sm:text-sm font-black tracking-wider select-none leading-none transition-transform duration-150 group-hover:scale-105"
            style={effect.previewStyle}
          >
            {effect.previewText || 'ART'}
          </span>
        </div>
      )}
    </button>
  )
})

function matchesTemplateSearch(item: TextTemplateCardItem, query: string): boolean {
  if (item.label.toLowerCase().includes(query)) return true
  if (item.defaultText.toLowerCase().includes(query)) return true
  if (item.sample.title.toLowerCase().includes(query)) return true
  if (item.sample.subtitle && item.sample.subtitle.toLowerCase().includes(query)) return true
  if (item.sample.tag && item.sample.tag.toLowerCase().includes(query)) return true
  return false
}

function matchesEffectSearch(item: TextEffectItem, query: string): boolean {
  if (item.label.toLowerCase().includes(query)) return true
  if (item.previewText && item.previewText.toLowerCase().includes(query)) return true
  return false
}

export const TextTabPanel = memo(function TextTabPanel({ onSuppressClick }: TextTabPanelProps) {
  const [activeMainTab, setActiveMainTab] = useState<MainTextTab>('templates')
  const [selectedTemplateCat, setSelectedTemplateCat] = useState<TextTemplateCategory>('all')
  const [selectedEffectCat, setSelectedEffectCat] = useState<TextEffectCategory>('all')
  const [appliedEffectId, setAppliedEffectId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Preload and cache all Google Fonts on mount
  useEffect(() => {
    void ensureFontsLoaded(ALL_CATALOG_FONTS)
  }, [])

  const templateCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: TEXT_TEMPLATES_CATALOG.length }
    for (const item of TEXT_TEMPLATES_CATALOG) {
      if (item.categories && item.categories.length > 0) {
        for (const cat of item.categories) {
          counts[cat] = (counts[cat] || 0) + 1
        }
      } else {
        counts[item.category] = (counts[item.category] || 0) + 1
      }
    }
    return counts
  }, [])

  const effectCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: TEXT_EFFECTS_CATALOG.length }
    for (const item of TEXT_EFFECTS_CATALOG) {
      if (item.categories && item.categories.length > 0) {
        for (const cat of item.categories) {
          counts[cat] = (counts[cat] || 0) + 1
        }
      } else {
        counts[item.category] = (counts[item.category] || 0) + 1
      }
    }
    return counts
  }, [])

  const filteredTemplates = useMemo(() => {
    let list = TEXT_TEMPLATES_CATALOG as readonly TextTemplateCardItem[]
    if (selectedTemplateCat !== 'all') {
      list = list.filter(
        (item) =>
          item.category === selectedTemplateCat || item.categories?.includes(selectedTemplateCat),
      )
    }
    const query = searchQuery.trim().toLowerCase()
    if (!query) return list
    return list.filter((item) => matchesTemplateSearch(item, query))
  }, [selectedTemplateCat, searchQuery])

  const filteredEffects = useMemo(() => {
    let list = TEXT_EFFECTS_CATALOG
    if (selectedEffectCat !== 'all') {
      list = list.filter(
        (item) =>
          item.category === selectedEffectCat || item.categories?.includes(selectedEffectCat),
      )
    }
    const query = searchQuery.trim().toLowerCase()
    if (!query) return list
    return list.filter((item) => matchesEffectSearch(item, query))
  }, [selectedEffectCat, searchQuery])

  const handleCreateTextItem = useCallback((overrides: Partial<TextItem>, label = 'Text') => {
    const { tracks, fps, addItemOnNewTrack } = useTimelineStore.getState()
    const { activeTrackId, selectItems, setActiveTrack } = useSelectionStore.getState()
    const currentProject = useProjectStore.getState().currentProject

    const newTrack = createOverlayLayerTrack({ tracks, activeTrackId })
    if (!newTrack) return

    const canvasWidth = currentProject?.metadata.width || DEFAULT_PROJECT_WIDTH
    const canvasHeight = currentProject?.metadata.height || DEFAULT_PROJECT_HEIGHT
    const durationInFrames = getDefaultGeneratedLayerDurationInFrames(fps)
    const currentFrame = Math.max(0, usePlaybackStore.getState().currentFrame)
    const text = overrides.text || label

    const newItem: TextItem = {
      ...BASE_TEXT_DEFAULTS,
      ...overrides,
      id: crypto.randomUUID(),
      type: 'text',
      trackId: newTrack.trackId,
      from: currentFrame,
      durationInFrames,
      label,
      text,
      transform: {
        x: 0,
        y: 0,
        width: canvasWidth * 0.8,
        height: canvasHeight * 0.28,
        rotation: 0,
        opacity: 1,
      },
    }

    addItemOnNewTrack(newItem, newTrack.tracks)
    setActiveTrack(newTrack.trackId)
    selectItems([newItem.id])
  }, [])

  const handleApplyEffect = useCallback(
    (effect: TextEffectItem) => {
      if (onSuppressClick && onSuppressClick()) return

      const { selectedItemIds } = useSelectionStore.getState()
      const { items, updateItem } = useTimelineStore.getState()

      const selectedTextItem = items.find(
        (item): item is TextItem => item.type === 'text' && selectedItemIds.includes(item.id),
      )
      const selectedSubtitleItems = items.filter(
        (item) => item.type === 'subtitle' && selectedItemIds.includes(item.id),
      )

      if (selectedSubtitleItems.length > 0) {
        for (const sub of selectedSubtitleItems) {
          updateItem(sub.id, {
            color: effect.patch.color,
            fontFamily: effect.patch.fontFamily,
            fontWeight: effect.patch.fontWeight,
            stroke: effect.patch.stroke,
            textShadow: effect.patch.textShadow,
            backgroundColor: effect.patch.backgroundColor,
            backgroundRadius: effect.patch.backgroundRadius,
            letterSpacing: effect.patch.letterSpacing,
          })
        }
        setAppliedEffectId(effect.id)
        window.setTimeout(() => setAppliedEffectId(null), 1200)
      } else if (selectedTextItem) {
        updateItem(selectedTextItem.id, {
          color: effect.patch.color,
          gradient: (effect.patch as any).gradient ?? undefined,
          fontFamily: effect.patch.fontFamily,
          fontWeight: effect.patch.fontWeight,
          stroke: effect.patch.stroke,
          textShadow: effect.patch.textShadow,
          backgroundColor: effect.patch.backgroundColor,
          backgroundRadius: effect.patch.backgroundRadius,
          letterSpacing: effect.patch.letterSpacing,
        })
        setAppliedEffectId(effect.id)
        window.setTimeout(() => setAppliedEffectId(null), 1200)
      } else {
        handleCreateTextItem(
          {
            text: effect.label,
            ...effect.patch,
          },
          effect.label,
        )
      }
    },
    [handleCreateTextItem, onSuppressClick],
  )

  const handleApplyTemplate = useCallback(
    (template: TextTemplateCardItem) => {
      if (onSuppressClick && onSuppressClick()) return

      const { selectedItemIds } = useSelectionStore.getState()
      const { items, updateItem } = useTimelineStore.getState()

      const selectedTextItem = items.find(
        (item): item is TextItem => item.type === 'text' && selectedItemIds.includes(item.id),
      )
      const selectedSubtitleItems = items.filter(
        (item) => item.type === 'subtitle' && selectedItemIds.includes(item.id),
      )
      const textGradient = getCapcutAlphaTextGradient(template)
      const textMotion = createTextTemplateMotion(template)

      if (selectedSubtitleItems.length > 0) {
        for (const sub of selectedSubtitleItems) {
          updateItem(sub.id, {
            color: template.patch.color,
            gradient: textGradient,
            fontFamily: template.patch.fontFamily,
            fontWeight: template.patch.fontWeight,
            fontSize: template.patch.fontSize,
            fontStyle: template.patch.fontStyle,
            textAlign: template.patch.textAlign,
            lineHeight: template.patch.lineHeight,
            stroke: template.patch.stroke,
            textShadow: template.patch.textShadow,
            backgroundColor: template.patch.backgroundColor,
            backgroundRadius: template.patch.backgroundRadius,
            letterSpacing: template.patch.letterSpacing,
            textMotion,
          })
        }
        return
      }

      if (selectedTextItem) {
        updateItem(selectedTextItem.id, {
          color: template.patch.color,
          gradient: textGradient,
          fontFamily: template.patch.fontFamily,
          fontWeight: template.patch.fontWeight,
          fontSize: template.patch.fontSize,
          fontStyle: template.patch.fontStyle,
          textAlign: template.patch.textAlign,
          lineHeight: template.patch.lineHeight,
          stroke: template.patch.stroke,
          textShadow: template.patch.textShadow,
          backgroundColor: template.patch.backgroundColor,
          backgroundRadius: template.patch.backgroundRadius,
          letterSpacing: template.patch.letterSpacing,
          textMotion,
        })
        return
      }

      handleCreateTextItem(
        {
          text: template.defaultText,
          ...template.patch,
          gradient: textGradient,
          textMotion,
        },
        template.label,
      )
    },
    [handleCreateTextItem, onSuppressClick],
  )

  const handleDragTemplate = useCallback(
    (template: TextTemplateCardItem) => (event: React.DragEvent<HTMLButtonElement>) => {
      event.dataTransfer.effectAllowed = 'copy'
      const dragData: TimelineTemplateDragData = {
        type: 'timeline-template',
        itemType: 'text',
        label: template.label,
        textOverrides: {
          text: template.defaultText,
          ...template.patch,
          textMotion: createTextTemplateMotion(template),
        },
      }
      event.dataTransfer.setData('application/json', JSON.stringify(dragData))
      setMediaDragData(dragData)
    },
    [],
  )

  const handleDragEffect = useCallback(
    (effect: TextEffectItem) => (event: React.DragEvent<HTMLButtonElement>) => {
      event.dataTransfer.effectAllowed = 'copy'
      const dragData: TimelineTemplateDragData = {
        type: 'timeline-template',
        itemType: 'text',
        label: effect.label,
        textOverrides: {
          text: effect.label,
          ...effect.patch,
        },
      }
      event.dataTransfer.setData('application/json', JSON.stringify(dragData))
      setMediaDragData(dragData)
    },
    [],
  )

  const handleDragQuickText = useCallback(
    (payload: { label: string; text?: string; overrides: Partial<TextItem> }) =>
      (event: React.DragEvent<HTMLButtonElement>) => {
        event.dataTransfer.effectAllowed = 'copy'
        const dragData: TimelineTemplateDragData = {
          type: 'timeline-template',
          itemType: 'text',
          label: payload.label,
          textOverrides: {
            text: payload.text,
            ...payload.overrides,
          },
        }
        event.dataTransfer.setData('application/json', JSON.stringify(dragData))
        setMediaDragData(dragData)
      },
    [],
  )

  const handleDragEnd = useCallback(() => {
    clearMediaDragData()
  }, [])

  return (
    <div className="flex flex-col h-full select-none">
      {/* Top CapCut-Style Tab Bar */}
      <div className="flex items-center px-4 pt-2.5 pb-1.5 border-b border-border bg-background/80 gap-6">
        <button
          type="button"
          onClick={() => setActiveMainTab('templates')}
          className={cn(
            'relative pb-2 text-xs font-bold tracking-wide transition-colors flex items-center gap-1.5',
            activeMainTab === 'templates'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Type className="w-3.5 h-3.5" />
          <span>Text templates ({TEXT_TEMPLATES_CATALOG.length})</span>
          {activeMainTab === 'templates' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('effects')}
          className={cn(
            'relative pb-2 text-xs font-bold tracking-wide transition-colors flex items-center gap-1.5',
            activeMainTab === 'effects'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Text effects ({TEXT_EFFECTS_CATALOG.length})</span>
          {activeMainTab === 'effects' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
          )}
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="px-3 pt-2 pb-1 bg-background/60 border-b border-border/40">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeMainTab === 'templates'
                ? `Search ${TEXT_TEMPLATES_CATALOG.length} templates...`
                : `Search ${TEXT_EFFECTS_CATALOG.length} effects...`
            }
            className="w-full pl-8 pr-7 py-1.5 bg-secondary/50 hover:bg-secondary/70 focus:bg-secondary border border-border/60 focus:border-primary/60 rounded-md text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 p-0.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
        {activeMainTab === 'templates' ? (
          <>
            {/* Basic Section: Add Heading & Add Body Text */}
            <div className="space-y-1.5">
              <div className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">
                Basic
              </div>

              <div className="space-y-1">
                <button
                  type="button"
                  draggable={true}
                  onDragStart={handleDragQuickText({
                    label: 'Heading',
                    text: 'Add heading',
                    overrides: {
                      fontSize: 72,
                      fontFamily: 'Anton',
                      fontWeight: 'normal',
                      color: '#ffffff',
                      textShadow: { offsetX: 0, offsetY: 4, blur: 8, color: 'rgba(0,0,0,0.7)' },
                    },
                  })}
                  onDragEnd={handleDragEnd}
                  onClick={() =>
                    handleCreateTextItem(
                      {
                        fontSize: 72,
                        fontFamily: 'Anton',
                        fontWeight: 'normal',
                        color: '#ffffff',
                        textShadow: { offsetX: 0, offsetY: 4, blur: 8, color: 'rgba(0,0,0,0.7)' },
                      },
                      'Heading',
                    )
                  }
                  className="w-full py-1.5 px-2.5 rounded-md bg-secondary/60 hover:bg-secondary border border-border/80 hover:border-primary/50 text-foreground font-black text-xs tracking-wide transition-[transform,background-color,border-color] active:scale-[0.98] flex items-center justify-center gap-1.5 group shadow-sm"
                >
                  <Heading className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
                  <span className="font-['Anton'] tracking-wider">Add heading</span>
                </button>

                <button
                  type="button"
                  draggable={true}
                  onDragStart={handleDragQuickText({
                    label: 'Body text',
                    text: 'Add body text',
                    overrides: {
                      fontSize: 38,
                      fontFamily: 'Inter',
                      fontWeight: 'normal',
                      color: '#e2e8f0',
                    },
                  })}
                  onDragEnd={handleDragEnd}
                  onClick={() =>
                    handleCreateTextItem(
                      {
                        fontSize: 38,
                        fontFamily: 'Inter',
                        fontWeight: 'normal',
                        color: '#e2e8f0',
                      },
                      'Body text',
                    )
                  }
                  className="w-full py-1 px-2.5 rounded-md bg-secondary/30 hover:bg-secondary/60 border border-border/50 hover:border-border text-muted-foreground hover:text-foreground font-medium text-[11px] tracking-normal transition-[transform,background-color,border-color] active:scale-[0.98] flex items-center justify-center gap-1.5 group"
                >
                  <Type className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span>Add body text</span>
                </button>
              </div>
            </div>

            {/* Template Category Chips */}
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md py-1 flex items-center gap-1 overflow-x-auto scrollbar-none border-b border-border/30">
              {TEXT_TEMPLATE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedTemplateCat(cat.id)}
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap transition-colors font-semibold border flex items-center gap-1',
                    selectedTemplateCat === cat.id
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-secondary/40 text-muted-foreground border-border/60 hover:bg-secondary/80 hover:text-foreground',
                  )}
                >
                  <span>{cat.label}</span>
                  <span className="text-[8.5px] opacity-75">
                    ({templateCategoryCounts[cat.id] || 0})
                  </span>
                </button>
              ))}
            </div>

            {/* Template Posters Grid */}
            {filteredTemplates.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No templates found matching &quot;{searchQuery}&quot;
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1.5">
                {filteredTemplates.map((template) => (
                  <TextTemplateCard
                    key={template.id}
                    template={template}
                    onApply={handleApplyTemplate}
                    onDragStart={handleDragTemplate}
                    onDragEnd={handleDragEnd}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">
                Styles & Effects
              </span>
              <span className="text-[8.5px] text-muted-foreground">Click to apply to clip</span>
            </div>

            {/* Effects Category Filter Chips */}
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md py-1 flex items-center gap-1 overflow-x-auto scrollbar-none border-b border-border/30">
              {TEXT_EFFECT_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedEffectCat(cat.id)}
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap transition-colors font-semibold border flex items-center gap-1',
                    selectedEffectCat === cat.id
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-secondary/40 text-muted-foreground border-border/60 hover:bg-secondary/80 hover:text-foreground',
                  )}
                >
                  <span>{cat.label}</span>
                  <span className="text-[8.5px] opacity-75">
                    ({effectCategoryCounts[cat.id] || 0})
                  </span>
                </button>
              ))}
            </div>

            {/* Effects Grid */}
            {filteredEffects.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No effects found matching &quot;{searchQuery}&quot;
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1.5">
                {filteredEffects.map((effect) => (
                  <TextEffectTile
                    key={effect.id}
                    effect={effect}
                    isApplied={appliedEffectId === effect.id}
                    onApply={handleApplyEffect}
                    onDragStart={handleDragEffect}
                    onDragEnd={handleDragEnd}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
