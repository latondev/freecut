import { getMediaType, getMimeType, validateMediaFileContent } from './validation'

export interface ExtractedMediaFileEntry {
  handle: FileSystemFileHandle
  file: File
  mediaType: 'video' | 'audio' | 'image' | 'lottie' | 'unknown'
  folderPath?: string
}

export interface ExtractedMediaFileDropResult {
  supported: boolean
  entries: ExtractedMediaFileEntry[]
  errors: string[]
}

function supportsFileSystemDragDrop(dataTransfer: DataTransfer): boolean {
  const firstItem = dataTransfer.items[0]
  return !!firstItem && 'getAsFileSystemHandle' in firstItem
}

export function formatMediaDropRejectionMessage(errors: string[]): string {
  const count = errors.length
  if (count === 0) return ''

  const examples = errors.slice(0, 3).join('; ')
  const overflow = count > 3 ? `; and ${count - 3} more` : ''
  const subject =
    count === 1 ? '1 dropped item was rejected' : `${count} dropped items were rejected`
  return `${subject}: ${examples}${overflow}.`
}

async function processSingleFileHandle(
  fileHandle: FileSystemFileHandle,
  folderPath: string | undefined,
  entries: ExtractedMediaFileEntry[],
  errors: string[],
): Promise<void> {
  try {
    const file = await fileHandle.getFile()
    const validation = await validateMediaFileContent(file)
    if (!validation.valid) {
      const prefix = folderPath ? `${folderPath}/${file.name}` : file.name
      errors.push(`${prefix}: ${validation.error}`)
      return
    }

    entries.push({
      handle: fileHandle,
      file,
      mediaType: getMediaType(getMimeType(file)),
      folderPath,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to read file'
    const prefix = folderPath ? `${folderPath}/${fileHandle.name}` : fileHandle.name
    errors.push(`${prefix}: ${message}`)
  }
}

export async function collectFilesFromDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  parentPath: string = '',
  entries: ExtractedMediaFileEntry[] = [],
  errors: string[] = [],
): Promise<ExtractedMediaFileEntry[]> {
  const currentPath =
    !parentPath || parentPath === dirHandle.name
      ? dirHandle.name
      : `${parentPath}/${dirHandle.name}`
  const iter = (dirHandle as unknown as { values?: () => AsyncIterable<FileSystemHandle> }).values
    ? (dirHandle as unknown as { values: () => AsyncIterable<FileSystemHandle> }).values()
    : null

  if (iter) {
    for await (const subHandle of iter) {
      if (subHandle.kind === 'file') {
        await processSingleFileHandle(
          subHandle as FileSystemFileHandle,
          currentPath,
          entries,
          errors,
        )
      } else if (subHandle.kind === 'directory') {
        await collectFilesFromDirectoryHandle(
          subHandle as FileSystemDirectoryHandle,
          currentPath,
          entries,
          errors,
        )
      }
    }
  }

  return entries
}

export async function extractValidMediaFileEntriesFromDataTransfer(
  dataTransfer: DataTransfer,
  defaultFolderPath?: string,
): Promise<ExtractedMediaFileDropResult> {
  if (!supportsFileSystemDragDrop(dataTransfer)) {
    return {
      supported: false,
      entries: [],
      errors: [],
    }
  }

  const items = Array.from(dataTransfer.items)
  const handlePromises: Promise<FileSystemHandle | null>[] = []
  for (const item of items) {
    if ('getAsFileSystemHandle' in item) {
      handlePromises.push(item.getAsFileSystemHandle())
    }
  }

  const rawHandles = await Promise.all(handlePromises)
  const entries: ExtractedMediaFileEntry[] = []
  const errors: string[] = []

  for (const handle of rawHandles) {
    if (!handle) {
      continue
    }

    if (handle.kind === 'directory') {
      await collectFilesFromDirectoryHandle(
        handle as FileSystemDirectoryHandle,
        defaultFolderPath || '',
        entries,
        errors,
      )
    } else {
      await processSingleFileHandle(
        handle as FileSystemFileHandle,
        defaultFolderPath || undefined,
        entries,
        errors,
      )
    }
  }

  return {
    supported: true,
    entries,
    errors,
  }
}
