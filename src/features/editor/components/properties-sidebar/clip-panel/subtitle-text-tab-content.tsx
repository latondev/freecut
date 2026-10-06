import { memo, useCallback, useMemo, useState } from 'react'
import {
  Sparkles,
  Type,
  WandSparkles,
  Check,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  X,
  Music,
  Star,
  Heart,
  Smile,
  Flame,
  Tag,
  Sun,
  Gamepad2,
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
} from 'lucide-react'
import { useTimelineStore } from '@/features/editor/deps/timeline-store'
import { cn } from '@/shared/ui/cn'
import type { SubtitleSegmentItem, TimelineItem } from '@/types/timeline'
import {
  TEXT_EFFECTS_CATALOG,
  TEXT_EFFECT_CATEGORIES,
  type TextEffectItem,
  type TextEffectCategory,
} from '@/shared/typography/text-effects-catalog'
import {
  TEXT_TEMPLATES_CATALOG,
  TEXT_TEMPLATE_CATEGORIES,
  type TextTemplateCardItem,
  type TextTemplateCategory,
} from '@/shared/typography/text-templates-catalog'
import {
  CAPTION_TEMPLATES_CATALOG,
  CAPTION_TEMPLATE_CATEGORIES,
  type CaptionTemplateCardItem,
  type CaptionTemplateCategory,
} from '@/shared/typography/caption-templates-catalog'
import {
  createTextTemplateMotion,
  getCapcutAlphaTextGradient,
  getTemplateMotionKind,
  getTextTemplateMotionPresetId,
} from '@/shared/typography/text-template-motion'
import { ensureFontsLoaded } from '@/shared/typography/font-loader'
import { FontPicker } from './font-picker'
import { ColorPicker, PropertyRow, SliderInput } from '../components'
import { DEFAULT_PROJECT_HEIGHT } from '@/shared/projects/defaults'
import '../../text-template-preview.css'

interface SubtitleTextTabContentProps {
  items: TimelineItem[]
  canvas?: {
    width: number
    height: number
    fps: number
  }
}

type SubTab = 'caption_templates' | 'effects' | 'templates' | 'style'

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

// Interactive Template Card with Hover Preview Animation
const SubtitleTemplateCard = memo(function SubtitleTemplateCard({
  template,
  isApplied,
  onApply,
}: {
  template: TextTemplateCardItem
  isApplied: boolean
  onApply: (template: TextTemplateCardItem) => void
}) {
  const [isHovered, setIsHovered] = useState(false)
  const isPro = template.isPro || template.badge === 'PRO'

  return (
    <button
      type="button"
      title={template.label}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onApply(template)}
      className={cn(
        'group relative aspect-square w-full rounded-md border text-left overflow-hidden flex items-center justify-center p-0 cursor-pointer select-none transition-all active:scale-95',
        isApplied
          ? 'border-emerald-500 bg-emerald-950/40 shadow-sm shadow-emerald-500/20'
          : 'border-white/[0.06] bg-[#1a1a21] hover:bg-[#252530] hover:border-amber-400/50 hover:shadow-md',
      )}
    >
      {/* Pro Badge */}
      {isPro && (
        <span className="absolute top-1 left-1 z-10 text-[7px] leading-none font-bold text-violet-400 drop-shadow">
          ◆
        </span>
      )}

      {/* Applied badge */}
      {isApplied && (
        <span className="absolute top-1 right-1 z-10 p-0.5 rounded-full bg-emerald-500 text-white animate-in zoom-in-50">
          <Check className="w-2.5 h-2.5" />
        </span>
      )}

      {/* Visual Content with Hover Animation */}
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

      {/* Label bar */}
      <span className="absolute bottom-0 inset-x-0 bg-black/75 text-[9px] py-0.5 px-1 truncate text-zinc-300 text-center">
        {template.label}
      </span>
    </button>
  )
})

