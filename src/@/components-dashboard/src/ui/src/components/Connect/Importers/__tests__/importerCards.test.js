import { describe, expect, it } from 'vitest'
import { IMPORTER_CARDS } from '../importerCards'

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
