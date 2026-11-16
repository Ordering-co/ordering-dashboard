// redesign GC-B (| D2, D3, GC-04, GC-16): the pure reading of a gift card row.
import { describe, expect, it } from 'vitest'

import {
  firstErrorMessage,
  hasError,
  hasRedeemData,
  isDeletedPerson,
  lastPageOf,
  orderIdOf,
  orderPath,
  pageSizeOptions,
  personContact,
  personName,
  personPhoto,
  recipientOf,
  statusOf
} from '../giftCardData'

describe('personName', () => {
  it('joins name and last name', () => {
    expect(personName({ name: 'Ana', lastname: 'Pérez' })).toBe('Ana Pérez')
  })

  it('keeps whichever of the two exists, trimmed', () => {
    expect(personName({ name: '  Ana ', lastname: null })).toBe('Ana')
    expect(personName({ name: '', lastname: 'Pérez' })).toBe('Pérez')
  })

  it('is empty for nobody (a card with no author or no redeemer)', () => {
    expect(personName(null)).toBe('')
    expect(personName(undefined)).toBe('')
    expect(personName({})).toBe('')
  })
})

describe('personContact', () => {
  it('is the phone when there is one, as main shows it (audit F4)', () => {
    expect(personContact({ cellphone: '555 0101', email: 'ana@example.com' })).toBe('555 0101')
  })

  it('is the email when there is no phone', () => {
    expect(personContact({ cellphone: null, email: 'ana@example.com' })).toBe('ana@example.com')
    expect(personContact({ cellphone: '  ', email: 'ana@example.com' })).toBe('ana@example.com')
  })

  it('is empty when there is neither', () => {
    expect(personContact({ cellphone: null, email: null })).toBe('')
    expect(personContact(null)).toBe('')
  })
})

// (T10): the API leaves a deleted user's phone as «7443172700_deleted_SzbeHbPZkk»; the suffix is never shown
describe('isDeletedPerson and personContact of a deleted user', () => {
  const gone = { name: 'Ana', cellphone: '7443172700_deleted_SzbeHbPZkk', email: 'ana@example.com' }

  it('isDeletedPerson is true when the phone or the email carries «_deleted_»', () => {
    expect(isDeletedPerson(gone)).toBe(true)
    expect(isDeletedPerson({ cellphone: null, email: 'ana_deleted_Abc123@example.com' })).toBe(true)
    expect(isDeletedPerson({ cellphone: '555 0101', email: 'ana@example.com' })).toBe(false)
    expect(isDeletedPerson({ cellphone: null, email: null })).toBe(false)
    expect(isDeletedPerson(null)).toBe(false)
  })

  it('personContact returns the phone without everything from «_deleted_» on', () => {
    expect(personContact(gone)).toBe('7443172700')
  })

  it('personContact falls to the clean email when nothing is left of the phone, and to empty when nothing is left at all', () => {
    expect(personContact({ cellphone: '_deleted_Abc', email: 'ana@example.com' })).toBe('ana@example.com')
    expect(personContact({ cellphone: '_deleted_Abc', email: '_deleted_Xyz' })).toBe('')
  })

  it('personContact cleans a deleted email too', () => {
    expect(personContact({ cellphone: null, email: 'ana@example.com_deleted_Abc123' })).toBe('ana@example.com')
  })
})

describe('personPhoto (GC-04)', () => {
  it('is the photo only when there is one, so the avatar draws initials otherwise', () => {
    expect(personPhoto({ photo: 'https://example.com/a.png' })).toBe('https://example.com/a.png')
    expect(personPhoto({ photo: null })).toBeUndefined()
    expect(personPhoto({ photo: '' })).toBeUndefined()
    expect(personPhoto(null)).toBeUndefined()
  })
})

describe('recipientOf', () => {
  it('reads the name and the email the buyer typed', () => {
    expect(recipientOf({ user_name: ' Bruno ', user_email: 'bruno@example.com' })).toEqual({ name: 'Bruno', email: 'bruno@example.com' })
  })

  it('may have only one of them, or none', () => {
    expect(recipientOf({ user_name: null, user_email: 'bruno@example.com' })).toEqual({ name: '', email: 'bruno@example.com' })
    expect(recipientOf({})).toEqual({ name: '', email: '' })
  })
})

