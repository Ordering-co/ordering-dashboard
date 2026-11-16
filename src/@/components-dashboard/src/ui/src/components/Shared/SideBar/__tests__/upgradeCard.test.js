import { describe, expect, it } from 'vitest'
import { buildUpgradeCardProps, daysUntilDue } from '../upgradeCard'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = Date.now()

const baseOffer = (overrides = {}) => ({
  id: 812,
  language: 'en',
  project: { name: 'Pizza Roma' },
  current_plan: { name: 'Legacy One Time Payment Platform' },
  save: 50,
  featured: {
    name: 'Marketplace Platform',
    periods: { annual: { price: '$2,499' } }
  },
  others: [],
  due_at: new Date(NOW + 12 * DAY_MS).toISOString(),
  due_at_label: 'December 14, 2026',
  link: 'https://accounts.ordering.co/upgrade/abc',
  ...overrides
})

describe('daysUntilDue', () => {
  it('rounds up a partial day', () => {
    expect(daysUntilDue(new Date(NOW + 1.2 * DAY_MS).toISOString(), NOW)).toBe(2)
  })

  it('is 0 or negative once the due date has passed', () => {
    expect(daysUntilDue(new Date(NOW - DAY_MS).toISOString(), NOW)).toBeLessThanOrEqual(0)
  })
})

describe('buildUpgradeCardProps', () => {
  it('is null when there is no offer', () => {
    expect(buildUpgradeCardProps(null)).toBeNull()
    expect(buildUpgradeCardProps(undefined)).toBeNull()
  })

  it('is null for a malformed offer missing required fields', () => {
    expect(buildUpgradeCardProps({ id: 1 })).toBeNull()
  })

  it('is null when the offer has no due_at, even if otherwise valid for the modal', () => {
    const offer = baseOffer({ due_at: undefined })
    expect(buildUpgradeCardProps(offer)).toBeNull()
  })

  it('builds English copy with save and the days-left count (N > 1)', () => {
    const props = buildUpgradeCardProps(baseOffer({ due_at: new Date(NOW + 12 * DAY_MS).toISOString() }), NOW)
    expect(props.title).toBe('Upgrade your plan')
    expect(props.ctaLabel).toBe('See offer')
    expect(props.subtitle).toBe('Save 50% · 12 days left')
    expect(props.railLabel).toBe('Upgrade your plan · Save 50%')
    expect(props.fraction).toBeCloseTo(12 / 30)
  })

  it('builds Spanish copy from offer.language', () => {
    const props = buildUpgradeCardProps(baseOffer({ language: 'es', due_at: new Date(NOW + 12 * DAY_MS).toISOString() }), NOW)
    expect(props.title).toBe('Actualiza tu plan')
    expect(props.ctaLabel).toBe('Ver oferta')
    expect(props.subtitle).toBe('Ahorra 50% · Quedan 12 días')
    expect(props.railLabel).toBe('Actualiza tu plan · Ahorra 50%')
  })

  it('reads "1 day left" / "Queda 1 día" for N = 1', () => {
    const dueAt = new Date(NOW + 0.5 * DAY_MS).toISOString()
    expect(buildUpgradeCardProps(baseOffer({ due_at: dueAt }), NOW).subtitle).toBe('Save 50% · 1 day left')
    expect(buildUpgradeCardProps(baseOffer({ language: 'es', due_at: dueAt }), NOW).subtitle).toBe('Ahorra 50% · Queda 1 día')
  })

  it('reads "Last day" / "Último día" for N <= 0', () => {
    const dueAt = new Date(NOW - DAY_MS).toISOString()
    expect(buildUpgradeCardProps(baseOffer({ due_at: dueAt }), NOW).subtitle).toBe('Save 50% · Last day')
    expect(buildUpgradeCardProps(baseOffer({ language: 'es', due_at: dueAt }), NOW).subtitle).toBe('Ahorra 50% · Último día')
    expect(buildUpgradeCardProps(baseOffer({ due_at: dueAt }), NOW).fraction).toBe(0)
  })

  it('drops the save mention when the offer has no save, keeping only the days phrase', () => {
    const props = buildUpgradeCardProps(baseOffer({ save: 0, due_at: new Date(NOW + 12 * DAY_MS).toISOString() }), NOW)
    expect(props.subtitle).toBe('12 days left')
    expect(props.railLabel).toBe('Upgrade your plan')
  })

  it('clamps the ring fraction to 30 days even when the offer runs further out', () => {
    const props = buildUpgradeCardProps(baseOffer({ due_at: new Date(NOW + 90 * DAY_MS).toISOString() }), NOW)
    expect(props.fraction).toBe(1)
  })
})
