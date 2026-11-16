import { describe, expect, it } from 'vitest'

import {
  PRODUCT_DETAILS_TABS,
  PRODUCT_SECTION_QUERY_KEYS,
  buildProductSections,
  entryFromUrl,
  entryToQuery,
  parseEntryId,
  toEntryId
} from '../productSections'

// redesign SP-F1 (D1)
const t = (_key, fallback) => fallback

describe('productSections · the list', () => {
  it('lists a product: Overview, the five tabs of Product details in their order, then Ingredients, Options, Images and Video', () => {
    const sections = buildProductSections({ isService: false }, t)
    expect(sections.map(({ id }) => id)).toEqual([
      'overview',
      'product_details:information',
      'product_details:advanced',
      'product_details:labels',
      'product_details:categories',
      'product_details:seo_options',
      'ingredients',
      'product_options',
      'product_images',
      'product_video'
    ])
    expect(sections.map(({ label }) => label)).toEqual([
      'Overview', 'Information', 'Advanced', 'Labels', 'Categories', 'SEO Options',
      'Ingredients / Properties', 'Product options', 'Product images', 'Product video'
    ])
  })

  it('groups the five tabs under «Product details» and nothing else', () => {
    const sections = buildProductSections({ isService: false }, t)
    expect(sections.filter(({ group }) => group === 'Product details').map(({ id }) => id)).toEqual(
      PRODUCT_DETAILS_TABS.map(tab => `product_details:${tab}`)
    )
    expect(sections.filter(({ group }) => group == null).map(({ id }) => id)).toEqual(
      ['overview', 'ingredients', 'product_options', 'product_images', 'product_video']
    )
  })

  it('lists a service as ProductSummary did: Service details, Professionals, Product options and Product images', () => {
    expect(buildProductSections({ isService: true }, t).map(({ id }) => id)).toEqual([
      'overview', 'service_details', 'professionals', 'product_options', 'product_images'
    ])
  })

  it('does not list Custom fields or Personalization (they are reached from the ⋯ menu or the address)', () => {
    for (const isService of [false, true]) {
      const ids = buildProductSections({ isService }, t).map(({ id }) => id)
      expect(ids).not.toContain('custom_fields')
      expect(ids).not.toContain('personalization')
    }
  })

  it('has one id per entry', () => {
    for (const isService of [false, true]) {
      const ids = buildProductSections({ isService }, t).map(({ id }) => id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})

describe('productSections · the address', () => {
  it('clears the keys of main (ProductDetails:61-66)', () => {
    expect(PRODUCT_SECTION_QUERY_KEYS).toEqual(['section', 'tab', 'tag', 'ingredient', 'extra'])
  })

  it.each([
    ['product_details', 'advanced', 'product_details:advanced'],
    ['product_details', 'information', 'product_details:information'],
    ['ingredients', undefined, 'ingredients'],
    ['ingredients', 'advanced', 'ingredients'], // a stale tab belongs to no other section
    ['custom_fields', null, 'custom_fields'],
    ['personalization', '', 'personalization']
  ])('?section=%s&tab=%s is the entry %s', (section, tab, entry) => {
    expect(entryFromUrl(section, tab)).toBe(entry)
  })

  it('Product details without a tab, or with one that is not a tab, is Information', () => {
    expect(entryFromUrl('product_details', null)).toBe('product_details:information')
    expect(entryFromUrl('product_details', 'nope')).toBe('product_details:information')
  })

  it('no section is no entry', () => {
    expect(entryFromUrl(null, 'advanced')).toBeNull()
    expect(entryFromUrl('', null)).toBeNull()
  })

  it('an entry goes back to the address that opens it', () => {
    expect(entryToQuery('product_details:labels')).toEqual({ section: 'product_details', tab: 'labels' })
    expect(entryToQuery('ingredients')).toEqual({ section: 'ingredients' })
    expect(entryToQuery('custom_fields')).toEqual({ section: 'custom_fields' })
  })

  it('parses and builds the same entry', () => {
    for (const tab of PRODUCT_DETAILS_TABS) {
      const entry = toEntryId('product_details', tab)
      expect(parseEntryId(entry)).toEqual({ section: 'product_details', tab })
    }
    expect(parseEntryId('product_options')).toEqual({ section: 'product_options', tab: undefined })
    expect(parseEntryId(null)).toEqual({ section: null, tab: undefined })
  })
})
