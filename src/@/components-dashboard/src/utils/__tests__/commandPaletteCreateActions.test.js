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
    expect(byId['create:whatsapp_bot'].path).toBe('/connect/whatsapp-bots?add=1')
    expect(rankCommandEntries(entries, 'crear cliente')[0].id).toBe('create:customer')
    expect(rankCommandEntries(entries, 'envio gratis')[0].id).toBe('create:quick-offer-free_delivery')
  })

  // redesign CA-B1: the entry says what the page's button says, and the old words still find it
  it('create:callcenter_agent says «Add call center agent» and opens the agents\' add sheet', () => {
    const entries = buildOpenActionEntries({ user: { level: 0 }, configs: {} })
    const agent = entries.find(entry => entry.id === 'create:callcenter_agent')
    expect(agent).toMatchObject({ title: 'Add call center agent', path: '/users/callcenter-agents?add=1' })
    expect(rankCommandEntries(entries, 'crear agente')[0].id).toBe('create:callcenter_agent')
    expect(rankCommandEntries(entries, 'add call center agent')[0].id).toBe('create:callcenter_agent')
  })

  // redesign AD-B1: the same for admins; «add user», the old label, still finds it
  it('create:admin says «Add admin» and opens the admins\' add sheet', () => {
    const entries = buildOpenActionEntries({ user: { level: 0 }, configs: {} })
    const admin = entries.find(entry => entry.id === 'create:admin')
    expect(admin).toMatchObject({ title: 'Add admin', path: '/users/admins?add=1' })
    expect(rankCommandEntries(entries, 'crear administrador')[0].id).toBe('create:admin')
    expect(rankCommandEntries(entries, 'add admin')[0].id).toBe('create:admin')
  })

  it('follows the rules of each Add button', () => {
    const admin = ids(buildOpenActionEntries({ user: { level: 0 }, configs: {} }))
    expect(admin).toEqual(expect.arrayContaining([
      'create:quick-offer-loyalty_reward',
      'create:professional',
      'create:gift_cards_setup',
      'create:whatsapp_bot'
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
