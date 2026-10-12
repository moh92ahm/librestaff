import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateCompanySettings } from '@/lib/company-settings'
import { generatePayrollsForPeriod, toPayrollMonth } from '@/lib/payroll-generation'

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const auth = request.headers.get('authorization')
  const bearer = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null

  return bearer === secret
}

function datePartsInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date)

  const value = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return {
    year: Number(value('year')),
    month: toPayrollMonth(value('month')),
  }
}

async function getRequestedPeriod(request: NextRequest) {
  const monthParam = request.nextUrl.searchParams.get('month')
  const yearParam = request.nextUrl.searchParams.get('year')

  if (monthParam || yearParam) {
    const year = Number(yearParam || new Date().getFullYear())
    if (!Number.isFinite(year)) {
      throw new Error('Invalid payroll year.')
    }

    return {
      month: toPayrollMonth(monthParam || new Date().getMonth() + 1),
      year,
    }
  }

  const dateParam = request.nextUrl.searchParams.get('date')
  const date = dateParam ? new Date(dateParam) : new Date()
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date
  const companySettings = await getOrCreateCompanySettings()

  return datePartsInTimezone(safeDate, companySettings.defaultTimezone || 'UTC')
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const period = await getRequestedPeriod(request)
    const result = await generatePayrollsForPeriod(period)
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Payroll generation failed' },
      { status: 400 },
    )
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
