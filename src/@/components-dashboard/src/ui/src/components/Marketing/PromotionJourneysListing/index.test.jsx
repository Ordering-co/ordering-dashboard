/* eslint-disable import/first */
import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

// redesign PE-B4 (decisions 2, 3, 4, 6, 7, 9, 10; PE-01, PE-02, PE-06): Quick offers with Product. The Product wrappers, the real
// UtilsProviders (parseDate, parsePrice) and the real PromotionsTable are the ones that ship; only the environment (language, config, the
// controller's data and the API calls) is played by the test. The logic tests of the old file keep their assertions on requests and
// payloads; what moved with the new controls (a store picker, day pickers, segmented controls, confirmation dialogs) has the marker.

const hookState = vi.hoisted(() => ({
  configs: {},
  dictionary: {},
  ordering: { root: 'https://api.test' },
  showToast: vi.fn(),
  token: 'token',
  user: { level: 0 }
}))

vi.mock('../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: hookState.configs }]
}))
vi.mock('../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../index', async () => {
  const { useUtils } = await import('../../../../../contexts/UtilsContext')
  return {
    EnterprisePromotionList: () => null,
    ToastType: { Success: 'success' },
    useApi: () => [hookState.ordering],
    useConfig: () => [{ configs: hookState.configs }],
    useLanguage: () => [{ dictionary: hookState.dictionary, language: { code: 'en' } }, (key, fallback) => hookState.dictionary[key] ?? (fallback || key)],
    useSession: () => [{ token: hookState.token, user: hookState.user }],
    useToast: () => [{}, { showToast: hookState.showToast }],
    useUtils
  }
})

vi.mock('../../Shared', () => ({
  SelectBusinessCategories: () => <div>Categories</div>
}))

vi.mock('./JourneyProductPicker', () => ({
  JourneyProductPicker: ({ setSelectedProductsIds, selectedProductsIds, businessId }) => (
    <button type='button' data-business-id={businessId} data-selected-count={Object.keys(selectedProductsIds || {}).length} onClick={() => setSelectedProductsIds({ 22: { id: 22, include: true } })}>Select product 22</button>
  )
}))

import { UtilsProviders, useUtils } from '../../../../../contexts/UtilsContext'
import { PromotionJourneysListingUI } from './index'

const dashboardTheme = createDashboardTheme(theme)

// the project writes its dates day first, so a stamp in the wrong format is easy to tell from an ISO one
const PROJECT_DATES = { dates_general_format: { value: 'DD/MM/YYYY HH:mm' } }

const util = {}
const Probe = () => {
  Object.assign(util, useUtils()[0])
  return null
}

const Wrapper = ({ children }) => (
  <ThemeProvider theme={dashboardTheme}>
    <UtilsProviders><Probe />{children}</UtilsProviders>
  </ThemeProvider>
)

const baseProps = {
  promotionListState: { promotions: [], loading: false, error: null },
  businessesList: { businesses: [{ id: 10, name: 'Store One', slug: 'store-one' }], loading: false },
  businessesPaginationProps: { currentPage: 1, totalPages: 1, pageSize: 10 },
  searchBusinesses: vi.fn(),
  handleChangeBusinessPage: vi.fn(),
  sitesState: { sites: [{ id: 3, name: 'Website' }], loading: false },
  getPromotions: vi.fn(),
  paginationProps: { currentPage: 1, pageSize: 10, totalPages: 1, totalItems: 0 },
  searchValue: '',
  onSearch: vi.fn(),
  handleEnablePromotion: vi.fn(),
  handleSuccessDeletePromotion: vi.fn(),
  handleSuccessUpdatePromotions: vi.fn(),
  saveJourney: async ({ payload, promotionId, enabled }) => {
    const response = await fetch(`https://api.test/offers${promotionId ? `/${promotionId}` : ''}`, {
      method: 'POST',
      body: JSON.stringify({ ...payload, enabled })
    })
    const content = await response.json()
    if (!response.ok || content.error) throw new Error(Array.isArray(content.result) ? content.result.join(' ') : String(content.result))
    return content.result
  },
  updateJourneyStatus: async ({ promotionId, enabled }) => {
    const response = await fetch(`https://api.test/offers/${promotionId}`, { method: 'POST', body: JSON.stringify({ enabled }) })
    const content = await response.json()
    if (!response.ok || content.error) throw new Error(Array.isArray(content.result) ? content.result.join(' ') : String(content.result))
    return content.result
  },
  deleteJourney: async ({ promotionId }) => {
    const response = await fetch(`https://api.test/offers/${promotionId}`, { method: 'DELETE' })
    if (response.status === 204) return { id: promotionId }
    const content = await response.json()
    if (!response.ok || content.error) throw new Error(Array.isArray(content.result) ? content.result.join(' ') : String(content.result))
    return content.result
  },
  loadJourneyLoyaltyLevels: vi.fn().mockResolvedValue([]),
  loadPromotionSites: vi.fn()
}

// async: the businesses of the scope load on mount, so the first render is let to settle before a test looks at it
const renderComponent = async (configs, props = {}) => {
  hookState.configs = { ...PROJECT_DATES, ...configs }
  const componentProps = { ...baseProps, ...props }
  const view = render(
    <PromotionJourneysListingUI
      {...componentProps}
      loadAllJourneyBusinesses={props.loadAllJourneyBusinesses || vi.fn().mockResolvedValue(componentProps.businessesList.businesses)}
    />,
    { wrapper: Wrapper }
  )
  await act(async () => { await Promise.resolve() })
  return view
}

const CURRENCY = { format_number_currency: { value: '$' } }

const templateButton = (container, key) => container.querySelector(`[data-template-key="${key}"]`)
const buttonNamed = name => screen.getByRole('button', { name })
// the builder is a region; with a modal open the page behind is hidden from the accessibility tree, so it is found by its attribute
const regionOf = () => document.querySelector('[role="region"]')
const numberField = name => screen.getByRole('textbox', { name })
const dateTrigger = name => screen.getByRole('combobox', { name: new RegExp(`^${name}`) })
const timeSelect = name => screen.getByRole('combobox', { name })

// types a figure into a Product NumberField the way a person does (clear, then type)
const fill = async (user, field, value) => {
  await user.clear(field)
  await user.type(field, value)
}

// picks a day by typing it in the project's format (DD/MM/YYYY) inside the picker, then closes the picker
const pickDay = async (user, name, digits) => {
  await user.click(dateTrigger(name))
  const dialog = await screen.findByRole('dialog', { name: 'Select a date' })
  await user.type(within(dialog).getByRole('textbox'), digits)
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).toBeNull())
}

const completeFirstPurchase = async (user) => {
  await fill(user, numberField('Discount (%)'), '20')
  await fill(user, numberField('Minimum purchase'), '200')
  await fill(user, numberField('Maximum discount'), '40')
  await pickDay(user, 'Start date', '01092026')
  await pickDay(user, 'End date', '30092026')
  await user.selectOptions(timeSelect('Start time Hour'), '9')
  await user.selectOptions(timeSelect('End time Hour'), '22')
  await user.selectOptions(timeSelect('End time Minute'), '0')
  expect(dateTrigger('Start date')).toHaveTextContent('01/09/2026')
  expect(dateTrigger('End date')).toHaveTextContent('30/09/2026')
}

const openTemplate = async (user, container, key) => {
  await user.click(templateButton(container, key))
}

const lastBody = () => JSON.parse(global.fetch.mock.calls[0][1].body)

const welcome = {
  id: 99,
  name: 'Welcome offer',
  description: 'Description',
  enabled: false
}

beforeEach(() => {
  global.fetch = vi.fn()
  hookState.dictionary = {}
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  document.getElementById('app-modals')?.remove()
})

