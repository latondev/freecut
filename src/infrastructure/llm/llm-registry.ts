/**
 * Registry of LLM adapters. Callers resolve adapters by id and never import a
 * concrete implementation directly.
 */

import { ProviderRegistry } from '@/shared/utils/provider-registry'
import { gemmaLlmAdapter } from './gemma-llm-adapter'
import { openAiCompatibleLlmAdapter } from './openai-compatible-llm-adapter'
import type { LlmAdapter } from './types'

export const DEFAULT_LLM_ADAPTER_ID = 'gemma'

const llmAdapterRegistry = new ProviderRegistry<LlmAdapter>(
  [gemmaLlmAdapter, openAiCompatibleLlmAdapter],
  DEFAULT_LLM_ADAPTER_ID,
)

export function getDefaultLlmAdapter(): LlmAdapter {
  return llmAdapterRegistry.getDefault()
}

export function getLlmAdapter(id: string): LlmAdapter {
  return llmAdapterRegistry.get(id)
}

export function listLlmAdapters(): readonly LlmAdapter[] {
  return llmAdapterRegistry.list()
}
