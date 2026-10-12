import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { applicantsTable } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { emitNotificationEvent, NOTIFICATION_EVENTS } from '@/lib/notification-events'
import { documentMimeTypes, saveUploadedMedia } from '@/lib/media-storage'
import { consumeRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    // Extract form fields
    const fullName = formData.get('fullName') as string
    const email = formData.get('email') as string
    const phone = formData.get('phone') as string
    const linkedInUrl = formData.get('linkedInUrl') as string | null
    const portfolioUrl = formData.get('portfolioUrl') as string | null
    const positionAppliedFor = formData.get('positionAppliedFor') as string
    const yearsOfExperience = formData.get('yearsOfExperience') as string
    const educationLevel = formData.get('educationLevel') as string
    const currentEmploymentStatus = formData.get('currentEmploymentStatus') as string
    const expectedSalary = formData.get('expectedSalary') as string | null
    const availabilityDate = formData.get('availabilityDate') as string | null
    const source = formData.get('source') as string | null
    const bio = formData.get('bio') as string
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
      !fullName ||
      !email ||
      !phone ||
      !positionAppliedFor ||
      !yearsOfExperience ||
      !educationLevel ||
      !currentEmploymentStatus ||
      !bio ||
      !cvFile
    ) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 },
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ success: false, message: 'Invalid email format' }, { status: 400 })
    }

    // Validate consent
    if (!consentToDataStorage) {
      return NextResponse.json(
        { success: false, message: 'Consent to data storage is required' },
        { status: 400 },
      )
    }

    // Check if email already exists
    const existing = await db.query.applicantsTable.findFirst({
      where: eq(applicantsTable.email, email),
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
      alt: `${fullName} CV`,
    })

    // Create the applicant record
    const [applicant] = await db
      .insert(applicantsTable)
      .values({
        fullName,
        email,
        phone,
        linkedInUrl: linkedInUrl || null,
        portfolioUrl: portfolioUrl || null,
        positionAppliedFor,
        yearsOfExperience: parseInt(yearsOfExperience, 10),
        educationLevel: educationLevel as any,
        currentEmploymentStatus: currentEmploymentStatus as any,
        expectedSalary: expectedSalary ? parseInt(expectedSalary, 10) : null,
        availabilityDate: availabilityDate ? availabilityDate.split('T')[0] : null,
        source: (source || 'website') as any,
        bio,
        cv: media.id,
        status: 'new',
        consentToDataStorage,
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
