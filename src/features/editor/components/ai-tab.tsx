import { memo } from 'react'
import { AiPanel } from './ai-panel'

/** Audio-generation tab for TTS and music; timeline editing lives in AI Editor. */
export const AiTab = memo(function AiTab() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">
        <AiPanel />
      </div>
    </div>
  )
})
