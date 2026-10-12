import { describe, expect, it } from 'vitest'
import de from '@/../messages/de.json'
import en from '@/../messages/en.json'
import tr from '@/../messages/tr.json'
import { PAGE_GUIDE_KEYS, resolvePageGuideKey } from '@/lib/page-guides'

describe('page guide routing', () => {
  it('resolves top-level and child routes to guide keys', () => {
    expect(resolvePageGuideKey('/')).toBe('home')
    expect(resolvePageGuideKey('/me')).toBe('profile')
    expect(resolvePageGuideKey('/team-members/new')).toBe('teamMembers')
    expect(resolvePageGuideKey('/users/123')).toBe('teamMembers')
    expect(resolvePageGuideKey('/announcements/channels')).toBe('announcements')
    expect(resolvePageGuideKey('/inventory/item-1')).toBe('inventory')
    expect(resolvePageGuideKey('/payroll/settings')).toBe('payrollSettings')
    expect(resolvePageGuideKey('/payroll/generate')).toBe('payroll')
    expect(resolvePageGuideKey('/reports/expenses')).toBe('expenseReports')
    expect(resolvePageGuideKey('/settings/workflows')).toBe('settingsWorkflows')
    expect(resolvePageGuideKey('/settings/unknown')).toBe('settings')
    expect(resolvePageGuideKey('/unknown')).toBe('fallback')
  })

  it('has guide content for every resolver key in each locale', () => {
    for (const messages of [en, tr, de]) {
      const guideItems = messages.guides.items

      for (const key of PAGE_GUIDE_KEYS) {
        expect(guideItems[key].title).toBeTruthy()
        expect(guideItems[key].overview).toBeTruthy()
        expect(guideItems[key].parts.length).toBeGreaterThan(0)
        expect(guideItems[key].actions.length).toBeGreaterThan(0)
        expect(guideItems[key].notes.length).toBeGreaterThan(0)
      }
    }
  })
})
