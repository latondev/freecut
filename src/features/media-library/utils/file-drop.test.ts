// @vitest-environment node

import { describe, expect, it, vi } from 'vite-plus/test'
import {
  extractValidMediaFileEntriesFromDataTransfer,
  formatMediaDropRejectionMessage,
} from './file-drop'

function makeItem(handle: FileSystemHandle | null): DataTransferItem {
  return {
    getAsFileSystemHandle: vi.fn().mockResolvedValue(handle),
  } as unknown as DataTransferItem
}

describe('extractValidMediaFileEntriesFromDataTransfer', () => {
  it('recursively extracts supported media files from dropped folders with folderPath', async () => {
    const mockFile = new File(['dummy audio content'], 'voice_sample.mp3', {
      type: 'audio/mpeg',
    })
    const fileHandle = {
      kind: 'file',
      name: 'voice_sample.mp3',
      getFile: vi.fn().mockResolvedValue(mockFile),
    } as unknown as FileSystemFileHandle

    const directoryHandle = {
      kind: 'directory',
      name: 'voice',
      values: async function* () {
        yield fileHandle
      },
    } as unknown as FileSystemDirectoryHandle

    const dataTransfer = {
      items: [makeItem(directoryHandle)],
    } as unknown as DataTransfer

    const result = await extractValidMediaFileEntriesFromDataTransfer(dataTransfer)

    expect(result.supported).toBe(true)
    expect(result.entries.length).toBe(1)
    expect(result.entries[0]?.folderPath).toBe('voice')
    expect(result.entries[0]?.handle).toBe(fileHandle)
    expect(result.entries[0]?.mediaType).toBe('audio')
    expect(result.errors).toEqual([])
  })

  it('reports unsupported files inside folders with relative path', async () => {
    const mockTextFile = new File(['text content'], 'readme.txt', {
      type: 'text/plain',
    })
    const fileHandle = {
      kind: 'file',
      name: 'readme.txt',
      getFile: vi.fn().mockResolvedValue(mockTextFile),
    } as unknown as FileSystemFileHandle

    const directoryHandle = {
      kind: 'directory',
      name: 'docs',
      values: async function* () {
        yield fileHandle
      },
    } as unknown as FileSystemDirectoryHandle

    const dataTransfer = {
      items: [makeItem(directoryHandle)],
    } as unknown as DataTransfer

    const result = await extractValidMediaFileEntriesFromDataTransfer(dataTransfer)

    expect(result.supported).toBe(true)
    expect(result.entries).toEqual([])
    expect(result.errors.length).toBe(1)
    expect(result.errors[0]).toContain('docs/readme.txt')
  })
})

describe('formatMediaDropRejectionMessage', () => {
  it('summarizes rejected drops with examples and an overflow count', () => {
    expect(
      formatMediaDropRejectionMessage([
        'docs/readme.txt: Unsupported file type',
        'notes.txt: Unsupported file type',
        'archive.zip: Unsupported file type',
        'broken.mp4: Unable to read file',
      ]),
    ).toBe(
      '4 dropped items were rejected: docs/readme.txt: Unsupported file type; notes.txt: Unsupported file type; archive.zip: Unsupported file type; and 1 more.',
    )
  })
})
