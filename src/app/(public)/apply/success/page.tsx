import type { Metadata } from 'next'
import { CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getTranslations } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Application Submitted',
  description: 'Your application has been submitted successfully',
}

export default async function ApplySuccessPage() {
  const t = await getTranslations('publicApply')
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-2xl">{t('successTitle')}</CardTitle>
              <CardDescription className="text-base">
                {t('successDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 text-center">
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  {t('successBody1')}
                </p>
                <p className="text-muted-foreground">
                  {t('successBody2')}
                </p>
              </div>

              <div className="rounded-lg bg-muted p-4 text-sm">
                <p className="font-medium">{t('nextTitle')}</p>
                <ul className="mt-2 space-y-1 text-left text-muted-foreground">
                  <li>• {t('nextReview')}</li>
                  <li>• {t('nextInterview')}</li>
                  <li>• {t('nextUpdates')}</li>
                </ul>
              </div>

              <p className="pt-2 text-sm font-medium text-muted-foreground">
                {t('closePage')}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
