// redesign UC-B4 (decision 1, auditor #3): the sections of the customer panel and the map from main's deep links.
import { describe, expect, it } from 'vitest'

import { customerSectionIds, fromLegacyQuery } from '../customerSections'

const CASH = { addon_cash_wallet_and_refunds: { value: '1' } }
const POINTS = { addon_points_and_levels: { value: '1' } }

describe('customerSectionIds', () => {
  // main: the wallet section does not depend on the cash or points add-on
  it('without add-ons or the Schools module: the wallet stays, no school students', () => {
    expect(customerSectionIds({ configs: {}, isSchoolsOn: false })).toEqual(['overview', 'orders', 'wallet', 'addresses', 'profile', 'push_tokens'])
  })

  it('an add-on whose value is falsy keeps the wallet too', () => {
    expect(customerSectionIds({ configs: { addon_cash_wallet_and_refunds: { value: '' }, addon_points_and_levels: { value: 0 } }, isSchoolsOn: false })).toContain('wallet')
  })

  it('the Schools module adds school students at the end', () => {
    const ids = customerSectionIds({ configs: { ...CASH, ...POINTS }, isSchoolsOn: true })
    expect(ids).toEqual(['overview', 'orders', 'wallet', 'addresses', 'profile', 'push_tokens', 'school_students'])
  })

  it('reads missing arguments as no Schools module', () => {
    expect(customerSectionIds()).toEqual(['overview', 'orders', 'wallet', 'addresses', 'profile', 'push_tokens'])
  })
})

describe('fromLegacyQuery (analysis §8: main links to the new sections)', () => {
  const to = (section, extra = {}) => ({ section, wallet: null, customFields: false, ...extra })

  it.each([
    [{ section: 'user_details' }, to('profile')],
    [{ section: 'user_details', tab: 'profile' }, to('profile')],
    [{ section: 'user_details', tab: 'saved_places' }, to('addresses')],
    [{ section: 'user_details', tab: 'orders' }, to('orders')],
    [{ section: 'user_details', tab: 'push_tokens' }, to('push_tokens')],
    [{ section: 'user_details', tab: 'school_students' }, to('school_students')],
    [{ section: 'user_details', tab: 'something_else' }, to('profile')],
    [{ section: 'cash_wallet' }, to('wallet', { wallet: 'cash' })],
    [{ section: 'cash_wallet', tab: 'cash_wallet' }, to('wallet', { wallet: 'cash' })],
    [{ section: 'cash_wallet', tab: 'history' }, to('wallet', { wallet: 'cash' })],
    [{ section: 'points_wallet' }, to('wallet', { wallet: 'points' })],
    [{ section: 'points_wallet', tab: 'history' }, to('wallet', { wallet: 'points' })],
    [{ section: 'metafields' }, to('overview', { customFields: true })]
  ])('%j', (query, expected) => {
    expect(fromLegacyQuery(query)).toEqual(expected)
  })

  it.each(['overview', 'orders', 'wallet', 'addresses', 'profile', 'push_tokens', 'school_students'])('the new id %s passes through', (id) => {
    expect(fromLegacyQuery({ section: id })).toEqual(to(id))
    expect(fromLegacyQuery({ section: id, tab: 'profile' })).toEqual(to(id))
  })

  it.each([undefined, null, '', 'nope', 'businesses_opened'])('unknown section %j goes to the overview', (section) => {
    expect(fromLegacyQuery({ section })).toEqual(to('overview'))
  })

  it('no query at all is the overview', () => {
    expect(fromLegacyQuery()).toEqual(to('overview'))
    expect(fromLegacyQuery({})).toEqual(to('overview'))
  })
})
