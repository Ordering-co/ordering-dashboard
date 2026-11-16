/* eslint-disable import/first */
// redesign stores 5.13 (E3a): the markup form on Product pieces, shared by the /stores/markups route (SideBar), the
// business markups modal and the Business markups section (SectionSplit).
// Covered: no console.log while rendering (G5-38); the header (title, P/AsyncSwitch «Enabled» that answers an empty result as OK
// and goes back on `{ error: true }`, S-8); `hideHeader` / `hideActions` / `disabled` / `showNameError`; site and delivery type
// locked when editing with the reason under them (S-11); the five rounding values as checkboxes (S-9); the % and Fixed values with
// their error under the field (S-10, G4-19); the props of before keep their meaning; `markupValueError` as a table.
// Business, Site and Delivery type are the real P/SelectField: a combobox that opens a listbox in the overlay host.
// `formState` keeps strings, as the two consumers validate them.
import fs from 'node:fs'
import path from 'node:path'
import React, { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))
import { MarkupForm, markupValueError } from '../index'

const t = (_key, fallback) => fallback
const LOCKED_HINT = "Can't be changed after creating. Create a new markup to apply it elsewhere."

const BASE_STATE = {
  name: '',
  enabled: true,
  business_id: 'all',
  site_id: 'all',
  delivery_type: 'all',
  rounding_values: [],
  products_markup_type: 'percentage',
  products_markup_value: '',
  apply_to_suboptions: true,
  apply_same_value: true,
  suboptions_markup_type: 'percentage',
  suboptions_markup_value: ''
}

const deliveryTypeOptions = [
  { value: 'all', content: 'All delivery types' },
  { value: 'delivery', content: 'Delivery' },
  { value: 'pickup', content: 'Pickup' }
]
const sitesOptions = [
  { value: 'all', content: 'All sites' },
  { value: 4, content: 'Main site' }
]
const businessOptions = [
  { value: 'all', content: 'All businesses' },
  { value: 12, content: 'Burger Place' }
]
const roundingOptions = [0, 0.25, 0.5, 0.75, 0.99].map(value => ({ value, content: <div>{value.toFixed(2)}</div> }))
const markupTypeOptions = [
  { value: 'percentage', content: '%' },
  { value: 'fixed', content: 'Fixed' }
]

const probe = { state: null }

// The form inside a holder that keeps `formState` like the consumers do (a useState of strings)
const Holder = ({ initial, ...rest }) => {
  const [formState, setFormState] = useState({ ...BASE_STATE, ...initial })
  probe.state = formState
  return (
    <MarkupForm
      t={t}
      formState={formState}
      setFormState={setFormState}
      filteredBusinessOptions={businessOptions}
      filteredSitesOptions={sitesOptions}
      deliveryTypeOptions={deliveryTypeOptions}
      roundingOptions={roundingOptions}
      markupTypeOptions={markupTypeOptions}
      businessSearchValue=''
      setBusinessSearchValue={() => {}}
      sitesSearchValue=''
      setSitesSearchValue={() => {}}
      {...rest}
    />
  )
}

const renderForm = (props = {}) => render(<Holder {...props} />)
// the one place that knows how the Business, Site and Delivery type selects are handled
const comboOf = (label) => screen.getByRole('combobox', { name: (name) => name.startsWith(label) })
const openList = async (user, label) => {
  await user.click(comboOf(label))
  return screen.findByRole('listbox', { name: label, hidden: true })
}
const choose = async (user, label, option) => {
  const list = await openList(user, label)
  await user.click(within(list).getByRole('option', { name: option, hidden: true }))
}
const editProps = (extra = {}) => ({ isEdit: true, markupId: 7, initial: { name: 'Summer', enabled: true }, ...extra })

afterEach(() => document.getElementById('app-modals')?.remove())

beforeEach(() => {
  probe.state = null
  vi.restoreAllMocks()
})

