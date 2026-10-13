import { describe, expect, it } from 'vitest'

import {
  BUSINESS_CONFIG_SECTIONS,
  getBusinessConfigSections
} from '../businessConfigSections'

const pedidosyaToken = { id: 3500, key: 'pedidosya_integration_api_token', rank: null }
const pedidosyaSandbox = { id: 3502, key: 'pedidosya_integration_sandbox_mode', rank: null }
const pedidosyaCash = { id: 3504, key: 'pedidosya_integration_accept_cash_orders', rank: 2 }
const walletCash = { id: 653, key: 'wallet_cash_enabled', rank: 124 }
const llamafoodBranch = { id: 3437, key: 'llamafood_delivery_integration_branch_id', rank: null }

describe('BUSINESS_CONFIG_SECTIONS', () => {
  it('registers PedidosYa as the first section with a key prefix', () => {
    expect(BUSINESS_CONFIG_SECTIONS[0]).toMatchObject({
      key: 'pedidosya',
      prefix: 'pedidosya_integration_'
    })
  })
})

describe('getBusinessConfigSections', () => {
  it('groups configs into the registered section by key prefix', () => {
    const sections = getBusinessConfigSections([walletCash, pedidosyaToken, pedidosyaSandbox])

    expect(sections).toHaveLength(1)
    expect(sections[0].key).toBe('pedidosya')
    expect(sections[0].configs.map(config => config.key)).toEqual([
      'pedidosya_integration_api_token',
      'pedidosya_integration_sandbox_mode'
    ])
  })

  it('drops sections that have no configs for this business', () => {
    expect(getBusinessConfigSections([walletCash, llamafoodBranch])).toEqual([])
  })

  it('orders configs inside a section by rank, then by id when rank is missing', () => {
    const sections = getBusinessConfigSections([pedidosyaSandbox, pedidosyaCash, pedidosyaToken])

    expect(sections[0].configs.map(config => config.id)).toEqual([3504, 3500, 3502])
  })

  it('returns an empty list when configs are missing', () => {
    expect(getBusinessConfigSections()).toEqual([])
    expect(getBusinessConfigSections(null)).toEqual([])
  })

  it('accepts a custom registry so new integrations only add an entry', () => {
    const registry = [
      { key: 'llamafood', prefix: 'llamafood_delivery_integration_', labelKey: 'LLAMAFOOD', label: 'Llamafood' },
      ...BUSINESS_CONFIG_SECTIONS
    ]

    const sections = getBusinessConfigSections([pedidosyaToken, llamafoodBranch], registry)

    expect(sections.map(section => section.key)).toEqual(['llamafood', 'pedidosya'])
    expect(sections[0]).toMatchObject({ labelKey: 'LLAMAFOOD', label: 'Llamafood' })
  })
})
