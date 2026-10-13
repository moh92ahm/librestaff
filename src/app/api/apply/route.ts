import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { applicantsTable } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { emitNotificationEvent, NOTIFICATION_EVENTS } from '@/lib/notification-events'
import { documentMimeTypes, saveUploadedMedia } from '@/lib/media-storage'
import { consumeRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'
import { z } from 'zod'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const educationLevels = ['high-school', 'associate', 'bachelor', 'master', 'phd', 'other'] as const
const employmentStatuses = ['employed', 'unemployed', 'notice-period', 'student'] as const
const applicationSources = ['website', 'linkedin', 'referral', 'job-board', 'other'] as const

const optionalUrl = z
  .preprocess(
    (value) => (value == null || value === '' ? undefined : value),
    z.string().trim().max(2048).optional(),
  )
  .transform((value) => value || null)
  .refine((value) => {
    if (!value) return true
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol)
    } catch {
      return false
    }
  }, 'URLs must use http or https')

const applicationSchema = z.object({
  fullName: z.string().trim().min(1).max(255),
  email: z.string().trim().email('Invalid email format').max(255).toLowerCase(),
  phone: z.string().trim().min(1).max(50),
  linkedInUrl: optionalUrl,
  portfolioUrl: optionalUrl,
  positionAppliedFor: z.string().trim().min(1).max(255),
  yearsOfExperience: z.coerce.number().int().min(0).max(80),
  educationLevel: z.enum(educationLevels),
  currentEmploymentStatus: z.enum(employmentStatuses),
  expectedSalary: z.preprocess(
    (value) => (value === '' || value == null ? null : value),
    z.coerce.number().int().min(0).max(1_000_000_000).nullable(),
  ),
  availabilityDate: z.preprocess(
    (value) => (value === '' || value == null ? null : value),
    z.string().date().nullable(),
  ),
  source: z.preprocess(
    (value) => (value === '' || value == null ? 'website' : value),
    z.enum(applicationSources),
  ),
  bio: z.string().trim().min(1).max(10_000),
  consentToDataStorage: z.literal(true),
})

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    // Extract form fields
    const email = String(formData.get('email') || '').trim()
    const consentToDataStorage = formData.get('consentToDataStorage') === 'true'
    const cvFile = formData.get('cv') as File | null
    const ip = getClientIp(req)
    const limit = await consumeRateLimit({
      scope: 'apply',
      key: `${ip}:${email || 'unknown'}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    })

    if (!limit.allowed) {
      return rateLimitResponse(limit)
    }

    // Validate required fields
    if (
      !formData.get('fullName') ||
      !email ||
      !formData.get('phone') ||
      !formData.get('positionAppliedFor') ||
      !formData.get('yearsOfExperience') ||
      !formData.get('educationLevel') ||
      !formData.get('currentEmploymentStatus') ||
      !formData.get('bio')
    ) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 },
      )
    }

    const parsed = applicationSchema.safeParse({
      fullName: formData.get('fullName'),
      email,
      phone: formData.get('phone'),
      linkedInUrl: formData.get('linkedInUrl'),
      portfolioUrl: formData.get('portfolioUrl'),
      positionAppliedFor: formData.get('positionAppliedFor'),
      yearsOfExperience: formData.get('yearsOfExperience'),
      educationLevel: formData.get('educationLevel'),
      currentEmploymentStatus: formData.get('currentEmploymentStatus'),
      expectedSalary: formData.get('expectedSalary'),
      availabilityDate: formData.get('availabilityDate'),
      source: formData.get('source'),
      bio: formData.get('bio'),
      consentToDataStorage,
    })

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || 'Invalid application data'
      return NextResponse.json(
        {
          success: false,
          message:
            message === 'Invalid input: expected true'
              ? 'Consent to data storage is required'
              : message,
        },
        { status: 400 },
      )
    }

    const data = parsed.data

    if (
      !cvFile ||
      typeof cvFile !== 'object' ||
      !('arrayBuffer' in cvFile) ||
      typeof cvFile.arrayBuffer !== 'function' ||
      cvFile.size <= 0
    ) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 },
      )
    }

    // Check if email already exists
    const existing = await db.query.applicantsTable.findFirst({
      where: eq(applicantsTable.email, data.email),
    })

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            'An application with this email already exists. Please contact HR if you need to update your application.',
        },
        { status: 409 },
      )
    }

    const media = await saveUploadedMedia({
      file: cvFile,
      category: 'applicant-cvs',
      allowedMimeTypes: documentMimeTypes,
      maxSize: MAX_FILE_SIZE,
      alt: `${data.fullName} CV`,
    })

    // Create the applicant record
    const [applicant] = await db
      .insert(applicantsTable)
      .values({
        ...data,
        cv: media.id,
        status: 'new',
      })
      .returning()

    await emitNotificationEvent({
      eventType: NOTIFICATION_EVENTS.applicantCreated,
      sourceType: 'applicant',
      sourceId: applicant.id,
      sourceKey: `${NOTIFICATION_EVENTS.applicantCreated}:applicant:${applicant.id}`,
      recipients: [],
      payload: {
        applicantId: applicant.id,
        applicantName: applicant.fullName,
        position: applicant.positionAppliedFor,
        email: applicant.email,
        linkUrl: `/applicants/${applicant.id}`,
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Application submitted successfully',
        applicant: {
          id: applicant.id,
          fullName: applicant.fullName,
          email: applicant.email,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error creating applicant:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to submit application. Please try again later.',
      },
      { status: 500 },
    )
  }
}
