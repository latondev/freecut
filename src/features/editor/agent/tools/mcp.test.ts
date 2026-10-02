import { describe, expect, it } from 'vitest'
import { listMcpTools, callMcpTool } from './mcp'
import { buildToolCatalog, listEditorTools } from './registry'

describe('MCP tool mapping', () => {
  it('exposes every registry tool as an MCP descriptor with a JSON-Schema input', () => {
    const descriptors = listMcpTools()
    expect(descriptors.length).toBe(listEditorTools().length)

    for (const descriptor of descriptors) {
      expect(descriptor.name).toBeTruthy()
      expect(descriptor.description).toBeTruthy()
      expect(descriptor.inputSchema.type).toBe('object')
      expect(descriptor.annotations.title).toBeTruthy()
      expect(typeof descriptor.annotations.readOnlyHint).toBe('boolean')
      expect(typeof descriptor.annotations.destructiveHint).toBe('boolean')
    }
  })

  it('includes parameter semantics in the model-facing tool catalog', () => {
    const catalog = buildToolCatalog()
    expect(catalog).toContain('Absolute timeline start time.')
    expect(catalog).toContain('do not use trim_clip for absolute times')
    expect(catalog).toContain('[mutation; requires confirmation]')
  })

  it('flags destructive vs read-only tools correctly', () => {
    const byName = new Map(listMcpTools().map((tool) => [tool.name, tool]))
    expect(byName.get('find_clips')?.annotations.readOnlyHint).toBe(true)
    expect(byName.get('delete_clips')?.annotations.destructiveHint).toBe(true)
    expect(byName.get('split_range')?.annotations.destructiveHint).toBe(true)
    expect(byName.get('set_image_range')?.annotations.destructiveHint).toBe(true)
    expect(byName.get('find_clips')?.annotations.destructiveHint).toBe(false)
  })

  it('returns a structured error for an unknown tool', async () => {
    const result = await callMcpTool('does_not_exist', {})
    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain('Unknown tool')
  })

  it('returns a structured error for invalid arguments', async () => {
    // set_speed requires a numeric `speed`; omitting it must fail validation
    // before any execution side effects.
    const result = await callMcpTool('set_speed', {})
    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain('Invalid arguments')
  })

  it('requires user approval before invoking a mutating tool', async () => {
    const result = await callMcpTool('delete_clips', { clips: ['c1'] })
    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain('requires user approval')
  })

  it('rejects reversed split ranges before execution', async () => {
    const result = await callMcpTool('split_range', { startSeconds: 8, endSeconds: 4 })
    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain('endSeconds')
  })

  it('rejects reversed image timeline ranges before execution', async () => {
    const result = await callMcpTool('set_image_range', {
      clip: 'c1',
      startSeconds: 30,
      endSeconds: 0,
    })
    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain('endSeconds')
  })
})
