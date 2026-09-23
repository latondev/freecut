import { memo, useState, useRef, useCallback, type DragEvent, type MouseEvent } from 'react'
import { Folder, FolderOpen, MoreVertical, Edit2, Trash2, CornerDownRight } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Input } from '@/components/ui/input'
import { useMediaLibraryStore } from '../stores/media-library-store'
import { CARD_PERF_STYLE } from './card-styles'

interface MediaFolderCardProps {
  name: string
  count: number
  layout?: 'grid' | 'list'
  onOpen: (folderName: string) => void
}

function extractDroppedMediaIds(e: DragEvent): string[] {
  const jsonStr = e.dataTransfer.getData('application/json')
  if (!jsonStr) return []
  try {
    const parsed = JSON.parse(jsonStr)
    if (parsed.type === 'media-item' && parsed.mediaId) return [parsed.mediaId]
    if (parsed.type === 'media-items' && Array.isArray(parsed.items)) {
      return parsed.items.map((i: { mediaId: string }) => i.mediaId).filter(Boolean)
    }
  } catch {
    // Ignore JSON parse error
  }
  return []
}

async function extractDroppedFileHandles(e: DragEvent): Promise<FileSystemFileHandle[]> {
  if (!e.dataTransfer.items || !('getAsFileSystemHandle' in DataTransferItem.prototype)) {
    return []
  }
  const handles: FileSystemFileHandle[] = []
  for (let i = 0; i < e.dataTransfer.items.length; i++) {
    const item = e.dataTransfer.items[i]
    try {
      const handle = await (
        item as unknown as { getAsFileSystemHandle: () => Promise<FileSystemHandle> }
      ).getAsFileSystemHandle()
      if (handle && handle.kind === 'file') {
        handles.push(handle as FileSystemFileHandle)
      }
    } catch {
      // Ignore
    }
  }
  return handles
}

