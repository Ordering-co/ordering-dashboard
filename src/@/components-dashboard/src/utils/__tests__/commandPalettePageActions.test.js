import { describe, expect, it } from 'vitest'
import { getAdvancedReport } from '../advancedReports'
import { buildOpenActionEntries } from '../commandPaletteActions'
import { buildPageActionEntries } from '../commandPalettePageActions'
import { rankCommandEntries } from '../commandPaletteSearch'

const ids = (entries) => entries.map(entry => entry.id)

describe('buildPageActionEntries', () => {
  it('offers the admin every fixed tab and view', () => {
    const entries = buildOpenActionEntries({ user: { level: 0 }, configs: { addon_gift_cards: { value: '1' } } })
    const byId = Object.fromEntries(entries.map(entry => [entry.id, entry]))
    expect(byId['action:status-deliveries-completed'].path).toBe('/deliveries?status=completed')
    expect(byId['action:status-all-in-one-pending'].path).toBe('/all-in-one?status=pending')
    expect(byId['action:invoice-business-order_type'].path).toBe('/intelligence/invoice?invoice=business&tab=order_type')
    expect(byId['action:promotions-journeys'].path).toBe('/marketing/promotions-enterprise?view=journeys')
    expect(byId['action:gift-cards-activated'].path).toBe('/gift-cards?status=activated')
    expect(byId['action:inactive-customers'].path).toBe('/users/customers?enabled=inactive')
    expect(byId['action:ecommerce-report-4']).toBeUndefined()
    expect(byId['action:translations-kiosk_app']).toMatchObject({
      path: '/settings?group=languages&category=language_manager&product_type=kiosk_app',
      remount: true
    })
  })

  // owner decision 33: the Advanced offers tab keeps its own palette entry
  it('keeps the Advanced offers view entry, going to that tab of the promotions page', () => {
    const entries = buildOpenActionEntries({ user: { level: 0 }, configs: {} })
    const view = entries.find(entry => entry.id === 'action:promotions-advanced_offers')
    expect(view).toMatchObject({ title: 'Advanced offers', path: '/marketing/promotions-enterprise?view=advanced_offers' })
    expect(rankCommandEntries(entries, 'Advanced offers')[0].id).toBe('action:promotions-advanced_offers')
    expect(rankCommandEntries(entries, 'ofertas avanzadas').map(entry => entry.id)).toContain('action:promotions-advanced_offers')
  })

  // tanda O: sentence case, as the rest of the fallbacks («Delivery type», not «Delivery Type»)
  it('writes the order type invoice tab in sentence case', () => {
    const entries = buildOpenActionEntries({ user: { level: 0 }, configs: {} })
    const byId = Object.fromEntries(entries.map(entry => [entry.id, entry]))
    expect(byId['action:invoice-business-order_type'].title).toBe('Store invoices › Delivery type')
    expect(entries.filter(entry => /Delivery Type/.test(entry.title))).toEqual([])
  })

  it('follows addons and roles', () => {
    const admin = ids(buildOpenActionEntries({ user: { level: 0 }, configs: {} }))
    expect(admin).toEqual(expect.arrayContaining([
      'action:gift-cards-pending',
      'action:reviews-professionals',
      'action:inactive-professionals'
    ]))

    const owner = ids(buildOpenActionEntries({ user: { level: 2 }, configs: {} }))
    expect(owner).not.toContain('action:status-deliveries-pending')
    expect(owner).not.toContain('action:inactive-customers')
    expect(owner).not.toContain('action:ecommerce-reports')
    expect(owner).not.toContain('action:translations-website')
    expect(owner).toContain('action:business-business_payments')

    const readOnly = ids(buildOpenActionEntries({ user: { level: 0, readOnlyAdmin: true }, configs: {} }))
    expect(readOnly).not.toContain('action:ecommerce-reports')
    expect(readOnly).not.toContain('action:status-deliveries-pending')
  })

  it('returns nothing without access', () => {
    expect(buildPageActionEntries()).toEqual([])
  })
})

// redesign (n.º 21, ecommerce P2): the Ecommerce reports page is merged into Enterprise reports
describe('retired ecommerce report entries', () => {
  const adminEntries = () => buildOpenActionEntries({ user: { level: 0 }, configs: {} })
  const reportEntry = (id) => adminEntries().find(entry => entry.id === `action:report-${id}`)

  it('has no entry of its own and none points at /intelligence/ecommerce_reports', () => {
    const entries = adminEntries()
    expect(ids(entries).filter(id => id.startsWith('action:ecommerce-report'))).toEqual([])
    expect(entries.filter(entry => String(entry.path).includes('ecommerce_reports'))).toEqual([])
  })

  it('moves the aliases of the page and of main to Enterprise reports 1 to 3', () => {
    expect(reportEntry(1).aliases).toEqual(expect.arrayContaining(['reporte de usuarios', 'Users', 'Ecommerce reports', 'ecommerce']))
    expect(reportEntry(2).aliases).toEqual(expect.arrayContaining(['descuentos', 'reporte de descuentos', 'Discount dashboard', 'ecommerce']))
    expect(reportEntry(3).aliases).toEqual(expect.arrayContaining(['mapa de tiendas', 'Dashboard with store map', 'ecommerce']))
  })

  it('still finds each report by the names of main and by ecommerce, in Enterprise reports', () => {
    const entries = adminEntries()
    const search = (query) => rankCommandEntries(entries, query).map(entry => entry.id)
    expect(search('Users')).toContain('action:report-1')
    expect(search('Discount dashboard')).toContain('action:report-2')
    expect(search('Dashboard with store map')).toContain('action:report-3')
    expect(search('ecommerce')).toEqual(expect.arrayContaining(['action:report-1', 'action:report-2', 'action:report-3']))
    expect(search('Ecommerce reports').filter(id => id.startsWith('action:ecommerce'))).toEqual([])
  })

  it('translates the name of main in the aliases', () => {
    const entries = buildOpenActionEntries({
      user: { level: 0 },
      configs: {},
      t: (key, fallback) => (key === 'USERS' ? 'Usuarios exactos' : fallback)
    })
    expect(entries.find(entry => entry.id === 'action:report-1').aliases).toContain('Usuarios exactos')
  })

  // Clicks is Enterprise report 22 once the registry has it (the Reports half of n.º 21 lands in parallel)
  it.runIf(getAdvancedReport(22))('moves Real time and its Spanish terms to Enterprise report 22', () => {
    expect(reportEntry(22).aliases).toEqual(expect.arrayContaining(['Real time', 'tiempo real', 'en vivo', 'clics', 'ecommerce']))
    expect(rankCommandEntries(adminEntries(), 'Real time').map(entry => entry.id)).toContain('action:report-22')
  })
})
