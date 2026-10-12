import type { Metadata } from 'next'
import { db } from '@/db'
import { requirePermission } from '@/lib/permissions'

import { Tabs, TabsContent } from '@/components/ui/tabs'
import { ApplicantsList } from '@/components/applicants/applicants-list'

export const metadata: Metadata = {
  title: 'Applicants',
  description: 'Manage job applications and candidate pool',
}

export default async function ApplicantsPage() {
  await requirePermission('applicants', 'view')

  // Fetch Applicants with CV media relation
  const applicants = await db.query.applicantsTable.findMany({
    orderBy: (applicants, { desc }) => [desc(applicants.applicationDate)],
    limit: 100,
    with: {
      cvFile: true,
    },
  })

  return (
    <Tabs defaultValue="outline">
      <TabsContent
        value="outline"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="space-y-4 p-4 lg:p-6">
          <ApplicantsList data={applicants} />
        </div>
      </TabsContent>
    </Tabs>
  )
}