describe('PromotionJourneysListingUI · the catalog', () => {
  test('the eight templates are one-click buttons with their icon, title, description and audience; nothing structural inside a button', async () => {
    const { container } = await renderComponent(CURRENCY)
    expect(screen.getByRole('heading', { level: 2, name: 'Promotion templates' })).toBeInTheDocument()
    const cards = container.querySelectorAll('[data-template-key]')
    expect(cards).toHaveLength(8)
    cards.forEach(card => {
      expect(card.tagName).toBe('BUTTON')
      expect(card).toHaveAttribute('type', 'button')
      // redesign PE-B4 (decision 2; inventory D39): a button holds phrasing content, never a heading, a paragraph or a block
      expect(card.querySelector('h1,h2,h3,h4,h5,h6,p,div,ul,ol,li')).toBeNull()
      expect(card.querySelector('svg')).not.toBeNull()
    })
    const first = templateButton(container, 'first_order')
    expect(first.children).toHaveLength(2)
    expect(first).toHaveTextContent('First purchase')
    expect(first).toHaveTextContent('Welcome customers who have not placed an order yet.')
    expect(first).toHaveTextContent('Customers with exactly 0 orders')
    expect(container.textContent).toContain('Happy hour')
    expect(container.textContent).toContain('We miss you')
    expect(container.textContent).toContain('Make items free from the same product selection used to qualify.')
    expect(container.textContent).not.toContain('Slow hours boost')
    expect(container.textContent).not.toContain('Win back inactive customers')
    expect(container.textContent).not.toContain('Validated before activation')
    expect(container.textContent).not.toContain('All templates')
    expect(container.textContent).not.toContain('Acquisition')
  })

  // redesign AC-D (G5): the eight template icons are Lucide, through the Ordering icon barrel, not react-bootstrap-icons
  test('the template icons are Lucide glyphs with the house defaults, none of them a Bootstrap icon', async () => {
    const { container } = await renderComponent(CURRENCY)
    const expected = {
      first_order: 'lucide-user-check',
      second_order: 'lucide-repeat',
      free_delivery: 'lucide-truck',
      minimum_purchase: 'lucide-shopping-basket',
      buy_x_get_y: 'lucide-gift',
      loyalty_reward: 'lucide-star',
      slow_hours: 'lucide-history',
      winback: 'lucide-shopping-bag'
    }
    Object.entries(expected).forEach(([key, glyph]) => {
      const icon = templateButton(container, key).querySelector('svg')
      expect(icon).toHaveClass('odc-promo-quick-template-icon', glyph)
      expect(icon).toHaveAttribute('aria-hidden', 'true')
      expect(icon).toHaveAttribute('stroke-width', '1.75')
    })
    container.querySelectorAll('[data-template-key] svg').forEach(icon => {
      expect(Array.from(icon.classList).some(name => name === 'bi' || name.startsWith('bi-'))).toBe(false)
    })
  })

  test('the loyalty template is available without an addon flag', async () => {
    await renderComponent(CURRENCY)
    const loyalty = screen.getAllByRole('button').find(button => button.textContent.includes('Loyalty level reward'))
    expect(loyalty.disabled).toBe(false)
    expect(loyalty.textContent).not.toContain('Requires Loyalty Levels')
  })

  test('one click on a template opens the builder with the template name', async () => {
    const user = userEvent.setup()
    const { container } = await renderComponent(CURRENCY)
    await openTemplate(user, container, 'first_order')
    expect(regionOf()).toHaveAccessibleName('First purchase promotion builder')
    expect(screen.getByRole('textbox', { name: 'Promotion name' })).toHaveValue('First purchase')
  })
})

