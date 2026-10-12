'use client'

import { DataTable } from '../data-table'
import {
  Drawer,
  DrawerHeader,
  DrawerTrigger,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from '../ui/drawer'
import { Button } from '../ui/button'
import { useIsMobile } from '@/hooks/use-mobile'

interface Column<T> {
  key: keyof T
  header: string
  render?: (value: unknown, item: T) => React.ReactNode
}

interface TableWithDrawerProps<T> {
  data: T[]
  columns: Column<T>[]
  title?: string
  drawerTitle: (item: T) => string
  drawerDescription?: (item: T) => string
  drawerContent: (item: T) => React.ReactNode
}

export function TableWithDrawer<T extends { id: number }>({
  data,
  columns,
  title,
  drawerTitle,
  drawerDescription,
  drawerContent,
}: TableWithDrawerProps<T>) {
  const isMobile = useIsMobile()

  return (
    <div className="space-y-4">
      {title && <h1 className="text-xl font-semibold">{title}</h1>}
      <DataTable<T>
        data={data}
        columns={columns}
        actionColumn={(item) => (
          <Drawer direction={isMobile ? 'bottom' : 'right'}>
            <DrawerTrigger asChild>
              <Button variant="outline" size="sm">
                View
              </Button>
            </DrawerTrigger>
            <DrawerContent className={isMobile ? '' : 'w-[400px] sm:w-[540px]'}>
              <DrawerHeader>
                <DrawerTitle>{drawerTitle(item)}</DrawerTitle>
                {drawerDescription && (
                  <DrawerDescription>{drawerDescription(item)}</DrawerDescription>
                )}
              </DrawerHeader>
              <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
                {drawerContent(item)}
              </div>
            </DrawerContent>
          </Drawer>
        )}
      />
    </div>
  )
}
