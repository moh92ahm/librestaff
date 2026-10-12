import { UrlPagination } from '@/components/url-pagination'

export function AnnouncementPagination({
  currentPage,
  totalPages,
  selectedCategoryId,
}: {
  currentPage: number
  totalPages: number
  selectedCategoryId: string
}) {
  return (
    <UrlPagination
      currentPage={currentPage}
      totalPages={totalPages}
      basePath="/announcements"
      query={selectedCategoryId === 'all' ? {} : { category: selectedCategoryId }}
    />
  )
}
