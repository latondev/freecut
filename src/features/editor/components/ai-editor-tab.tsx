import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bot, Loader2, RefreshCw, Save, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  configureLlmProvider,
  fetchLlmModels,
  getLlmApiKey,
  getLlmProviderSettings,
  type LlmProviderSettings,
} from '@/infrastructure/llm'
import { AgentChatPanel } from './agent-chat-panel'
import { useAgentStore } from '../agent'
import { listMcpTools } from '../agent/tools'

interface ModelCapabilities {
  vision?: boolean
  video?: boolean
  tools?: boolean
  streaming?: boolean
  reasoning?: boolean
  context?: string
}

// fallow-ignore-next-line complexity
function getModelCapabilities(model: string): ModelCapabilities {
  const id = model.toLowerCase()
  if (!id) return {}

  const capabilities: ModelCapabilities = {
    tools: true,
    streaming: true,
    reasoning: true,
  }
  if (id.includes('minimax-m3')) {
    return { ...capabilities, vision: true, video: true, context: '1M tokens' }
  }
  if (id.includes('minimax')) {
    return { ...capabilities, context: '204K tokens' }
  }
  if (id.includes('qwen3-vl') || id.includes('qwen3-omni') || id.includes('qwen3.5-omni')) {
    return { ...capabilities, vision: true, video: id.includes('vl'), context: 'Long context' }
  }
  if (id.includes('coder')) return { ...capabilities, context: 'Long context' }
  if (id.includes('glm') || id.includes('deepseek') || id.includes('ling-3')) {
    return { ...capabilities, context: 'Long context' }
  }

  return {}
}

const DOCUMENTED_MODEL_IDS = [
  'seekai_fee/deepseek-v4-flash',
  'seekai_fee/glm-5.3-flash',
  'xkiro/liquid/lfm-2.5-2.6b',
  'xkiro/inclusionai/ling-3.0-flash-sante',
  'xkiro/minimax/minimax-m3',
  'xkiro/minimax/minimax-m2.7-highspeed',
  'xkiro/minimax/minimax-m2.7',
  'xkiro/minimax/minimax-m2.5-highspeed',
  'xkiro/minimax/minimax-m2.5',
  'xkiro/minimax/minimax-m2.1-highspeed',
  'xkiro/minimax/minimax-m2.1',
  'xkiro/minimax/minimax-m2',
  'xkiro/qwen/qwen3.8-max',
  'xkiro/qwen/qwen3.8-omni-flash',
  'xkiro/qwen/qwen3-coder-plus',
  'xkiro/qwen/qwen3.7-max',
  'xkiro/qwen/qwen3.7-plus',
  'xkiro/qwen/qwen3.7-flash',
  'xkiro/qwen/qwen3.6-plus',
  'xkiro/qwen/qwen3.6-max-preview',
  'xkiro/qwen/qwen3.6-35b-a3b',
  'xkiro/qwen/qwen3.6-27b',
  'xkiro/qwen/qwen3.5-plus',
  'xkiro/qwen/qwen3.5-flash',
  'xkiro/qwen/qwen3.5-omni-plus',
  'xkiro/qwen/qwen3.5-omni-flash',
  'xkiro/qwen/qwen3.5-397b-a17b',
  'xkiro/qwen/qwen3-max',
  'xkiro/qwen/qwen3-vl-plus',
  'xkiro/qwen/qwen3-omni-flash',
  'xkiro/qwen/qwen-plus-2025-07-28',
  'xkiro/stealth/space-bunny-alpha',
  'xkiro/dots-studio/dots-3-note-preview',
]

function CapabilityBadge({ label }: { label: string }) {
  return (
    <span className="rounded border border-border bg-secondary/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
      {label}
    </span>
  )
}

