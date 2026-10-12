import { inArray } from 'drizzle-orm'
import { db } from '@/db'
import { mediaTable } from '@/db/schema'

function imageIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'object' && item && 'id' in item ? String(item.id) : String(item)))
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return imageIds(parsed)
    } catch {
      return value ? [value] : []
    }
  }
  return []
}

export async function hydrateInventoryImages<T extends { images?: unknown }>(items: T[]): Promise<T[]> {
  const ids = Array.from(new Set(items.flatMap((item) => imageIds(item.images))))
  const media = ids.length > 0 ? await db.select().from(mediaTable).where(inArray(mediaTable.id, ids)) : []
  const mediaById = new Map(media.map((item) => [item.id, item]))

  return items.map((item) => ({
    ...item,
    images: imageIds(item.images).map((id) => mediaById.get(id)).filter(Boolean),
  }))
}
