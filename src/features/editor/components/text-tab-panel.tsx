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

function renderTemplateCssPreview(template: TextTemplateCardItem) {
  const { stroke, textShadow } = template.patch
  const webkitStroke = stroke ? `${stroke.width * 0.8}px ${stroke.color}` : undefined
  const shadow = textShadow
    ? `${textShadow.offsetX}px ${textShadow.offsetY}px ${textShadow.blur * 0.6}px ${textShadow.color}`
    : undefined

  return (
    <div className="flex-1 flex flex-col justify-center items-center py-2 px-1 text-center w-full">
      {template.sample.tag && (
        <div className="flex items-center gap-1 mb-1">
          {!template.badge && renderCardIcon(template.icon)}
          <span className="text-[8px] font-bold tracking-widest text-zinc-400 uppercase">
            {template.sample.tag}
          </span>
        </div>
      )}
      <span
        className="text-[13px] font-extrabold leading-snug truncate max-w-full drop-shadow-md select-none"
        style={{
          color: template.patch.color,
          fontFamily: template.patch.fontFamily,
          WebkitTextStroke: webkitStroke,
          textShadow: shadow,
        }}
      >
        {template.sample.title}
      </span>
      {template.sample.subtitle && (
        <span className="text-[8px] text-zinc-400 font-medium truncate max-w-full mt-1 select-none">
          {template.sample.subtitle}
        </span>
      )}
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
  return (
    <button
      type="button"
      draggable={true}
      onDragStart={onDragStart(template)}
      onDragEnd={onDragEnd}
      onClick={() => onApply(template)}
      className={cn(
        'group relative flex flex-col justify-between p-2.5 rounded-xl border border-zinc-800/80',
        'bg-gradient-to-b',
        template.cardBgClass || 'from-zinc-900/60 to-black/80',
        'hover:border-primary/70 hover:shadow-lg hover:shadow-primary/5 transition-[transform,border-color,box-shadow]',
        'active:scale-[0.97] text-left overflow-hidden min-h-[105px]',
      )}
    >
      {/* Decorative Badge */}
      {template.badge && (
        <span className="absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider bg-rose-500 text-white shadow-sm flex items-center gap-0.5">
          {renderCardIcon(template.icon)}
          {template.badge}
        </span>
      )}

      {/* Main Poster Preview Area */}
      {template.previewImage ? (
        <div className="flex-1 flex items-center justify-center p-1 w-full overflow-hidden min-h-[72px]">
          <img
            src={template.previewImage}
            alt={template.label}
            className="w-full h-auto max-h-[78px] object-contain rounded-md select-none group-hover:scale-105 transition-transform duration-200"
            draggable={false}
            loading="lazy"
          />
        </div>
      ) : (
        renderTemplateCssPreview(template)
      )}

      {/* Card Footer Bar */}
      <div className="pt-1.5 border-t border-zinc-800/60 flex items-center justify-between text-[9px] text-zinc-400 group-hover:text-zinc-200">
        <span className="truncate font-medium">{template.label}</span>
        <span className="text-primary font-bold opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">
          + Add
        </span>
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
  return (
    <button
      type="button"
      draggable={true}
      onDragStart={onDragStart(effect)}
      onDragEnd={onDragEnd}
      onClick={() => onApply(effect)}
      className={cn(
        'group relative flex flex-col items-center justify-between p-2 rounded-xl border transition-[transform,background-color,border-color,box-shadow] active:scale-95 text-center min-h-[84px]',
        isApplied
          ? 'border-emerald-500 bg-emerald-950/40 shadow-sm shadow-emerald-500/20'
          : 'border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-900 hover:border-primary/60 hover:shadow-md',
      )}
    >
      {isApplied && (
        <span className="absolute top-1 right-1 z-10 p-0.5 rounded-full bg-emerald-500 text-white animate-in zoom-in-50">
          <Check className="w-2.5 h-2.5" />
        </span>
      )}

      <div className="flex-1 flex items-center justify-center py-1 w-full">
        <span
          className="text-lg font-bold tracking-wider select-none leading-none max-w-full truncate px-1"
          style={effect.previewStyle}
        >
          {effect.previewText || 'Ag'}
        </span>
      </div>

      <span className="text-[9px] font-medium text-zinc-400 group-hover:text-zinc-200 truncate w-full pt-1.5 border-t border-zinc-800/50">
        {effect.label}
      </span>
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
      counts[item.category] = (counts[item.category] || 0) + 1
    }
    return counts
  }, [])

  const effectCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: TEXT_EFFECTS_CATALOG.length }
    for (const item of TEXT_EFFECTS_CATALOG) {
      counts[item.category] = (counts[item.category] || 0) + 1
    }
    return counts
  }, [])

  const filteredTemplates = useMemo(() => {
    let list = TEXT_TEMPLATES_CATALOG
    if (selectedTemplateCat !== 'all') {
      list = list.filter((item) => item.category === selectedTemplateCat)
    }
    const query = searchQuery.trim().toLowerCase()
    if (!query) return list
    return list.filter((item) => matchesTemplateSearch(item, query))
  }, [selectedTemplateCat, searchQuery])

  const filteredEffects = useMemo(() => {
    let list = TEXT_EFFECTS_CATALOG
    if (selectedEffectCat !== 'all') {
      list = list.filter((item) => item.category === selectedEffectCat)
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

      if (selectedTextItem) {
        updateItem(selectedTextItem.id, {
          color: effect.patch.color,
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

      handleCreateTextItem(
        {
          text: template.defaultText,
          ...template.patch,
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

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {activeMainTab === 'templates' ? (
          <>
            {/* Basic Section: Add Heading & Add Body Text */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Basic
              </div>

              <div className="space-y-1.5">
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
                  className="w-full py-2.5 px-3 rounded-lg bg-secondary/60 hover:bg-secondary border border-border/80 hover:border-primary/50 text-foreground font-black text-sm tracking-wide transition-[transform,background-color,border-color] active:scale-[0.98] flex items-center justify-center gap-2 group shadow-sm"
                >
                  <Heading className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
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
                  className="w-full py-2 px-3 rounded-lg bg-secondary/30 hover:bg-secondary/60 border border-border/50 hover:border-border text-muted-foreground hover:text-foreground font-medium text-xs tracking-normal transition-[transform,background-color,border-color] active:scale-[0.98] flex items-center justify-center gap-2 group"
                >
                  <Type className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span>Add body text</span>
                </button>
              </div>
            </div>

            {/* Template Category Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {TEXT_TEMPLATE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedTemplateCat(cat.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap transition-colors font-semibold border flex items-center gap-1',
                    selectedTemplateCat === cat.id
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-secondary/40 text-muted-foreground border-border/60 hover:bg-secondary/80 hover:text-foreground',
                  )}
                >
                  <span>{cat.label}</span>
                  <span className="text-[9px] opacity-75">
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
              <div className="grid grid-cols-2 gap-2.5">
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Styles & Effects
              </span>
              <span className="text-[9px] text-muted-foreground">Click to apply to clip</span>
            </div>

            {/* Effects Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {TEXT_EFFECT_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedEffectCat(cat.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap transition-colors font-semibold border flex items-center gap-1',
                    selectedEffectCat === cat.id
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-secondary/40 text-muted-foreground border-border/60 hover:bg-secondary/80 hover:text-foreground',
                  )}
                >
                  <span>{cat.label}</span>
                  <span className="text-[9px] opacity-75">
                    ({effectCategoryCounts[cat.id] || 0})
                  </span>
                </button>
              ))}
            </div>

            {/* 3-Column Effects Grid */}
            {filteredEffects.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No effects found matching &quot;{searchQuery}&quot;
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
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
