import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { db } from '@/db'
import { mediaTable } from '@/db/schema'

export const MIME = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const

const extensionByMime: Record<string, string[]> = {
  [MIME.jpeg]: ['jpg', 'jpeg'],
  [MIME.png]: ['png'],
  [MIME.webp]: ['webp'],
  [MIME.pdf]: ['pdf'],
  [MIME.doc]: ['doc'],
  [MIME.docx]: ['docx'],
}

export const imageMimeTypes = [MIME.jpeg, MIME.png, MIME.webp]
export const documentMimeTypes = [MIME.pdf, MIME.doc, MIME.docx]

export type SaveUploadOptions = {
  file: File
  category: string
  allowedMimeTypes: string[]
  maxSize?: number
  alt?: string
  visibility?: 'private' | 'public'
}

export function getMediaStorageDir() {
  return process.env.MEDIA_STORAGE_DIR || path.join(process.cwd(), 'storage', 'media')
}

function cleanFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'file'
}

function extensionFromName(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return ext.replace(/[^a-z0-9]/g, '')
}

function startsWith(buffer: Buffer, signature: number[]) {
  return signature.every((byte, index) => buffer[index] === byte)
}

function hasValidMagicBytes(buffer: Buffer, mimeType: string) {
  if (mimeType === MIME.pdf) return buffer.subarray(0, 4).toString('ascii') === '%PDF'
  if (mimeType === MIME.png) return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (mimeType === MIME.jpeg) return startsWith(buffer, [0xff, 0xd8, 0xff])
  if (mimeType === MIME.webp) {
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  }
  if (mimeType === MIME.doc) {
    return startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  }
  if (mimeType === MIME.docx) {
    return buffer.subarray(0, 2).toString('ascii') === 'PK'
  }
  return false
}

export async function validateUpload(file: File, options: Omit<SaveUploadOptions, 'file' | 'category' | 'alt' | 'visibility'>) {
  const maxSize = options.maxSize ?? Number(process.env.MAX_FILE_SIZE || 10485760)

  if (!file || file.size <= 0) throw new Error('No file provided')
  if (file.size > maxSize) throw new Error(`File too large. Max size: ${Math.floor(maxSize / 1024 / 1024)}MB`)
  if (!options.allowedMimeTypes.includes(file.type)) throw new Error('File type is not allowed')

  const ext = extensionFromName(file.name)
  const allowedExtensions = extensionByMime[file.type] || []
  if (!allowedExtensions.includes(ext)) throw new Error('File extension is not allowed')

  const buffer = Buffer.from(await file.arrayBuffer())
  if (!hasValidMagicBytes(buffer, file.type)) throw new Error('File content does not match the declared type')

  return { buffer, ext }
}

export async function saveUploadedMedia({
  file,
  category,
  allowedMimeTypes,
  maxSize,
  alt,
  visibility = 'private',
}: SaveUploadOptions) {
  const { buffer, ext } = await validateUpload(file, { allowedMimeTypes, maxSize })
  const id = randomUUID()
  const originalFilename = cleanFilename(file.name)
  const filename = `${id}.${ext}`
  const storageKey = path.posix.join(category.replace(/[^a-zA-Z0-9_-]/g, '-'), filename)
  const uploadDir = path.join(getMediaStorageDir(), path.dirname(storageKey))
  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(getMediaStorageDir(), storageKey), buffer)

  let width: number | null = null
  let height: number | null = null
  if (file.type.startsWith('image/')) {
    try {
      const sharp = (await import('sharp')).default
      const metadata = await sharp(buffer).metadata()
      width = metadata.width || null
      height = metadata.height || null
    } catch (error) {
      console.warn('Could not get image dimensions:', error)
    }
  }

  const [media] = await db
    .insert(mediaTable)
    .values({
      id,
      filename,
      originalFilename,
      mimeType: file.type,
      filesize: file.size,
      width,
      height,
      storageKey,
      visibility,
      url: visibility === 'private' ? `/api/media/${id}` : `/media/${filename}`,
      alt: alt || originalFilename,
    })
    .returning()

  return media
}

export async function savePublicRasterMedia({
  file,
  category,
  alt,
}: Pick<SaveUploadOptions, 'file' | 'category' | 'alt'>) {
  const media = await saveUploadedMedia({
    file,
    category,
    allowedMimeTypes: imageMimeTypes,
    alt,
    visibility: 'public',
  })
  const source = path.join(getMediaStorageDir(), media.storageKey || '')
  const publicDir = path.join(process.cwd(), 'public', 'media')
  await mkdir(publicDir, { recursive: true })
  await writeFile(path.join(publicDir, media.filename), await readFile(source))
  return { ...media, url: `/media/${media.filename}` }
}

export function mediaStoragePath(storageKey: string) {
  const normalized = path.normalize(storageKey)
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
    throw new Error('Invalid storage key')
  }
  return path.join(getMediaStorageDir(), normalized)
}

export async function deleteStoredMedia(storageKey: string | null | undefined) {
  if (!storageKey) return
  try {
    await unlink(mediaStoragePath(storageKey))
  } catch {
    // File already missing; database cleanup can continue.
  }
}
