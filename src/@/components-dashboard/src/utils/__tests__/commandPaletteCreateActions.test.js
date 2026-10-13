import { describe, expect, it } from 'vitest'
import { buildOpenActionEntries } from '../commandPaletteActions'
import { buildCreateActionEntries } from '../commandPaletteCreateActions'
import { rankCommandEntries } from '../commandPaletteSearch'

const ids = (entries) => entries.map(entry => entry.id)

describe('buildCreateActionEntries', () => {
  it('opens add forms through their one-shot query', () => {
    const entries = buildOpenActionEntries({ user: { level: 0 }, configs: { addon_gift_cards: { value: '1' } } })
    const byId = Object.fromEntries(entries.map(entry => [entry.id, entry]))
    expect(byId['create:custom_order'].path).toBe('/orders?add=custom_order')
    expect(byId['create:customer'].path).toBe('/users/customers?add=1')
    expect(byId['create:promotion'].path).toBe('/marketing/promotions-enterprise?view=advanced_offers&add=1')
    expect(byId['create:quick-offer-first_order'].path).toBe('/marketing/promotions-enterprise?view=journeys&template=first_order')
    expect(byId['create:gift_cards_setup'].path).toBe('/gift-cards?setup=1')
    expect(rankCommandEntries(entries, 'crear cliente')[0].id).toBe('create:customer')
    expect(rankCommandEntries(entries, 'envio gratis')[0].id).toBe('create:quick-offer-free_delivery')
  })

  it('follows the rules of each Add button', () => {
    const admin = ids(buildOpenActionEntries({ user: { level: 0 }, configs: {} }))
    expect(admin).toEqual(expect.arrayContaining([
      'create:quick-offer-loyalty_reward',
      'create:professional',
      'create:gift_cards_setup'
    ]))

    const readOnly = ids(buildOpenActionEntries({ user: { level: 0, readOnlyAdmin: true }, configs: {} }))
    expect(readOnly).not.toContain('create:custom_order')
    expect(readOnly).not.toContain('create:customer')

    const owner = ids(buildOpenActionEntries({ user: { level: 2 }, configs: {} }))
    expect(owner.filter(id => id.startsWith('create:'))).toEqual([])

    const driverManager = ids(buildOpenActionEntries({ user: { level: 5 }, configs: {} }))
    expect(driverManager).toEqual(expect.arrayContaining(['create:driver', 'create:driver_group']))
    expect(driverManager).not.toContain('create:custom_order')
  })

  it('returns nothing without access', () => {
    expect(buildCreateActionEntries()).toEqual([])
  })
})
