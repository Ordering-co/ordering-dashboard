/* eslint-disable import/first */
// redesign (lot A): the project mode of the markup detail, for the /stores/markups page. With `businessField` the form has
// the Business select («all» is the default and is sent as null, as `main` does), the bar counts a change of business and there is no
// «Business is required». `guardScope` says which close guard the leave guard uses. Without the new props the detail is the one of
// before (the store editor does not pass them). The Business select is the real P/SelectField; the detail is mounted alone, as the table is.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const probe = vi.hoisted(() => ({ guards: [], registerCloseGuard: null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))
// The close guard of the surrounding piece is a spy, and the leave guard is seen through (it still runs): what it was given is what matters
vi.mock('../../../Shared/Product', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useSectionSplit: () => ({ ...actual.useSectionSplit(), registerCloseGuard: probe.registerCloseGuard }),
    useLeaveGuard: (args) => {
      probe.guards.push(args)
      return actual.useLeaveGuard(args)
    }
  }
})

import { MarkupDetail, markupToForm, buildMarkupPayload } from '../MarkupDetail'

const SITES = [{ value: 'all', content: 'All sites' }]
const DELIVERY = [{ value: 'all', content: 'All delivery types' }]
const TYPES = [{ value: 'percentage', content: '%' }, { value: 'fixed', content: 'Fixed' }]
const BUSINESS_OPTIONS = [{ value: 'all', content: 'All businesses' }, { value: 12, content: 'Burger Place' }]
const STORED = { id: 31, name: 'Stored', business_id: 12, site_id: null, delivery_type: null, enabled: true, rounding_values: [], rules: { products: { markup_type: 'percentage', markup_value: 10 }, suboptions: { markup_type: 'percentage', markup_value: 10 } } }
const GLOBAL_STORED = { ...STORED, id: 32, name: 'For every business', business_id: null }

const businessField = (extra = {}) => ({
  options: BUSINESS_OPTIONS,
  searchValue: '',
  onSearchChange: vi.fn(),
  pagination: { currentPage: 1, pageSize: 10, totalPages: 1, totalItems: 2 },
  onChangePage: vi.fn(),
  loading: false,
  ...extra
})

const spies = { create: null, update: null }
const renderDetail = (props = {}) => render(
  <MarkupDetail
    markup={null}
    businessId={undefined}
    deliveryTypeOptions={DELIVERY}
    markupTypeOptions={TYPES}
    siteOptions={SITES}
    createMarkup={spies.create}
    updateMarkup={spies.update}
    onToggleEnabled={async () => ({ ok: true })}
    onSaved={() => {}}
    onCreated={() => {}}
    onClose={() => {}}
    {...props}
  />
)

// the Business select: a combobox named by its label and the chosen text; its listbox opens in the overlay host
const businessCombo = () => screen.getByRole('combobox', { name: (name) => name.startsWith('Business') })
const chooseBusiness = async (user, option) => {
  await user.click(businessCombo())
  const list = await screen.findByRole('listbox', { name: 'Business', hidden: true })
  await user.click(within(list).getByRole('option', { name: option, hidden: true }))
}
const saveBar = () => screen.getByRole('group', { name: 'Save changes' })
const fillNew = async (user) => {
  await user.type(screen.getByRole('textbox', { name: /Name/ }), 'Happy hour')
  await user.type(screen.getByRole('textbox', { name: 'Products markup value' }), '5')
}

afterEach(() => document.getElementById('app-modals')?.remove())

beforeEach(() => {
  probe.guards = []
  probe.registerCloseGuard = vi.fn(() => () => {})
  spies.create = vi.fn(async (payload) => ({ error: false, result: { id: 99, ...payload } }))
  spies.update = vi.fn(async (id, payload) => ({ error: false, result: { id, ...payload } }))
})

