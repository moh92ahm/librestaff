import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FileQuestion } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <FileQuestion className="h-24 w-24 text-muted-foreground" />
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <h2 className="mt-2 text-2xl font-semibold">Page Not Found</h2>
        <p className="mt-2 text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Go to Dashboard</Link>
      </Button>
    </div>
  )
}
