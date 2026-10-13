import { describe, expect, it } from 'vitest'
import {
  buildOrderSearchUrl,
  buildOrderSearchWhere,
  buildUserSearchUrl,
  buildUserSearchWhere,
  canSearchOrders,
  classifyRecordQuery,
  canSearchOrderQuery,
  getSearchableUserLevels,
  toOrderItems,
  toUserItems
} from '../commandPaletteRecords'

const decode = (where) => JSON.parse(decodeURIComponent(JSON.stringify(where)))
const ilikeValue = (term) => ({ condition: 'ilike', value: `%${term}%` })

describe('classifyRecordQuery', () => {
  it('reads ids, phones, emails and names', () => {
    expect(classifyRecordQuery('  ')).toBeNull()
    expect(classifyRecordQuery('1234')).toMatchObject({ kind: 'number', digits: '1234', id: 1234 })
    // Long plain numbers read as phones first; too big to be an id
    expect(classifyRecordQuery('737210150')).toMatchObject({ kind: 'phone', id: 737210150 })
    expect(classifyRecordQuery('7372101502')).toMatchObject({ kind: 'phone', id: null })
    expect(classifyRecordQuery('+52 (55) 1234-5678')).toMatchObject({ kind: 'phone', digits: '525512345678' })
    expect(classifyRecordQuery('ana@test.com')).toMatchObject({ kind: 'email' })
    expect(classifyRecordQuery('Ana  López Ruiz')).toMatchObject({ kind: 'text', first: 'Ana', rest: 'López Ruiz' })
  })
})

describe('buildOrderSearchWhere', () => {
  it('matches a number as the order id and the end of the customer phone', () => {
    expect(decode(buildOrderSearchWhere('10234'))).toEqual({
      conditions: [
        { attribute: 'id', value: 10234 },
        { attribute: 'customer', conditions: [{ attribute: 'cellphone', value: ilikeValue('10234') }] }
      ],
      conector: 'OR'
    })
  })

  it('searches a name in the customer and the store, with first and last name together', () => {
    const where = decode(buildOrderSearchWhere('Ana López'))
    expect(where.conector).toBe('OR')
    expect(where.conditions).toContainEqual({ attribute: 'customer', conditions: [{ attribute: 'name', value: ilikeValue('Ana López') }] })
    expect(where.conditions).toContainEqual({
      attribute: 'customer',
      conditions: [{ attribute: 'name', value: ilikeValue('Ana') }, { attribute: 'lastname', value: ilikeValue('López') }]
    })
    expect(where.conditions).toContainEqual({ attribute: 'business', conditions: [{ attribute: 'name', value: ilikeValue('Ana López') }] })
  })

  it('matches a formatted phone by its national digits, and never sends it as an id', () => {
    expect(decode(buildOrderSearchWhere('+52 55 1234 5678')).conditions).toEqual([
      { attribute: 'customer', conditions: [{ attribute: 'cellphone', value: ilikeValue('5512345678') }] }
    ])
    expect(decode(buildOrderSearchWhere('7372101502')).conditions).toEqual([
      { attribute: 'customer', conditions: [{ attribute: 'cellphone', value: ilikeValue('7372101502') }] }
    ])
  })

  it('in safe mode looks up the exact order number only', () => {
    const safe = { extended: false }
    expect(buildOrderSearchWhere('10797708', safe)).toEqual({ conditions: [{ attribute: 'id', value: 10797708 }], conector: 'AND' })
    expect(buildOrderSearchWhere('Ana López', safe)).toBeNull()
    expect(buildOrderSearchWhere('ana@test.com', safe)).toBeNull()
    expect(buildOrderSearchWhere('7372101502', safe)).toBeNull()
    expect(canSearchOrderQuery('Ana', safe)).toBe(false)
    expect(canSearchOrderQuery('Ana')).toBe(true)
  })
})