describe('PromotionJourneysListingUI · the builder, with Product controls', () => {
  test('opens the guided builder with the same fields and hints', async () => {
    const user = userEvent.setup()
    const { container } = await renderComponent(CURRENCY)
    await openTemplate(user, container, 'first_order')
    expect(container.textContent).toContain('Customers with exactly 0 orders')
    expect(container.textContent).not.toContain('Review')
    expect(container.textContent).not.toContain('Test')
    expect(container.textContent).toContain('This will be the offer name your customers see at checkout.')
    expect(container.textContent).not.toContain('I reviewed dates and times')
    expect(container.textContent).not.toContain('Advanced settings')
    expect(container.textContent).not.toContain('Uses per customer')
    expect(container.textContent).not.toContain('Sites')
    expect(buttonNamed('Save draft')).toBeInTheDocument()
    expect(buttonNamed('Activate')).toBeInTheDocument()
    expect(buttonNamed('Cancel')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Description' }).value).toContain('Customers with exactly 0 orders')
    expect(container.textContent).toContain('Product options')
    expect(container.textContent).toContain('Choose whether the discount also applies to product options.')
  })

  test('the builder has no native select of its own and no datetime-local input (PE-06)', async () => {
    const user = userEvent.setup()
    const { container } = await renderComponent(CURRENCY)
    await openTemplate(user, container, 'first_order')
    expect(container.querySelectorAll('input[type="datetime-local"]')).toHaveLength(0)
    // the only <select>s are the hour and minute of the two time fields (Product's own, with their names); the rest are not selects
    const selects = [...container.querySelectorAll('select')]
    expect(selects.every(select => select.classList.contains('odc-time-field-select'))).toBe(true)
    expect(selects).toHaveLength(4)
  })

  test('the Buy X, get Y builder has no native store select either: the store is a Product picker', async () => {
    const user = userEvent.setup()
    const { container } = await renderComponent(CURRENCY)
    await openTemplate(user, container, 'buy_x_get_y')
    expect([...container.querySelectorAll('select')].every(select => select.classList.contains('odc-time-field-select'))).toBe(true)
    expect(screen.getByRole('button', { name: /Promotion store/ })).toBeInTheDocument()
  })

  test('the numbers are Product number fields, each with its hint or error', async () => {
    const user = userEvent.setup()
    const { container } = await renderComponent(CURRENCY)
    await openTemplate(user, container, 'minimum_purchase')
    // (Base UI keeps one hidden number input per field for forms; what a person reaches is a text input with the figure class)
    expect([...container.querySelectorAll('input[type="number"]')].filter(input => input.getAttribute('aria-hidden') !== 'true')).toHaveLength(0)
    expect(numberField('Discount (%)')).toHaveClass('odc-figure')
    expect(numberField('Minimum purchase')).toBeInTheDocument()
    expect(numberField(/Uses per customer|used per user/)).toBeInTheDocument()
    expect(numberField('Maximum discount')).toBeInTheDocument()
    await user.click(buttonNamed('Activate'))
    const alerts = screen.getAllByRole('alert').map(alert => alert.textContent)
    expect(alerts).toEqual(expect.arrayContaining([
      expect.stringContaining('Enter a benefit greater than 0.'),
      expect.stringContaining('Enter a minimum purchase greater than 0.'),
      expect.stringContaining('Select a start date.'),
      expect.stringContaining('Select an end date.')
    ]))
    expect(numberField('Discount (%)')).toBeInvalid()
  })

  test('does not show product options for a delivery-fee discount', async () => {
    const user = userEvent.setup()
    const { container } = await renderComponent(CURRENCY)
    await openTemplate(user, container, 'free_delivery')
    expect(container.textContent).not.toContain('Product options')
    expect(screen.queryByRole('group', { name: 'Product options' })).toBeNull()
  })

  test('Application and Product options are segmented controls that stage the same values', async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { id: 77, enabled: false } }) })
    const { container } = await renderComponent(CURRENCY)
    await openTemplate(user, container, 'first_order')

    const application = screen.getByRole('group', { name: "How it's going to be applied?" })
    expect(within(application).getByRole('button', { name: 'Automatic' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('textbox', { name: 'Coupon code' })).toBeNull()
    await user.click(within(application).getByRole('button', { name: 'Coupon' }))
    expect(within(application).getByRole('button', { name: 'Coupon' })).toHaveAttribute('aria-pressed', 'true')
    // the code has a visible label now (inventory D37), not a placeholder only
    const code = screen.getByRole('textbox', { name: 'Coupon code' })
    await user.type(code, 'SAVE 10')
    expect(code).toHaveValue('SAVE10')

    const options = screen.getByRole('group', { name: 'Product options' })
    expect(within(options).getByRole('button', { name: 'Exclude' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(options).getByRole('button', { name: 'Include' }))
    expect(within(options).getByRole('button', { name: 'Include' })).toHaveAttribute('aria-pressed', 'true')

    await completeFirstPurchase(user)
    await user.click(buttonNamed('Save draft'))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    expect(lastBody()).toMatchObject({ auto: false, type: 2, coupon: 'SAVE10', include_options: true, enabled: false })
  })

  test('the generated description writes the dates in the project format, never as an ISO stamp (decision 7, PE-02)', async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { id: 77, enabled: false } }) })
    const { container } = await renderComponent(CURRENCY)
    await openTemplate(user, container, 'first_order')
    await completeFirstPurchase(user)
    const description = screen.getByRole('textbox', { name: 'Description' })
    // 09:00 shows with its time; the end is 22:00 here
    const start = util.parseDate('2026-09-01 09:00:00', { utc: false })
    const end = util.parseDate('2026-09-30 22:00:00', { utc: false })
    expect(start).toBe('01/09/2026 09:00')
    expect(description.value).toContain(`from ${start} to ${end}.`)
    expect(description.value).not.toMatch(/\d{4}-\d{2}-\d{2}T/)
    expect(description.value).not.toContain('T09:00')
    await user.click(buttonNamed('Save draft'))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    // what is saved (and shown to the customer at checkout) is the same text
    expect(lastBody().description).toContain(`from ${start} to ${end}.`)
    expect(lastBody().description).not.toMatch(/\d{4}-\d{2}-\d{2}T/)
    expect(lastBody()).toMatchObject({ start: '2026-09-01 09:00:00', end: '2026-09-30 22:00:59' })
  })

  test('a day with no time yet takes the default time: 00:00 for the start, 23:59 for the end, and the generated text shows only the day', async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { id: 77, enabled: false } }) })
    const { container } = await renderComponent(CURRENCY)
    await openTemplate(user, container, 'first_order')
    // the time cannot be set before there is a day
    expect(timeSelect('Start time Hour')).toBeDisabled()
    await fill(user, numberField('Discount (%)'), '20')
    await fill(user, numberField('Minimum purchase'), '200')
    await fill(user, numberField('Maximum discount'), '40')
    await pickDay(user, 'Start date', '01092026')
    await pickDay(user, 'End date', '30092026')
    expect(timeSelect('Start time Hour')).toHaveValue('0')
    expect(timeSelect('End time Hour')).toHaveValue('23')
    expect(timeSelect('End time Minute')).toHaveValue('59')
    expect(screen.getByRole('textbox', { name: 'Description' }).value).toContain('from 01/09/2026 to 30/09/2026.')
    // a later day keeps the time that was chosen
    await user.selectOptions(timeSelect('Start time Hour'), '9')
    await pickDay(user, 'Start date', '02092026')
    expect(timeSelect('Start time Hour')).toHaveValue('9')
    await pickDay(user, 'Start date', '01092026')
    await user.click(buttonNamed('Save draft'))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    expect(lastBody()).toMatchObject({ start: '2026-09-01 09:00:00', end: '2026-09-30 23:59:59' })
  })

  test('uses one business selector as the Buy X, get Y scope and saves selected products', async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { id: 78, enabled: false } }) })
    const { container } = await renderComponent(CURRENCY)

    await openTemplate(user, container, 'buy_x_get_y')
    expect(container.textContent).not.toContain('Use every business, or choose only the locations')
    expect(container.textContent).not.toContain('Choose businesses')
    expect(container.textContent).not.toContain('Condition type')
    expect(container.textContent).not.toContain('Categories')
    expect(container.textContent).toContain('The free items will come from this same product selection.')
    expect(container.textContent).toContain('Customers must add every unit to the cart. The promotion discounts eligible units already in the cart.')
    expect(container.textContent).toContain('Eligible items required in cart')
    expect(container.textContent).toContain('Eligible items that become free')
    expect(container.textContent).toContain('Product options')
    expect(container.textContent).toContain('Product options are not available for Buy X, get Y promotions yet. Extra option charges will not be discounted.')
    expect(container.textContent).not.toContain('Include product options')
    expect(container.textContent).not.toContain('Do not include product options')
    expect(screen.queryByRole('group', { name: 'Product options' })).toBeNull()
    expect(container.textContent).toContain('Rule: When the cart contains 2 eligible items, 1 of them become free.')
    expect(container.textContent).not.toContain('Minimum items')
    expect(container.textContent).not.toContain('Free products')

    // redesign PE-B4 (decision 6): the store is picked in Product's list, with a search, instead of a native select
    await user.click(screen.getByRole('button', { name: /Promotion store/ }))
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: 'Store One' }))
    const productButton = buttonNamed('Select product 22')
    expect(productButton.getAttribute('data-business-id')).toBe('10')
    await user.click(productButton)

    await pickDay(user, 'Start date', '01092026')
    await pickDay(user, 'End date', '30092026')
    await user.click(buttonNamed('Save draft'))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))

    expect(lastBody()).toMatchObject({
      businesses: [10],
      sites: [3],
      products: [{ id: 22, include: true, is_condition: true }],
      rate: 1,
      minimum: 2,
      include_options: false,
      enabled: false
    })
    expect(lastBody().categories).toBeUndefined()
  })

  test('blocks an invalid Buy X, get Y quantity before saving', async () => {
    const user = userEvent.setup()
    const { container } = await renderComponent(CURRENCY)
    await openTemplate(user, container, 'buy_x_get_y')
    await user.click(screen.getByRole('button', { name: /Promotion store/ }))
    await user.click(screen.getByRole('option', { name: 'Store One' }))
    await user.click(buttonNamed('Select product 22'))
    await fill(user, numberField('Eligible items that become free'), '2')
    await user.click(buttonNamed('Save draft'))
    expect(container.textContent).toContain('Free items must be fewer than the eligible items required in the cart.')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('changing the Buy X, get Y store clears products selected for the previous store', async () => {
    const user = userEvent.setup()
    const businesses = [
      { id: 10, name: 'Store One', slug: 'store-one' },
      { id: 20, name: 'Store Two', slug: 'store-two' }
    ]
    const { container } = await renderComponent(CURRENCY, {
      businessesList: { businesses, loading: false },
      businessesPaginationProps: { currentPage: 1, totalPages: 1, totalItems: 2, pageSize: 10 }
    })
    await openTemplate(user, container, 'buy_x_get_y')
    await user.click(screen.getByRole('button', { name: /Promotion store/ }))
    await user.click(screen.getByRole('option', { name: 'Store One' }))
    await user.click(buttonNamed('Select product 22'))
    await user.click(screen.getByRole('button', { name: /Promotion store/ }))
    await user.click(screen.getByRole('option', { name: 'Store Two' }))
    expect(buttonNamed('Select product 22').getAttribute('data-business-id')).toBe('20')

    await user.click(buttonNamed('Save draft'))
    expect(container.textContent).toContain('Select at least one product.')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  // redesign review r1 (R3): main's native <select> only fired on a change; choosing the same store again keeps its products
  test('choosing the same Buy X, get Y store again keeps the products already selected', async () => {
    const user = userEvent.setup()
    const businesses = [{ id: 10, name: 'Store One', slug: 'store-one' }]
    const { container } = await renderComponent(CURRENCY, {
      businessesList: { businesses, loading: false },
      businessesPaginationProps: { currentPage: 1, totalPages: 1, totalItems: 1, pageSize: 10 }
    })
    await openTemplate(user, container, 'buy_x_get_y')
    await user.click(screen.getByRole('button', { name: /Promotion store/ }))
    await user.click(screen.getByRole('option', { name: 'Store One' }))
    await user.click(buttonNamed('Select product 22'))
    expect(buttonNamed('Select product 22').getAttribute('data-selected-count')).toBe('1')
    await user.click(screen.getByRole('button', { name: /Promotion store/ }))
    await user.click(screen.getByRole('option', { name: 'Store One' }))
    expect(buttonNamed('Select product 22').getAttribute('data-selected-count')).toBe('1')
  })

  // redesign review r1 (R5): main kept a value out of range and said why on save; the field never rewrites it on its own
  test('an out-of-range number stays as typed and the save says why', async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn()
    const { container } = await renderComponent(CURRENCY)
    await openTemplate(user, container, 'minimum_purchase')
    await fill(user, numberField(/Uses per customer|used per user/), '0')
    await user.tab()
    expect(numberField(/Uses per customer|used per user/).value).toBe('0')
    await user.click(buttonNamed('Save draft'))
    expect(container.textContent).toContain('Enter a per-customer usage limit.')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('the store list of Buy X, get Y can be searched', async () => {
    const user = userEvent.setup()
    const businesses = [
      { id: 10, name: 'Store One', slug: 'store-one' },
      { id: 20, name: 'Harbour', slug: 'harbour' }
    ]
    const { container } = await renderComponent(CURRENCY, { businessesList: { businesses, loading: false } })
    await openTemplate(user, container, 'buy_x_get_y')
    await user.click(screen.getByRole('button', { name: /Promotion store/ }))
    await user.type(screen.getByRole('searchbox'), 'harb')
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map(option => option.textContent)).toEqual(['Harbour'])
  })

  test('saves the editable natural description with every site and business included automatically', async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { id: 77, enabled: false } }) })
    const { container } = await renderComponent(CURRENCY)
    await openTemplate(user, container, 'first_order')
    await completeFirstPurchase(user)
    const description = screen.getByRole('textbox', { name: 'Description' })
    expect(description.value).toContain('Customers with exactly 0 orders receive 20% off across all businesses and sales channels')
    await user.clear(description)
    await user.type(description, 'Custom customer-facing description')
    await user.click(buttonNamed('Save draft'))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    expect(lastBody()).toMatchObject({ description: 'Custom customer-facing description', enabled: false, businesses: [10], sites: [3] })
    expect(baseProps.getPromotions).toHaveBeenCalledWith(1, 10)
    expect(container.textContent).toContain('Your promotions')
    expect(container.textContent).not.toContain('Promotion name')
  })

  test('validates and activates directly from Configure', async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { id: 77, enabled: true } }) })
    const { container } = await renderComponent(CURRENCY)
    await openTemplate(user, container, 'first_order')
    await completeFirstPurchase(user)
    await user.click(buttonNamed('Activate'))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    expect(lastBody().enabled).toBe(true)
    await waitFor(() => expect(baseProps.getPromotions).toHaveBeenCalledWith(1, 10))
    await waitFor(() => expect(container.textContent).toContain('Your promotions'))
    expect(container.textContent).not.toContain('Promotion name')
  })

  test('blocks save and activation in Configure before calling the API when fields are missing', async () => {
    const user = userEvent.setup()
    const { container } = await renderComponent(CURRENCY)
    await openTemplate(user, container, 'first_order')
    await user.click(buttonNamed('Activate'))
    expect(container.textContent).toContain('Enter a benefit greater than 0.')
    expect(container.textContent).toContain('Select a start date.')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('blocks submission before the API when automatic sales-channel scope is unavailable', async () => {
    const user = userEvent.setup()
    const loadPromotionSites = vi.fn()
    const { container } = await renderComponent(CURRENCY, {
      sitesState: { sites: [], loading: false, error: ['Channels unavailable'] },
      loadPromotionSites
    })
    await openTemplate(user, container, 'first_order')
    await completeFirstPurchase(user)
    await user.click(buttonNamed('Save draft'))

    expect(container.textContent).toContain('Sales channels could not be loaded. Retry before saving.')
    expect(global.fetch).not.toHaveBeenCalled()
    await user.click(buttonNamed('Retry'))
    expect(loadPromotionSites).toHaveBeenCalledTimes(1)
  })

  test('allows saving when sales channels loaded successfully with an empty list', async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { id: 77, enabled: false } }) })
    const { container } = await renderComponent(CURRENCY, { sitesState: { sites: [], loading: false, error: null } })
    await openTemplate(user, container, 'first_order')
    await completeFirstPurchase(user)
    await user.click(buttonNamed('Save draft'))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    expect(lastBody().enabled).toBe(false)
    expect(lastBody()).not.toHaveProperty('sites')
    await waitFor(() => expect(container.textContent).toContain('Your promotions'))
  })

  test('keeps the builder open and creates no ghost card when saving fails; the pressed button is busy, not relabelled', async () => {
    const user = userEvent.setup()
    let release
    global.fetch = vi.fn(() => new Promise(resolve => { release = resolve }))
    const getPromotions = vi.fn()
    const { container } = await renderComponent(CURRENCY, { getPromotions })
    await openTemplate(user, container, 'first_order')
    await completeFirstPurchase(user)
    await user.click(buttonNamed('Save draft'))
    // redesign PE-B4 (decision 6): `busy` on the button that was pressed instead of the «Loading...» text
    expect(buttonNamed('Save draft')).toHaveAttribute('aria-busy', 'true')
    expect(buttonNamed('Activate')).not.toHaveAttribute('aria-busy')
    expect(buttonNamed('Activate')).toBeDisabled()
    expect(container.textContent).not.toContain('Loading...')
    await act(async () => {
      release({ ok: false, json: async () => ({ error: true, result: ['The offer could not be saved'] }) })
    })
    expect(await screen.findByText('The offer could not be saved')).toBeInTheDocument()
    expect(regionOf()).not.toBeNull()
    expect(container.querySelector('[data-row-id]')).toBeNull()
    expect(getPromotions).not.toHaveBeenCalled()
    expect(buttonNamed('Save draft')).not.toHaveAttribute('aria-busy')
  })

  test('retries a failed atomic activation without creating a hidden draft', async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: true, result: ['Activation failed'] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: false, result: { id: 77, enabled: true } }) })
    const { container } = await renderComponent(CURRENCY)
    await openTemplate(user, container, 'first_order')
    await completeFirstPurchase(user)
    await user.click(buttonNamed('Activate'))
    expect(await screen.findByText('Activation failed')).toBeInTheDocument()
    expect(regionOf()).not.toBeNull()
    await user.click(buttonNamed('Activate'))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
    expect(global.fetch.mock.calls.map(call => call[0])).toEqual([
      'https://api.test/offers',
      'https://api.test/offers'
    ])
    await waitFor(() => expect(regionOf()).toBeNull())
  })

  test('the business scope: all businesses by default, or a searchable checklist of the chosen ones', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const searchBusinesses = vi.fn()
    const { container } = await renderComponent(CURRENCY, {
      searchBusinesses,
      businessesList: { businesses: [{ id: 10, name: 'Store One', slug: 'store-one' }, { id: 11, name: 'Store Two', slug: 'store-two' }], loading: false }
    })
    await openTemplate(user, container, 'first_order')
    const scope = screen.getByRole('group', { name: 'Businesses' })
    expect(within(scope).getByRole('button', { name: 'All businesses' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('checkbox', { name: 'Store One' })).toBeNull()

    await user.click(within(scope).getByRole('button', { name: 'Choose businesses' }))
    expect(within(scope).getByRole('button', { name: 'Choose businesses' })).toHaveAttribute('aria-pressed', 'true')
    const one = screen.getByRole('checkbox', { name: 'Store One' })
    await user.click(one)
    expect(one).toHaveAttribute('aria-checked', 'true')
    expect(container.textContent).toContain('1 businesses selected')
    await user.click(screen.getByRole('checkbox', { name: 'Store Two' }))
    expect(container.textContent).toContain('2 businesses selected')
    await user.click(one)
    expect(one).toHaveAttribute('aria-checked', 'false')

    // one request after the wait, not one per key (inventory D29)
    const search = screen.getByRole('searchbox', { name: 'Search businesses' })
    await user.type(search, 'sto')
    expect(searchBusinesses).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(300) })
    expect(searchBusinesses).toHaveBeenCalledTimes(1)
    expect(searchBusinesses).toHaveBeenCalledWith('sto')

    await user.click(within(scope).getByRole('button', { name: 'All businesses' }))
    expect(screen.queryByRole('checkbox', { name: 'Store One' })).toBeNull()
  })

  test('the businesses of a long list are paged with the Product pager, without a size selector', async () => {
    const user = userEvent.setup()
    const handleChangeBusinessPage = vi.fn()
    const { container } = await renderComponent(CURRENCY, {
      handleChangeBusinessPage,
      businessesPaginationProps: { currentPage: 2, totalPages: 3, totalItems: 25, pageSize: 10 }
    })
    await openTemplate(user, container, 'first_order')
    await user.click(screen.getByRole('button', { name: 'Choose businesses' }))
    const pager = screen.getByRole('navigation', { name: 'Pagination' })
    expect(within(pager).queryByText('Items per page')).toBeNull()
    await user.click(within(pager).getByRole('button', { name: 'Next page' }))
    expect(handleChangeBusinessPage).toHaveBeenCalledWith(3)
    await user.click(within(pager).getByRole('button', { name: 'Previous page' }))
    expect(handleChangeBusinessPage).toHaveBeenLastCalledWith(1)
  })

  test('loyalty levels are checkboxes that stage the chosen ids', async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { id: 80, enabled: false } }) })
    const loadJourneyLoyaltyLevels = vi.fn().mockResolvedValue([{ id: 4, name: 'Gold' }, { id: 5, name: 'Silver' }])
    const { container } = await renderComponent(CURRENCY, { loadJourneyLoyaltyLevels })
    await openTemplate(user, container, 'loyalty_reward')
    const gold = await screen.findByRole('checkbox', { name: 'Gold' })
    await user.click(gold)
    expect(gold).toHaveAttribute('aria-checked', 'true')
    await fill(user, numberField('Discount (%)'), '10')
    await fill(user, numberField('Minimum purchase'), '20')
    await fill(user, numberField('Maximum discount'), '5')
    await pickDay(user, 'Start date', '01092026')
    await pickDay(user, 'End date', '30092026')
    await user.click(buttonNamed('Save draft'))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    expect(lastBody().loyalty_levels).toEqual([4])
  })

  test('Happy hour uses the Product schedule editor on the same controller', async () => {
    const user = userEvent.setup()
    const { container } = await renderComponent(CURRENCY)
    await openTemplate(user, container, 'slow_hours')
    expect(screen.getByRole('heading', { level: 3, name: 'Schedule' })).toBeInTheDocument()
    expect(container.querySelector('.odc-sched')).not.toBeNull()
    expect(screen.getAllByRole('switch').length).toBeGreaterThanOrEqual(7)
  })

  test('inactive days is a number field that sets the minutes of the offer', async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { id: 81, enabled: false } }) })
    const { container } = await renderComponent(CURRENCY)
    await openTemplate(user, container, 'winback')
    await fill(user, numberField('Inactive days'), '30')
    await fill(user, numberField('Discount (%)'), '10')
    await fill(user, numberField('Minimum purchase'), '20')
    await fill(user, numberField('Maximum discount'), '5')
    await pickDay(user, 'Start date', '01092026')
    await pickDay(user, 'End date', '30092026')
    await user.click(buttonNamed('Save draft'))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    expect(lastBody().valid_from_after_user_last_order_minutes).toBe(30 * 24 * 60)
  })

  test('recovers from an all-business load error instead of remaining stuck', async () => {
    const user = userEvent.setup()
    const loadAllJourneyBusinesses = vi.fn()
      .mockRejectedValueOnce(new Error('Businesses unavailable'))
      .mockResolvedValueOnce([{ id: 10, name: 'Store One', slug: 'store-one' }])
    const { container } = await renderComponent(CURRENCY, { loadAllJourneyBusinesses })
    await act(async () => Promise.resolve())
    await openTemplate(user, container, 'first_order')
    expect(container.textContent).toContain('Businesses unavailable')

    await user.click(buttonNamed('Retry'))
    expect(loadAllJourneyBusinesses).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(container.textContent).not.toContain('Businesses unavailable'))
    expect(container.textContent).not.toContain('Loading businesses...')
  })
})

