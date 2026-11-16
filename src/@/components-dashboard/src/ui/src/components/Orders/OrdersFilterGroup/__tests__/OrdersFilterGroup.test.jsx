/* eslint-disable import/first */
// redesign 5.2-B: the filters sheet (it was a Modal with placeholder-only fields).
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const controller = vi.hoisted(() => ({
  handleChangeOrderId: vi.fn(),
  handleChangeOfferId: vi.fn(),
  handleChangeChildFilterValue: vi.fn(),
  handleChangeMetaFieldValue: vi.fn(),
  handleAddMetaField: vi.fn(),
  handleDeleteMetafield: vi.fn(),
  handleResetFilterValues: vi.fn(),
  handleChangeDateType: vi.fn(),
  handleChangeFromDate: vi.fn(),
  handleChangeEndDate: vi.fn(),
  handleChangeBusinesses: vi.fn(),
  handleChangeCity: vi.fn(),
  handleChangeDeliveryType: vi.fn(),
  handleChangePaymethodType: vi.fn(),
  handleChangeCountryCode: vi.fn(),
  handleChangeCurrency: vi.fn(),
  handleChangeAdmin: vi.fn(),
  handleChangeGroupUnassigned: vi.fn()
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  useApi: () => [{ root: 'https://api.test' }],
  useSession: () => [{ token: 'token' }],
  OrdersFilter: ({ UIComponent, ...props }) => <UIComponent {...props} {...controller} />
}))
vi.mock('../../../Shared', () => ({ CitySelector: () => <div data-testid='city-selector' /> }))
vi.mock('../../BusinessesSelector', () => ({ BusinessesSelector: () => <button type='button'>Pick business</button> }))
vi.mock('../../DateTypeSelector', () => ({ DateTypeSelector: () => <button type='button'>Pick date</button> }))
vi.mock('../../DriversGroupTypeSelector', () => ({ DriversGroupTypeSelector: ({ title }) => <div data-testid='group-selector'>{title}</div> }))
vi.mock('../../DeliveryTypeSelector', () => ({ DeliveryTypeSelector: () => <div /> }))
vi.mock('../../PaymethodTypeSelector', () => ({ PaymethodTypeSelector: () => <div /> }))
vi.mock('../../CountryFilter', () => ({ CountryFilter: () => <div /> }))
// redesign fix-qa E2: a picker of the sheet reads the opt-in surface through the context, not through props.
vi.mock('../../CurrencyFilter', async () => {
  const { useContext } = await import('react')
  const { SelectSurfaceContext } = await import('../../../Shared/UI/selectPlacement')
  return { CurrencyFilter: () => <div data-testid='currency-surface'>{String(useContext(SelectSurfaceContext).fitTrigger)}</div> }
})
vi.mock('../../AdminsSelector', () => ({ AdminsSelector: () => <div /> }))
vi.mock('../../../../styles/Select/FirstSelect', () => ({
  Select: ({ placeholder, options, className }) => (
    <div data-testid='select' className={className}>
      {placeholder}
      {(options || []).map(option => <span key={option.value}>{option.content}</span>)}
    </div>
  )
}))

import { FilterValuesContext } from '../../../../contexts/FilterValuesContext'
import { OrdersFilterGroup } from '..'
import { scanCss } from '../../../../../../../../../../scripts/product-ui/literal-guard.mjs'

const FILTERS = {
  orderId: '12',
  externalId: null,
  groupTypes: [],
  groupTypesUnassigned: [],
  dateType: null,
  deliveryFromDatetime: null,
  deliveryEndDatetime: null,
  businessIds: [],
  driverIds: [],
  driverGroupIds: [],
  cityIds: [],
  statuses: [],
  deliveryTypes: [],
  paymethodIds: [],
  countryCode: [],
  currency: [],
  metafield: [],
  logisticStatus: null,
  assigned: null,
  driverGroupBusinessIds: [],
  customerName: 'ana',
  customerEmail: null,
  customerCellphone: null,
  customerLastname: null,
  coupon: null,
  offerId: null,
  administratorIds: [],
  timeStatus: null
}

