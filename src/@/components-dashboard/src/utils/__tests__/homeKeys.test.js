import { describe, expect, it } from 'vitest'

import { getDashboardNavSections } from '../dashboardNavigation'
import { getSidebarGroups } from '../sidebarGroups'

// redesign W0-4c (T0-15, decisión 19): the menu keeps HOME ("Inicio"); the address type is HOME_ADDRESS ("Casa").
const admin = { level: 0, name: 'Ada', lastname: 'Admin', user_system_id: 7 }

describe('Home keys (W0-4c)', () => {
  it('the navigation sections and the sidebar ask for HOME, with the English text "Home"', () => {
    const calls = []
    const t = (key, fallback) => { calls.push([key, fallback]); return fallback }
    const sections = getDashboardNavSections({ t, user: admin })
    const result = getSidebarGroups({ t, user: admin, location: { pathname: '/home', search: '', state: null } })
    expect(sections.home.title).toBe('Home')
    expect(result.groups[0].items[0]).toMatchObject({ key: 'home', label: 'Home' })
    expect(calls.filter(([key]) => key === 'HOME').length).toBeGreaterThan(0)
    expect(calls.filter(([key]) => key === 'HOME').every(([, fallback]) => fallback === 'Home')).toBe(true)
    expect(calls.map(([key]) => key)).not.toContain('HOME_ADDRESS')
  })
})
