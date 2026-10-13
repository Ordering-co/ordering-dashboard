import { describe, expect, it } from 'vitest'
import {
  buildBackofficeBusinessSearchUrl,
  buildBusinessDetailPath,
  buildBusinessSearchWhere,
  rankBusinessResults,
  shouldUseBackofficeBusinessSearch
} from '../commandPaletteBusinesses'

describe('buildBusinessSearchWhere', () => {
  it('searches name and slug, plus the exact id for numbers', () => {
    const where = buildBusinessSearchWhere('42')
    expect(where.conector).toBe('OR')
    expect(where.conditions.map(condition => condition.attribute)).toEqual(['name', 'slug', 'id'])
    expect(where.conditions[2].value).toBe(42)
  })

  it('does not send an id bigger than the API holds (a phone number)', () => {
    const ids = (query) => buildBusinessSearchWhere(query).conditions.filter(condition => condition.attribute === 'id')
    expect(ids('2147483647')).toEqual([{ attribute: 'id', value: 2147483647 }])
    expect(ids('7372101502')).toEqual([])
    expect(ids('0')).toEqual([])
  })

  it('encodes characters the SDK would not', () => {
    const where = buildBusinessSearchWhere('Ben & Jerry')
    expect(where.conditions[0].value).toEqual({ condition: 'ilike', value: '%25Ben%20%26%20Jerry%25' })
    expect(where.conditions).toHaveLength(2)
  })

  it('returns null for an empty query', () => {
    expect(buildBusinessSearchWhere('  ')).toBeNull()
  })
})

describe('rankBusinessResults', () => {
  const rows = [
    { id: 7, name: 'Pizza Planet', enabled: true },
    { id: 12, name: 'The pizza', enabled: '0' },
    { id: 3, name: 'pizza', enabled: 1 },
    { name: 'no id' },
    { id: 9, name: '12 Burgers', enabled: false }
  ]

  it('orders exact id, exact name and prefix first', () => {
    expect(rankBusinessResults(rows, 'pizza').map(row => row.id)).toEqual([3, 7, 12, 9])
    expect(rankBusinessResults(rows, '12')[0].id).toBe(12)
  })

  it('keeps a minimal projection with a boolean enabled', () => {
    const [first] = rankBusinessResults(rows, 'pizza')
    expect(first).toEqual({ id: 3, name: 'pizza', slug: '', address: '', logo: null, enabled: true })
    expect(rankBusinessResults(rows, 'pizza').find(row => row.id === 12).enabled).toBe(false)
  })

  it('applies the limit and tolerates bad input', () => {
    expect(rankBusinessResults(rows, '', 2)).toHaveLength(2)
    expect(rankBusinessResults(null, 'x')).toEqual([])
  })
})

describe('store action paths', () => {
  it('builds detail, tab, products and Connect paths', async () => {
    const { buildPaletteStorePath } = await import('../businessDetailSections')
    const store = { id: 7, slug: 'fast bite' }
    expect(buildPaletteStorePath({ section: 'menu', tab: 'shared_menus' }, store)).toBe('/stores/list?id=7&section=menu&tab=shared_menus')
    expect(buildPaletteStorePath({}, store)).toBe('/stores/list?id=7')
    expect(buildPaletteStorePath({ target: 'products' }, store)).toBe('/stores/products/fast%20bite')
    expect(buildPaletteStorePath({ target: 'products' }, { id: 7 })).toBe('/stores/list?id=7')
    expect(buildPaletteStorePath({ target: 'pos_menu' }, store)).toBe('/connect/pos-menu?id=7')
    expect(buildPaletteStorePath({ target: 'sales_channels' }, store)).toBe('/connect/sales-channels?id=7')
  })
})

describe('business paths', () => {
  it('opens the detail through the Stores list flow', () => {
    expect(buildBusinessDetailPath(5)).toBe('/stores/list?id=5')
    expect(buildBusinessDetailPath(5, { section: 'schedule', tab: '' })).toBe('/stores/list?id=5&section=schedule')
  })

  it('uses the backoffice endpoint only for Eatstreet admins', () => {
    expect(shouldUseBackofficeBusinessSearch({ project: 'eatstreet', level: 0 })).toBe(true)
    expect(shouldUseBackofficeBusinessSearch({ project: 'eatstreet', level: 2 })).toBe(false)
    expect(shouldUseBackofficeBusinessSearch({ project: 'demo', level: 0 })).toBe(false)
    const url = buildBackofficeBusinessSearchUrl('https://api.test/v400/en/eatstreet', 'taco')
    expect(url).toContain('/backoffice/businesses?params=id,name,slug,enabled,logo&page=1&page_size=8&where=')
    expect(buildBackofficeBusinessSearchUrl('https://api.test', '')).not.toContain('where=')
  })
})