const renderSheet = ({ filters = FILTERS, open = true, ...props } = {}) => {
  const spies = {
    handleFilterValues: vi.fn(),
    handleChangeFilterValues: vi.fn(),
    setFilterModalOpen: vi.fn()
  }
  const view = render(
    <ThemeProvider theme={{ colors: {} }}>
      <FilterValuesContext.Provider value={[filters, { handleFilterValues: spies.handleFilterValues }]}>
      <OrdersFilterGroup
        filterModalOpen={open}
        setFilterModalOpen={spies.setFilterModalOpen}
        handleChangeFilterValues={spies.handleChangeFilterValues}
        driverGroupList={{ loading: false, groups: [] }}
        driversList={{ loading: false, drivers: [] }}
        paymethodsList={{ loading: false, paymethods: [] }}
        businessesList={{ loading: false, businesses: [] }}
        citiesList={[]}
        adminsList={{ loading: false, admins: [] }}
        searchValue={null}
        handleChangeSearch={vi.fn()}
        {...props}
      />
      </FilterValuesContext.Provider>
    </ThemeProvider>
  )
  return { ...spies, ...view }
}

describe('OrdersFilterGroup sheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn(() => Promise.reject(new Error('no plugin')))
  })
  afterEach(() => {
    document.getElementById('app-modals')?.remove()
  })

  it('draws nothing while closed and no trigger button of its own', () => {
    renderSheet({ open: false })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('button', { name: /filter/i })).toBeNull()
  })

  // redesign 5.2-F: the sheet is titled «Filters» (as its trigger) and the labels are in sentence case (C14).
  it('is a side sheet named Filters with the fields in labelled groups', async () => {
    renderSheet()
    const sheet = await screen.findByRole('dialog', { name: 'Filters' })
    expect(sheet).toHaveAttribute('data-side', 'end')
    for (const name of ['Order', 'Customer', 'Location', 'Logistics', 'Payment and marketing', 'Metafields']) {
      expect(within(sheet).getByRole('heading', { name })).toBeInTheDocument()
    }
    const order = within(sheet).getByRole('region', { name: 'Order' })
    expect(within(order).getByLabelText('Order ID')).toHaveValue('12')
    expect(within(order).getByRole('group', { name: 'Date' })).toBeInTheDocument()
    expect(within(order).getByRole('group', { name: 'Delivery type' })).toBeInTheDocument()
    const customer = within(sheet).getByRole('region', { name: 'Customer' })
    for (const label of ['Customer name', 'Customer last name', 'Customer email', 'Customer cellphone']) {
      expect(within(customer).getByLabelText(label)).toBeInTheDocument()
    }
    const location = within(sheet).getByRole('region', { name: 'Location' })
    for (const label of ['Business', 'Country', 'City', 'Currency']) {
      expect(within(location).getByRole('group', { name: label })).toBeInTheDocument()
    }
    const logistics = within(sheet).getByRole('region', { name: 'Logistics' })
    // redesign 5.2 audit-3: «Logistic status» and «Offer ID», the same words as «Order ID».
    for (const label of ['Driver group (assigned)', 'Driver status', 'Logistic status']) {
      expect(within(logistics).getByRole('group', { name: label })).toBeInTheDocument()
    }
    const payment = within(sheet).getByRole('region', { name: 'Payment and marketing' })
    expect(within(payment).getByRole('group', { name: 'Payment method' })).toBeInTheDocument()
    expect(within(payment).getByLabelText('Coupon')).toBeInTheDocument()
    expect(within(payment).getByLabelText('Offer ID')).toBeInTheDocument()
    expect(within(payment).getByRole('group', { name: 'Administrator' })).toBeInTheDocument()
    expect(within(sheet).queryByRole('group', { name: 'Fraud status' })).toBeNull()
  })

  // redesign 5.2-F: the labels these fields are found by are in sentence case now.
  it('gives every picker of the sheet the fit-to-trigger surface (lists aligned to the trigger, flipping inside the sheet)', async () => {
    renderSheet()
    expect(await screen.findByTestId('currency-surface')).toHaveTextContent('true')
  })

  it('keeps the same change handlers on the text fields', async () => {
    renderSheet()
    await screen.findByRole('dialog')
    fireEvent.change(screen.getByLabelText('Order ID'), { target: { value: '99' } })
    expect(controller.handleChangeOrderId).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByLabelText('Customer name'), { target: { value: 'bea' } })
    expect(controller.handleChangeChildFilterValue).toHaveBeenLastCalledWith({ customerName: 'bea' })
    fireEvent.change(screen.getByLabelText('Customer email'), { target: { value: 'a@b.co' } })
    expect(controller.handleChangeChildFilterValue).toHaveBeenLastCalledWith({ customerEmail: 'a@b.co' })
    fireEvent.change(screen.getByLabelText('Coupon'), { target: { value: 'ZZ' } })
    expect(controller.handleChangeChildFilterValue).toHaveBeenLastCalledWith({ coupon: 'ZZ' })
    fireEvent.change(screen.getByLabelText('Offer ID'), { target: { value: '7' } })
    expect(controller.handleChangeOfferId).toHaveBeenCalledTimes(1)
  })

  // redesign 5.2 audit-1: the primary action of a filters sheet is «Apply» (C7), not «Accept».
  it('applies with the same handlers as the old modal and closes', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterValues, handleFilterValues, setFilterModalOpen } = renderSheet()
    await user.click(await screen.findByRole('button', { name: 'Apply' }))
    expect(handleChangeFilterValues).toHaveBeenCalledWith(FILTERS)
    expect(handleFilterValues).toHaveBeenCalledWith(FILTERS)
    expect(setFilterModalOpen).toHaveBeenCalledWith(false)
  })

  it('clears with the controller reset and keeps the sheet open', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterValues, setFilterModalOpen } = renderSheet()
    await user.click(await screen.findByRole('button', { name: 'Clear' }))
    expect(controller.handleResetFilterValues).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterValues).toHaveBeenCalledWith({})
    expect(setFilterModalOpen).not.toHaveBeenCalled()
  })

  // redesign 5.2 audit-1: the footer reads Clear then Apply.
  it('closes from the close button and keeps the footer buttons in order: Clear then Apply', async () => {
    const user = userEvent.setup()
    const { setFilterModalOpen } = renderSheet()
    const sheet = await screen.findByRole('dialog')
    const footer = within(sheet).getByRole('button', { name: 'Apply' }).parentElement
    expect(within(footer).getAllByRole('button').map(button => button.textContent)).toEqual(['Clear', 'Apply'])
    expect(within(sheet).queryByRole('button', { name: 'Accept' })).toBeNull()
    await user.click(within(sheet).getByRole('button', { name: 'Close' }))
    expect(setFilterModalOpen).toHaveBeenCalledWith(false)
  })

  it('moves the focus into the field the pill asked for', async () => {
    renderSheet({ initialFocusField: 'business' })
    const button = await screen.findByRole('button', { name: 'Pick business' })
    await waitFor(() => expect(button).toHaveFocus())
  })

  it('shows the fraud status only when the fraud plugin is installed', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ json: async () => ({ error: false, result: { id: 1 } }) }))
    renderSheet()
    expect(await screen.findByRole('group', { name: 'Fraud status' })).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('https://api.test/plugins/key/braintree', expect.objectContaining({ method: 'GET' }))
  })

  describe('metafields', () => {
    it('lists the existing ones with visible labels and deletes one', async () => {
      const user = userEvent.setup()
      renderSheet({ filters: { ...FILTERS, metafield: [{ id: 'm1', key: 'floor', value: '3' }] } })
      const section = await screen.findByRole('region', { name: 'Metafields' })
      expect(within(section).getByLabelText('Metafield name')).toHaveValue('floor')
      expect(within(section).getByLabelText('Metafield value')).toHaveValue('3')
      await user.click(within(section).getByRole('button', { name: 'Delete' }))
      expect(controller.handleDeleteMetafield).toHaveBeenCalledWith('m1')
    })

    it('adds a new one once it has a name', async () => {
      const user = userEvent.setup()
      renderSheet()
      await user.click(await screen.findByRole('button', { name: 'Add a metafield' }))
      await user.type(screen.getByLabelText('Metafield name'), 'floor')
      await user.type(screen.getByLabelText('Metafield value'), '3')
      await user.click(screen.getByRole('button', { name: 'Add' }))
      expect(controller.handleAddMetaField).toHaveBeenCalledWith({ id: expect.any(String), key: 'floor', value: '3' })
    })
  })
})

