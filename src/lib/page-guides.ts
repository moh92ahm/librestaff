export const PAGE_GUIDE_KEYS = [
  'home',
  'profile',
  'teamMembers',
  'organization',
  'calendar',
  'announcements',
  'applicants',
  'inventory',
  'leaves',
  'payroll',
  'payrollSettings',
  'expenses',
  'expenseReports',
  'settings',
  'settingsCompany',
  'settingsRoles',
  'settingsDepartments',
  'settingsEmail',
  'settingsWorkflows',
  'settingsCron',
  'settingsLeaves',
  'settingsAnnouncements',
  'settingsHierarchy',
  'fallback',
] as const

export type PageGuideKey = (typeof PAGE_GUIDE_KEYS)[number]

const SETTINGS_GUIDES: Record<string, PageGuideKey> = {
  company: 'settingsCompany',
  roles: 'settingsRoles',
  departments: 'settingsDepartments',
  email: 'settingsEmail',
  workflows: 'settingsWorkflows',
  cron: 'settingsCron',
  leaves: 'settingsLeaves',
  announcements: 'settingsAnnouncements',
  hierarchy: 'settingsHierarchy',
}

export function resolvePageGuideKey(pathname: string | null | undefined): PageGuideKey {
  const path = pathname || '/'
  const segments = path.split('?')[0].split('/').filter(Boolean)
  const [section, child] = segments

  if (!section) return 'home'
  if (section === 'me') return 'profile'
  if (section === 'team-members' || section === 'users') return 'teamMembers'
  if (section === 'organization' || section === 'departments') return 'organization'
  if (section === 'calendar') return 'calendar'
  if (section === 'announcements') return 'announcements'
  if (section === 'applicants') return 'applicants'
  if (section === 'inventory') return 'inventory'
  if (section === 'leaves') return 'leaves'
  if (section === 'expenses') return 'expenses'

  if (section === 'reports') {
    if (child === 'expenses') return 'expenseReports'
    return 'fallback'
  }

  if (section === 'payroll') {
    if (child === 'settings') return 'payrollSettings'
    return 'payroll'
  }

  if (section === 'settings') {
    return (child && SETTINGS_GUIDES[child]) || 'settings'
  }

  return 'fallback'
}
