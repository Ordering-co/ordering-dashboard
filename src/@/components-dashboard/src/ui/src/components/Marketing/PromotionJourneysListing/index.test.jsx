import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { PromotionJourneysListingUI } from './index'

const hookState = vi.hoisted(() => ({
  configs: {},
  ordering: { root: 'https://api.test' },
  showToast: vi.fn(),
  token: 'token',
  user: { level: 0 }
}))

vi.mock('../../../../../index', () => ({
  EnterprisePromotionList: () => null,
  ToastType: { Success: 'success' },
  useApi: () => [hookState.ordering],
  useConfig: () => [{ configs: hookState.configs }],
  useLanguage: () => [{}, (key, fallback) => fallback || key],
  useSession: () => [{ token: hookState.token, user: hookState.user }],
  useToast: () => [{}, { showToast: hookState.showToast }]
}))

vi.mock('../../Shared', () => ({
  Confirm: ({ open, title, content, children, onAccept, onCancel, acceptText, cancelText }) => open
    ? (
      <div role='dialog' aria-label={title}>
        <p>{content}</p>
        {children}
        <button type='button' onClick={onCancel}>{cancelText}</button>
        <button type='button' onClick={onAccept}>{acceptText}</button>
      </div>
      )
    : null,
  Schedule: () => <div>Schedule</div>,
  SelectBusinessCategories: () => <div>Categories</div>
}))

vi.mock('./JourneyProductPicker', () => ({
  JourneyProductPicker: ({ setSelectedProductsIds, businessId }) => (
    <button type='button' data-business-id={businessId} onClick={() => setSelectedProductsIds({ 22: { id: 22, include: true } })}>Select product 22</button>
  )
}))

global.IS_REACT_ACT_ENVIRONMENT = true

const theme = {
  colors: {
    primary: '#266DF0',
    backgroundPage: '#FFFFFF',
    headingColor: '#0B0C0D',
    lightGray: '#3F4145',
    borderColor: '#DEE0E3',
    secundary: '#F6F7F7'
  }
}

