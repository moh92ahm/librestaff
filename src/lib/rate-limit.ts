import { createHash } from 'crypto'
import { sql } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { db } from '@/db'
import { rateLimitsTable } from '@/db/schema'

export type RateLimitConfig = {
  scope: string
  key: string
  limit: number
  windowMs: number
}

export type RateLimitResult = {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: string
}

function hashKey(scope: string, key: string) {
  return createHash('sha256').update(`${scope}:${key}`).digest('hex')
}

export function getClientIp(request: Request | NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return request.headers.get('x-real-ip') || 'unknown'
}

export async function consumeRateLimit({
  scope,
  key,
  limit,
  windowMs,
}: RateLimitConfig): Promise<RateLimitResult> {
  const now = new Date()
  const nowIso = now.toISOString()
  const expiresAt = new Date(now.getTime() + windowMs).toISOString()
  const keyHash = hashKey(scope, key)

  try {
    const [row] = await db
      .insert(rateLimitsTable)
      .values({
        keyHash,
        scope,
        count: 1,
        windowStart: nowIso,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: rateLimitsTable.keyHash,
        set: {
          count: sql<number>`case when ${rateLimitsTable.expiresAt} <= ${nowIso} then 1 else ${rateLimitsTable.count} + 1 end`,
          windowStart: sql<string>`case when ${rateLimitsTable.expiresAt} <= ${nowIso} then ${nowIso} else ${rateLimitsTable.windowStart} end`,
          expiresAt: sql<string>`case when ${rateLimitsTable.expiresAt} <= ${nowIso} then ${expiresAt} else ${rateLimitsTable.expiresAt} end`,
          updatedAt: nowIso,
        },
      })
      .returning({
        count: rateLimitsTable.count,
        expiresAt: rateLimitsTable.expiresAt,
      })

    const count = Number(row?.count || 1)
    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt: row?.expiresAt || expiresAt,
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('Rate limit check failed open:', error)
    }
    return { allowed: true, limit, remaining: limit, resetAt: expiresAt }
  }
}

export async function clearExpiredRateLimits() {
  const nowIso = new Date().toISOString()
  await db.delete(rateLimitsTable).where(sql`${rateLimitsTable.expiresAt} <= ${nowIso}`)
}

export function rateLimitResponse(result: RateLimitResult) {
  return Response.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(
          Math.max(1, Math.ceil((new Date(result.resetAt).getTime() - Date.now()) / 1000)),
        ),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': result.resetAt,
      },
    },
  )
}