export const MediaFolderCard = memo(function MediaFolderCard({
  name,
  count,
  layout = 'grid',
  onOpen,
}: MediaFolderCardProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  const moveMediaToFolder = useMediaLibraryStore((s) => s.moveMediaToFolder)
  const renameFolder = useMediaLibraryStore((s) => s.renameFolder)
  const deleteFolder = useMediaLibraryStore((s) => s.deleteFolder)
  const importHandles = useMediaLibraryStore((s) => s.importHandles)

  const handleStartRename = useCallback(() => {
    setEditName(name)
    setIsEditing(true)
    setTimeout(() => {
      inputRef.current?.select()
      inputRef.current?.focus()
    }, 50)
  }, [name])

  const handleSaveRename = useCallback(async () => {
    const trimmed = editName.trim()
    setIsEditing(false)
    if (trimmed && trimmed !== name) {
      await renameFolder(name, trimmed)
    }
  }, [editName, name, renameFolder])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        void handleSaveRename()
      } else if (e.key === 'Escape') {
        setIsEditing(false)
        setEditName(name)
      }
    },
    [handleSaveRename, name],
  )

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  // fallow-ignore-next-line complexity
  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const mediaIds = extractDroppedMediaIds(e)
      if (mediaIds.length > 0) {
        await moveMediaToFolder(mediaIds, name)
        return
      }

      const handles = await extractDroppedFileHandles(e)
      if (handles.length > 0) {
        await importHandles(handles, { folderPath: name })
      }
    },
    [importHandles, moveMediaToFolder, name],
  )

  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation()
      if (!isEditing) {
        onOpen(name)
      }
    },
    [isEditing, name, onOpen],
  )

  const countLabel = `${count} ${count === 1 ? 'item' : 'items'}`

  if (layout === 'list') {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            style={CARD_PERF_STYLE}
            onClick={handleClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => void handleDrop(e)}
            className={`
              group panel-bg border rounded-md overflow-hidden transition-all duration-150
              flex items-center justify-between px-3 py-2 cursor-pointer select-none
              ${
                isDragOver
                  ? 'border-amber-500 bg-amber-500/15 ring-2 ring-amber-500/40'
                  : 'border-border/70 hover:border-amber-500/50 hover:bg-accent/40'
              }
            `}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {isDragOver ? (
                <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-amber-500 shrink-0 fill-amber-500/20" />
              )}
              {isEditing ? (
                <Input
                  ref={inputRef}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => void handleSaveRename()}
                  onKeyDown={handleKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  className="h-6 text-xs px-1.5 py-0.5"
                  autoFocus
                />
              ) : (
                <span className="text-xs font-medium text-foreground truncate group-hover:text-amber-400 transition-colors">
                  {name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-muted-foreground">{countLabel}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Folder options"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => onOpen(name)}>
                    <CornerDownRight className="w-3.5 h-3.5 mr-2" />
                    Open folder
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleStartRename}>
                    <Edit2 className="w-3.5 h-3.5 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => void deleteFolder(name, { deleteMedia: false })}
                    className="text-muted-foreground"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Delete folder (keep media)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => void deleteFolder(name, { deleteMedia: true })}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Delete folder and media
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent onClick={(e) => e.stopPropagation()}>
          <ContextMenuItem onClick={() => onOpen(name)}>
            <CornerDownRight className="w-3.5 h-3.5 mr-2" />
            Open folder
          </ContextMenuItem>
          <ContextMenuItem onClick={handleStartRename}>
            <Edit2 className="w-3.5 h-3.5 mr-2" />
            Rename
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => void deleteFolder(name, { deleteMedia: false })}>
            <Trash2 className="w-3.5 h-3.5 mr-2" />
            Delete folder (keep media)
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => void deleteFolder(name, { deleteMedia: true })}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5 mr-2" />
            Delete folder and media
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  // Grid view
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          style={CARD_PERF_STYLE}
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={(e) => void handleDrop(e)}
          className={`
            group relative panel-bg border-2 rounded-lg overflow-hidden transition-all duration-150
            aspect-square flex flex-col justify-between p-2.5 cursor-pointer select-none
            ${
              isDragOver
                ? 'border-amber-500 bg-amber-500/15 ring-2 ring-amber-500/40 shadow-lg shadow-amber-500/10'
                : 'border-border/60 hover:border-amber-500/50 hover:bg-accent/30'
            }
          `}
        >
          {/* Top section: Folder icon & menu button */}
          <div className="flex items-start justify-between">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 group-hover:scale-105 group-hover:bg-amber-500/20 transition-all duration-200">
              {isDragOver ? (
                <FolderOpen className="w-6 h-6 text-amber-400 fill-amber-400/20" />
              ) : (
                <Folder className="w-6 h-6 text-amber-500 fill-amber-500/30" />
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Folder options"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => onOpen(name)}>
                  <CornerDownRight className="w-3.5 h-3.5 mr-2" />
                  Open folder
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleStartRename}>
                  <Edit2 className="w-3.5 h-3.5 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => void deleteFolder(name, { deleteMedia: false })}
                  className="text-muted-foreground"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Delete folder (keep media)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => void deleteFolder(name, { deleteMedia: true })}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Delete folder and media
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Bottom section: Name & item count */}
          <div className="space-y-0.5 min-w-0">
            {isEditing ? (
              <Input
                ref={inputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => void handleSaveRename()}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                className="h-6 text-[11px] px-1 py-0.5"
                autoFocus
              />
            ) : (
              <h4
                className="text-[11px] font-semibold text-foreground truncate group-hover:text-amber-400 transition-colors"
                title={name}
              >
                {name}
              </h4>
            )}
            <p className="text-[10px] text-muted-foreground">{countLabel}</p>
          </div>

          {/* Accent border highlight on bottom */}
          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-amber-500/0 via-amber-500/40 to-amber-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent onClick={(e) => e.stopPropagation()}>
        <ContextMenuItem onClick={() => onOpen(name)}>
          <CornerDownRight className="w-3.5 h-3.5 mr-2" />
          Open folder
        </ContextMenuItem>
        <ContextMenuItem onClick={handleStartRename}>
          <Edit2 className="w-3.5 h-3.5 mr-2" />
          Rename
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => void deleteFolder(name, { deleteMedia: false })}>
          <Trash2 className="w-3.5 h-3.5 mr-2" />
          Delete folder (keep media)
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => void deleteFolder(name, { deleteMedia: true })}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="w-3.5 h-3.5 mr-2" />
          Delete folder and media
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
})