const setInputValue = (input, value) => {
  const prototype = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value').set
  act(() => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

const setSelectValue = (select, value) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
  act(() => {
    setter.call(select, value)
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

const baseProps = {
  promotionListState: { promotions: [], loading: false, error: null },
  businessesList: { businesses: [{ id: 10, name: 'Store One', slug: 'store-one' }], loading: false },
  businessesPaginationProps: { currentPage: 1, totalPages: 1, pageSize: 10 },
  searchBusinesses: vi.fn(),
  handleChangeBusinessPage: vi.fn(),
  sitesState: { sites: [{ id: 3, name: 'Website' }], loading: false },
  getPromotions: vi.fn(),
  paginationProps: { currentPage: 1, pageSize: 10, totalPages: 1, totalItems: 0 },
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

const renderComponent = (configs, props = {}) => {
  hookState.configs = configs
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    const componentProps = { ...baseProps, ...props }
    root.render(
      <ThemeProvider theme={theme}>
        <PromotionJourneysListingUI
          {...componentProps}
          loadAllJourneyBusinesses={props.loadAllJourneyBusinesses || vi.fn().mockResolvedValue(componentProps.businessesList.businesses)}
        />
      </ThemeProvider>
    )
  })
  return { container, root }
}

const completeFirstPurchase = async container => {
  const numberInputs = container.querySelectorAll('input[type="number"]')
  const dateInputs = container.querySelectorAll('input[type="datetime-local"]')
  setInputValue(numberInputs[0], '20')
  setInputValue(numberInputs[1], '200')
  setInputValue(numberInputs[2], '40')
  setInputValue(dateInputs[0], '2026-09-01T09:00')
  setInputValue(dateInputs[1], '2026-09-30T22:00')
  expect(dateInputs[0].value).toBe('2026-09-01T09:00')
  expect(dateInputs[1].value).toBe('2026-09-30T22:00')
  await act(async () => Promise.resolve())
}

describe('PromotionJourneysListingUI', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  test('renders the catalog and opens the guided builder', () => {
    const { container, root } = renderComponent({ format_number_currency: { value: '$' } })
    expect(container.textContent).toContain('Promotion templates')
    expect(container.textContent).not.toContain('Validated before activation')
    expect(container.textContent).not.toContain('All templates')
    expect(container.textContent).not.toContain('Acquisition')
    const firstPurchase = container.querySelector('[data-template-key="first_order"]')
    expect(firstPurchase.children).toHaveLength(2)
    act(() => firstPurchase.click())
    expect(container.textContent).toContain('Customers with exactly 0 orders')
    expect(container.textContent).not.toContain('Review')
    expect(container.textContent).not.toContain('Test')
    expect(container.textContent).toContain('Save draft')
    expect(container.textContent).toContain('Activate')
    expect(container.querySelector('input').value).toBe('First purchase')
    expect(container.textContent).toContain('This will be the offer name your customers see at checkout.')
    expect(container.textContent).not.toContain('I reviewed dates and times')
    expect(container.textContent).not.toContain('Advanced settings')
    expect(container.textContent).not.toContain('Uses per customer')
    expect(container.textContent).not.toContain('Sites')
    expect(container.textContent).toContain('Product options')
    expect(container.textContent).toContain('Include product options')
    expect(container.textContent).toContain('Do not include product options')
    expect(container.querySelector('textarea').value).toContain('Customers with exactly 0 orders')
    const startDate = container.querySelector('input[type="datetime-local"]')
    startDate.showPicker = vi.fn()
    act(() => startDate.click())
    expect(startDate.showPicker).toHaveBeenCalledTimes(1)
    act(() => root.unmount())
  })

  test('does not show product options for a delivery-fee discount', () => {
    const { container, root } = renderComponent({ format_number_currency: { value: '$' } })
    act(() => container.querySelector('[data-template-key="free_delivery"]').click())
    expect(container.textContent).not.toContain('Product options')
    expect(container.textContent).not.toContain('Include product options')
    act(() => root.unmount())
  })

  test('uses one business selector as the Buy X, get Y scope and saves selected products', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: false, result: { id: 78, enabled: false } })
    })
    const { container, root } = renderComponent({ format_number_currency: { value: '$' } })

    expect(container.textContent).toContain('Happy hour')
    expect(container.textContent).toContain('We miss you')
    expect(container.textContent).toContain('Make items free from the same product selection used to qualify.')
    expect(container.textContent).not.toContain('Slow hours boost')
    expect(container.textContent).not.toContain('Win back inactive customers')

    act(() => container.querySelector('[data-template-key="buy_x_get_y"]').click())
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
    expect(container.textContent).toContain('Rule: When the cart contains 2 eligible items, 1 of them become free.')
    expect(container.textContent).not.toContain('Minimum items')
    expect(container.textContent).not.toContain('Free products')

    const businessSelect = [...container.querySelectorAll('select')]
      .find(select => [...select.options].some(option => option.textContent === 'Store One'))
    setSelectValue(businessSelect, '10')
    const productButton = [...container.querySelectorAll('button')].find(button => button.textContent === 'Select product 22')
    expect(productButton).toBeTruthy()
    expect(productButton.getAttribute('data-business-id')).toBe('10')
    act(() => productButton.click())

    const dateInputs = container.querySelectorAll('input[type="datetime-local"]')
    setInputValue(dateInputs[0], '2026-09-01T09:00')
    setInputValue(dateInputs[1], '2026-09-30T22:00')

    const saveDraft = [...container.querySelectorAll('button')].find(button => button.textContent === 'Save draft')
    await act(async () => saveDraft.click())

    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body).toMatchObject({
      businesses: [10],
      sites: [3],
      products: [{ id: 22, include: true, is_condition: true }],
      rate: 1,
      minimum: 2,
      include_options: false,
      enabled: false
    })
    expect(body.categories).toBeUndefined()
    act(() => root.unmount())
  })

  test('blocks an invalid Buy X, get Y quantity before saving', () => {
    global.fetch = vi.fn()
    const { container, root } = renderComponent({ format_number_currency: { value: '$' } })
    act(() => container.querySelector('[data-template-key="buy_x_get_y"]').click())
    const businessSelect = [...container.querySelectorAll('select')]
      .find(select => [...select.options].some(option => option.textContent === 'Store One'))
    setSelectValue(businessSelect, '10')
    act(() => [...container.querySelectorAll('button')].find(button => button.textContent === 'Select product 22').click())
    const quantityInputs = container.querySelectorAll('input[type="number"]')
    setInputValue(quantityInputs[2], '2')
    const saveDraft = [...container.querySelectorAll('button')].find(button => button.textContent === 'Save draft')
    act(() => saveDraft.click())
    expect(container.textContent).toContain('Free items must be fewer than the eligible items required in the cart.')
    expect(global.fetch).not.toHaveBeenCalled()
    act(() => root.unmount())
  })

  test('changing the Buy X, get Y store clears products selected for the previous store', () => {
    global.fetch = vi.fn()
    const businesses = [
      { id: 10, name: 'Store One', slug: 'store-one' },
      { id: 20, name: 'Store Two', slug: 'store-two' }
    ]
    const { container, root } = renderComponent(
      { format_number_currency: { value: '$' } },
      {
        businessesList: { businesses, loading: false },
        businessesPaginationProps: { currentPage: 1, totalPages: 1, totalItems: 2, pageSize: 10 }
      }
    )

    act(() => container.querySelector('[data-template-key="buy_x_get_y"]').click())
    const businessSelect = [...container.querySelectorAll('select')]
      .find(select => [...select.options].some(option => option.textContent === 'Store One'))
    setSelectValue(businessSelect, '10')
    act(() => [...container.querySelectorAll('button')].find(button => button.textContent === 'Select product 22').click())
    setSelectValue(businessSelect, '20')
    expect([...container.querySelectorAll('button')].find(button => button.textContent === 'Select product 22').getAttribute('data-business-id')).toBe('20')

    act(() => [...container.querySelectorAll('button')].find(button => button.textContent === 'Save draft').click())
    expect(container.textContent).toContain('Select at least one product.')
    expect(global.fetch).not.toHaveBeenCalled()
    act(() => root.unmount())
  })

  test('keeps the loyalty template available without an addon flag', () => {
    const { container, root } = renderComponent({ format_number_currency: { value: '$' } })
    const loyalty = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Loyalty level reward'))
    expect(loyalty.disabled).toBe(false)
    expect(loyalty.textContent).not.toContain('Requires Loyalty Levels')
    act(() => root.unmount())
  })

  test('saves the editable natural description with every site and business included automatically', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: false, result: { id: 77, enabled: false } })
    })
    const { container, root } = renderComponent({ format_number_currency: { value: '$' } })
    act(() => container.querySelector('[data-template-key="first_order"]').click())
    await completeFirstPurchase(container)
    const description = container.querySelector('textarea')
    expect(description.value).toContain('Customers with exactly 0 orders receive 20% off across all businesses and sales channels')
    setInputValue(description, 'Custom customer-facing description')
    const saveDraft = [...container.querySelectorAll('button')].find(button => button.textContent === 'Save draft')
    await act(async () => saveDraft.click())
    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body).toMatchObject({ description: 'Custom customer-facing description', enabled: false, businesses: [10], sites: [3] })
    expect(baseProps.getPromotions).toHaveBeenCalledWith(1, 10)
    expect(container.textContent).toContain('Your promotions')
    expect(container.textContent).not.toContain('Promotion name')
    act(() => root.unmount())
  })

  test('validates and activates directly from Configure', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { id: 77, enabled: true } }) })
    const { container, root } = renderComponent({ format_number_currency: { value: '$' } })
    act(() => container.querySelector('[data-template-key="first_order"]').click())
    await completeFirstPurchase(container)
    const activate = [...container.querySelectorAll('button')].find(button => button.textContent === 'Activate')
    await act(async () => activate.click())
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).enabled).toBe(true)
    expect(baseProps.getPromotions).toHaveBeenCalledWith(1, 10)
    expect(container.textContent).toContain('Your promotions')
    expect(container.textContent).not.toContain('Promotion name')
    act(() => root.unmount())
  })

  test('blocks save and activation in Configure before calling the API when fields are missing', () => {
    global.fetch = vi.fn()
    const { container, root } = renderComponent({ format_number_currency: { value: '$' } })
    act(() => container.querySelector('[data-template-key="first_order"]').click())
    const activate = [...container.querySelectorAll('button')].find(button => button.textContent === 'Activate')
    act(() => activate.click())
    expect(container.textContent).toContain('Enter a benefit greater than 0.')
    expect(container.textContent).toContain('Select a start date.')
    expect(global.fetch).not.toHaveBeenCalled()
    act(() => root.unmount())
  })

  test('blocks submission before the API when automatic sales-channel scope is unavailable', async () => {
    global.fetch = vi.fn()
    const loadPromotionSites = vi.fn()
    const { container, root } = renderComponent(
      { format_number_currency: { value: '$' } },
      {
        sitesState: { sites: [], loading: false, error: ['Channels unavailable'] },
        loadPromotionSites
      }
    )
    act(() => container.querySelector('[data-template-key="first_order"]').click())
    await completeFirstPurchase(container)
    act(() => [...container.querySelectorAll('button')].find(button => button.textContent === 'Save draft').click())

    expect(container.textContent).toContain('Sales channels could not be loaded. Retry before saving.')
    expect(global.fetch).not.toHaveBeenCalled()
    act(() => [...container.querySelectorAll('button')].find(button => button.textContent === 'Retry').click())
    expect(loadPromotionSites).toHaveBeenCalledTimes(1)
    act(() => root.unmount())
  })

  test('allows saving when sales channels loaded successfully with an empty list', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { id: 77, enabled: false } }) })
    const { container, root } = renderComponent(
      { format_number_currency: { value: '$' } },
      { sitesState: { sites: [], loading: false, error: null } }
    )
    act(() => container.querySelector('[data-template-key="first_order"]').click())
    await completeFirstPurchase(container)
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Save draft').click())

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.enabled).toBe(false)
    expect(body).not.toHaveProperty('sites')
    expect(container.textContent).toContain('Your promotions')
    act(() => root.unmount())
  })

  test('keeps the builder open and creates no ghost card when saving fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: true, result: ['The offer could not be saved'] })
    })
    const getPromotions = vi.fn()
    const { container, root } = renderComponent(
      { format_number_currency: { value: '$' } },
      { getPromotions }
    )
    act(() => container.querySelector('[data-template-key="first_order"]').click())
    await completeFirstPurchase(container)
    const saveDraft = [...container.querySelectorAll('button')].find(button => button.textContent === 'Save draft')
    await act(async () => saveDraft.click())
    expect(container.textContent).toContain('The offer could not be saved')
    expect(container.querySelector('[role="region"]')).not.toBeNull()
    expect(container.querySelector('[data-promotion-id]')).toBeNull()
    expect(getPromotions).not.toHaveBeenCalled()
    act(() => root.unmount())
  })

  test('retries a failed atomic activation without creating a hidden draft', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: true, result: ['Activation failed'] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: false, result: { id: 77, enabled: true } }) })
    const { container, root } = renderComponent({ format_number_currency: { value: '$' } })
    act(() => container.querySelector('[data-template-key="first_order"]').click())
    await completeFirstPurchase(container)
    let activate = [...container.querySelectorAll('button')].find(button => button.textContent === 'Activate')
    await act(async () => activate.click())
    expect(container.textContent).toContain('Activation failed')
    expect(container.querySelector('[role="region"]')).not.toBeNull()
    activate = [...container.querySelectorAll('button')].find(button => button.textContent === 'Activate')
    await act(async () => activate.click())
    expect(global.fetch.mock.calls.map(call => call[0])).toEqual([
      'https://api.test/offers',
      'https://api.test/offers'
    ])
    expect(container.querySelector('[role="region"]')).toBeNull()
    act(() => root.unmount())
  })

  test('closes the builder with Escape without saving', () => {
    global.fetch = vi.fn()
    const { container, root } = renderComponent({ format_number_currency: { value: '$' } })
    act(() => container.querySelector('[data-template-key="first_order"]').click())
    expect(container.querySelector('[role="region"]')).not.toBeNull()
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(container.querySelector('[role="region"]')).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
    act(() => root.unmount())
  })

  test('Escape dismisses a date interaction without closing the builder', () => {
    global.fetch = vi.fn()
    const { container, root } = renderComponent({ format_number_currency: { value: '$' } })
    act(() => container.querySelector('[data-template-key="first_order"]').click())
    const startDate = container.querySelector('input[type="datetime-local"]')
    act(() => startDate.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(container.querySelector('[role="region"]')).not.toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
    act(() => root.unmount())
  })

  test('asks before closing a builder that contains unsaved changes', () => {
    const { container, root } = renderComponent({ format_number_currency: { value: '$' } })
    act(() => container.querySelector('[data-template-key="first_order"]').click())
    setInputValue(container.querySelector('input'), 'Renamed offer')

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(container.querySelector('[role="region"]')).not.toBeNull()
    expect(container.querySelector('[role="dialog"]').getAttribute('aria-label')).toBe('Discard unsaved changes?')

    act(() => [...container.querySelectorAll('[role="dialog"] button')].find(button => button.textContent === 'Keep editing').click())
    expect(container.querySelector('[role="region"]')).not.toBeNull()
    act(() => root.unmount())
  })

  test('does not close the builder when a nested control already handled Escape', () => {
    const { container, root } = renderComponent({ format_number_currency: { value: '$' } })
    act(() => container.querySelector('[data-template-key="first_order"]').click())
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    event.preventDefault()
    act(() => window.dispatchEvent(event))
    expect(container.querySelector('[role="region"]')).not.toBeNull()
    act(() => root.unmount())
  })

  test('recovers from an all-business load error instead of remaining stuck', async () => {
    const loadAllJourneyBusinesses = vi.fn()
      .mockRejectedValueOnce(new Error('Businesses unavailable'))
      .mockResolvedValueOnce([{ id: 10, name: 'Store One', slug: 'store-one' }])
    const { container, root } = renderComponent(
      { format_number_currency: { value: '$' } },
      { loadAllJourneyBusinesses }
    )
    await act(async () => Promise.resolve())
    act(() => container.querySelector('[data-template-key="first_order"]').click())
    expect(container.textContent).toContain('Businesses unavailable')

    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Retry').click())
    expect(loadAllJourneyBusinesses).toHaveBeenCalledTimes(2)
    expect(container.textContent).not.toContain('Businesses unavailable')
    expect(container.textContent).not.toContain('Loading businesses...')
    act(() => root.unmount())
  })

  test('opens an existing promotion in the same Quick Offers builder', () => {
    const promotion = {
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
    const { container, root } = renderComponent(
      { format_number_currency: { value: '$' } },
      { promotionListState: { promotions: [promotion], loading: false, error: null } }
    )
    const editPromotion = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Edit promotion'))
    act(() => editPromotion.click())
    expect(container.textContent).toContain('Edit promotion')
    expect(container.textContent).toContain('Customers with exactly 0 orders')
    expect(container.querySelector('input').value).toBe('Existing welcome offer')
    const productOptionsSelect = [...container.querySelectorAll('select')]
      .find(select => [...select.options].some(option => option.textContent === 'Include product options'))
    expect(productOptionsSelect.value).toBe('include')
    expect(container.textContent).not.toContain('Manage in Advanced Offers')
    act(() => root.unmount())
  })

  test.each([
    ['product', { condition_type: 2, products: [{ id: 22, business_id: 10, pivot: { include: 0 } }] }],
    ['category', { condition_type: 3, categories: [{ id: 7, business_id: 10, include: false }] }]
  ])('routes an existing promotion with an excluded %s to Advanced Offers', (_relationship, relationshipState) => {
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
    const { container, root } = renderComponent(
      { format_number_currency: { value: '$' } },
      {
        promotionListState: { promotions: [promotion], loading: false, error: null },
        onOpenAdvancedPromotion
      }
    )

    act(() => [...container.querySelectorAll('button')].find(button => button.textContent.includes('Edit promotion')).click())

    expect(onOpenAdvancedPromotion).toHaveBeenCalledWith(promotion)
    expect(container.querySelector('[role="region"]')).toBeNull()
    expect(container.textContent).not.toContain('Save changes')
    act(() => root.unmount())
  })

  test('turns off hidden product options when updating an existing Buy X, get Y promotion', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: false, result: { id: 99, enabled: false } })
    })
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
    const { container, root } = renderComponent(
      { format_number_currency: { value: '$' } },
      {
        promotionListState: { promotions: [promotion], loading: false, error: null },
        onOpenAdvancedPromotion
      }
    )

    act(() => [...container.querySelectorAll('button')].find(button => button.textContent.includes('Edit promotion')).click())
    expect(onOpenAdvancedPromotion).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Extra option charges will not be discounted.')
    expect([...container.querySelectorAll('select')].some(select =>
      [...select.options].some(option => option.textContent === 'Include product options')
    )).toBe(false)

    setInputValue(container.querySelector('input'), 'Renamed legacy BOGO')
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Save changes').click())

    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({
      name: 'Renamed legacy BOGO',
      include_options: false,
      enabled: false
    })
    act(() => root.unmount())
  })

  test('saving changes preserves the enabled state of an existing active promotion', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: false, result: { id: 99, enabled: true } })
    })
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
    const { container, root } = renderComponent(
      { format_number_currency: { value: '$' } },
      {
        promotionListState: { promotions: [promotion], loading: false, error: null },
        paginationProps: { currentPage: 3, pageSize: 10, totalPages: 3, totalItems: 25 }
      }
    )

    act(() => [...container.querySelectorAll('button')].find(button => button.textContent.includes('Edit promotion')).click())
    setInputValue(container.querySelector('input'), 'Renamed active offer')
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Save changes').click())

    expect(global.fetch).toHaveBeenCalledWith('https://api.test/offers/99', expect.objectContaining({ method: 'POST' }))
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ name: 'Renamed active offer', enabled: true })
    expect(baseProps.getPromotions).toHaveBeenCalledWith(3, 10)
    expect(container.textContent).toContain('Promotion templates')
    act(() => root.unmount())
  })

  test('toggles a promotion without opening the editor or losing scroll position', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: false, result: { id: 99, enabled: true } })
    })
    const scrollElement = document.scrollingElement || document.documentElement
    const getPromotions = vi.fn().mockImplementation(async () => {
      scrollElement.scrollTop = 0
    })
    const promotion = { id: 99, name: 'Welcome offer', description: 'Description', enabled: false }
    const { container, root } = renderComponent(
      { format_number_currency: { value: '$' } },
      { promotionListState: { promotions: [promotion], loading: false, error: null }, getPromotions }
    )
    scrollElement.scrollTop = 650
    const toggle = container.querySelector('[role="switch"]')
    await act(async () => toggle.click())
    await act(async () => new Promise(resolve => window.requestAnimationFrame(resolve)))
    expect(global.fetch).toHaveBeenCalledWith('https://api.test/offers/99', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ enabled: true })
    }))
    expect(getPromotions).toHaveBeenCalledWith(1, 10)
    expect(scrollElement.scrollTop).toBe(650)
    expect(container.textContent).not.toContain('Promotion name')
    act(() => root.unmount())
  })

  test('reports a toggle API error and leaves the page usable', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: true, result: ['Status update failed'] })
    })
    const promotion = { id: 99, name: 'Welcome offer', description: 'Description', enabled: false }
    const { container, root } = renderComponent(
      { format_number_currency: { value: '$' } },
      { promotionListState: { promotions: [promotion], loading: false, error: null } }
    )
    await act(async () => container.querySelector('[role="switch"]').click())
    expect(container.textContent).toContain('Status update failed')
    expect(container.textContent).toContain('Welcome offer')
    expect(container.querySelector('[data-testid="promotion-journeys"]')).not.toBeNull()
    act(() => root.unmount())
  })

  test('asks for confirmation and cancels without deleting the promotion', () => {
    global.fetch = vi.fn()
    const promotion = { id: 99, name: 'Welcome offer', description: 'Description', enabled: false }
    const { container, root } = renderComponent(
      { format_number_currency: { value: '$' } },
      { promotionListState: { promotions: [promotion], loading: false, error: null } }
    )

    act(() => container.querySelector('button[aria-label="Delete Welcome offer"]').click())
    expect(container.querySelector('[role="dialog"]').textContent).toContain('Are you sure that you want to delete the offer?')
    act(() => [...container.querySelectorAll('[role="dialog"] button')].find(button => button.textContent === 'Cancel').click())

    expect(global.fetch).not.toHaveBeenCalled()
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(container.textContent).toContain('Welcome offer')

    act(() => container.querySelector('button[aria-label="Delete Welcome offer"]').click())
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
    act(() => root.unmount())
  })

  test('deletes once, refreshes the correct page and reports success', async () => {
    let resolveDelete
    global.fetch = vi.fn(() => new Promise(resolve => { resolveDelete = resolve }))
    const getPromotions = vi.fn()
    const handleSuccessDeletePromotion = vi.fn()
    const promotion = { id: 99, name: 'Last page offer', description: 'Description', enabled: false }
    const { container, root } = renderComponent(
      { format_number_currency: { value: '$' } },
      {
        promotionListState: { promotions: [promotion], loading: false, error: null },
        paginationProps: { currentPage: 2, pageSize: 10, totalPages: 2, totalItems: 11 },
        getPromotions,
        handleSuccessDeletePromotion
      }
    )

    act(() => container.querySelector('button[aria-label="Delete Last page offer"]').click())
    const acceptDelete = [...container.querySelectorAll('[role="dialog"] button')].find(button => button.textContent === 'Delete')
    await act(async () => {
      acceptDelete.click()
      await Promise.resolve()
    })
    act(() => [...container.querySelectorAll('[role="dialog"] button')].find(button => button.textContent === 'Loading...').click())
    expect(global.fetch).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveDelete({ ok: true, status: 200, json: async () => ({ error: false, result: { id: 99 } }) })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(global.fetch).toHaveBeenCalledWith('https://api.test/offers/99', expect.objectContaining({ method: 'DELETE' }))
    expect(handleSuccessDeletePromotion).toHaveBeenCalledWith(99)
    expect(getPromotions).toHaveBeenCalledWith(1, 10)
    expect(hookState.showToast).toHaveBeenCalledWith('success', 'Promotion deleted')
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    act(() => root.unmount())
  })

  test('keeps the confirmation and promotion available after a delete error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: true, result: ['Offer is in use'] })
    })
    const promotion = { id: 99, name: 'Protected offer', description: 'Description', enabled: true }
    const { container, root } = renderComponent(
      { format_number_currency: { value: '$' } },
      { promotionListState: { promotions: [promotion], loading: false, error: null } }
    )

    act(() => container.querySelector('button[aria-label="Delete Protected offer"]').click())
    await act(async () => [...container.querySelectorAll('[role="dialog"] button')].find(button => button.textContent === 'Delete').click())

    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
    expect(container.querySelector('[role="alert"]').textContent).toContain('Offer is in use')
    expect(container.textContent).toContain('Protected offer')
    expect(container.querySelector('[data-testid="promotion-journeys"]')).not.toBeNull()
    act(() => root.unmount())
  })

  test('shows at most ten promotions and requests page two for item eleven', () => {
    const promotions = Array.from({ length: 11 }, (_, index) => ({
      id: index + 1,
      name: `Promotion ${index + 1}`,
      description: `Description ${index + 1}`,
      enabled: false
    }))
    const getPromotions = vi.fn()
    const { container, root } = renderComponent(
      { format_number_currency: { value: '$' } },
      {
        promotionListState: { promotions, loading: false, error: null },
        paginationProps: { currentPage: 1, pageSize: 10, totalPages: 2, totalItems: 11 },
        getPromotions
      }
    )
    expect(container.querySelectorAll('[role="switch"]')).toHaveLength(10)
    expect(container.textContent).toContain('1 / 2')
    const next = [...container.querySelectorAll('button')].find(button => button.textContent === 'Next')
    act(() => next.click())
    expect(getPromotions).toHaveBeenCalledWith(2, 10)
    act(() => root.unmount())
  })

  test('refreshes page one and keeps the newly created promotion visible', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: false, result: { id: 77, name: 'First purchase', enabled: false } })
    })
    const getPromotions = vi.fn()
    const { container, root } = renderComponent(
      { format_number_currency: { value: '$' } },
      { getPromotions }
    )
    act(() => container.querySelector('[data-template-key="first_order"]').click())
    await completeFirstPurchase(container)
    const saveDraft = [...container.querySelectorAll('button')].find(button => button.textContent === 'Save draft')
    await act(async () => saveDraft.click())
    expect(getPromotions.mock.calls).toEqual([[1, 10]])
    expect(container.querySelector('[role="region"]')).toBeNull()
    expect(container.textContent).toContain('First purchase')
    act(() => root.unmount())
  })

  test('renders a nonblank error state when promotions cannot be loaded', () => {
    const { container, root } = renderComponent(
      { format_number_currency: { value: '$' } },
      { promotionListState: { promotions: [], loading: false, error: ['Advanced Offers is not available'] } }
    )
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    expect(container.textContent).toContain('Advanced Offers is not available')
    act(() => root.unmount())
  })
})
