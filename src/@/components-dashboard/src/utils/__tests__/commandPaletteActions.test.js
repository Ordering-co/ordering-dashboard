import { describe, expect, it } from 'vitest'
import { buildOpenActionEntries } from '../commandPaletteActions'
import { getPaletteBusinessSections, isBusinessSectionEnabled } from '../businessDetailSections'

const ids = (entries) => entries.map(entry => entry.id)

describe('buildOpenActionEntries', () => {
  it('gives the admin panels on pages they can open', () => {
    const entries = buildOpenActionEntries({ user: { level: 0 }, configs: {} })
    expect(ids(entries)).toEqual(expect.arrayContaining([
      'action:orders-pending',
      'action:settings-apiKeys',
      'action:settings-mcpTokens',
      'action:banner-web_home_page',
      'action:report-14',
      'action:invoice-business',
      'action:reviews-business',
      'action:business-schedule'
    ]))
    const webhooks = entries.find(entry => entry.id === 'action:settings-webhooks')
    expect(webhooks.path).toBe('/settings?group=developers&category=developers&id=webhooks')
  })

  it('asks for a store before opening a store section', () => {
    const schedule = buildOpenActionEntries({ user: { level: 0 }, configs: {} })
      .find(entry => entry.id === 'action:business-schedule')
    expect(schedule.requires).toBe('business')
    expect(schedule.section).toBe('schedule')
    expect(schedule.path).toBeUndefined()
  })

  it('opens the store detail for Connect clover without starting the connection', () => {
    const admin = buildOpenActionEntries({ user: { level: 0 }, configs: {} })
    const clover = admin.find(entry => entry.id === 'action:business-connect_clover')
    expect(clover.requires).toBe('business')
    expect(clover.section).toBeUndefined()
    const owner = buildOpenActionEntries({ user: { level: 2 }, configs: {} })
    expect(owner.map(entry => entry.id)).not.toContain('action:business-connect_clover')
  })

  it('offers store tabs, the products page and Connect panels after choosing a store', () => {
    const entries = buildOpenActionEntries({ user: { level: 0 }, configs: {} })
    const byId = Object.fromEntries(entries.map(entry => [entry.id, entry]))
    expect(byId['action:business-store_details:seo_options']).toMatchObject({ section: 'store_details', tab: 'seo_options', title: 'Store details › SEO Options' })
    expect(byId['action:business-products_page']).toMatchObject({ target: 'products', section: undefined })
    expect(byId['action:business-pos_menu']).toMatchObject({ target: 'pos_menu' })
    expect(byId['action:stores-sync-deliverect'].path).toBe('/stores/list?header=sync&tab=deliverect')
    expect(byId['action:stores-add'].path).toBe('/stores/add')
  })

  it('applies tab rules for EatStreet owners and store registration', () => {
    const owner = buildOpenActionEntries({ user: { level: 2 }, configs: { allow_business_owner_register_business: { value: '0' } }, project: 'eatstreet' })
    const ids = owner.map(entry => entry.id)
    expect(ids).not.toContain('action:business-store_details:agents')
    expect(ids).not.toContain('action:business-store_details:owner')
    expect(ids).not.toContain('action:business-ordering_channels:custom_slug')
    expect(ids).not.toContain('action:stores-add')
    expect(ids).not.toContain('action:business-store_sales_channels')
    expect(ids).toContain('action:business-pos_menu')
  })

  it('limits business owners to their own surfaces', () => {
    const entries = buildOpenActionEntries({ user: { level: 2 }, configs: {} })
    expect(ids(entries)).toContain('action:business-schedule')
    expect(ids(entries)).not.toContain('action:business-business_fees')
    expect(ids(entries)).not.toContain('action:settings-apiKeys')
    expect(ids(entries)).not.toContain('action:report-14')
  })

  it('offers nothing to read-only admins outside orders', () => {
    const entries = buildOpenActionEntries({ user: { level: 0, readOnlyAdmin: true }, configs: {} })
    expect(ids(entries).every(id => id.startsWith('action:orders-'))).toBe(true)
  })
})

describe('business detail sections', () => {
  it('mirrors the store menu rules', () => {
    expect(isBusinessSectionEnabled('publishing', { isAdmin: false })).toBe(false)
    expect(isBusinessSectionEnabled('publishing', { isAdmin: true })).toBe(true)
    expect(isBusinessSectionEnabled('webhooks', { isAdmin: false, project: 'eatstreet' })).toBe(false)
    expect(isBusinessSectionEnabled('schedule', { isSelectedAccessRole: true })).toBe(false)
    expect(isBusinessSectionEnabled('payment_methods', { isSelectedAccessRole: true })).toBe(true)
    expect(isBusinessSectionEnabled('sales_channels', { configs: { white_label_module: { value: true } } })).toBe(false)
    expect(isBusinessSectionEnabled('spoonity_key', { hasSpoonity: true })).toBe(true)
    expect(isBusinessSectionEnabled('spoonity_key', {})).toBe(false)
  })

  it('shows preorders without an addon flag and custom fields when metafields are on', () => {
    const keys = (configs) => getPaletteBusinessSections({ user: { level: 0 }, configs }).map(section => section.key)
    expect(keys({})).toContain('preorder')
    expect(keys({ show_metafields: { value: '1' } })).toEqual(expect.arrayContaining(['preorder', 'custom_fields']))
  })

  it('keeps selected-access owners to delivery and payments', () => {
    const keys = getPaletteBusinessSections({ user: { level: 2, selected_access: true } }).map(section => section.key)
    expect(keys.every(key => /^(delivery_pickup_more|payment_methods)(:|$)/.test(key))).toBe(true)
    expect(keys).toEqual(expect.arrayContaining(['delivery_pickup_more', 'payment_methods', 'delivery_pickup_more:pickup']))
  })
})
