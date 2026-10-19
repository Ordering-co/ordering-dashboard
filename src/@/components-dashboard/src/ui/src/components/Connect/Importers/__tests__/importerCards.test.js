import { describe, expect, it } from 'vitest'
import { IMPORTER_CARDS, validateOrderingForm } from '../importerCards'

describe('importerCards', () => {
  it('defines all four menu importer sources', () => {
    expect(IMPORTER_CARDS.map((card) => card.id)).toEqual([
      'doordash',
      'ubereats',
      'gloriafood',
      'ordering'
    ])
  })

  it('flags GloriaFood as the only source with image migration note', () => {
    const withNote = IMPORTER_CARDS.filter((card) => card.showImagesNote)
    expect(withNote).toHaveLength(1)
    expect(withNote[0].id).toBe('gloriafood')
  })

  it('uses a custom modal for GloriaFood and modal config for the others', () => {
    const gloriafoodCard = IMPORTER_CARDS.find((card) => card.id === 'gloriafood')
    expect(gloriafoodCard.usesCustomModal).toBe(true)
    expect(gloriafoodCard.modalConfig).toBeUndefined()

    IMPORTER_CARDS.filter((card) => card.id !== 'gloriafood').forEach((card) => {
      expect(card.modalConfig?.validateForm).toBeTypeOf('function')
      expect(card.modalConfig?.buildImportParams).toBeTypeOf('function')
    })
  })

  it('uses neutral Ordering.co placeholder examples', () => {
    const orderingCard = IMPORTER_CARDS.find((card) => card.id === 'ordering')
    const { modalConfig } = orderingCard

    expect(modalConfig.orderingProjectPlaceholderDefault).toBe('e.g. yourproject')
    expect(modalConfig.orderingBusinessSegmentPlaceholderDefault).toBe('e.g. yourstore')
    expect(modalConfig.urlPlaceholderDefault).not.toMatch(/finitless/i)
  })
})

const orderingUrl = (hostAndPort, segment = 'shop1') =>
  `https://${hostAndPort}/v400/en/demo/business/${segment}`

describe('validateOrderingForm host allowlist', () => {
  it('accepts the Ordering API hosts', () => {
    expect(validateOrderingForm({ url: orderingUrl('api.orderingplus.com') }).valid).toBe(true)
    expect(validateOrderingForm({ url: orderingUrl('apiv4.ordering.co') }).valid).toBe(true)
    expect(validateOrderingForm({ url: orderingUrl('API.ORDERINGPLUS.COM') }).valid).toBe(true)
  })

  it('accepts the host of the current project API root', () => {
    const result = validateOrderingForm(
      { url: orderingUrl('stores.customer.com') },
      { projectApiRoot: 'https://stores.customer.com/v400/en/demo' }
    )
    expect(result.valid).toBe(true)
  })

  it.each([
    ['https://denied-api.example.com/v400/en/demo/business/1'],
    ['https://db:443/v400/en/demo/business/1'],
    ['https://127.0.0.1:22/v400/en/x/business/y'],
    ['https://www.example.com/v400/en/x/business/y'],
    ['http://localhost/v400/en/demo/business/1'],
    ['https://api.orderingplus.com:8443/v400/en/demo/business/1']
  ])('rejects %s', (url) => {
    expect(validateOrderingForm({ url })).toEqual({
      valid: false,
      error: 'IMPORTER_VALIDATION_ORDERING_HOST_NOT_ALLOWED'
    })
  })

  it('still accepts project and store without a url', () => {
    expect(validateOrderingForm({
      url: '',
      orderingPlusProjectId: 'demo',
      orderingBusinessSegment: 'shop1'
    }).valid).toBe(true)
  })
})
