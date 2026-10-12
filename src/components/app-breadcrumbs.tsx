import React from 'react'
import Link from 'next/link'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

type Crumb = {
  label: string
  href?: string
}

interface AppBreadcrumbsProps {
  items: Crumb[]
  className?: string
}

export function AppBreadcrumbs({ items, className }: AppBreadcrumbsProps) {
  if (!items?.length) return null
  const lastIdx = items.length - 1
  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {items.map((item, idx) => (
          <React.Fragment key={`breadcrumb-${idx}`}>
            <BreadcrumbItem>
              {idx === lastIdx || !item.href ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {idx < lastIdx && <BreadcrumbSeparator />}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
