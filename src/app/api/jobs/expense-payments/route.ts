import { NextRequest, NextResponse } from 'next/server'
import { generateDueExpensePayments } from '@/lib/expense-generation'

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

  const dateParam = request.nextUrl.searchParams.get('date')
  const date = dateParam ? new Date(dateParam) : new Date()
  const payments = await generateDueExpensePayments(Number.isNaN(date.getTime()) ? new Date() : date)

  return NextResponse.json({ ok: true, generated: payments.length })
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
