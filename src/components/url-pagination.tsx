import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { cn } from '@/lib/utils'

type PageItem = number | 'start-ellipsis' | 'end-ellipsis'

function visiblePages(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'end-ellipsis', totalPages]
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      'start-ellipsis',
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ]
  }

  return [
    1,
    'start-ellipsis',
    currentPage - 1,
    currentPage,
    currentPage + 1,
    'end-ellipsis',
    totalPages,
  ]
}

export function UrlPagination({
  currentPage,
  totalPages,
  basePath,
  query = {},
}: {
  currentPage: number
  totalPages: number
  basePath: string
  query?: Record<string, string | undefined>
}) {
  if (totalPages <= 1) return null

  const hrefForPage = (page: number) => {
    const params = new URLSearchParams()
    Object.entries(query).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    if (page > 1) params.set('page', String(page))
    const queryString = params.toString()
    return queryString ? `${basePath}?${queryString}` : basePath
  }

  return (
    <Pagination className="pt-2">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href={hrefForPage(Math.max(1, currentPage - 1))}
            aria-disabled={currentPage === 1}
            className={cn(currentPage === 1 && 'pointer-events-none opacity-50')}
          />
        </PaginationItem>

        {visiblePages(currentPage, totalPages).map((item) =>
          typeof item === 'number' ? (
            <PaginationItem key={item}>
              <PaginationLink href={hrefForPage(item)} isActive={item === currentPage}>
                {item}
              </PaginationLink>
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationEllipsis />
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          <PaginationNext
            href={hrefForPage(Math.min(totalPages, currentPage + 1))}
            aria-disabled={currentPage === totalPages}
            className={cn(currentPage === totalPages && 'pointer-events-none opacity-50')}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
