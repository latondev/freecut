import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Check,
  Download,
  ExternalLink,
  Film,
  GripVertical,
  Loader2,
  Plus,
  RotateCcw,
} from 'lucide-react'
import { cn } from '@/shared/ui/cn'
import type { LottieFilesAnimation } from '../services/lottiefiles-api'
import { setMediaDragData, clearMediaDragData } from '../deps/media-library'
import type { MediaMetadata } from '@/types/storage'

interface LottieCardProps {
  animation: LottieFilesAnimation
  importedMedia?: MediaMetadata
  isImporting: boolean
  isImported: boolean
  isFailed: boolean
  onImport: (animation: LottieFilesAnimation) => void
}

// fallow-ignore-next-line complexity
function LottieCardComponent({
  animation,
  importedMedia,
  isImporting,
  isImported,
  isFailed,
  onImport,
}: LottieCardProps) {
  const { t } = useTranslation()
  const canDrag = Boolean(isImported && importedMedia)
  const disabled = isImporting || isImported
  // Some (often freshly uploaded) animations have no rendered GIF yet.
  const [previewFailed, setPreviewFailed] = useState(false)
  const showPreview = Boolean(animation.gifUrl) && !previewFailed

  const actionLabel = isImported
    ? canDrag
      ? t('lottieBrowser.dragToTimeline', 'Kéo vào Timeline')
      : t('lottieBrowser.added')
    : isFailed
      ? t('lottieBrowser.importFailed')
      : t('lottieBrowser.addToMedia')

  const isIconScout = animation.provider === 'IconScout' || animation.id.startsWith('iconscout-')

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!animation.lottieUrl) return
    const a = document.createElement('a')
    a.href = animation.lottieUrl
    a.download = `${animation.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.lottie`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleDragStart = (e: React.DragEvent) => {
    if (!importedMedia) return
    e.dataTransfer.effectAllowed = 'copy'
    const dragData = {
      type: 'media-item' as const,
      mediaId: importedMedia.id,
      mediaType: 'lottie' as const,
      fileName: importedMedia.fileName,
      duration: importedMedia.duration,
    }
    e.dataTransfer.setData('application/json', JSON.stringify(dragData))
    setMediaDragData(dragData)
  }

  const handleDragEnd = () => {
    clearMediaDragData()
  }

  return (
    <div className="group flex flex-col gap-1">
      <div
        className={cn(
          'relative aspect-square w-full overflow-hidden rounded-lg border border-border transition-colors select-none',
          !disabled && 'hover:border-primary/60 cursor-pointer',
          canDrag &&
            'cursor-grab active:cursor-grabbing hover:border-primary/80 ring-1 ring-primary/40',
          disabled && !canDrag && 'cursor-default',
          isFailed && 'border-destructive/70 cursor-pointer',
        )}
        style={{ backgroundColor: animation.bgColor ?? undefined }}
        draggable={canDrag}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={() => {
          if (!disabled) onImport(animation)
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault()
            onImport(animation)
          }
        }}
        aria-label={actionLabel}
        data-tooltip={actionLabel}
        data-tooltip-side="top"
      >
        {isIconScout && (
          <span className="absolute left-1.5 top-1.5 z-10 rounded bg-amber-500/90 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white shadow-xs">
            Free
          </span>
        )}

        {/* Quick direct download button */}
        {animation.lottieUrl && !isImporting && (
          <button
            type="button"
            onClick={handleDownload}
            title="Tải file animation về máy"
            className="absolute right-1.5 top-1.5 z-10 rounded-md bg-black/60 p-1 text-white/90 opacity-0 transition-all hover:bg-black/90 hover:text-white group-hover:opacity-100"
          >
            <Download className="h-3 w-3" />
          </button>
        )}

        {showPreview ? (
          <img
            // COEP is `require-corp`; a cross-origin <img> must be a CORS
            // request or it is blocked. The CDN serves `Access-Control-Allow-
            // Origin: *`, so anonymous CORS loads (and animates) fine.
            crossOrigin="anonymous"
            src={animation.gifUrl ?? undefined}
            alt={animation.name}
            loading="lazy"
            onError={() => setPreviewFailed(true)}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Film className="h-6 w-6" />
          </div>
        )}

        {!disabled && !isFailed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <Plus className="h-6 w-6 text-white" />
          </div>
        )}

        {isFailed && !isImporting && (
          <div className="absolute inset-0 flex items-center justify-center bg-destructive/30">
            <RotateCcw className="h-5 w-5 text-white" />
          </div>
        )}

        {isImporting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </div>
        )}

        {canDrag && !isImporting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none p-1 text-center">
            <GripVertical className="h-5 w-5 text-white mb-0.5" />
            <span className="text-[10px] font-semibold text-white leading-tight">
              Kéo vào Timeline
            </span>
          </div>
        )}

        {isImported && (
          <div className="absolute right-1 top-1 z-10 rounded-full bg-primary p-0.5 text-primary-foreground">
            <Check className="h-3 w-3" />
          </div>
        )}
      </div>

      <div className="min-w-0 px-0.5">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-[11px] font-medium text-foreground">{animation.name}</span>
          {animation.pageUrl && (
            <a
              href={animation.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Xem trên IconScout"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
        {animation.author && (
          <div className="truncate text-[10px] text-muted-foreground">
            {t('lottieBrowser.by', { author: animation.author })}
          </div>
        )}
      </div>
    </div>
  )
}

export const LottieCard = memo(LottieCardComponent)