describe('MarkupDetail · the form and the payload as pure functions', () => {
  it('without the option, the business is the one of the store: the number of businessId', () => {
    expect(markupToForm(null, 7).business_id).toBe(7)
    expect(markupToForm(STORED, 7).business_id).toBe(7)
    expect(markupToForm({ ...STORED, business_id: null }, '7').business_id).toBe(7)
  })

  it('without the option, the payload carries the number of businessId', () => {
    const form = markupToForm(STORED, 7)
    expect(buildMarkupPayload(form, 7).business_id).toBe(7)
    expect(buildMarkupPayload({ ...form, business_id: 'all' }, 7).business_id).toBe(7)
  })

  it('with anyBusiness, a new markup is for «all» and a stored one keeps its business (null is «all»)', () => {
    const option = { anyBusiness: true }
    expect(markupToForm(null, undefined, option).business_id).toBe('all')
    expect(markupToForm(STORED, undefined, option).business_id).toBe(12)
    expect(markupToForm({ ...STORED, business_id: null }, undefined, option).business_id).toBe('all')
    expect(markupToForm({ ...STORED, business_id: undefined }, undefined, option).business_id).toBe('all')
  })

  it('with anyBusiness, «all» and an empty business are null and any other value goes as it is', () => {
    const option = { anyBusiness: true }
    const form = markupToForm(STORED, undefined, option)
    expect(buildMarkupPayload({ ...form, business_id: 'all' }, undefined, option).business_id).toBeNull()
    expect(buildMarkupPayload({ ...form, business_id: '' }, undefined, option).business_id).toBeNull()
    expect(buildMarkupPayload({ ...form, business_id: 12 }, undefined, option).business_id).toBe(12)
    expect(buildMarkupPayload({ ...form, business_id: '12' }, undefined, option).business_id).toBe('12')
  })
})

describe('MarkupDetail · project mode (businessField)', () => {
  it('shows the Business select, starting on «all», and says nothing of the business without businessField', () => {
    const { unmount } = renderDetail({ businessField: businessField() })
    expect(businessCombo()).toHaveAccessibleName('Business All businesses')
    unmount()
    renderDetail({ businessId: 7 })
    expect(screen.queryByRole('combobox', { name: (name) => name.startsWith('Business') })).toBeNull()
  })

  it('creates with the business that was chosen', async () => {
    const user = userEvent.setup()
    renderDetail({ businessField: businessField() })
    await fillNew(user)
    await chooseBusiness(user, 'Burger Place')
    await user.click(within(saveBar()).getByRole('button', { name: 'Create markup' }))
    await waitFor(() => expect(spies.create).toHaveBeenCalledTimes(1))
    expect(spies.create.mock.calls[0][0]).toMatchObject({ name: 'Happy hour', business_id: 12 })
    expect(spies.create.mock.calls[0][1]).toEqual({ inlineError: true })
  })

  it('creates for every business with business_id null and does not ask for a business', async () => {
    const user = userEvent.setup()
    renderDetail({ businessField: businessField() })
    await fillNew(user)
    await user.click(within(saveBar()).getByRole('button', { name: 'Create markup' }))
    await waitFor(() => expect(spies.create).toHaveBeenCalledTimes(1))
    expect(spies.create.mock.calls[0][0].business_id).toBeNull()
    expect(screen.queryByText('Business is required')).toBeNull()
  })

  it('counts the change of business in the bar, named «Business»', async () => {
    const user = userEvent.setup()
    renderDetail({ businessField: businessField() })
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
    await chooseBusiness(user, 'Burger Place')
    expect(saveBar()).toHaveTextContent('1 unsaved change')
    expect(saveBar()).toHaveTextContent('Business')
    await chooseBusiness(user, 'All businesses')
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
  })

  it('lists the business before the other changes, right after the name', async () => {
    const user = userEvent.setup()
    renderDetail({ businessField: businessField() })
    await user.type(screen.getByRole('textbox', { name: 'Products markup value' }), '5')
    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'Happy hour')
    await chooseBusiness(user, 'Burger Place')
    const text = saveBar().textContent
    expect(text).toContain('3 unsaved changes')
    expect(text.indexOf('Name')).toBeLessThan(text.indexOf('Business'))
    expect(text.indexOf('Business')).toBeLessThan(text.indexOf('Products markup value'))
  })

  it('compares the business as text: a stored 12 and a chosen "12" are the same', async () => {
    const user = userEvent.setup()
    const field = businessField({ options: [{ value: 'all', content: 'All businesses' }, { value: '12', content: 'Burger Place' }] })
    renderDetail({ markup: { ...STORED, business_id: 12 }, businessField: field })
    expect(businessCombo()).toBeDisabled() // locked once it exists, so this is the pure comparison
    expect(businessCombo()).toHaveAccessibleName('Business Burger Place') // the stored 12 finds the option '12'
    await user.type(screen.getByRole('textbox', { name: /Name/ }), '!')
    expect(saveBar()).toHaveTextContent('1 unsaved change')
  })

  it('edits a markup of every business with the selector locked, and saves it with business_id null', async () => {
    const user = userEvent.setup()
    renderDetail({ markup: GLOBAL_STORED, businessField: businessField() })
    expect(businessCombo()).toHaveAccessibleName('Business All businesses')
    expect(businessCombo()).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: /Name/ }), '!')
    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(spies.update).toHaveBeenCalledTimes(1))
    expect(spies.update.mock.calls[0][0]).toBe(32)
    expect(spies.update.mock.calls[0][1]).toMatchObject({ name: 'For every business!', business_id: null })
  })

  it('edits a markup of one business and keeps that business', async () => {
    const user = userEvent.setup()
    renderDetail({ markup: STORED, businessField: businessField() })
    expect(businessCombo()).toHaveAccessibleName('Business Burger Place')
    await user.type(screen.getByRole('textbox', { name: /Name/ }), '!')
    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(spies.update).toHaveBeenCalledTimes(1))
    expect(spies.update.mock.calls[0][1]).toMatchObject({ business_id: 12 })
  })
})