describe('PromotionJourneysListingUI · closing the builder', () => {
  test('the close button is a named icon button and closes a clean builder at once', async () => {
    const user = userEvent.setup()
    const { container } = await renderComponent(CURRENCY)
    await openTemplate(user, container, 'first_order')
    await user.click(buttonNamed('Close'))
    expect(regionOf()).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  test('closes the builder with Escape without saving', async () => {
    const { container } = await renderComponent(CURRENCY)
    fireEvent.click(templateButton(container, 'first_order'))
    expect(regionOf()).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(regionOf()).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('Escape inside a day picker closes only the picker, not the builder', async () => {
    const user = userEvent.setup()
    const { container } = await renderComponent(CURRENCY)
    await openTemplate(user, container, 'first_order')
    await user.click(dateTrigger('Start date'))
    await screen.findByRole('dialog', { name: 'Select a date' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).toBeNull())
    expect(regionOf()).not.toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  // Owner decision 22 B (2026-10-21, T-1): the builder's guard is lent to the page's tabs, so Quick → Advanced asks before it drops the typing
  test('registers a guard that asks before leaving a dirty builder, and proceeds after Discard (owner decision 22)', async () => {
    const user = userEvent.setup()
    let guard = null
    const registerLeaveGuard = vi.fn(next => { guard = next })
    const { container } = await renderComponent(CURRENCY, { registerLeaveGuard })
    const proceed = vi.fn()
    act(() => { guard(proceed) })
    expect(proceed).toHaveBeenCalledTimes(1)

    await openTemplate(user, container, 'first_order')
    await user.type(screen.getByRole('textbox', { name: 'Promotion name' }), ' 2')
    proceed.mockClear()
    act(() => { guard(proceed) })
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard unsaved changes?' })
    expect(proceed).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(proceed).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Promotion name' }).value).toMatch(/ 2$/)

    act(() => { guard(proceed) })
    await user.click(within(await screen.findByRole('alertdialog', { name: 'Discard unsaved changes?' })).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(proceed).toHaveBeenCalledTimes(1))
  })

  test('asks before closing a builder that contains unsaved changes, with the focus on Keep editing', async () => {
    const user = userEvent.setup()
    const { container } = await renderComponent(CURRENCY)
    await openTemplate(user, container, 'first_order')
    await user.type(screen.getByRole('textbox', { name: 'Promotion name' }), ' 2')

    fireEvent.keyDown(window, { key: 'Escape' })
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard unsaved changes?' })
    expect(regionOf()).not.toBeNull()
    expect(dialog).toHaveTextContent('Your promotion changes have not been saved.')
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Keep editing' })).toHaveFocus())

    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(regionOf()).not.toBeNull()

    await user.click(buttonNamed('Cancel'))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(regionOf()).toBeNull())
  })

  test('does not close the builder when a nested control already handled Escape', async () => {
    const { container } = await renderComponent(CURRENCY)
    fireEvent.click(templateButton(container, 'first_order'))
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    event.preventDefault()
    act(() => { window.dispatchEvent(event) })
    expect(regionOf()).not.toBeNull()
  })
})

describe('PromotionJourneysListingUI · editing an existing promotion', () => {
  const existing = {
    id: 99,
    name: 'Existing welcome offer',
    rate: 20,
    rate_type: 1,
    minimum: 30,
    limit_per_user: 1,
    start: '2026-09-01 09:00:00',
    end: '2026-09-30 22:00:00',
    include_options: true,
    user_order_count: 0,
    user_order_count_condition: '=',
    businesses: []
  }

  test('opens an existing promotion in the same Quick Offers builder', async () => {
    const user = userEvent.setup()
    await renderComponent(CURRENCY, { promotionListState: { promotions: [existing], loading: false, error: null } })
    await user.click(buttonNamed('Edit promotion'))
    expect(screen.getByRole('heading', { level: 2, name: 'Edit promotion' })).toBeInTheDocument()
    expect(document.body.textContent).toContain('Customers with exactly 0 orders')
    expect(screen.getByRole('textbox', { name: 'Promotion name' })).toHaveValue('Existing welcome offer')
    expect(within(screen.getByRole('group', { name: 'Product options' })).getByRole('button', { name: 'Include' })).toHaveAttribute('aria-pressed', 'true')
    // the stored day and time come into the pickers in the project's format
    expect(dateTrigger('Start date')).toHaveTextContent('01/09/2026')
    expect(timeSelect('Start time Hour')).toHaveValue('9')
    expect(timeSelect('End time Hour')).toHaveValue('22')
    expect(document.body.textContent).not.toContain('Manage in Advanced Offers')
  })

  // a description saved by an older version carries raw stamps; the textarea shows them as dates
  describe('with a legacy description that carries ISO stamps', () => {
    const legacy = {
      id: 99,
      name: 'Legacy welcome offer',
      description: 'Customers with exactly 0 orders receive 20% off, from 2026-09-01T16:57 to 2026-09-30T16:57.',
      enabled: false,
      auto: true,
      type: 1,
      condition_type: 1,
      target: 1,
      rate: 20,
      rate_type: 1,
      minimum: 30,
      max_discount: 20,
      limit_per_user: 1,
      start: '2026-09-01 16:57:00',
      end: '2026-09-30 16:57:00',
      user_order_count: 0,
      user_order_count_condition: '=',
      businesses: [{ id: 10 }]
    }
    const openLegacy = async () => {
      const user = userEvent.setup()
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { id: 99, enabled: false } }) })
      await renderComponent(CURRENCY, { promotionListState: { promotions: [legacy], loading: false, error: null } })
      await user.click(buttonNamed('Edit promotion'))
      return user
    }

    test('the Description textarea shows the stamps as dates in the project format', async () => {
      await openLegacy()
      const textarea = screen.getByRole('textbox', { name: /^Description/ })
      expect(textarea.value).not.toMatch(/\d{4}-\d{2}-\d{2}T/)
      expect(textarea.value).toBe('Customers with exactly 0 orders receive 20% off, from 01/09/2026 16:57 to 30/09/2026 16:57.')
    })

    test('saving without touching the textarea does not send the description', async () => {
      const user = await openLegacy()
      const name = screen.getByRole('textbox', { name: 'Promotion name' })
      await user.clear(name)
      await user.type(name, 'Renamed legacy offer')
      await user.click(buttonNamed('Save changes'))
      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
      expect(lastBody()).toEqual({ name: 'Renamed legacy offer', enabled: false })
    })

    test('when the person edits the textarea, what they see is what is sent', async () => {
      const user = await openLegacy()
      const textarea = screen.getByRole('textbox', { name: /^Description/ })
      await user.type(textarea, ' Weekends only.')
      await user.click(buttonNamed('Save changes'))
      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
      expect(lastBody()).toEqual({
        description: 'Customers with exactly 0 orders receive 20% off, from 01/09/2026 16:57 to 30/09/2026 16:57. Weekends only.',
        enabled: false
      })
    })
  })

  // the live dictionary has START_DATE = «Start Date» (and END_DATE = «End Date»); the builder has its own keys
  test('labels the dates «Start date» and «End date» even when the dictionary writes START_DATE as «Start Date»', async () => {
    hookState.dictionary = { START_DATE: 'Start Date', END_DATE: 'End Date' }
    const user = userEvent.setup()
    const { container } = await renderComponent(CURRENCY)
    await openTemplate(user, container, 'first_order')
    expect(dateTrigger('Start date')).toBeInTheDocument()
    expect(dateTrigger('End date')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /^Start Date/ })).toBeNull()
    expect(screen.queryByRole('combobox', { name: /^End Date/ })).toBeNull()
  })

  test.each([
    ['product', { condition_type: 2, products: [{ id: 22, business_id: 10, pivot: { include: 0 } }] }],
    ['category', { condition_type: 3, categories: [{ id: 7, business_id: 10, include: false }] }]
  ])('routes an existing promotion with an excluded %s to Advanced Offers', async (_relationship, relationshipState) => {
    const user = userEvent.setup()
    const onOpenAdvancedPromotion = vi.fn()
    const promotion = {
      id: 99,
      name: 'Promotion with exclusions',
      rate: 1,
      rate_type: 2,
      minimum: 2,
      businesses: [{ id: 10 }],
      ...relationshipState
    }
    await renderComponent(CURRENCY, {
      promotionListState: { promotions: [promotion], loading: false, error: null },
      onOpenAdvancedPromotion
    })

    await user.click(buttonNamed('Edit promotion'))

    expect(onOpenAdvancedPromotion).toHaveBeenCalledWith(promotion)
    expect(regionOf()).toBeNull()
    expect(document.body.textContent).not.toContain('Save changes')
  })

  test('turns off hidden product options when updating an existing Buy X, get Y promotion', async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { id: 99, enabled: false } }) })
    const promotion = {
      id: 99,
      name: 'Legacy options-included BOGO',
      enabled: false,
      condition_type: 2,
      target: 1,
      rate: 1,
      rate_type: 2,
      minimum: 2,
      limit_per_user: 1,
      include_options: 1,
      start: '2026-09-01 09:00:00',
      end: '2026-09-30 22:00:00',
      businesses: [{ id: 10 }],
      products: [{ id: 22, business_id: 10 }]
    }
    const onOpenAdvancedPromotion = vi.fn()
    await renderComponent(CURRENCY, {
      promotionListState: { promotions: [promotion], loading: false, error: null },
      onOpenAdvancedPromotion
    })

    await user.click(buttonNamed('Edit promotion'))
    expect(onOpenAdvancedPromotion).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Extra option charges will not be discounted.')
    expect(screen.queryByRole('group', { name: 'Product options' })).toBeNull()

    const name = screen.getByRole('textbox', { name: 'Promotion name' })
    await user.clear(name)
    await user.type(name, 'Renamed legacy BOGO')
    await user.click(buttonNamed('Save changes'))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))

    expect(lastBody()).toEqual({
      name: 'Renamed legacy BOGO',
      include_options: false,
      enabled: false
    })
  })

  test('saving changes preserves the enabled state of an existing active promotion', async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { id: 99, enabled: true } }) })
    const promotion = {
      id: 99,
      name: 'Active welcome offer',
      enabled: true,
      auto: true,
      type: 1,
      condition_type: 1,
      target: 1,
      rate: 20,
      rate_type: 1,
      minimum: 30,
      max_discount: 20,
      limit_per_user: 1,
      start: '2026-09-01 09:00:00',
      end: '2026-09-30 22:00:00',
      user_order_count: 0,
      user_order_count_condition: '=',
      businesses: [{ id: 10 }]
    }
    await renderComponent(CURRENCY, {
      promotionListState: { promotions: [promotion], loading: false, error: null },
      paginationProps: { currentPage: 3, pageSize: 10, totalPages: 3, totalItems: 25 }
    })

    await user.click(buttonNamed('Edit promotion'))
    const name = screen.getByRole('textbox', { name: 'Promotion name' })
    await user.clear(name)
    await user.type(name, 'Renamed active offer')
    await user.click(buttonNamed('Save changes'))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))

    expect(global.fetch).toHaveBeenCalledWith('https://api.test/offers/99', expect.objectContaining({ method: 'POST' }))
    expect(lastBody()).toEqual({ name: 'Renamed active offer', enabled: true })
    await waitFor(() => expect(baseProps.getPromotions).toHaveBeenCalledWith(3, 10))
    await waitFor(() => expect(document.body.textContent).toContain('Promotion templates'))
  })
})

