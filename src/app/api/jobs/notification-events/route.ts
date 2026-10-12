import { NextRequest, NextResponse } from 'next/server'
import { processNotificationEventOutbox } from '@/lib/notification-events'

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const auth = request.headers.get('authorization')
  const bearer = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null

  return bearer === secret
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limit = Number(request.nextUrl.searchParams.get('limit') || 50)
  const result = await processNotificationEventOutbox(Number.isFinite(limit) ? limit : 50)

  return NextResponse.json({ ok: true, result })
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