describe('MarkupForm · the pure helper markupValueError', () => {
  it.each([
    // [type, value, expected]
    ['percentage', '', undefined],
    ['percentage', '0', undefined],
    ['percentage', '12', undefined],
    ['percentage', '999', undefined],
    ['percentage', '1000', 'Enter a number from 0 to 999.'],
    // P4: the API takes decimal percentages (`numeric|min:0`), so 2.5 % is valid
    ['percentage', '12.5', undefined],
    ['percentage', '2.25', undefined],
    ['percentage', '999.99', undefined],
    ['percentage', '1000.5', 'Enter a number from 0 to 999.'],
    ['percentage', '1.', 'Enter a number from 0 to 999.'],
    ['percentage', '-3', 'Enter a number from 0 to 999.'],
    ['percentage', 'abc', 'Enter a number from 0 to 999.'],
    ['percentage', ' 7 ', undefined],
    ['fixed', '', undefined],
    ['fixed', '0', undefined],
    ['fixed', '2.5', undefined],
    ['fixed', '1000.75', undefined],
    ['fixed', '-0.5', 'Enter an amount of 0 or more.'],
    ['fixed', 'abc', 'Enter an amount of 0 or more.'],
    [undefined, '5', undefined]
  ])('%s %j → %j', (type, value, expected) => {
    expect(markupValueError(type, value, t)).toBe(expected)
  })

  it('reads the messages through t with their keys', () => {
    const keys = []
    const spy = (key, fallback) => { keys.push(key); return fallback }
    markupValueError('percentage', '1000', spy)
    markupValueError('fixed', '-1', spy)
    expect(keys).toEqual(['MARKUP_PERCENT_0_999', 'ENTER_AMOUNT_0_OR_MORE'])
  })
})

