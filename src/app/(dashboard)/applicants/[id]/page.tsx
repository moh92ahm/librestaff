import { notFound } from 'next/navigation'
import { db } from '@/db'
import { requirePermission } from '@/lib/permissions'
import { ApplicantDetail } from '@/components/applicants/applicant-detail'
import { eq } from 'drizzle-orm'
import { applicantsTable } from '@/db/schema'

interface ApplicantPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ApplicantPage({ params }: ApplicantPageProps) {
  const { id } = await params
  const currentUser = await requirePermission('applicants', 'view')

  try {
    const applicant = await db.query.applicantsTable.findFirst({
      where: eq(applicantsTable.id, id),
      with: {
        cvFile: true,
      },
    })

    if (!applicant) {
      notFound()
    }

    return <ApplicantDetail applicant={applicant} currentUser={currentUser} />
  } catch (error) {
    console.error('Error fetching applicant:', error)
    notFound()
  }
}
