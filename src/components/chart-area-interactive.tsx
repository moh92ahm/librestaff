'use client'

import * as React from 'react'
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { useTranslations } from 'next-intl'

export const description = 'Monthly expenses and employee trend chart'

export interface DashboardExpensePoint {
  month: string
  totalExpenses: number
  payrollExpenses: number
  nonPayrollExpenses: number
  activeEmployees: number
  expensePerEmployee: number
}

interface ChartAreaInteractiveProps {
  data: DashboardExpensePoint[]
}

export function ChartAreaInteractive({ data }: ChartAreaInteractiveProps) {
  const t = useTranslations('dashboard')
  const chartConfig = {
    totalExpenses: {
      label: t('totalExpenses'),
      color: 'var(--primary)',
    },
    payrollExpenses: {
      label: t('payroll'),
      color: '#2563eb',
    },
    nonPayrollExpenses: {
      label: t('nonPayroll'),
      color: '#16a34a',
    },
    activeEmployees: {
      label: t('employees'),
      color: '#f97316',
    },
    expensePerEmployee: {
      label: t('expensePerEmployee'),
      color: '#7c3aed',
    },
  } satisfies ChartConfig

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t('expensesAndTeamSize')}</CardTitle>
        <CardDescription>{t('completedMonthlyPeriods')}</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
          <ComposedChart data={data}>
            <defs>
              <linearGradient id="fillTotalExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-totalExpenses)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-totalExpenses)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis yAxisId="amount" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              yAxisId="employees"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            <Area
              yAxisId="amount"
              dataKey="totalExpenses"
              type="natural"
              fill="url(#fillTotalExpenses)"
              stroke="var(--color-totalExpenses)"
            />
            <Line
              yAxisId="amount"
              dataKey="payrollExpenses"
              type="natural"
              stroke="var(--color-payrollExpenses)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="amount"
              dataKey="nonPayrollExpenses"
              type="natural"
              stroke="var(--color-nonPayrollExpenses)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="employees"
              dataKey="activeEmployees"
              type="natural"
              stroke="var(--color-activeEmployees)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="amount"
              dataKey="expensePerEmployee"
              type="natural"
              stroke="var(--color-expensePerEmployee)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