describe('MarkupForm · render', () => {
  it('does not log the pagination while rendering (G5-38)', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    renderForm({ businessPagination: { currentPage: 1, pageSize: 10, totalPages: 3, totalItems: 25 } })
    expect(log).not.toHaveBeenCalled()
  })

  it('is a Product root and has no styled-components wrapper of the old form', () => {
    const { container } = renderForm()
    expect(container.firstChild).toHaveClass('odc-root', 'odc-mf')
  })

  it('names a new markup «Create markup» and an edited one by its name, as before', () => {
    const { unmount } = renderForm()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Create markup')
    unmount()
    renderForm(editProps({ initial: { name: '' } }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Edit markup')
    expect(screen.getByRole('switch', { name: 'Enabled' })).toBeInTheDocument()
  })

  it('shows the name of the markup as the title once it has one', () => {
    renderForm(editProps())
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Summer')
  })

  // jsdom paints no CSS, so the rule is read from the stylesheet: inside the legacy SideBar the close button is absolute (20px from the
  // end, as tall and wide as the touch target), and the header must neither reach it nor push «Enabled» under it.
  it('keeps «Enabled» beside the title and clear of the close button of the SideBar', () => {
    const { container } = renderForm(editProps())
    const header = container.querySelector('.odc-mf-header')
    const title = within(header).getByRole('heading', { level: 1 })
    expect(header.firstElementChild).toBe(title)
    expect(title.nextElementSibling).toContainElement(within(header).getByRole('switch', { name: 'Enabled' }))
    const css = fs.readFileSync(path.resolve(process.cwd(), 'src/@/components-dashboard/src/ui/src/components/Stores/MarkupForm/markup-form.css'), 'utf8')
    const rule = (selector) => css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
    const headerRule = rule('.odc-mf-header')
    // the switch follows the title on the start side (as in main) instead of going to the far end, under the X
    expect(headerRule).toMatch(/justify-content:\s*flex-start/)
    expect(headerRule).not.toMatch(/space-between/)
    // the end margin is the touch target of the close button plus a gap, not a fixed token that falls 8px short
    expect(headerRule).toMatch(/padding-inline-end:\s*calc\(var\(--od-sidebar-touch-target[^)]*\)[^;]*\+\s*var\(--od-space-3\)\)/)
    expect(rule('.odc-mf-title')).toMatch(/flex:\s*0 1 auto/)
  })

  it('has no Enabled switch for a new markup', () => {
    renderForm()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('edits the name in a labelled field with a 100 character limit', async () => {
    const user = userEvent.setup()
    renderForm()
    const field = screen.getByRole('textbox', { name: /^Name/ })
    expect(field).toHaveAttribute('maxlength', '100')
    await user.type(field, 'Happy hour')
    expect(probe.state.name).toBe('Happy hour')
  })
})

describe('MarkupForm · Enabled (S-8)', () => {
  it('saves at once and an empty answer counts as OK: it stays moved and the form follows', async () => {
    const user = userEvent.setup()
    const onUpdateEnabled = vi.fn(() => undefined) // the route returns nothing
    renderForm(editProps({ onUpdateEnabled }))
    const toggle = screen.getByRole('switch', { name: 'Enabled' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    await user.click(toggle)
    expect(onUpdateEnabled).toHaveBeenCalledWith(7, false)
    await waitFor(() => expect(probe.state.enabled).toBe(false))
    expect(screen.getByRole('switch', { name: 'Enabled' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('counts an answer without `error` as OK too', async () => {
    const user = userEvent.setup()
    const onUpdateEnabled = vi.fn(async () => ({ error: false, result: { id: 7 } }))
    renderForm(editProps({ onUpdateEnabled }))
    await user.click(screen.getByRole('switch', { name: 'Enabled' }))
    await waitFor(() => expect(probe.state.enabled).toBe(false))
  })

  it('goes back and says so when the answer is `{ error: true }`', async () => {
    const user = userEvent.setup()
    const onUpdateEnabled = vi.fn(async () => ({ error: true, result: [] }))
    renderForm(editProps({ onUpdateEnabled }))
    await user.click(screen.getByRole('switch', { name: 'Enabled' }))
    expect(onUpdateEnabled).toHaveBeenCalledWith(7, false)
    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent("We couldn't change this markup.")
    expect(probe.state.enabled).toBe(true)
    expect(screen.getByRole('switch', { name: 'Enabled' })).toHaveAttribute('aria-checked', 'true')
  })

  it('goes back when the save throws', async () => {
    const user = userEvent.setup()
    const onUpdateEnabled = vi.fn(async () => { throw new Error('offline') })
    renderForm(editProps({ onUpdateEnabled }))
    await user.click(screen.getByRole('switch', { name: 'Enabled' }))
    await screen.findByRole('alert')
    expect(probe.state.enabled).toBe(true)
  })

  it('only moves the form when nothing saves it (no handler), as before', async () => {
    const user = userEvent.setup()
    renderForm(editProps())
    await user.click(screen.getByRole('switch', { name: 'Enabled' }))
    await waitFor(() => expect(probe.state.enabled).toBe(false))
  })
})

describe('MarkupForm · what the host can turn off', () => {
  it('hideHeader paints neither the title nor the switch', () => {
    renderForm(editProps({ hideHeader: true }))
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('hideActions paints no Save button; by default there is one that calls handleSubmit', async () => {
    const user = userEvent.setup()
    const handleSubmit = vi.fn()
    const { unmount } = renderForm({ handleSubmit })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(handleSubmit).toHaveBeenCalledTimes(1)
    unmount()
    renderForm({ handleSubmit, hideActions: true })
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('says «Saving» and blocks the button while actionLoading', () => {
    renderForm({ actionLoading: true })
    const button = screen.getByRole('button', { name: 'Saving' })
    expect(button).toBeDisabled()
  })

  it('disabled turns off every field while it saves', () => {
    renderForm({ disabled: true, initial: { apply_same_value: false } })
    expect(screen.getByRole('textbox', { name: /^Name/ })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Products markup value' })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Suboptions markup value' })).toBeDisabled()
    screen.getAllByRole('checkbox').forEach(box => expect(box).toBeDisabled())
    ;['Products markup type', 'Suboptions markup type'].forEach(label => {
      within(screen.getByRole('group', { name: label })).getAllByRole('button').forEach(button => expect(button).toBeDisabled())
    })
    ;['Business', 'Site', 'Delivery type'].forEach(label => expect(comboOf(label)).toBeDisabled())
  })

  it('enabled by default', () => {
    renderForm()
    expect(screen.getByRole('textbox', { name: /^Name/ })).toBeEnabled()
    screen.getAllByRole('checkbox').forEach(box => expect(box).toBeEnabled())
  })

  it('showNameError says «Name is required» under an empty name, and only then', () => {
    const { unmount } = renderForm()
    expect(screen.queryByText('Name is required')).toBeNull()
    unmount()
    const second = renderForm({ showNameError: true })
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveAttribute('aria-invalid', 'true')
    second.unmount()
    renderForm({ showNameError: true, initial: { name: 'Filled' } })
    expect(screen.queryByText('Name is required')).toBeNull()
  })
})

describe('MarkupForm · Business, Site and Delivery type', () => {
  it('shows a labelled Business select only for the route, and reports the business chosen', async () => {
    const user = userEvent.setup()
    const { unmount } = renderForm()
    expect(comboOf('Business')).toHaveAccessibleName('Business All businesses')
    await choose(user, 'Business', 'Burger Place')
    expect(probe.state.business_id).toBe(12)
    expect(comboOf('Business')).toHaveAccessibleName('Business Burger Place')
    unmount()
    renderForm({ isShowBusinessSelect: false })
    expect(screen.queryByRole('combobox', { name: (name) => name.startsWith('Business') })).toBeNull()
  })

  it('searches the Business list through the host (remote): it tells setBusinessSearchValue and does not filter by itself', async () => {
    const user = userEvent.setup()
    const setBusinessSearchValue = vi.fn()
    renderForm({ setBusinessSearchValue, businessSearchValue: 'zzz' })
    const list = await openList(user, 'Business')
    const search = screen.getByRole('searchbox', { name: 'Search Business', hidden: true })
    expect(search).toHaveValue('zzz')
    expect(within(list).getAllByRole('option', { hidden: true })).toHaveLength(2)
    await user.type(search, 'b')
    // the search tells the host after a pause without typing (searchDelay), not on each key
    await waitFor(() => expect(setBusinessSearchValue).toHaveBeenLastCalledWith('zzzb'), { timeout: 2000 })
  })

  // redesign (review 1): a business picked from one page or search keeps its name when the list shows another one
  it('keeps the name of the picked business in the trigger when the list no longer holds it', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Holder />)
    await choose(user, 'Business', 'Burger Place')
    await waitFor(() => expect(comboOf('Business')).toHaveAccessibleName('Business Burger Place'))
    rerender(<Holder filteredBusinessOptions={[{ value: 'all', content: 'All businesses' }, { value: 31, content: 'Pasta House' }]} />)
    expect(comboOf('Business')).toHaveAccessibleName('Business Burger Place')
    expect(probe.state.business_id).toBe(12)
  })

  // redesign (review 3): the next markup does not open on the last one's business search
  it('empties the host\'s business search when the form goes away', () => {
    const setBusinessSearchValue = vi.fn()
    const { unmount } = renderForm({ setBusinessSearchValue, businessSearchValue: 'pa' })
    expect(setBusinessSearchValue).not.toHaveBeenCalled()
    unmount()
    expect(setBusinessSearchValue).toHaveBeenCalledWith('')
  })

  it('pages the Business list in the foot of the list, only with more than one page', async () => {
    const user = userEvent.setup()
    const handleChangeBusinessPage = vi.fn()
    const { unmount } = renderForm({
      businessPagination: { currentPage: 1, pageSize: 10, totalPages: 2, totalItems: 15 },
      handleChangeBusinessPage
    })
    await openList(user, 'Business')
    const nav = screen.getByRole('navigation', { name: 'Pagination', hidden: true })
    expect(nav).toHaveTextContent('Showing 1–10 of 15')
    await user.click(within(nav).getByRole('button', { name: 'Next page', hidden: true }))
    expect(handleChangeBusinessPage).toHaveBeenCalledWith(2)
    unmount()
    document.getElementById('app-modals')?.remove()
    renderForm({ businessPagination: { currentPage: 1, pageSize: 10, totalPages: 1, totalItems: 3 }, handleChangeBusinessPage })
    await openList(user, 'Business')
    expect(screen.queryByRole('navigation', { name: 'Pagination', hidden: true })).toBeNull()
  })

  it('marks the Business list busy while it loads and keeps its pager from moving', async () => {
    const user = userEvent.setup()
    const handleChangeBusinessPage = vi.fn()
    renderForm({
      businessPagination: { currentPage: 1, pageSize: 10, totalPages: 2, totalItems: 15 },
      handleChangeBusinessPage,
      businessesLoading: true
    })
    const list = await openList(user, 'Business')
    expect(list).toHaveAttribute('aria-busy', 'true')
    await user.click(within(screen.getByRole('navigation', { name: 'Pagination', hidden: true })).getByRole('button', { name: 'Next page', hidden: true }))
    expect(handleChangeBusinessPage).not.toHaveBeenCalled()
  })

  it('site and delivery type are labelled selects that report their value in formState', async () => {
    const user = userEvent.setup()
    renderForm()
    await choose(user, 'Site', 'Main site')
    expect(probe.state.site_id).toBe(4)
    await choose(user, 'Delivery type', 'Pickup')
    expect(probe.state.delivery_type).toBe('pickup')
    expect(screen.queryByText(LOCKED_HINT)).toBeNull()
  })

  // lote B: the form hands its host the whole formState on Save (the hosts turn it into the API body), pinned whatever the select is
  it('hands the host the formState with the business and site as numbers and the delivery type as text', async () => {
    const user = userEvent.setup()
    let submitted = null
    const handleSubmit = vi.fn(() => { submitted = JSON.parse(JSON.stringify(probe.state)) })
    renderForm({ handleSubmit, initial: { name: 'Payload markup', products_markup_value: '10' } })
    await choose(user, 'Business', 'Burger Place')
    await choose(user, 'Site', 'Main site')
    await choose(user, 'Delivery type', 'Pickup')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(handleSubmit).toHaveBeenCalledTimes(1)
    expect(submitted).toEqual({
      name: 'Payload markup',
      enabled: true,
      business_id: 12,
      site_id: 4,
      delivery_type: 'pickup',
      rounding_values: [],
      products_markup_type: 'percentage',
      products_markup_value: '10',
      apply_to_suboptions: true,
      apply_same_value: true,
      suboptions_markup_type: 'percentage',
      suboptions_markup_value: ''
    })
    expect(typeof submitted.business_id).toBe('number')
    expect(typeof submitted.site_id).toBe('number')
  })

  it('keeps \'all\' in the formState for the three selects put back to «All …»', async () => {
    const user = userEvent.setup()
    let submitted = null
    const handleSubmit = vi.fn(() => { submitted = JSON.parse(JSON.stringify(probe.state)) })
    renderForm({ handleSubmit, initial: { name: 'Back to all' } })
    await choose(user, 'Business', 'Burger Place')
    await choose(user, 'Business', 'All businesses')
    await choose(user, 'Site', 'Main site')
    await choose(user, 'Site', 'All sites')
    await choose(user, 'Delivery type', 'Delivery')
    await choose(user, 'Delivery type', 'All delivery types')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(submitted).toEqual({
      name: 'Back to all',
      enabled: true,
      business_id: 'all',
      site_id: 'all',
      delivery_type: 'all',
      rounding_values: [],
      products_markup_type: 'percentage',
      products_markup_value: '',
      apply_to_suboptions: true,
      apply_same_value: true,
      suboptions_markup_type: 'percentage',
      suboptions_markup_value: ''
    })
  })

  it('editing locks business, site and delivery type and says why under each (S-11, G4-19)', () => {
    renderForm(editProps())
    ;['Business', 'Site', 'Delivery type'].forEach(label => {
      const combo = comboOf(label)
      expect(combo).toBeDisabled()
      // redesign stores 5.18 (m7 of 5.13): the lock hint describes each disabled control
      expect(combo).toHaveAccessibleDescription(LOCKED_HINT)
    })
    expect(screen.getAllByText(LOCKED_HINT)).toHaveLength(3)
  })

  it('without the Business select the lock is on the two that remain', () => {
    renderForm(editProps({ isShowBusinessSelect: false }))
    expect(screen.getAllByText(LOCKED_HINT)).toHaveLength(2)
  })
})

describe('MarkupForm · Rounding values (S-9)', () => {
  it('draws one checkbox per option in a fieldset with its legend and its line', () => {
    renderForm({ initial: { rounding_values: [0.25, '0.99'] } })
    const group = screen.getByRole('group', { name: 'Rounding values' })
    expect(group.tagName).toBe('FIELDSET')
    const boxes = within(group).getAllByRole('checkbox')
    expect(boxes.map(box => box.textContent)).toEqual(['0.00', '0.25', '0.50', '0.75', '0.99'])
    expect(boxes.map(box => box.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false', 'false', 'true'])
    expect(within(group).getByText('Prices are rounded up to end in these cents.')).toBeInTheDocument()
  })

  it('each box calls handleToggleRounding with the option value', async () => {
    const user = userEvent.setup()
    const handleToggleRounding = vi.fn()
    renderForm({ handleToggleRounding })
    const group = screen.getByRole('group', { name: 'Rounding values' })
    await user.click(within(group).getByRole('checkbox', { name: '0.25' }))
    await user.click(within(group).getByRole('checkbox', { name: '0.99' }))
    await user.click(within(group).getByRole('checkbox', { name: '0.00' }))
    expect(handleToggleRounding.mock.calls.map(call => call[0])).toEqual([0.25, 0.99, 0])
  })
})

describe('MarkupForm · Rules (S-10, G4-19)', () => {
  const productsValue = () => screen.getByRole('textbox', { name: 'Products markup value' })

  it('says a % above 999 under the field, in its own words', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.type(productsValue(), '1200')
    expect(probe.state.products_markup_value).toBe('1200')
    expect(screen.getByText('Enter a number from 0 to 999.')).toBeInTheDocument()
    expect(productsValue()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText('Invalid products markup value')).toBeNull()
  })

  it('takes a decimal %, as the API does (P4)', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.type(productsValue(), '2.5')
    expect(probe.state.products_markup_value).toBe('2.5')
    expect(screen.queryByText('Enter a number from 0 to 999.')).toBeNull()
    expect(productsValue()).not.toHaveAttribute('aria-invalid', 'true')
    expect(productsValue()).toHaveAttribute('inputmode', 'decimal')
  })

  it('says 1000 too, and nothing for 999', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.type(productsValue(), '1000')
    expect(screen.getByText('Enter a number from 0 to 999.')).toBeInTheDocument()
    await user.clear(productsValue())
    await user.type(productsValue(), '999')
    expect(probe.state.products_markup_value).toBe('999')
    expect(screen.queryByText('Enter a number from 0 to 999.')).toBeNull()
  })

  it('keeps the value as a string and an empty field as \'\'', async () => {
    const user = userEvent.setup()
    renderForm({ initial: { products_markup_value: '15' } })
    expect(productsValue()).toHaveValue('15')
    await user.clear(productsValue())
    expect(probe.state.products_markup_value).toBe('')
    expect(screen.queryByText('Enter a number from 0 to 999.')).toBeNull()
  })

  // redesign (F-1): the value is kept as typed when the type changes, both ways; the error under the field says what is wrong
  it('switches the type with the segmented control and keeps the value as it is (it says the error instead of changing the number)', async () => {
    const user = userEvent.setup()
    renderForm({ initial: { products_markup_type: 'fixed', products_markup_value: '1200.5' } })
    expect(screen.getByRole('button', { name: 'Fixed' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Enter a number from 0 to 999.')).toBeNull()
    await user.click(screen.getByRole('button', { name: '%' }))
    expect(probe.state.products_markup_type).toBe('percentage')
    expect(probe.state.products_markup_value).toBe('1200.5')
    expect(screen.getByText('Enter a number from 0 to 999.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Fixed' }))
    expect(probe.state.products_markup_type).toBe('fixed')
    expect(probe.state.products_markup_value).toBe('1200.5')
    expect(screen.queryByText('Enter a number from 0 to 999.')).toBeNull()
  })

  it('keeps a whole value and a four-digit one when the type goes to %: 12 has no error, 1500 is not cut to 150', async () => {
    const user = userEvent.setup()
    renderForm({ initial: { products_markup_type: 'fixed', products_markup_value: '12' } })
    await user.click(screen.getByRole('button', { name: '%' }))
    expect(probe.state.products_markup_value).toBe('12')
    expect(screen.queryByText('Enter a number from 0 to 999.')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Fixed' }))
    await user.clear(productsValue())
    await user.type(productsValue(), '1500')
    await user.click(screen.getByRole('button', { name: '%' }))
    expect(probe.state.products_markup_value).toBe('1500')
    expect(screen.getByText('Enter a number from 0 to 999.')).toBeInTheDocument()
  })

  it('does the same for the suboptions: 1200.5 stays 1200.5 when they go to %', async () => {
    const user = userEvent.setup()
    renderForm({ initial: { apply_same_value: false, suboptions_markup_type: 'fixed', suboptions_markup_value: '1200.5' } })
    const group = screen.getByRole('group', { name: 'Suboptions markup type' })
    await user.click(within(group).getByRole('button', { name: '%' }))
    expect(probe.state.suboptions_markup_type).toBe('percentage')
    expect(probe.state.suboptions_markup_value).toBe('1200.5')
    expect(screen.getByText('Enter a number from 0 to 999.')).toBeInTheDocument()
  })

  it('says a fixed amount below 0 under the field', async () => {
    const user = userEvent.setup()
    renderForm({ initial: { products_markup_type: 'fixed' } })
    await user.type(productsValue(), '-3')
    expect(screen.getByText('Enter an amount of 0 or more.')).toBeInTheDocument()
    await user.clear(productsValue())
    await user.type(productsValue(), '2.5')
    expect(probe.state.products_markup_value).toBe('2.5')
    expect(screen.queryByText('Enter an amount of 0 or more.')).toBeNull()
  })

  it('«Apply to suboptions» and «Apply same value» keep today\'s logic', async () => {
    const user = userEvent.setup()
    renderForm()
    const suboptions = screen.getByRole('checkbox', { name: 'Apply to suboptions' })
    const same = screen.getByRole('checkbox', { name: 'Apply same value' })
    expect(suboptions).toHaveAttribute('aria-checked', 'true')
    expect(same).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('textbox', { name: 'Suboptions markup value' })).toBeNull()
    await user.click(same)
    expect(probe.state.apply_same_value).toBe(false)
    expect(screen.getByRole('textbox', { name: 'Suboptions markup value' })).toBeInTheDocument()
    await user.click(suboptions)
    expect(probe.state.apply_to_suboptions).toBe(false)
    expect(probe.state.apply_same_value).toBe(false) // unchecking the first clears the second
    expect(screen.queryByRole('checkbox', { name: 'Apply same value' })).toBeNull()
    expect(screen.queryByRole('textbox', { name: 'Suboptions markup value' })).toBeNull()
  })

  it('suboptions have their own type and value, with the same errors', async () => {
    const user = userEvent.setup()
    renderForm({ initial: { apply_same_value: false } })
    const value = screen.getByRole('textbox', { name: 'Suboptions markup value' })
    await user.type(value, '1000')
    expect(probe.state.suboptions_markup_value).toBe('1000')
    expect(screen.getByText('Enter a number from 0 to 999.')).toBeInTheDocument()
    const group = screen.getByRole('group', { name: 'Suboptions markup type' })
    await user.click(within(group).getByRole('button', { name: 'Fixed' }))
    expect(probe.state.suboptions_markup_type).toBe('fixed')
    expect(screen.queryByText('Enter a number from 0 to 999.')).toBeNull()
  })
})