// redesign 5.2-F: sentence case (C14) and one label spacing + one control height for every field.
describe('OrdersFilterGroup sheet · copy and control size', () => {
  const CSS_PATH = path.resolve(__dirname, '../orders-filter-group.css')
  const cssRule = (css, selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = css.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm'))
    return match ? match[1] : null
  }

  beforeEach(() => {
    global.fetch = vi.fn(() => Promise.resolve({ json: async () => ({ error: false, result: { id: 1 } }) }))
  })

  it('writes every visible label, group title and option in sentence case', async () => {
    renderSheet({ filters: { ...FILTERS, metafield: [{ id: 'm1', key: 'floor', value: '3' }] } })
    const sheet = await screen.findByRole('dialog', { name: 'Filters' })
    await screen.findByRole('group', { name: 'Fraud status' })
    const texts = [
      ...sheet.querySelectorAll('.odc-ofs-label, .odc-ofs-group-title, [data-testid="select"] span')
    ].map(node => node.textContent.trim())
    expect(texts).toEqual(expect.arrayContaining([
      'Order ID', 'Delivery type', 'Customer name', 'Customer last name', 'Customer email',
      'Customer cellphone', 'Declined', 'Fail-open'
    ]))
    // A second word that starts a capital is Title Case; the only capitals allowed after the
    // first word are acronyms («ID»).
    const titleCase = texts.filter(text => /\s[A-Z][a-z]/.test(text))
    expect(titleCase).toEqual([])
  })

  it('gives every text field and picker the same field, label and control classes', async () => {
    renderSheet({ filters: { ...FILTERS, metafield: [{ id: 'm1', key: 'floor', value: '3' }] } })
    const sheet = await screen.findByRole('dialog', { name: 'Filters' })
    const body = sheet.querySelector('.odc-ofs-body')
    const inputs = [...body.querySelectorAll('input')]
    expect(inputs.length).toBeGreaterThan(8)
    inputs.forEach(input => {
      expect(input).toHaveClass('odc-ofs-input')
      expect(input.closest('.odc-ofs-field')).not.toBeNull()
    })
    const fields = [...body.querySelectorAll('.odc-ofs-field')]
    fields.forEach(field => {
      // The label is the first child, so each label + control pair has the same shape.
      expect(field.firstElementChild).toHaveClass('odc-ofs-label')
    })
    expect(body.querySelectorAll('.odc-ofs-label')).toHaveLength(fields.length)
  })

  it('sizes every control with one token pair (fine pointer, coarse pointer) and zeroes the label margin', () => {
    const css = readFileSync(CSS_PATH, 'utf8')
    const body = cssRule(css, '.odc-ofs-body')
    expect(body).toMatch(/--odc-ofs-control:\s*var\(--od-x-control-height\)/)
    // redesign fix-qa E10: phone widths get the touch target too (coarse pointer or below 768px).
    const coarse = css.match(/@media \(pointer: coarse\), \(max-width: 767px\)\s*\{\s*\.odc-ofs-body\s*\{([^}]*)\}/)
    expect(coarse && coarse[1]).toMatch(/--odc-ofs-control:\s*var\(--od-x-target-coarse\)/)

    const input = cssRule(css, '.odc-ofs-body .odc-ofs-input')
    expect(input).toMatch(/block-size:\s*var\(--odc-ofs-control\)/)
    const picker = cssRule(css, '.odc-ofs-body .odc-ofs-field :is(.od-first-select-root, .od-multi-select-root)')
    expect(picker).toMatch(/min-block-size:\s*var\(--odc-ofs-control\)/)

    const label = cssRule(css, '.odc-ofs-body .odc-ofs-label')
    expect(label).toMatch(/margin:\s*0/)
    expect(cssRule(css, '.odc-ofs-body .odc-ofs-field')).toMatch(/gap:\s*var\(--od-x-space-1-5\)/)
  })

  it('keeps the new stylesheet free of literal colours, sizes and spaces', () => {
    expect(scanCss(readFileSync(CSS_PATH, 'utf8'))).toEqual([])
  })
})

