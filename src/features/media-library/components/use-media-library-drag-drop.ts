import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  extractValidMediaFileEntriesFromDataTransfer,
  formatMediaDropRejectionMessage,
} from '../utils/file-drop'
import type { MediaLibraryNotification } from '../types'

interface UseMediaLibraryDragDropParams {
  showNotification: (notification: MediaLibraryNotification) => void
  importHandles: (
    handles: FileSystemFileHandle[],
    options?: {
      folderPath?: string
      entries?: Array<{ handle: FileSystemFileHandle; folderPath?: string }>
    },
  ) => Promise<unknown>
  currentFolder?: string | null
}

/**
 * Panel-level drag/drop handling for importing media files. Uses an enter/leave
 * counter so the drop overlay doesn't flicker when dragging over child elements,
 * ignores in-app media/composition drags, and routes valid file handles to the
 * import path. Extracted verbatim from `MediaLibrary`.
 */
function shouldIgnoreInternalDrag(dataTransfer: DataTransfer): boolean {
  try {
    const jsonData = dataTransfer.getData('application/json')
    if (jsonData) {
      const data = JSON.parse(jsonData)
      if (
        data.type === 'media-item' ||
        data.type === 'media-items' ||
        data.type === 'composition'
      ) {
        return true
      }
    }
  } catch {
    // Not JSON data
  }
  return false
}

export function useMediaLibraryDragDrop({
  showNotification,
  importHandles,
  currentFolder,
}: UseMediaLibraryDragDropParams) {
  const { t } = useTranslation()
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (dragCounterRef.current === 1 && !e.dataTransfer.types.includes('application/json')) {
      setIsDragging(true)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback(
    // fallow-ignore-next-line complexity
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current = 0
      setIsDragging(false)

      if (shouldIgnoreInternalDrag(e.dataTransfer)) {
        return
      }

      const { supported, entries, errors } = await extractValidMediaFileEntriesFromDataTransfer(
        e.dataTransfer,
        currentFolder ?? undefined,
      )
      if (!supported) {
        showNotification({
          type: 'warning',
          message: t('media.library.dragDropUnsupported'),
        })
        return
      }

      if (errors.length > 0) {
        showNotification({
          type: 'error',
          message: formatMediaDropRejectionMessage(errors),
        })
      }
      if (entries.length > 0) {
        await importHandles(
          entries.map((entry) => entry.handle),
          { folderPath: currentFolder ?? undefined, entries },
        )
      }
    },
    [showNotification, importHandles, currentFolder, t],
  )

  return { isDragging, handleDragEnter, handleDragOver, handleDragLeave, handleDrop }
}