describe('MarkupDetail · without businessField (the store editor)', () => {
  it('creates for the store with its id and still asks for a business when there is none', async () => {
    const user = userEvent.setup()
    renderDetail({ businessId: 7 })
    await fillNew(user)
    await user.click(within(saveBar()).getByRole('button', { name: 'Create markup' }))
    await waitFor(() => expect(spies.create).toHaveBeenCalledTimes(1))
    expect(spies.create.mock.calls[0][0].business_id).toBe(7)
  })

  it('says «Business is required» and does not write when there is no business', async () => {
    const user = userEvent.setup()
    renderDetail({ businessId: undefined })
    await fillNew(user)
    await user.click(within(saveBar()).getByRole('button', { name: 'Create markup' }))
    expect(await within(saveBar()).findByRole('alert')).toHaveTextContent('Business is required')
    expect(spies.create).not.toHaveBeenCalled()
  })
})

describe('MarkupDetail · the close guard (guardScope)', () => {
  it('uses the close guard of the section split by default', () => {
    renderDetail({ businessId: 7 })
    expect(probe.guards.at(-1).registerCloseGuard).toBe(probe.registerCloseGuard)
    expect(probe.registerCloseGuard).toHaveBeenCalled()
  })

  it('uses the close guard of the section split with guardScope «section»', () => {
    renderDetail({ businessId: 7, guardScope: 'section' })
    expect(probe.guards.at(-1).registerCloseGuard).toBe(probe.registerCloseGuard)
  })

  it('leaves the close guard to the surrounding split view with guardScope «page»', () => {
    renderDetail({ businessId: 7, guardScope: 'page' })
    expect(probe.guards.at(-1).registerCloseGuard).toBeUndefined()
    expect(probe.registerCloseGuard).not.toHaveBeenCalled()
  })
})