// redesign 5.2 audit-1 (FC): placeholders do not repeat the label, and the logistic status picker
// stays on one line (32px, 44px with a coarse pointer) with truncated text and a title.
describe('OrdersFilterGroup sheet · placeholders and single-line pickers', () => {
  const CSS_PATH = path.resolve(__dirname, '../orders-filter-group.css')

  beforeEach(() => {
    global.fetch = vi.fn(() => Promise.resolve({ json: async () => ({ error: false, result: { id: 1 } }) }))
  })

  it('never repeats the field label as its placeholder', async () => {
    renderSheet()
    const sheet = await screen.findByRole('dialog', { name: 'Filters' })
    await screen.findByRole('group', { name: 'Fraud status' })
    const groups = [...sheet.querySelectorAll('[role="group"]')]
    expect(groups.length).toBeGreaterThan(8)
    groups.forEach(group => {
      const label = group.querySelector('.odc-ofs-label').textContent.trim()
      const control = [...group.children].filter(child => !child.classList.contains('odc-ofs-label'))
        .map(child => child.textContent).join(' ')
      expect(control, `placeholder of «${label}»`).not.toContain(label)
    })
  })

  it('says Any in the driver group, driver status, logistic status and fraud status pickers', async () => {
    renderSheet()
    const sheet = await screen.findByRole('dialog', { name: 'Filters' })
    await screen.findByRole('group', { name: 'Fraud status' })
    expect(within(within(sheet).getByRole('group', { name: 'Driver group (assigned)' })).getByTestId('group-selector')).toHaveTextContent('Any')
    for (const name of ['Driver status', 'Logistic status', 'Fraud status']) {
      const select = within(within(sheet).getByRole('group', { name })).getByTestId('select')
      expect(select.textContent, name).toMatch(/^Any/)
      expect(select.textContent, name).not.toMatch(/Select a/)
    }
  })

  it('the placeholder is a single-line, truncating text', async () => {
    renderSheet()
    const sheet = await screen.findByRole('dialog', { name: 'Filters' })
    const select = within(within(sheet).getByRole('group', { name: 'Logistic status' })).getByTestId('select')
    expect(select).toHaveClass('odc-ofs-select-single')
    expect(select.querySelector('.odc-ofs-placeholder.odc-ofs-text')).toHaveTextContent('Any')
  })

  it('every logistic status option is a truncating label with its full text as title', async () => {
    renderSheet()
    const sheet = await screen.findByRole('dialog', { name: 'Filters' })
    const select = within(within(sheet).getByRole('group', { name: 'Logistic status' })).getByTestId('select')
    const labels = [...select.querySelectorAll('.odc-ofs-text:not(.odc-ofs-placeholder)')]
    // redesign F6c: the first row is «Any», to go back to no filter
    expect(labels.map(label => label.textContent)).toEqual(['Any', 'Pending', 'In progress', 'In queue', 'Expired', 'Resolved'])
    labels.forEach(label => expect(label).toHaveAttribute('title', label.textContent))
  })

  it('keeps the pickers on one line without taller controls: ellipsis, no wrapping, the same control token', () => {
    const css = readFileSync(CSS_PATH, 'utf8')
    const rule = selector => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\>]/g, '\\$&')
      const match = css.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm'))
      return match ? match[1] : null
    }
    const text = rule('.odc-ofs-body .odc-ofs-text')
    expect(text).toMatch(/overflow:\s*hidden/)
    expect(text).toMatch(/text-overflow:\s*ellipsis/)
    expect(text).toMatch(/white-space:\s*nowrap/)
    expect(text).toMatch(/min-inline-size:\s*0/)
    const header = rule('.odc-ofs-body .odc-ofs-select-single .od-first-select-header')
    expect(header).toMatch(/flex-wrap:\s*nowrap/)
    expect(header).toMatch(/overflow:\s*hidden/)
    expect(rule('.odc-ofs-body .odc-ofs-dot')).toMatch(/flex:\s*none/)
    // The control height still comes from the one token pair (32px, 44px coarse); nothing here sets another.
    expect(css).not.toMatch(/(?<!-)(?:min-)?block-size:\s+(?!var\(--odc-ofs-control\)|auto)/)
    expect(scanCss(css)).toEqual([])
  })
})