describe('buildUserSearchWhere', () => {
  it('searches by phone, limited to the levels the person can open', () => {
    expect(decode(buildUserSearchWhere('55 1234', [3, 4]))).toEqual({
      conditions: [
        { attribute: 'level', value: [3, 4] },
        { conditions: [{ attribute: 'cellphone', value: ilikeValue('551234') }], conector: 'OR' }
      ],
      conector: 'AND'
    })
  })

  it('matches a number as the user id and the phone', () => {
    const anyOf = buildUserSearchWhere('98765', [3]).conditions[1].conditions
    expect(anyOf[0]).toEqual({ attribute: 'id', value: 98765 })
    expect(decode(anyOf[1])).toEqual({ attribute: 'cellphone', value: ilikeValue('98765') })
  })

  it('searches name, last name and email for text', () => {
    const anyOf = decode(buildUserSearchWhere('maria', [3])).conditions[1].conditions
    expect(anyOf.map(condition => condition.attribute)).toEqual(['name', 'lastname', 'email'])
  })

  it('does not search without levels', () => {
    expect(buildUserSearchWhere('maria', [])).toBeNull()
  })

  it('needs three characters in both modes (trigram indexes)', () => {
    expect(buildUserSearchWhere('an', [3])).toBeNull()
    expect(buildUserSearchWhere('an', [3], { extended: false })).toBeNull()
    expect(buildUserSearchWhere('ana', [3])).not.toBeNull()
    // Safe mode keeps every user field
    expect(decode(buildUserSearchWhere('ana', [3], { extended: false })).conditions[1].conditions.map(condition => condition.attribute)).toEqual(['name', 'lastname', 'email'])
    // A short number is still an exact id
    expect(buildUserSearchWhere('42', [3], { extended: false }).conditions[1].conditions).toEqual([{ attribute: 'id', value: 42 }])
  })

  it('keeps exact email and phone matching available in safe mode', () => {
    expect(decode(buildUserSearchWhere('ana@test.com', [3], { extended: false })).conditions[1].conditions)
      .toContainEqual({ attribute: 'email', value: ilikeValue('ana@test.com') })
    expect(decode(buildUserSearchWhere('+52 55 1234 5678', [3], { extended: false })).conditions[1].conditions)
      .toContainEqual({ attribute: 'cellphone', value: ilikeValue('5512345678') })
  })
})

describe('search URLs', () => {
  it('uses the dashboard list contracts with a small projection', () => {
    const root = 'https://api.test/v400/en/demo'
    expect(buildOrderSearchUrl(root, '15')).toContain('/orders?page=1&page_size=5&params=id,status,created_at,customer,business&mode=dashboard&orderBy=-id&where=')
    expect(buildUserSearchUrl(root, 'ana', [3])).toContain('/users?page=1&page_size=5&params=id,name,lastname,email,cellphone,country_phone_code,level,photo,enabled&orderBy=-id&where=')
    // Safe mode sends no orderBy: with a filter, ORDER BY id DESC LIMIT may walk the whole primary key
    expect(buildOrderSearchUrl(root, '15', { extended: false })).not.toContain('orderBy')
    expect(buildUserSearchUrl(root, 'ana', [3], { extended: false })).not.toContain('orderBy')
  })
})

describe('access', () => {
  it('searches orders for admins and store owners who can open Orders', () => {
    expect(canSearchOrders({ level: 0, canOpenOrders: true })).toBe(true)
    expect(canSearchOrders({ level: 2, canOpenOrders: true })).toBe(true)
    expect(canSearchOrders({ level: 5, canOpenOrders: true })).toBe(false)
    expect(canSearchOrders({ level: 0, canOpenOrders: false })).toBe(false)
  })

  it('searches only the user types whose listing the admin can open', () => {
    const can = (url) => url !== '/users/professionals'
    expect(getSearchableUserLevels({ level: 0, can })).toEqual([0, 2, 3, 4, 5, 9])
    expect(getSearchableUserLevels({ level: 2, can: () => true })).toEqual([])
  })
})

describe('result items', () => {
  it('puts the exact order id first and opens the order detail', () => {
    const items = toOrderItems([
      { id: 123456, status: 0, customer: { name: 'Ana', lastname: 'Ruiz' }, business: { name: 'Pizza Uno' } },
      { id: 1234, status: 1, customer: { name: 'Leo' }, business: { name: 'Taco Dos' } }
    ], '1234', { statusLabel: (status) => ['Pending', 'Completed'][status] })
    expect(items.map(item => item.id)).toEqual(['order:1234', 'order:123456'])
    expect(items[0]).toMatchObject({ title: 'Order #1234', subtitle: 'Leo · Taco Dos · Completed', path: '/orders?id=1234', group: 'orders' })
  })

  it('opens each user type in its own listing and shows the phone', () => {
    const items = toUserItems([
      { id: 7, name: 'Ana', lastname: 'Ruiz', email: 'ana@test.com', cellphone: '5512345678', country_phone_code: '52', level: 3, enabled: true },
      { id: 8, name: 'Beto', level: 4, enabled: false },
      { id: 9, name: 'Caro', level: 8 }
    ], 'a', { levels: [3, 4] })
    expect(items.map(item => item.path)).toEqual(['/users/customers?id=7', '/delivery/drivers-list?id=8'])
    expect(items[0].subtitle).toBe('Customer · ana@test.com · +52 5512345678')
    expect(items[1].badge).toBe('Inactive')
  })
})