// redesign (row 81, review r1 R7, R8): the day picker and the row buttons against main
describe('PromotionJourneysListingUI · gaps against main (R7, R8)', () => {
  // a day already set is in the box: clear it first, then type the new one
  const replaceDay = async (user, name, digits) => {
    await user.click(dateTrigger(name))
    const dialog = await screen.findByRole('dialog', { name: 'Select a date' })
    const box = within(dialog).getByRole('textbox')
    await user.clear(box)
    await user.type(box, digits)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).toBeNull())
  }

  const existing = {
    id: 99,
    name: 'Existing welcome offer',
    rate: 20,
    rate_type: 1,
    minimum: 30,
    limit_per_user: 1,
    start: '2026-09-01 09:00:00',
    end: '2026-09-30 22:00:00',
    include_options: true,
    user_order_count: 0,
    user_order_count_condition: '=',
    businesses: []
  }

  test('picking the day that is already set does not make the form dirty (R7)', async () => {
    const user = userEvent.setup()
    await renderComponent(CURRENCY, { promotionListState: { promotions: [existing], loading: false, error: null } })
    await user.click(buttonNamed('Edit promotion'))
    await replaceDay(user, 'Start date', '01092026')
    expect(dateTrigger('Start date')).toHaveTextContent('01/09/2026')
    await user.click(buttonNamed('Cancel'))
    // nothing changed: the builder closes with no question
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await waitFor(() => expect(regionOf()).toBeNull())
  })

  test('picking another day still dirties the form (R7 kept the guard)', async () => {
    const user = userEvent.setup()
    await renderComponent(CURRENCY, { promotionListState: { promotions: [existing], loading: false, error: null } })
    await user.click(buttonNamed('Edit promotion'))
    await replaceDay(user, 'Start date', '02092026')
    expect(dateTrigger('Start date')).toHaveTextContent('02/09/2026')
    await user.click(buttonNamed('Cancel'))
    expect(await screen.findByRole('alertdialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
  })

  test('the Delete of a row is disabled while that row\'s switch saves, the others stay on (R8)', async () => {
    const user = userEvent.setup()
    let finish
    const updateJourneyStatus = vi.fn(() => new Promise(resolve => { finish = resolve }))
    await renderComponent(CURRENCY, {
      updateJourneyStatus,
      promotionListState: { promotions: [{ ...existing, enabled: false }, { ...existing, id: 100, name: 'Second offer', enabled: false }], loading: false, error: null }
    })
    await user.click(screen.getByRole('switch', { name: 'Enable Existing welcome offer' }))
    await waitFor(() => expect(updateJourneyStatus).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'Delete Existing welcome offer' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete Second offer' })).not.toBeDisabled()
    await act(async () => { finish({}) })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete Existing welcome offer' })).not.toBeDisabled())
  })
})

describe('PromotionJourneysListingUI · Your promotions (the shared list)', () => {
  test('shows the promotions in the shared list with a status in words worked out from the switch and the dates', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-15T12:00:00'))
    const promotions = [
      { id: 1, name: 'Running offer', description: 'Now', enabled: true, start: '2026-09-01 00:00:00', end: '2026-09-30 23:59:59', rate_type: 1, rate: 10 },
      { id: 2, name: 'Coming offer', description: 'Soon', enabled: true, start: '2026-10-01 00:00:00', end: '2026-10-31 23:59:59', rate_type: 1, rate: 10 },
      { id: 3, name: 'Past offer', description: 'Then', enabled: true, start: '2026-08-01 00:00:00', end: '2026-08-31 23:59:59', rate_type: 1, rate: 10 },
      { id: 4, name: 'Paused offer', description: 'Never', enabled: false, start: '2026-09-01 00:00:00', end: '2026-09-30 23:59:59', rate_type: 1, rate: 10 }
    ]
    const { container } = await renderComponent(CURRENCY, {
      promotionListState: { promotions, loading: false, error: null },
      paginationProps: { currentPage: 1, pageSize: 10, totalPages: 1, totalItems: 4 }
    })
    const row = id => container.querySelector(`[data-row-id="${id}"]`)
    expect(row(1)).toHaveTextContent('Active')
    expect(row(2)).toHaveTextContent('Scheduled')
    expect(row(3)).toHaveTextContent('Ended')
    expect(row(4)).toHaveTextContent('Off')
    // the description stays on the row (it was the main datum of the card), the dates are the project's, never ISO
    expect(row(1)).toHaveTextContent('Now')
    expect(row(1)).toHaveTextContent(util.parseDate('2026-09-01 00:00:00', { utc: false, dateOnly: true }))
    expect(container.querySelector('tbody').textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(screen.getByRole('heading', { level: 2, name: 'Your promotions' })).toBeInTheDocument()
  })

  test('the search box sends the text once, after the wait, and shares the controller state with Advanced', async () => {
    vi.useFakeTimers()
    const onSearch = vi.fn()
    await renderComponent(CURRENCY, { onSearch, searchValue: '', promotionListState: { promotions: [welcome], loading: false, error: null } })
    const search = screen.getByRole('searchbox', { name: 'Search promotions' })
    fireEvent.change(search, { target: { value: 'wel' } })
    fireEvent.change(search, { target: { value: 'welc' } })
    act(() => { vi.advanceTimersByTime(749) })
    expect(onSearch).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledWith('welc')
  })

  test('an empty result of a search says so and Clear search asks for the whole list', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    await renderComponent(CURRENCY, { onSearch, searchValue: 'zzz', promotionListState: { promotions: [], loading: false, error: null } })
    expect(screen.getByText('No promotions match your search')).toBeInTheDocument()
    // the empty result brings its own «Clear search» (the search box has one too: both ask for the whole list)
    const emptyState = screen.getByText('No promotions match your search').closest('.odc-state')
    await user.click(within(emptyState).getByRole('button', { name: 'Clear search' }))
    expect(onSearch).toHaveBeenCalledWith('')
  })

  test('says so when there is nothing yet', async () => {
    await renderComponent(CURRENCY)
    expect(screen.getByText('No promotions yet. Choose a template to create your first draft.')).toBeInTheDocument()
  })

  test('toggles a promotion without opening the editor or losing scroll position', async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { id: 99, enabled: true } }) })
    const scrollElement = document.scrollingElement || document.documentElement
    const getPromotions = vi.fn().mockImplementation(async () => {
      scrollElement.scrollTop = 0
    })
    await renderComponent(CURRENCY, { promotionListState: { promotions: [welcome], loading: false, error: null }, getPromotions })
    scrollElement.scrollTop = 650
    await user.click(screen.getByRole('switch', { name: 'Enable Welcome offer' }))
    await act(async () => new Promise(resolve => window.requestAnimationFrame(resolve)))
    expect(global.fetch).toHaveBeenCalledWith('https://api.test/offers/99', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ enabled: true })
    }))
    expect(getPromotions).toHaveBeenCalledWith(1, 10)
    expect(scrollElement.scrollTop).toBe(650)
    expect(regionOf()).toBeNull()
    expect(document.body.textContent).not.toContain('Promotion name')
  })

  test('a failed toggle keeps the switch where it was and says why in the row, with no page-level alert (decision 4, PE-03)', async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: true, result: ['Status update failed'] }) })
    const getPromotions = vi.fn()
    const { container } = await renderComponent(CURRENCY, { promotionListState: { promotions: [welcome], loading: false, error: null }, getPromotions })
    await user.click(screen.getByRole('switch', { name: 'Enable Welcome offer' }))
    const message = await screen.findByText('Status update failed')
    expect(container.querySelector('[data-row-id="99"]')).toContainElement(message)
    expect(screen.getByRole('switch', { name: 'Enable Welcome offer' })).not.toBeChecked()
    expect(getPromotions).not.toHaveBeenCalled()
    // the page is usable and the message is the row's, not a banner above the list
    expect(container.querySelector('[data-testid="promotion-journeys"]')).not.toBeNull()
    expect(container.querySelector('section > [role="alert"]')).toBeNull()
    expect(container.textContent).toContain('Welcome offer')
  })

  // redesign review r1 (R4): main ignored a press while another toggle was saving, silently; no failure notice for a request never sent
  test('a press while another toggle is saving is ignored, with no failure notice', async () => {
    const user = userEvent.setup()
    let release
    global.fetch = vi.fn().mockImplementation(() => new Promise(resolve => { release = () => resolve({ ok: true, json: async () => ({ error: false, result: { id: 99, enabled: true } }) }) }))
    const other = { ...welcome, id: 100, name: 'Other offer' }
    const { container } = await renderComponent(CURRENCY, { promotionListState: { promotions: [welcome, other], loading: false, error: null }, getPromotions: vi.fn() })
    await user.click(screen.getByRole('switch', { name: 'Enable Welcome offer' }))
    await user.click(screen.getByRole('switch', { name: 'Enable Other offer' }))
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-row-id="100"]').textContent).not.toContain("We couldn't change this promotion")
    await act(async () => { release() })
  })

  test('asks for confirmation naming the promotion, and cancels without deleting it', async () => {
    const user = userEvent.setup()
    await renderComponent(CURRENCY, { promotionListState: { promotions: [welcome], loading: false, error: null } })

    await user.click(buttonNamed('Delete Welcome offer'))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete "Welcome offer"?' })
    expect(dialog).toHaveTextContent("This can't be undone.")
    expect(within(dialog).getByRole('button', { name: 'Delete promotion' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(global.fetch).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Welcome offer')

    await user.click(buttonNamed('Delete Welcome offer'))
    await screen.findByRole('alertdialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(global.fetch).not.toHaveBeenCalled()
    expect(regionOf()).toBeNull()
  })

  test('deletes once, refreshes the correct page and reports success', async () => {
    const user = userEvent.setup()
    let resolveDelete
    global.fetch = vi.fn(() => new Promise(resolve => { resolveDelete = resolve }))
    const getPromotions = vi.fn()
    const handleSuccessDeletePromotion = vi.fn()
    const promotion = { id: 99, name: 'Last page offer', description: 'Description', enabled: false }
    await renderComponent(CURRENCY, {
      promotionListState: { promotions: [promotion], loading: false, error: null },
      paginationProps: { currentPage: 2, pageSize: 10, totalPages: 2, totalItems: 11 },
      getPromotions,
      handleSuccessDeletePromotion
    })

    await user.click(buttonNamed('Delete Last page offer'))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete promotion' }))
    // busy: the same button cannot fire a second request
    expect(within(dialog).getByRole('button', { name: 'Delete promotion' })).toHaveAttribute('aria-busy', 'true')
    await user.click(within(dialog).getByRole('button', { name: 'Delete promotion' }))
    expect(global.fetch).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveDelete({ ok: true, status: 200, json: async () => ({ error: false, result: { id: 99 } }) })
    })

    expect(global.fetch).toHaveBeenCalledWith('https://api.test/offers/99', expect.objectContaining({ method: 'DELETE' }))
    expect(handleSuccessDeletePromotion).toHaveBeenCalledWith(99)
    expect(getPromotions).toHaveBeenCalledWith(1, 10)
    expect(hookState.showToast).toHaveBeenCalledWith('success', 'Promotion deleted')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  test('keeps the confirmation and promotion available after a delete error', async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({ error: true, result: ['Offer is in use'] }) })
    const promotion = { id: 99, name: 'Protected offer', description: 'Description', enabled: true }
    const { container } = await renderComponent(CURRENCY, { promotionListState: { promotions: [promotion], loading: false, error: null } })

    await user.click(buttonNamed('Delete Protected offer'))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete promotion' }))

    expect(await within(dialog).findByText('Offer is in use')).toBeInTheDocument()
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Offer is in use')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(container.textContent).toContain('Protected offer')
    expect(container.querySelector('[data-testid="promotion-journeys"]')).not.toBeNull()
  })

  test('shows at most ten promotions and requests page two for item eleven', async () => {
    const user = userEvent.setup()
    const promotions = Array.from({ length: 11 }, (_, index) => ({
      id: index + 1,
      name: `Promotion ${index + 1}`,
      description: `Description ${index + 1}`,
      enabled: false
    }))
    const getPromotions = vi.fn()
    const { container } = await renderComponent(CURRENCY, {
      promotionListState: { promotions, loading: false, error: null },
      paginationProps: { currentPage: 1, pageSize: 10, totalPages: 2, totalItems: 11 },
      getPromotions
    })
    expect(screen.getAllByRole('switch')).toHaveLength(10)
    expect(container.querySelector('[data-row-id="11"]')).toBeNull()
    // the pager of the shared list: no size selector (Quick keeps its ten)
    expect(screen.queryByText('Items per page')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(getPromotions).toHaveBeenCalledWith(2, 10)
  })

  test('refreshes page one and keeps the newly created promotion visible', async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { id: 77, name: 'First purchase', enabled: false } }) })
    const getPromotions = vi.fn()
    const { container } = await renderComponent(CURRENCY, { getPromotions })
    await openTemplate(user, container, 'first_order')
    await completeFirstPurchase(user)
    await user.click(buttonNamed('Save draft'))
    await waitFor(() => expect(regionOf()).toBeNull())
    expect(getPromotions.mock.calls).toEqual([[1, 10]])
    expect(container.textContent).toContain('Promotion templates')
  })

  test('a list that cannot load keeps the templates in view and shows the error with Retry on the current page (decision 3)', async () => {
    const user = userEvent.setup()
    const getPromotions = vi.fn()
    const { container } = await renderComponent(CURRENCY, {
      promotionListState: { promotions: [], loading: false, error: ['Advanced Offers is not available'] },
      paginationProps: { currentPage: 3, pageSize: 10, totalPages: 3, totalItems: 25 },
      getPromotions
    })
    expect(templateButton(container, 'first_order')).not.toBeNull()
    expect(container.querySelectorAll('[data-template-key]')).toHaveLength(8)
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load promotions.")
    expect(screen.getByRole('alert')).toHaveTextContent('Advanced Offers is not available')
    await user.click(buttonNamed('Retry'))
    expect(getPromotions).toHaveBeenCalledWith(3, 10)
  })

  test('the list is drawn from the first load: a skeleton while it has no rows, not the empty message', async () => {
    const { container } = await renderComponent(CURRENCY, { promotionListState: { promotions: [], loading: true, error: null } })
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByText('No promotions yet. Choose a template to create your first draft.')).toBeNull()
  })
})
