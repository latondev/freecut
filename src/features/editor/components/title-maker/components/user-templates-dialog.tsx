import { memo, useState, useEffect } from 'react'
import { Bookmark, Trash2, Check, Download, Upload } from 'lucide-react'
import type { UserSavedTemplate, TitleScene } from '../types'
import { getUserTemplates, saveUserTemplates } from '../engine/user-templates'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'

interface UserTemplatesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentScene: TitleScene
  onLoadTemplate: (scene: TitleScene) => void
}

export const UserTemplatesDialog = memo(function UserTemplatesDialog({
  open,
  onOpenChange,
  currentScene,
  onLoadTemplate,
}: UserTemplatesDialogProps) {
  const [templates, setTemplates] = useState<UserSavedTemplate[]>([])
  const [templateName, setTemplateName] = useState('')

  useEffect(() => {
    if (open) {
      setTemplates(getUserTemplates())
      setTemplateName(currentScene.text ? currentScene.text.slice(0, 24) : 'My Custom Title')
    }
  }, [open, currentScene.text])

  const handleSaveCurrent = () => {
    if (!templateName.trim()) {
      toast.error('Vui lòng nhập tên template')
      return
    }

    const newTemplate: UserSavedTemplate = {
      id: crypto.randomUUID(),
      name: templateName.trim(),
      createdAt: Date.now(),
      scene: JSON.parse(JSON.stringify(currentScene)),
    }

    const next = [newTemplate, ...templates]
    setTemplates(next)
    saveUserTemplates(next)
    toast.success('Đã lưu template thành công!')
  }

  const handleDelete = (id: string) => {
    const next = templates.filter((t) => t.id !== id)
    setTemplates(next)
    saveUserTemplates(next)
    toast.success('Đã xóa template')
  }

  const handleExportJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(templates, null, 2))
    const dlAnchor = document.createElement('a')
    dlAnchor.setAttribute('href', dataStr)
    dlAnchor.setAttribute('download', 'freecut_title_templates.json')
    dlAnchor.click()
  }

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string)
        if (Array.isArray(parsed)) {
          const next = [...parsed, ...templates]
          setTemplates(next)
          saveUserTemplates(next)
          toast.success(`Đã import ${parsed.length} templates!`)
        }
      } catch {
        toast.error('File JSON không hợp lệ')
      }
    }
    reader.readAsText(file)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-primary" />
            <span>Thư viện Custom Templates của bạn</span>
          </DialogTitle>
        </DialogHeader>

        {/* Save Current Scene Box */}
        <div className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-secondary/30">
          <span className="text-xs font-semibold text-foreground">
            Lưu cấu hình hiện tại thành Template:
          </span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Đặt tên cho template..."
              className="flex-1 px-3 py-1.5 text-xs rounded-md border border-border bg-background text-foreground"
            />
            <Button size="sm" onClick={handleSaveCurrent} className="text-xs h-8">
              Lưu Preset
            </Button>
          </div>
        </div>

        {/* List of Saved Templates */}
        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
          {templates.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              Chưa có template nào được lưu. Bạn có thể lưu mẫu thiết kế riêng để sử dụng cho mọi dự
              án!
            </div>
          ) : (
            templates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors"
              >
                <div className="flex flex-col flex-1 min-w-0 pr-2">
                  <span className="text-xs font-semibold text-foreground truncate">{tpl.name}</span>
                  <span className="text-[10px] text-muted-foreground truncate">
                    {tpl.scene.mode.toUpperCase()} • {tpl.scene.text || 'Untitled'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onLoadTemplate(tpl.scene)
                      onOpenChange(false)
                      toast.success(`Đã áp dụng template "${tpl.name}"`)
                    }}
                    className="h-7 text-xs flex items-center gap-1"
                  >
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Áp dụng</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(tpl.id)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportJson}
              className="text-[11px] h-7 flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              <span>Export JSON</span>
            </Button>
            <label className="cursor-pointer">
              <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border hover:bg-secondary text-[11px] text-foreground">
                <Upload className="w-3 h-3" />
                <span>Import JSON</span>
              </span>
            </label>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-7"
          >
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
})
