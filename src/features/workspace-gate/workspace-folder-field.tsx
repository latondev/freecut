import { useState, useEffect, useCallback } from 'react'
import { Folder, FolderOpen, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  getWorkspaceHandleRecord,
  saveWorkspaceHandleRecord,
  queryHandlePermission,
  requestHandlePermission,
} from '@/infrastructure/storage/handles-db'
import { setWorkspaceRoot } from '@/infrastructure/storage/workspace-fs/root'
import { bootstrapWorkspace } from '@/infrastructure/storage/workspace-fs/bootstrap'
import { createLogger } from '@/shared/logging/logger'

const logger = createLogger('WorkspaceFolderField')

export function WorkspaceFolderField() {
  const [folderName, setFolderName] = useState<string | null>(null)
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [isPicking, setIsPicking] = useState(false)

  const checkFolderHealth = useCallback(async () => {
    try {
      const record = await getWorkspaceHandleRecord()
      if (!record || !record.handle) {
        setFolderName(null)
        setIsValid(false)
        return
      }

      setFolderName(record.name || 'Workspace')

      const handle = record.handle as FileSystemDirectoryHandle
      // Verify that the folder actually exists on disk by querying its keys
      let readable = false
      try {
        // Querying values() will fail with NotFoundError if the directory was deleted/moved from disk
        const iter = handle.values()
        await iter.next()
        readable = true
      } catch (err) {
        logger.warn('Current workspace folder check failed on disk', err)
        readable = false
      }

      setIsValid(readable)
      if (readable) {
        setWorkspaceRoot(handle)
      }
    } catch (err) {
      logger.warn('checkFolderHealth failed', err)
      setIsValid(false)
    }
  }, [])

  useEffect(() => {
    void checkFolderHealth()
  }, [checkFolderHealth])

  const handlePickFolder = async () => {
    if (typeof window === 'undefined' || typeof window.showDirectoryPicker !== 'function') {
      toast.error('File System Access API không được hỗ trợ trên trình duyệt này')
      return
    }

    setIsPicking(true)
    try {
      const handle = await window.showDirectoryPicker({
        id: 'freecut-workspace',
        mode: 'readwrite',
        startIn: 'documents',
      })

      const queryState = await queryHandlePermission(handle)
      const finalState =
        queryState === 'granted' ? queryState : await requestHandlePermission(handle)

      if (finalState !== 'granted') {
        toast.error('Quyền truy cập thư mục bị từ chối')
        setIsPicking(false)
        return
      }

      // Save to database, set as active root, and bootstrap
      await saveWorkspaceHandleRecord(handle)
      setWorkspaceRoot(handle)
      await bootstrapWorkspace(handle)

      setFolderName(handle.name)
      setIsValid(true)
      toast.success(`Đã đổi thư mục lưu sang: ${handle.name}`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        // User cancelled picker dialog
        setIsPicking(false)
        return
      }
      logger.error('Failed to pick workspace folder', error)
      toast.error('Không thể chọn thư mục lưu này', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setIsPicking(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-foreground">
          Thư mục lưu dự án (Save Location)
        </label>
        <span className="text-[11px] text-muted-foreground">
          Nơi lưu trữ file dự án, media và cache
        </span>
      </div>

      <div className="flex items-center gap-2 p-2.5 rounded-lg border border-input bg-secondary/40 hover:bg-secondary/60 transition-colors">
        <div className="p-2 rounded-md bg-secondary text-primary shrink-0">
          {isValid === false ? (
            <AlertCircle className="w-4 h-4 text-destructive" />
          ) : isValid === true ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : (
            <Folder className="w-4 h-4" />
          )}
        </div>

        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-foreground truncate">
              {folderName || 'Chưa chọn thư mục lưu'}
            </span>
            {isValid === false && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium shrink-0">
                Thư mục không tồn tại
              </span>
            )}
            {isValid === true && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium shrink-0">
                Sẵn sàng
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            {isValid === false
              ? 'Thư mục trước đó bị thiếu hoặc đã bị xóa. Vui lòng bấm "Chọn thư mục..." để chọn lại.'
              : 'Tất cả dữ liệu dự án sẽ được ghi trực tiếp vào thư mục này.'}
          </p>
        </div>

        <Button
          type="button"
          variant={isValid === false ? 'destructive' : 'outline'}
          size="sm"
          onClick={handlePickFolder}
          disabled={isPicking}
          className="shrink-0 gap-1.5 font-medium"
        >
          {isPicking ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FolderOpen className="w-3.5 h-3.5" />
          )}
          <span>{isValid === false ? 'Chọn lại thư mục...' : 'Đổi thư mục...'}</span>
        </Button>
      </div>
    </div>
  )
}
