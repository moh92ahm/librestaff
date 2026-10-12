"use client"

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

interface SetBreadcrumbLabelProps {
  label: string
}

export function SetBreadcrumbLabel({ label }: SetBreadcrumbLabelProps) {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const key = pathname || '/'
    // If this is an edit route, also set parent path override (/x/y instead of /x/y/edit)
    const segments = (key || '/').split('/').filter(Boolean)
    const parentKey = segments.at(-1) === 'edit' ? `/${segments.slice(0, -1).join('/')}` : undefined
    ;(window as any).__breadcrumbOverride = (window as any).__breadcrumbOverride || {}
    ;(window as any).__breadcrumbOverride[key] = label
    if (parentKey) {
      ;(window as any).__breadcrumbOverride[parentKey] = label
    }
    return () => {
      if ((window as any).__breadcrumbOverride) {
        delete (window as any).__breadcrumbOverride[key]
        if (parentKey) delete (window as any).__breadcrumbOverride[parentKey]
      }
    }
  }, [pathname, label])

  return null
}
