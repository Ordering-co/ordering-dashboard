import { describe, expect, it } from 'vitest'
import { DEFAULT_DASHBOARD_TITLE, getDashboardTitle, withDashboardTitle } from '../../../worker/seo.js'

describe('worker dashboard title', () => {
  it('prefers the project dashboard title, then the app name', () => {
    expect(getDashboardTitle({ configs: { dashboard_title: { value: ' Delosi Admin ' } } }, { app_name: 'Ordering.co Dashboard' })).toBe('Delosi Admin')
    expect(getDashboardTitle({ configs: { dashboard_title: { value: '' } } }, { app_name: 'Ordering.co Dashboard' })).toBe('Ordering.co Dashboard')
    expect(getDashboardTitle(null, {})).toBe(DEFAULT_DASHBOARD_TITLE)
  })

  it('replaces the website title in every title meta, nothing else', () => {
    const seo = {
      metas: [
        { name: 'title', content: 'OrderingPlus.com' },
        { property: 'og:title', content: 'OrderingPlus.com' },
        { name: 'twitter:title', content: 'OrderingPlus.com' },
        { name: 'description', content: 'Online Ordering' }
      ],
      links: [{ rel: 'icon', href: '/favicon.png' }]
    }
    const result = withDashboardTitle(seo, 'Ordering.co Dashboard')
    expect(result.metas.map(meta => meta.content)).toEqual(['Ordering.co Dashboard', 'Ordering.co Dashboard', 'Ordering.co Dashboard', 'Online Ordering'])
    expect(result.links).toBe(seo.links)
    expect(withDashboardTitle(null, 'x')).toBeNull()
  })
})
