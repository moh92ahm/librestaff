'use client'

import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from './ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'
import * as React from 'react'
import { useTranslations } from 'next-intl'

interface Column<T> {
  id?: string
  key: keyof T
  header: string
  render?: (value: unknown, item: T) => React.ReactNode
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  actionColumn?: (item: T) => React.ReactNode
  className?: string
  enablePagination?: boolean
  initialPageSize?: number
  selectable?: boolean
  selectableOnMobile?: boolean
  isRowSelected?: (item: T) => boolean
  canSelectRow?: (item: T) => boolean
  onToggleRow?: (item: T, checked: boolean) => void
  onToggleAllRows?: (items: T[], checked: boolean) => void
}

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  actionColumn,
  className = '',
  enablePagination = true,
  initialPageSize = 20,
  selectable = false,
  selectableOnMobile = selectable,
  isRowSelected,
  canSelectRow,
  onToggleRow,
  onToggleAllRows,
}: DataTableProps<T>) {
  const t = useTranslations('common')
  const [pageIndex, setPageIndex] = React.useState(0)
  const [pageSize, setPageSize] = React.useState(initialPageSize)

  const pageCount = Math.max(1, Math.ceil(data.length / pageSize))
  const safePageIndex = Math.min(pageIndex, pageCount - 1)
  const start = enablePagination ? safePageIndex * pageSize : 0
  const end = enablePagination ? start + pageSize : data.length
  const rows = data.slice(start, end)
  const selectableRows = selectable
    ? rows.filter((item) => (canSelectRow ? canSelectRow(item) : true))
    : []
  const selectedRowCount = selectableRows.filter((item) => isRowSelected?.(item)).length
  const allRowsSelected = selectableRows.length > 0 && selectedRowCount === selectableRows.length
  const someRowsSelected = selectedRowCount > 0 && !allRowsSelected

  React.useEffect(() => {
    // If data size shrinks and page index is out of range, clamp it
    const newPageCount = Math.max(1, Math.ceil(data.length / pageSize))
    if (pageIndex > newPageCount - 1) setPageIndex(newPageCount - 1)
  }, [data.length, pageIndex, pageSize])

  const canPrev = safePageIndex > 0
  const canNext = safePageIndex < pageCount - 1
  const renderColumnValue = (column: Column<T>, item: T) =>
    column.render
      ? column.render(item[column.key], item)
      : item[column.key] === null || item[column.key] === undefined || item[column.key] === ''
        ? '-'
        : String(item[column.key])

  return (
    <>
      <div className={`hidden overflow-hidden rounded-lg border md:block ${className}`}>
        {/* Future: Add filters and search here */}

        <Table>
          <TableHeader className="bg-muted sticky top-0 z-10">
            <TableRow>
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allRowsSelected || (someRowsSelected ? 'indeterminate' : false)}
                    disabled={selectableRows.length === 0}
                    onCheckedChange={(checked) =>
                      onToggleAllRows?.(selectableRows, checked === true)
                    }
                    aria-label="Select rows"
                  />
                </TableHead>
              )}
              {columns.map((column) => (
                <TableHead key={column.id ?? String(column.key)}>{column.header}</TableHead>
              ))}
              {actionColumn && <TableHead className="w-20">{t('actions')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item) => (
              <TableRow key={item.id}>
                {selectable && (
                  <TableCell>
                    <Checkbox
                      checked={Boolean(isRowSelected?.(item))}
                      disabled={canSelectRow ? !canSelectRow(item) : false}
                      onCheckedChange={(checked) => onToggleRow?.(item, checked === true)}
                      aria-label="Select row"
                    />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell key={column.id ?? String(column.key)}>
                    {renderColumnValue(column, item)}
                  </TableCell>
                ))}
                {actionColumn && <TableCell>{actionColumn(item)}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className={`space-y-3 md:hidden ${className}`}>
        {selectableOnMobile && (
          <label className="flex min-h-11 items-center gap-3 rounded-lg border bg-muted/20 px-4 text-sm font-medium">
            <Checkbox
              checked={allRowsSelected || (someRowsSelected ? 'indeterminate' : false)}
              disabled={selectableRows.length === 0}
              onCheckedChange={(checked) => onToggleAllRows?.(selectableRows, checked === true)}
              aria-label={t('selectAll')}
            />
            {t('selectAll')}
          </label>
        )}
        {rows.map((item) => {
          const primaryColumn = columns[0]
          const rowSelectable = canSelectRow ? canSelectRow(item) : true

          return (
            <article key={item.id} className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="flex min-h-14 items-start gap-3 px-4 py-3">
                {selectableOnMobile && (
                  <Checkbox
                    className="mt-1"
                    checked={Boolean(isRowSelected?.(item))}
                    disabled={!rowSelectable}
                    onCheckedChange={(checked) => onToggleRow?.(item, checked === true)}
                    aria-label="Select row"
                  />
                )}
                {primaryColumn && (
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      {primaryColumn.header}
                    </p>
                    <div className="mt-1 min-w-0 text-sm font-semibold">
                      {renderColumnValue(primaryColumn, item)}
                    </div>
                  </div>
                )}
                {actionColumn && <div className="shrink-0">{actionColumn(item)}</div>}
              </div>

              {columns.length > 1 && (
                <dl className="divide-y border-t px-4">
                  {columns.slice(1).map((column) => (
                    <div
                      key={column.id ?? String(column.key)}
                      className="grid grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] items-start gap-3 py-2.5"
                    >
                      <dt className="text-xs text-muted-foreground">{column.header}</dt>
                      <dd className="flex min-w-0 justify-end break-words text-right text-sm">
                        {renderColumnValue(column, item)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </article>
          )
        })}
      </div>

      {enablePagination && (
        <div className="mt-3 flex flex-row items-center justify-between gap-3 px-1 py-3 sm:px-4">
          {/* Left side: Rows per page + Showing text */}
          <div className="flex items-center gap-6">
            <div className="hidden items-center gap-2 lg:flex">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {t('rowsPerPage')}
              </span>
              <Select
                value={`${pageSize}`}
                onValueChange={(value) => {
                  setPageSize(Number(value))
                  setPageIndex(0)
                }}
              >
                <SelectTrigger className="w-20" size="sm">
                  <SelectValue placeholder={pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((size) => (
                    <SelectItem key={size} value={`${size}`}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
              {t('showingItems', { shown: Math.min(end, data.length), total: data.length })}
            </div>
          </div>

          {/* Right side: Page info + Navigation buttons */}
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden whitespace-nowrap text-sm font-medium sm:block">
              {t('page')} {safePageIndex + 1} / {pageCount}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => setPageIndex(0)}
                disabled={!canPrev}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                disabled={!canPrev}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setPageIndex((i) => Math.min(pageCount - 1, i + 1))}
                disabled={!canNext}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => setPageIndex(pageCount - 1)}
                disabled={!canNext}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