export const AiEditorTab = memo(function AiEditorTab() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<LlmProviderSettings>(getLlmProviderSettings)
  const [apiKey, setApiKey] = useState(getLlmApiKey)
  const [models, setModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [settingsDirty, setSettingsDirty] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const phase = useAgentStore((state) => state.phase)
  const refreshAdapter = useAgentStore((state) => state.refreshAdapter)
  const modelOptions = [
    ...new Set([...DOCUMENTED_MODEL_IDS, ...models, settings.model].filter(Boolean)),
  ]
  const toolCount = listMcpTools().length
  const capabilities = getModelCapabilities(settings.model)

  const updateSettings = (updates: Partial<LlmProviderSettings>) => {
    setSettings((current) => ({ ...current, ...updates }))
    setSettingsDirty(true)
    setMessage('')
    setError('')
  }

  const saveSettings = () => {
    configureLlmProvider(settings, apiKey)
    refreshAdapter()
    setSettingsDirty(false)
    setMessage(t('agent.settings.saved', { defaultValue: 'AI Editor settings saved.' }))
    setError('')
    setSettingsOpen(false)
  }

  const loadModels = async () => {
    setLoadingModels(true)
    setError('')
    setMessage('')
    try {
      const found = await fetchLlmModels(settings.baseUrl, apiKey.trim())
      setModels(found)
      if (!settings.model && found[0]) updateSettings({ model: found[0] })
      setMessage(
        t('agent.settings.modelsFound', {
          defaultValue: '{{count}} models found.',
          count: found.length,
        }),
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load models.')
    } finally {
      setLoadingModels(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Bot className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <h2 className="text-sm font-medium">AI Editor</h2>
            <p className="truncate text-[10px] text-muted-foreground">
              {settings.model || 'No model configured'} · {toolCount} tools · Timeline context
              {settingsDirty ? ' · Unsaved changes' : ''}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 gap-1.5 text-xs"
          onClick={() => setSettingsOpen(true)}
          disabled={phase !== 'idle'}
        >
          <Settings2 className="h-3.5 w-3.5" />
          Settings
        </Button>
      </header>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>AI Editor settings</DialogTitle>
            <DialogDescription>
              Configure the OpenAI-compatible model endpoint used by the editor assistant.
            </DialogDescription>
          </DialogHeader>
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium">
                {t('agent.settings.title', { defaultValue: 'AI Editor settings' })}
              </h2>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-editor-base-url" className="text-[11px]">
                {t('agent.settings.baseUrl', { defaultValue: 'Base URL' })}
              </Label>
              <Input
                id="ai-editor-base-url"
                type="url"
                value={settings.baseUrl}
                disabled={phase !== 'idle'}
                onChange={(event) => updateSettings({ baseUrl: event.target.value })}
                placeholder="https://160-187-229-140.sslip.io/v1"
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                {t('agent.settings.corsNote', {
                  defaultValue: 'The endpoint must allow browser requests from FreeCut (CORS).',
                })}
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-editor-model" className="text-[11px]">
                {t('agent.settings.model', { defaultValue: 'Model' })}
              </Label>
              <select
                id="ai-editor-model"
                value={settings.model}
                disabled={phase !== 'idle'}
                onChange={(event) => updateSettings({ model: event.target.value })}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
              >
                <option value="">
                  {t('agent.settings.selectModel', { defaultValue: 'Select a model' })}
                </option>
                {modelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-1 pt-1">
                {capabilities.context && <CapabilityBadge label={capabilities.context} />}
                {capabilities.vision && <CapabilityBadge label="Vision" />}
                {capabilities.video && <CapabilityBadge label="Video" />}
                {capabilities.tools && <CapabilityBadge label="Tools" />}
                {capabilities.streaming && <CapabilityBadge label="Streaming" />}
                {capabilities.reasoning && <CapabilityBadge label="Reasoning" />}
                {!Object.keys(capabilities).length && (
                  <span className="text-[10px] text-muted-foreground">
                    Capabilities unavailable for this model.
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-editor-api-key" className="text-[11px]">
                {t('agent.settings.apiKey', { defaultValue: 'API key (optional)' })}
              </Label>
              <Input
                id="ai-editor-api-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                disabled={phase !== 'idle'}
                onChange={(event) => {
                  setApiKey(event.target.value)
                  setSettingsDirty(true)
                }}
                placeholder=""
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                {t('agent.settings.apiKeyNote', {
                  defaultValue:
                    'Saved in this browser profile on this machine (not synced; browser storage is not encrypted).',
                })}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-full gap-1.5 text-xs"
              onClick={() => void loadModels()}
              disabled={loadingModels || !settings.baseUrl.trim() || phase !== 'idle'}
            >
              {loadingModels ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {t('agent.settings.loadModels', { defaultValue: 'Load models' })}
            </Button>

            <Button
              size="sm"
              className="h-7 w-full gap-1.5 text-xs"
              onClick={saveSettings}
              disabled={phase !== 'idle'}
            >
              <Save className="h-3.5 w-3.5" />
              {t('agent.settings.save', { defaultValue: 'Save settings' })}
            </Button>
            {message && (
              <p role="status" className="text-[10px] text-emerald-500">
                {message}
              </p>
            )}
            {error && (
              <p role="alert" className="text-[10px] text-destructive">
                {error}
              </p>
            )}
          </section>
        </DialogContent>
      </Dialog>
      <div className="min-h-0 flex-1">
        <AgentChatPanel enabled={!settingsDirty} />
      </div>
    </div>
  )
})