// redesign 5.6-B: below 768px of viewport the sheet rises from the bottom (C8, prototype `.dlg`): same
// content and handlers, 90dvh, the footer fixed with Clear and Apply across the width at 44px.
describe('OrdersFilterGroup sheet · from the bottom on phones (5.6-B)', () => {
  const CSS_PATH = path.resolve(__dirname, '../orders-filter-group.css')
  const setViewport = (phone) => {
    window.matchMedia = vi.fn((query) => ({
      matches: phone && query === '(max-width: 767px)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {}
    }))
  }

  beforeEach(() => {
    global.fetch = vi.fn(() => Promise.reject(new Error('no plugin')))
  })
  afterEach(() => { delete window.matchMedia })

  it('is a bottom sheet under 768px, with the same title, groups and footer', async () => {
    setViewport(true)
    renderSheet()
    const sheet = await screen.findByRole('dialog', { name: 'Filters' })
    expect(sheet).toHaveAttribute('data-side', 'bottom')
    for (const name of ['Order', 'Customer', 'Location', 'Logistics', 'Payment and marketing', 'Metafields']) {
      expect(within(sheet).getByRole('heading', { name })).toBeInTheDocument()
    }
    const footer = within(sheet).getByRole('button', { name: 'Apply' }).parentElement
    expect(within(footer).getAllByRole('button').map(button => button.textContent)).toEqual(['Clear', 'Apply'])
  })

  it('from 768px up it is the side sheet it was', async () => {
    setViewport(false)
    renderSheet()
    expect(await screen.findByRole('dialog', { name: 'Filters' })).toHaveAttribute('data-side', 'end')
  })

  it('without matchMedia it is the side sheet', async () => {
    renderSheet()
    expect(await screen.findByRole('dialog', { name: 'Filters' })).toHaveAttribute('data-side', 'end')
  })

  it('keeps the same handlers on the bottom sheet: Apply sends the values and closes, Clear resets and stays', async () => {
    setViewport(true)
    const user = userEvent.setup()
    const { handleChangeFilterValues, handleFilterValues, setFilterModalOpen } = renderSheet()
    await user.click(await screen.findByRole('button', { name: 'Clear' }))
    expect(controller.handleResetFilterValues).toHaveBeenCalledTimes(1)
    expect(setFilterModalOpen).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    expect(handleChangeFilterValues).toHaveBeenLastCalledWith(FILTERS)
    expect(handleFilterValues).toHaveBeenCalledWith(FILTERS)
    expect(setFilterModalOpen).toHaveBeenCalledWith(false)
  })

  describe('stylesheet', () => {
    const css = readFileSync(CSS_PATH, 'utf8')
    const rule = (selector) => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? null
    }

    it('the bottom sheet is capped at 90dvh: it overrides the Sheet default cap, not the lateral sides', () => {
      const bottom = rule(".odc-ofs-sheet[data-side='bottom']")
      expect(bottom).not.toBeNull()
      expect(bottom).toMatch(/max-block-size:\s*90dvh/)
      expect(css).not.toMatch(/data-side='end'/)
    })

    // The footer needs no rule of its own: Clear and Apply split the width under 768px (dialog.css) and every
    // button is 44px with a coarse pointer (product.css). Pinned here so the sheet cannot lose either.
    it('the footer buttons split the width under 768px and reach 44px with a coarse pointer, from the shared sheets', () => {
      const shared = path.resolve(__dirname, '../../../Shared/Product')
      const dialog = readFileSync(path.join(shared, 'dialog.css'), 'utf8')
      const phoneBlock = dialog.split('@media (max-width: 767px) {')[1]
      expect(phoneBlock).toMatch(/\.odc-overlay-foot\s*>\s*\.odc-btn\s*{[^}]*flex:\s*1/)
      const product = readFileSync(path.join(shared, 'product.css'), 'utf8')
      // redesign fix-qa E10: same rule, now also below 768px.
      const coarse = product.match(/@media \(pointer: coarse\), \(max-width: 767px\)\s*{([\s\S]*?)\n}/)[1]
      // redesign W0-3d (T0-12, decisión 12): the buttons keep their box and reach 44px with Product's centred hit area
      expect(coarse).toMatch(/\.odc-btn::after\s*{[^}]*inset:\s*var\(--od-x-target-inset\)/)
    })

    it('stays free of literal colours, sizes and spaces', () => {
      expect(scanCss(css)).toEqual([])
    })
  })
})
