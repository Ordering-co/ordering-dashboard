import { describe, expect, it } from 'vitest'
import { buildOpenActionEntries } from '../commandPaletteActions'
import { buildPageActionEntries } from '../commandPalettePageActions'

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
    expect(byId['action:ecommerce-report-4'].path).toBe('/intelligence/ecommerce_reports?id=4')
    expect(byId['action:translations-kiosk_app']).toMatchObject({
      path: '/settings?group=languages&category=language_manager&product_type=kiosk_app',
      remount: true
    })
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