// Interactive Caption Template Card with Hover Preview Animation
const SubtitleCaptionCard = memo(function SubtitleCaptionCard({
  template,
  isApplied,
  onApply,
}: {
  template: CaptionTemplateCardItem
  isApplied: boolean
  onApply: (template: CaptionTemplateCardItem) => void
}) {
  const [isHovered, setIsHovered] = useState(false)
  const isPro = template.isPro || template.badge === 'PRO'

  return (
    <button
      type="button"
      title={template.label}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onApply(template)}
      className={cn(
        'group relative aspect-video w-full rounded-md border text-left overflow-hidden flex items-center justify-center p-0 cursor-pointer select-none transition-all active:scale-95',
        isApplied
          ? 'border-amber-500 bg-amber-950/40 shadow-sm shadow-amber-500/20'
          : 'border-white/[0.06] bg-[#1a1a21] hover:bg-[#252530] hover:border-amber-400/50 hover:shadow-md',
      )}
    >
      {/* Pro Badge */}
      {isPro && (
        <span className="absolute top-1 left-1 z-10 text-[7px] leading-none font-bold text-violet-400 drop-shadow">
          ◆
        </span>
      )}

      {/* Applied badge */}
      {isApplied && (
        <span className="absolute top-1 right-1 z-10 p-0.5 rounded-full bg-amber-500 text-white animate-in zoom-in-50">
          <Check className="w-2.5 h-2.5" />
        </span>
      )}

      {/* Visual Content with Hover Animation */}
      {template.previewImage ? (
        <div className="w-full h-full flex items-center justify-center p-1 relative">
          <img
            src={template.previewImage}
            alt={template.label}
            className="max-w-[90%] max-h-[85%] object-contain pointer-events-none select-none transition-transform duration-200 group-hover:scale-105 drop-shadow-sm"
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
              className="absolute inset-0 m-auto max-w-[90%] max-h-[85%] object-contain pointer-events-none select-none transition-transform duration-200 group-hover:scale-105 drop-shadow-sm"
            />
          )}
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center p-1">
          <span className="text-xs font-semibold text-zinc-300">{template.label}</span>
        </div>
      )}

      {/* Label bar */}
      <span className="absolute bottom-0 inset-x-0 bg-black/75 text-[9px] py-0.5 px-1 truncate text-zinc-300 text-center">
        {template.label}
      </span>
    </button>
  )
})

// Interactive Effect Tile with Hover Animation
const SubtitleEffectTile = memo(function SubtitleEffectTile({
  effect,
  isApplied,
  onApply,
}: {
  effect: TextEffectItem
  isApplied: boolean
  onApply: (effect: TextEffectItem) => void
}) {
  const [isHovered, setIsHovered] = useState(false)
  const isPro = effect.isPro || effect.badge === 'PRO'

  return (
    <button
      type="button"
      title={effect.label}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onApply(effect)}
      className={cn(
        'group relative flex flex-col items-center justify-center rounded-lg border transition-all text-center overflow-hidden aspect-square select-none cursor-pointer p-1 active:scale-95',
        isApplied
          ? 'border-emerald-500 bg-emerald-950/40 shadow-sm shadow-emerald-500/30'
          : 'border-white/[0.08] bg-[#1a1a21] hover:bg-[#252530] hover:border-amber-400/50 hover:shadow-md',
      )}
    >
      {/* Pro Badge */}
      {isPro && (
        <span className="absolute top-1 left-1 z-10 text-[7px] text-violet-400 select-none leading-none drop-shadow">
          ◆
        </span>
      )}

      {/* Applied indicator */}
      {isApplied && (
        <span className="absolute top-1 right-1 z-10 p-0.5 rounded-full bg-emerald-500 text-white animate-in zoom-in-50">
          <Check className="w-2.5 h-2.5" />
        </span>
      )}

      {/* Image Preview with Hover Animation */}
      {effect.previewImage ? (
        <div className="w-full h-full flex items-center justify-center p-1 relative">
          <img
            src={effect.previewImage}
            alt={effect.label}
            className="max-w-[85%] max-h-[85%] object-contain pointer-events-none select-none transition-transform duration-200 group-hover:scale-105 drop-shadow-sm"
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
              className="absolute inset-0 m-auto max-w-[85%] max-h-[85%] object-contain pointer-events-none select-none transition-transform duration-200 group-hover:scale-105 drop-shadow-sm"
            />
          )}
        </div>
      ) : (
        <span className="text-xs font-bold text-foreground truncate px-1">{effect.label}</span>
      )}

      <span className="absolute bottom-0 inset-x-0 bg-black/75 text-[9px] py-0.5 px-1 truncate text-zinc-300">
        {effect.label}
      </span>
    </button>
  )
})