describe('statusOf', () => {
  it('maps the three statuses of the API to a family', () => {
    expect(statusOf({ status: 'pending' })).toMatchObject({ family: 'pending', kind: 'pending' })
    expect(statusOf({ status: 'sent' })).toMatchObject({ family: 'progress', kind: 'sent' })
    expect(statusOf({ status: 'activated' })).toMatchObject({ family: 'done', kind: 'activated' })
  })

  it('draws any other value as pending with its own text, never throws (audit F5)', () => {
    expect(statusOf({ status: 'expired' })).toEqual({ family: 'pending', kind: 'other', raw: 'expired' })
    expect(statusOf({ status: null })).toEqual({ family: 'pending', kind: 'other', raw: '' })
    expect(statusOf({})).toEqual({ family: 'pending', kind: 'other', raw: '' })
  })

  it('does not read a property of Object.prototype as a status', () => {
    expect(statusOf({ status: 'constructor' })).toMatchObject({ kind: 'other', raw: 'constructor' })
  })
})

describe('orderIdOf and orderPath', () => {
  it('is the id of the order the card was bought in', () => {
    expect(orderIdOf({ order_product: { order_id: 1234 } })).toBe(1234)
    expect(orderIdOf({ order_product: { order_id: '1234' } })).toBe(1234)
  })

  it('is null when the card has no order: order_product comes null', () => {
    expect(orderIdOf({ order_product: null })).toBeNull()
    expect(orderIdOf({ order_product: {} })).toBeNull()
    expect(orderIdOf({})).toBeNull()
    expect(orderIdOf({ order_product: { order_id: 0 } })).toBeNull()
    expect(orderIdOf({ order_product: { order_id: 'abc' } })).toBeNull()
  })

  it('opens that order on the orders page', () => {
    expect(orderPath(1234)).toBe('/orders?id=1234')
  })
})

describe('hasRedeemData (D3, audit F3)', () => {
  it('is true when some row has a redeemer or a redeem date', () => {
    expect(hasRedeemData([{ id: 1 }, { id: 2, activater: { id: 9 } }])).toBe(true)
    expect(hasRedeemData([{ id: 1, activated_at: '2026-10-01 12:00:00' }])).toBe(true)
  })

  it('is false when none has: «no data» in a page is a sample, but then there is nothing to draw', () => {
    expect(hasRedeemData([{ id: 1, activater: null, activated_at: null }, { id: 2, activated_at: '' }])).toBe(false)
    expect(hasRedeemData([])).toBe(false)
    expect(hasRedeemData()).toBe(false)
  })
})

describe('lastPageOf (GC-16)', () => {
  it('is the last page the total allows', () => {
    expect(lastPageOf(43, 10)).toBe(5)
    expect(lastPageOf(40, 10)).toBe(4)
    expect(lastPageOf(1, 50)).toBe(1)
  })

  it('is 1 when the total or the size is not usable', () => {
    expect(lastPageOf(0, 10)).toBe(1)
    expect(lastPageOf(null, 10)).toBe(1)
    expect(lastPageOf(43, 0)).toBe(1)
    expect(lastPageOf(43, undefined)).toBe(1)
  })
})

describe('pageSizeOptions', () => {
  it('offers 10, 25 and 50', () => {
    expect(pageSizeOptions(10)).toEqual([10, 25, 50])
  })

  it('adds the size of the URL when it is not among them, in order', () => {
    expect(pageSizeOptions(30)).toEqual([10, 25, 30, 50])
    expect(pageSizeOptions(100)).toEqual([10, 25, 50, 100])
  })

  it('ignores a size that is not a positive whole number', () => {
    expect(pageSizeOptions(undefined)).toEqual([10, 25, 50])
    expect(pageSizeOptions(0)).toEqual([10, 25, 50])
    expect(pageSizeOptions(12.5)).toEqual([10, 25, 50])
  })
})

describe('errors of the controller', () => {
  it('hasError: a non-empty list or a string', () => {
    expect(hasError(['Internal error'])).toBe(true)
    expect(hasError('Internal error')).toBe(true)
    expect(hasError([])).toBe(false)
    expect(hasError(null)).toBe(false)
  })

  it('firstErrorMessage: the first message with text, from a string, a list or a { message }', () => {
    expect(firstErrorMessage(['Internal error', 'Other'])).toBe('Internal error')
    expect(firstErrorMessage('Internal error')).toBe('Internal error')
    expect(firstErrorMessage([{ message: 'Bad' }])).toBe('Bad')
    expect(firstErrorMessage([])).toBeUndefined()
    expect(firstErrorMessage(null)).toBeUndefined()
  })
})
