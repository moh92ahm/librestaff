import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import { HelpGuideButton } from '@/components/help-guide-button'
import en from '@/../messages/en.json'

vi.mock('next/navigation', () => ({
  usePathname: () => '/settings/workflows',
}))

describe('HelpGuideButton', () => {
  it('opens the current page guide from the header button', () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <HelpGuideButton />
      </NextIntlClientProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open page guide' }))

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Workflows guide' })).toBeTruthy()
    expect(screen.getByText('What this page is for')).toBeTruthy()
    expect(screen.getByText(/automation rules/)).toBeTruthy()
  })
})