export const SubtitleTextTabContent = memo(function SubtitleTextTabContent({
  items,
  canvas,
}: SubtitleTextTabContentProps) {
  const timelineItems = useTimelineStore((s) => s.items)
  const updateItem = useTimelineStore((s) => s.updateItem)
  const updateItems = useTimelineStore((s) => s.updateItems)

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('caption_templates')
  const [applyToAll, setApplyToAll] = useState(true)
  const [selectedEffectCat, setSelectedEffectCat] = useState<TextEffectCategory | 'all'>('all')
  const [selectedTemplateCat, setSelectedTemplateCat] = useState<TextTemplateCategory | 'all'>(
    'all',
  )
  const [selectedCaptionTemplateCat, setSelectedCaptionTemplateCat] = useState<
    CaptionTemplateCategory | 'all'
  >('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [selectedEffectId, setSelectedEffectId] = useState<string | null>(null)
  const [selectedCaptionTemplateId, setSelectedCaptionTemplateId] = useState<string | null>(null)

  const canvasHeight = canvas?.height ?? DEFAULT_PROJECT_HEIGHT

  // All subtitle items on timeline
  const allSubtitleItems = useMemo(
    () => timelineItems.filter((it): it is SubtitleSegmentItem => it.type === 'subtitle'),
    [timelineItems],
  )

  // Currently selected subtitle items
  const selectedSubtitles = useMemo(
    () => items.filter((it): it is SubtitleSegmentItem => it.type === 'subtitle'),
    [items],
  )

  const activeSample = selectedSubtitles[0] ?? allSubtitleItems[0]

  // Apply style patch to selected or all subtitles
  const applyStylePatch = useCallback(
    (patch: Partial<SubtitleSegmentItem>) => {
      const targetItems = applyToAll ? allSubtitleItems : selectedSubtitles
      if (targetItems.length === 0) return

      // Allow all style properties (including backgroundColor, stroke, etc.) to apply or reset cleanly
      const cleanPatch: Partial<SubtitleSegmentItem> = {
        ...patch,
      }

      if (updateItems && targetItems.length > 1) {
        updateItems(
          targetItems.map((sub) => ({ id: sub.id, changes: cleanPatch as Partial<TimelineItem> })),
        )
      } else {
        for (const sub of targetItems) {
          updateItem(sub.id, cleanPatch as Partial<TimelineItem>)
        }
      }
    },
    [allSubtitleItems, applyToAll, selectedSubtitles, updateItem, updateItems],
  )

  // Handle clicking a Text Effect
  const handleApplyEffect = useCallback(
    async (effect: TextEffectItem) => {
      setSelectedEffectId(effect.id)

      if (effect.patch.fontFamily) {
        await ensureFontsLoaded([effect.patch.fontFamily], [400, 700])
      }

      applyStylePatch({
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
    },
    [applyStylePatch],
  )

  // Handle clicking a Text Template
  const handleApplyTemplate = useCallback(
    async (template: TextTemplateCardItem) => {
      setSelectedTemplateId(template.id)

      if (template.patch.fontFamily) {
        await ensureFontsLoaded([template.patch.fontFamily], [400, 700])
      }

      const textMotion = createTextTemplateMotion(template)
      const textGradient = getCapcutAlphaTextGradient(template)

      // Script fonts (Dancing Script, Pacifico, Charm, Patrick Hand) are already cursive;
      // forcing fontStyle='italic' causes browser font-matching fallback to sans-serif
      const isScriptFont =
        template.patch.fontFamily === 'Dancing Script' ||
        template.patch.fontFamily === 'Pacifico' ||
        template.patch.fontFamily === 'Charm' ||
        template.patch.fontFamily === 'Patrick Hand'

      const fontStyle = isScriptFont ? 'normal' : template.patch.fontStyle

      applyStylePatch({
        color: template.patch.color,
        gradient: textGradient,
        fontFamily: template.patch.fontFamily,
        fontWeight: template.patch.fontWeight,
        fontSize: template.patch.fontSize ? Math.min(54, template.patch.fontSize) : 50,
        fontStyle,
        textAlign: 'center',
        lineHeight: template.patch.lineHeight,
        stroke: template.patch.stroke,
        textShadow: template.patch.textShadow,
        backgroundColor: template.patch.backgroundColor,
        backgroundRadius: template.patch.backgroundRadius,
        letterSpacing: template.patch.letterSpacing,
        textMotion,
      })
    },
    [applyStylePatch],
  )

  // Handle clicking a Caption Template
  const handleApplyCaptionTemplate = useCallback(
    // fallow-ignore-next-line complexity
    async (template: CaptionTemplateCardItem) => {
      setSelectedCaptionTemplateId(template.id)

      if (template.patch.fontFamily) {
        await ensureFontsLoaded([template.patch.fontFamily], [400, 700])
      }

      applyStylePatch({
        color: template.patch.color ?? '#ffffff',
        gradient: template.patch.gradient ?? undefined,
        fontFamily: template.patch.fontFamily ?? 'Montserrat',
        fontWeight: template.patch.fontWeight ?? 'bold',
        fontSize: template.patch.fontSize ?? 50,
        fontStyle: template.patch.fontStyle ?? 'normal',
        textAlign: template.patch.textAlign ?? 'center',
        lineHeight: template.patch.lineHeight ?? 1.2,
        letterSpacing: template.patch.letterSpacing ?? 0,
        stroke: template.patch.stroke ?? { width: 2.5, color: '#000000' },
        textShadow: template.patch.textShadow ?? {
          offsetX: 0,
          offsetY: 2,
          blur: 4,
          color: 'rgba(0, 0, 0, 0.6)',
        },
        backgroundColor: template.patch.backgroundColor ?? undefined,
        backgroundRadius: template.patch.backgroundRadius ?? undefined,
        textPadding: template.patch.textPadding ?? undefined,
        highlightColor: template.patch.highlightColor ?? '#facc15',
        textTransform: template.patch.textTransform ?? 'none',
        wordHighlightEnabled: true,
      })
    },
    [applyStylePatch],
  )

  // Filtered caption templates
  const filteredCaptionTemplates = useMemo(() => {
    let list = CAPTION_TEMPLATES_CATALOG
    if (selectedCaptionTemplateCat !== 'all') {
      list = list.filter((item) => item.category === selectedCaptionTemplateCat)
    }
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter((item) => item.label.toLowerCase().includes(q))
    }
    return list
  }, [searchQuery, selectedCaptionTemplateCat])

  // Filtered effects
  const filteredEffects = useMemo(() => {
    let list = TEXT_EFFECTS_CATALOG
    if (selectedEffectCat !== 'all') {
      list = list.filter((item) => item.category === selectedEffectCat)
    }
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter((item) => item.label.toLowerCase().includes(q))
    }
    return list
  }, [searchQuery, selectedEffectCat])

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    let list = TEXT_TEMPLATES_CATALOG
    if (selectedTemplateCat !== 'all') {
      list = list.filter((item) => item.category === selectedTemplateCat)
    }
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (item) =>
          item.label.toLowerCase().includes(q) || item.defaultText.toLowerCase().includes(q),
      )
    }
    return list
  }, [searchQuery, selectedTemplateCat])

  return (
    <div className="flex flex-col h-full min-h-0 space-y-2">
      {/* Controls row: Apply to all & Karaoke highlight */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-amber-500/50 text-amber-500 accent-amber-500 cursor-pointer"
            />
            <span className="font-medium text-foreground">Áp dụng cho tất cả phụ đề</span>
          </label>
          <span className="text-[10px] font-mono text-amber-400 font-semibold bg-amber-500/20 px-1.5 py-0.5 rounded">
            {applyToAll
              ? `Tất cả (${allSubtitleItems.length} câu)`
              : `Chỉ câu chọn (${selectedSubtitles.length})`}
          </span>
        </div>

        <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={activeSample?.wordHighlightEnabled !== false}
              onChange={(e) => {
                applyStylePatch({
                  wordHighlightEnabled: e.target.checked,
                  highlightColor: activeSample?.highlightColor || '#facc15',
                })
              }}
              className="w-3.5 h-3.5 rounded border-yellow-500/50 text-yellow-500 accent-yellow-500 cursor-pointer"
            />
            <span className="font-medium text-foreground">
              🎤 Nhảy chữ theo giọng đọc (Karaoke)
            </span>
          </label>
          <div className="flex items-center gap-1.5">
            <span
              className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-xs"
              style={{ backgroundColor: activeSample?.highlightColor || '#facc15' }}
              title="Màu nhảy chữ"
            />
            <span className="text-[10px] font-mono text-yellow-400 font-semibold">
              {activeSample?.wordHighlightEnabled !== false ? 'Bật' : 'Tắt'}
            </span>
          </div>
        </div>
      </div>

      {/* Sub-tabs header */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-secondary/50 rounded-lg text-xs shrink-0">
        <button
          type="button"
          onClick={() => {
            setActiveSubTab('caption_templates')
            setSearchQuery('')
          }}
          className={cn(
            'flex items-center justify-center gap-1 py-1.5 px-1 rounded-md font-medium transition-all cursor-pointer select-none text-[11px]',
            activeSubTab === 'caption_templates'
              ? 'bg-background text-amber-400 shadow-xs'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Subtitles className="w-3 h-3 shrink-0" />
          <span className="truncate">Mẫu Phụ Đề</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSubTab('effects')
            setSearchQuery('')
          }}
          className={cn(
            'flex items-center justify-center gap-1 py-1.5 px-1 rounded-md font-medium transition-all cursor-pointer select-none text-[11px]',
            activeSubTab === 'effects'
              ? 'bg-background text-amber-400 shadow-xs'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Sparkles className="w-3 h-3 shrink-0" />
          <span className="truncate">Hiệu Ứng</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSubTab('templates')
            setSearchQuery('')
          }}
          className={cn(
            'flex items-center justify-center gap-1 py-1.5 px-1 rounded-md font-medium transition-all cursor-pointer select-none text-[11px]',
            activeSubTab === 'templates'
              ? 'bg-background text-amber-400 shadow-xs'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <WandSparkles className="w-3 h-3 shrink-0" />
          <span className="truncate">Mẫu Chữ</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSubTab('style')
            setSearchQuery('')
          }}
          className={cn(
            'flex items-center justify-center gap-1 py-1.5 px-1 rounded-md font-medium transition-all cursor-pointer select-none text-[11px]',
            activeSubTab === 'style'
              ? 'bg-background text-amber-400 shadow-xs'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Type className="w-3 h-3 shrink-0" />
          <span className="truncate">Kiểu Chữ</span>
        </button>
      </div>

      {/* Search Input for caption templates, effects and text templates */}
      {activeSubTab !== 'style' && (
        <div className="relative flex items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeSubTab === 'caption_templates'
                ? `Tìm trong ${CAPTION_TEMPLATES_CATALOG.length} mẫu phụ đề...`
                : activeSubTab === 'effects'
                  ? `Tìm trong ${TEXT_EFFECTS_CATALOG.length} hiệu ứng...`
                  : `Tìm trong ${TEXT_TEMPLATES_CATALOG.length} mẫu chữ...`
            }
            className="w-full text-xs pl-2.5 pr-6 py-1 rounded bg-secondary/40 border border-border/50 focus:border-amber-500/60 focus:outline-none placeholder:text-muted-foreground/60"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-1.5 p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* TAB 0: CAPTION TEMPLATES */}
      {activeSubTab === 'caption_templates' && (
        <div className="flex-1 min-h-0 flex flex-col space-y-2">
          {/* Categories */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px]">
            {CAPTION_TEMPLATE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCaptionTemplateCat(cat.id)}
                className={cn(
                  'px-2 py-0.5 rounded-full shrink-0 transition-colors cursor-pointer',
                  selectedCaptionTemplateCat === cat.id
                    ? 'bg-amber-500 text-black font-semibold'
                    : 'bg-secondary text-muted-foreground hover:text-foreground',
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Grid of caption templates */}
          <div className="flex-1 min-h-[300px] max-h-[500px] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-2">
              {filteredCaptionTemplates.map((template) => (
                <SubtitleCaptionCard
                  key={template.id}
                  template={template}
                  isApplied={selectedCaptionTemplateId === template.id}
                  onApply={handleApplyCaptionTemplate}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: TEXT EFFECTS */}
      {activeSubTab === 'effects' && (
        <div className="flex-1 min-h-0 flex flex-col space-y-2">
          {/* Categories */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px]">
            <button
              type="button"
              onClick={() => setSelectedEffectCat('all')}
              className={cn(
                'px-2 py-0.5 rounded-full shrink-0 transition-colors cursor-pointer',
                selectedEffectCat === 'all'
                  ? 'bg-amber-500 text-black font-semibold'
                  : 'bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              Tất cả
            </button>
            {TEXT_EFFECT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedEffectCat(cat.id)}
                className={cn(
                  'px-2 py-0.5 rounded-full shrink-0 transition-colors cursor-pointer',
                  selectedEffectCat === cat.id
                    ? 'bg-amber-500 text-black font-semibold'
                    : 'bg-secondary text-muted-foreground hover:text-foreground',
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Grid of effects */}
          <div className="flex-1 min-h-[300px] max-h-[500px] overflow-y-auto pr-1">
            <div className="grid grid-cols-3 gap-2">
              {filteredEffects.map((effect) => (
                <SubtitleEffectTile
                  key={effect.id}
                  effect={effect}
                  isApplied={selectedEffectId === effect.id}
                  onApply={handleApplyEffect}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TEXT TEMPLATES */}
      {activeSubTab === 'templates' && (
        <div className="flex-1 min-h-0 flex flex-col space-y-2">
          {/* Categories */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px]">
            <button
              type="button"
              onClick={() => setSelectedTemplateCat('all')}
              className={cn(
                'px-2 py-0.5 rounded-full shrink-0 transition-colors cursor-pointer',
                selectedTemplateCat === 'all'
                  ? 'bg-amber-500 text-black font-semibold'
                  : 'bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              Tất cả
            </button>
            {TEXT_TEMPLATE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedTemplateCat(cat.id)}
                className={cn(
                  'px-2 py-0.5 rounded-full shrink-0 transition-colors cursor-pointer',
                  selectedTemplateCat === cat.id
                    ? 'bg-amber-500 text-black font-semibold'
                    : 'bg-secondary text-muted-foreground hover:text-foreground',
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Grid of templates */}
          <div className="flex-1 min-h-[300px] max-h-[500px] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-2">
              {filteredTemplates.map((template) => (
                <SubtitleTemplateCard
                  key={template.id}
                  template={template}
                  isApplied={selectedTemplateId === template.id}
                  onApply={handleApplyTemplate}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BASIC TYPOGRAPHY STYLE */}
      {activeSubTab === 'style' && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3 text-xs">
          {/* Font Family */}
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground font-medium">Font chữ</label>
            <FontPicker
              value={activeSample?.fontFamily ?? 'Inter'}
              onValueChange={(font) => applyStylePatch({ fontFamily: font })}
            />
          </div>

          {/* Font Size & Vertical Position */}
          <PropertyRow label="Cỡ chữ">
            <SliderInput
              value={activeSample?.fontSize ?? 36}
              min={16}
              max={120}
              step={1}
              unit="px"
              onChange={(val) => applyStylePatch({ fontSize: val })}
            />
          </PropertyRow>

          <PropertyRow label="Vị trí Y">
            <SliderInput
              value={Math.round(activeSample?.transform?.y ?? 0)}
              min={-Math.round(canvasHeight / 2)}
              max={Math.round(canvasHeight / 2)}
              step={1}
              unit="px"
              onChange={(val) =>
                applyStylePatch({
                  transform: {
                    ...(activeSample?.transform ?? {
                      x: 0,
                      y: 0,
                      width: 0,
                      height: 0,
                      rotation: 0,
                      opacity: 1,
                    }),
                    y: val,
                  },
                })
              }
            />
          </PropertyRow>

          {/* Color */}
          <ColorPicker
            label="Màu chữ"
            color={activeSample?.color ?? '#ffffff'}
            onChange={(color) => applyStylePatch({ color })}
            defaultColor="#ffffff"
          />

          {/* Formatting */}
          <PropertyRow label="Định dạng">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  applyStylePatch({
                    fontWeight: activeSample?.fontWeight === 'bold' ? 'normal' : 'bold',
                  })
                }
                className={cn(
                  'p-1.5 rounded border transition-colors cursor-pointer',
                  activeSample?.fontWeight === 'bold'
                    ? 'bg-amber-500 text-black border-amber-500'
                    : 'bg-secondary text-muted-foreground border-border/50 hover:text-foreground',
                )}
                title="In đậm (Bold)"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() =>
                  applyStylePatch({
                    fontStyle: activeSample?.fontStyle === 'italic' ? 'normal' : 'italic',
                  })
                }
                className={cn(
                  'p-1.5 rounded border transition-colors cursor-pointer',
                  activeSample?.fontStyle === 'italic'
                    ? 'bg-amber-500 text-black border-amber-500'
                    : 'bg-secondary text-muted-foreground border-border/50 hover:text-foreground',
                )}
                title="In nghiêng (Italic)"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>

              <div className="h-4 w-px bg-border/50 mx-1" />

              <button
                type="button"
                onClick={() => applyStylePatch({ textAlign: 'left' })}
                className={cn(
                  'p-1.5 rounded border transition-colors cursor-pointer',
                  activeSample?.textAlign === 'left'
                    ? 'bg-amber-500 text-black border-amber-500'
                    : 'bg-secondary text-muted-foreground border-border/50 hover:text-foreground',
                )}
                title="Căn trái"
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => applyStylePatch({ textAlign: 'center' })}
                className={cn(
                  'p-1.5 rounded border transition-colors cursor-pointer',
                  activeSample?.textAlign === 'center' || !activeSample?.textAlign
                    ? 'bg-amber-500 text-black border-amber-500'
                    : 'bg-secondary text-muted-foreground border-border/50 hover:text-foreground',
                )}
                title="Căn giữa"
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => applyStylePatch({ textAlign: 'right' })}
                className={cn(
                  'p-1.5 rounded border transition-colors cursor-pointer',
                  activeSample?.textAlign === 'right'
                    ? 'bg-amber-500 text-black border-amber-500'
                    : 'bg-secondary text-muted-foreground border-border/50 hover:text-foreground',
                )}
                title="Căn phải"
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </PropertyRow>

          {/* Background Box */}
          <div className="pt-2 border-t border-border/40 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-foreground">
                Hộp nền (Background)
              </label>
              <input
                type="checkbox"
                checked={!!activeSample?.backgroundColor}
                onChange={(e) =>
                  applyStylePatch({
                    backgroundColor: e.target.checked ? 'rgba(0, 0, 0, 0.75)' : undefined,
                  })
                }
                className="w-3.5 h-3.5 rounded border-amber-500/50 text-amber-500 accent-amber-500 cursor-pointer"
              />
            </div>

            {activeSample?.backgroundColor && (
              <ColorPicker
                label="Màu nền"
                color={activeSample.backgroundColor}
                onChange={(color) => applyStylePatch({ backgroundColor: color })}
                defaultColor="rgba(0, 0, 0, 0.75)"
              />
            )}
          </div>

          {/* Stroke / Outline */}
          <div className="pt-2 border-t border-border/40 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-foreground">Viền chữ (Stroke)</label>
              <input
                type="checkbox"
                checked={!!activeSample?.stroke && activeSample.stroke.width > 0}
                onChange={(e) =>
                  applyStylePatch({
                    stroke: e.target.checked ? { width: 3, color: '#000000' } : undefined,
                  })
                }
                className="w-3.5 h-3.5 rounded border-amber-500/50 text-amber-500 accent-amber-500 cursor-pointer"
              />
            </div>

            {activeSample?.stroke && (
              <>
                <PropertyRow label="Độ dày viền">
                  <SliderInput
                    value={activeSample.stroke.width}
                    min={1}
                    max={20}
                    step={1}
                    unit="px"
                    onChange={(width) =>
                      applyStylePatch({
                        stroke: { ...activeSample.stroke!, width },
                      })
                    }
                  />
                </PropertyRow>

                <ColorPicker
                  label="Màu viền"
                  color={activeSample.stroke.color}
                  onChange={(color) =>
                    applyStylePatch({
                      stroke: { ...activeSample.stroke!, color },
                    })
                  }
                  defaultColor="#000000"
                />
              </>
            )}
          </div>

          {/* Text Shadow */}
          <div className="pt-2 border-t border-border/40 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-foreground">Đổ bóng (Shadow)</label>
              <input
                type="checkbox"
                checked={!!activeSample?.textShadow}
                onChange={(e) =>
                  applyStylePatch({
                    textShadow: e.target.checked
                      ? { offsetX: 0, offsetY: 3, blur: 8, color: 'rgba(0, 0, 0, 0.8)' }
                      : undefined,
                  })
                }
                className="w-3.5 h-3.5 rounded border-amber-500/50 text-amber-500 accent-amber-500 cursor-pointer"
              />
            </div>

            {activeSample?.textShadow && (
              <>
                <PropertyRow label="Độ mờ bóng">
                  <SliderInput
                    value={activeSample.textShadow.blur}
                    min={0}
                    max={30}
                    step={1}
                    unit="px"
                    onChange={(blur) =>
                      applyStylePatch({
                        textShadow: { ...activeSample.textShadow!, blur },
                      })
                    }
                  />
                </PropertyRow>

                <ColorPicker
                  label="Màu bóng"
                  color={activeSample.textShadow.color}
                  onChange={(color) =>
                    applyStylePatch({
                      textShadow: { ...activeSample.textShadow!, color },
                    })
                  }
                  defaultColor="rgba(0, 0, 0, 0.8)"
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
})
