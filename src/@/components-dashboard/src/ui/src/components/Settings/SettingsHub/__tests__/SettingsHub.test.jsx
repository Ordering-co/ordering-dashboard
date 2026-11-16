import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { useHistory, useLocation } from 'react-router-dom'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const windowSize = vi.hoisted(() => ({ width: 1200, height: 800 }))
const askedKeys = vi.hoisted(() => ({}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => { askedKeys[key] = fallback; return fallback }]
}))

vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: true }, { handleMenuCollapse: vi.fn() }]
}))

vi.mock('../../../../hooks/useWindowSize', () => ({
  useWindowSize: () => windowSize
}))

// redesign settings A: the back row moved from the detail to the hub (the detail no longer gets `onBack`), and the
// detail gets the group's name, the phone's heading focus and the guard's `report`.
vi.mock('../SettingsHubDetail', () => ({
  SettingsHubDetail: ({ section, focus, groupLabel, focusHeading }) => (
    <div>
      <div data-testid='hub-detail'>{section?.key || 'empty'}</div>
      <div data-testid='hub-focus'>{focus || ''}</div>
      <div data-testid='hub-group-label'>{groupLabel || ''}</div>
      <div data-testid='hub-focus-heading'>{String(!!focusHeading)}</div>
    </div>
  )
}))

const legacy = vi.hoisted(() => ({ required: false, request: vi.fn() }))
const requestUpgrade = legacy.request
vi.mock('../../../../contexts/LegacyPlanUpgradeContext', () => ({
  useLegacyPlanUpgrade: () => ({ upgradeRequired: legacy.required, requestUpgrade: legacy.request })
}))

import { SettingsHub } from '../index'

const categoryLists = {
  key_basic: [
    { id: 1, key: 'stripe', name: 'Card Payments', rank: 1, configs: [{ key: 'stripe_publishable', name: 'Publishable key', rank: 1 }] },
    { id: 2, key: 'basic_order_types', name: 'Order types', rank: 2, configs: [] },
    { id: 3, key: 'platform_date_time_formats', name: 'Date and time', rank: 3, configs: [{ key: 'dates_general_format', name: 'Date format', rank: 1 }] },
    { id: 4, key: 'platform_fee_tip_settings', name: 'Fees and tips', rank: 4, configs: [{ key: 'driver_tip_options', name: 'Driver tip options', rank: 1 }] }
  ],
  key_pro: [
    { id: 5, key: 'pro_preorder', name: 'Preorder', rank: 1, configs: [{ key: 'max_days_preorder', name: 'Maximum preorder days', rank: 1 }] }
  ],
  key_enterprise: [
    { id: 6, key: 'recaptcha', name: 'reCAPTCHA', rank: 1, configs: [{ key: 'security_recaptcha_auth', name: 'Login reCAPTCHA', rank: 1 }] },
    {
      id: 9,
      key: 'enterprise_delivery_driver_assignment_and_scheduling',
      name: 'Assignment',
      rank: 1,
      configs: [{ key: 'assign_driver_enabled', name: 'Enable driver assignment', rank: 1 }]
    },
    {
      id: 10,
      key: 'enterprise_delivery_auto_assignment_penalties',
      name: 'Auto-assignment retries',
      rank: 2,
      configs: [{ key: 'autoassign_time_to_attempt_again', name: 'Time to attempt again', rank: 1 }]
    },
    {
      id: 11,
      key: 'enterprise_orders_management',
      name: 'Orders management',
      rank: 3,
      configs: [{ key: 'reject_orders_enabled', name: 'Allow businesses to reject orders', rank: 1 }]
    },
    {
      id: 12,
      key: 'enterprise_delivery_driver_permissions_and_controls',
      name: 'Driver permissions',
      rank: 4,
      configs: [
        { key: 'allow_driver_reject_order', name: 'Allow drivers to reject assigned orders', rank: 1 },
        { key: 'available_status_enabled', name: 'Available status', rank: 2 }
      ]
    }
  ]
}

const router = { history: null }

const LocationProbe = () => {
  const location = useLocation()
  router.history = useHistory()
  return <div data-testid='hub-location'>{`${location.pathname}${location.search}`}</div>
}

const dispatchAutofill = (input, value) => {
  const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  valueSetter.call(input, value)
  input.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertReplacementText',
    data: value
  }))
}

const renderHub = (path = '/settings') => renderWithProviders(
  <>
    <LocationProbe />
    <SettingsHub
      categoryLists={categoryLists}
      loadingCategories={false}
      categoriesError={null}
      configs={{}}
    />
  </>,
  { initialEntries: [path], routePath: '/settings' }
)

describe('SettingsHub', () => {
  beforeEach(() => {
    windowSize.width = 1200
    legacy.required = false
    requestUpgrade.mockReset().mockReturnValue(false)
  })

  it.each([
    ['Professional sign-up', 'professional_signup', 'professional_signup_enabled'],
    ['Reservations', 'store_reservation', 'reservation_enabled'],
    ['Deadlines & SLAs', 'enterprise_orders_slas', 'order_sla']
  ])('opens the upgrade request instead of the visible %s editor', (name, category, configKey) => {
    const lists = {
      ...categoryLists,
      key_enterprise: [...categoryLists.key_enterprise, {
        id: 80, key: category, name, configs: [{ key: configKey, name, rank: 1 }]
      }]
    }
    const path = '/settings?group=orders&category=basic_order_types'
    requestUpgrade.mockReturnValue(true)
    renderWithProviders(
      <><LocationProbe /><SettingsHub categoryLists={lists} configs={{}} /></>,
      { initialEntries: [path] }
    )

    const section = screen.getAllByRole('button', { name }).find(button => button.dataset.kind === 'section')
    expect(section).toBeVisible()
    fireEvent.click(section)
    expect(requestUpgrade).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('hub-location')).toHaveTextContent(path)
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('basic_order_types')
  })

  it('lets legacy users focus an upgrade section with arrows before selecting it', () => {
    const lists = {
      ...categoryLists,
      key_enterprise: [...categoryLists.key_enterprise, {
        id: 80,
        key: 'enterprise_orders_slas',
        name: 'Deadlines & SLAs',
        configs: [{ key: 'order_sla', name: 'Order SLA', rank: 1 }]
      }]
    }
    legacy.required = true
    requestUpgrade.mockReturnValue(true)
    renderWithProviders(
      <><LocationProbe /><SettingsHub categoryLists={lists} configs={{}} /></>,
      { initialEntries: ['/settings?group=orders&category=basic_order_types'] }
    )
    const target = screen.getByRole('button', { name: 'Deadlines & SLAs' })
    const previous = screen.getByRole('button', { name: 'Checkout form fields' })
    previous.focus()
    fireEvent.keyDown(previous, { key: 'ArrowDown' })
    expect(target).toHaveFocus()
    expect(requestUpgrade).not.toHaveBeenCalled()
    fireEvent.click(target)
    expect(requestUpgrade).toHaveBeenCalledTimes(1)
  })

  it('renders groups, sections and the selected detail', () => {
    renderHub('/settings?group=payments&category=stripe&focus=stripe_publishable')

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Payments/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Card payments (Stripe)' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add-ons/ })).not.toBeInTheDocument()
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('stripe')
  })

  // ST7: the subtitle is read on the phone too, where the detail is not «on the right»; its text has its own key because the
  // live dictionary kept the old sentence under SETTINGS_HUB_SUBTITLE.
  it('words the subtitle for both widths, under its own key', () => {
    renderHub('/settings')
    expect(screen.getByText('Find a setting by task, then select it to edit.')).toBeInTheDocument()
    expect(askedKeys.SETTINGS_HUB_SUBTITLE_TEXT).toBe('Find a setting by task, then select it to edit.')
    expect(askedKeys.SETTINGS_HUB_SUBTITLE).toBeUndefined()
  })

  it('lists Platform as the first group', () => {
    renderHub('/settings')
    const groups = screen.getByRole('navigation', { name: 'Setting groups' })
    expect(groups.querySelector('button')).toHaveTextContent('Platform')
  })

  it('keeps the right panel closed on the task landing', () => {
    renderHub('/settings')
    expect(screen.queryByTestId('hub-detail')).not.toBeInTheDocument()
    const groups = screen.getByRole('navigation', { name: 'Setting groups' })
    expect(groups.querySelector('[aria-current="page"]')).toBeNull()
  })

  it('does not let the browser fill the settings search', () => {
    renderHub('/settings')
    const search = screen.getByLabelText('Search settings')
    expect(search).toHaveAttribute('type', 'text')
    expect(search).toHaveAttribute('role', 'searchbox')
    expect(search).toHaveAttribute('autocomplete', 'off')
    expect(search).toHaveAttribute('name', 'settings-search')
  })

  it('ignores browser autofill and keeps the open section', () => {
    renderHub('/settings?group=payments&category=stripe')
    const search = screen.getByLabelText('Search settings')
    expect(search).toHaveAttribute('readonly')

    fireEvent.focus(search)
    expect(search).not.toHaveAttribute('readonly')

    dispatchAutofill(search, 'saved@example.com')

    const location = screen.getByTestId('hub-location')
    expect(location).toHaveTextContent('group=payments')
    expect(location).toHaveTextContent('category=stripe')
    expect(location).not.toHaveTextContent('q=')
    expect(screen.queryByText('No settings match that search.')).not.toBeInTheDocument()
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('stripe')
    expect(search).toHaveValue('')

    fireEvent.change(search, { target: { value: 'stripe' } })
    expect(location).toHaveTextContent('q=stripe')
  })

  // redesign settings A (decision 2A): a result opens its group and field and KEEPS the search (it used to leave it)
  it('opens the group and keeps the search when a result is chosen', () => {
    renderHub('/settings?q=reject')
    fireEvent.click(screen.getByRole('button', { name: /Allow drivers to reject assigned orders/ }))
    const location = screen.getByTestId('hub-location')
    expect(location).toHaveTextContent('q=reject')
    expect(location).toHaveTextContent('group=drivers')
    expect(location).toHaveTextContent('focus=allow_driver_reject_order')
    expect(screen.getByLabelText('Search settings')).toHaveValue('reject')
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('enterprise_delivery_driver_permissions_and_controls')
    expect(screen.getByTestId('hub-focus')).toHaveTextContent('allow_driver_reject_order')
  })

  it('shows outcome tasks on a bare settings visit', () => {
    renderHub('/settings')
    expect(screen.getByText('What do you want to do?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Let drivers reject assigned orders' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Let stores reject incoming orders' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change the driver tip amounts' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Let drivers mark themselves available or busy' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set how far ahead customers can schedule' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Configure auto-assignment retries' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Configure driver assignment rules' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change how dates and times look' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set the Stripe card keys' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Protect login with reCAPTCHA' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Set store hours' })).not.toBeInTheDocument()
    expect(screen.queryByText('Drivers ›')).not.toBeInTheDocument()
  })

  it('shows outcome tasks when view is tasks', () => {
    renderHub('/settings?view=tasks')
    expect(screen.getByText('What do you want to do?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Let drivers reject assigned orders' })).toBeInTheDocument()
    expect(screen.getByTestId('hub-location')).toHaveTextContent('/settings')
    expect(screen.getByTestId('hub-location')).not.toHaveTextContent('view=')
  })

  it('shows the selected group sections when browsing without view or focus', () => {
    renderHub('/settings?group=payments&category=stripe')
    expect(screen.getByRole('button', { name: 'Card payments (Stripe)' })).toBeInTheDocument()
    expect(screen.queryByText('What do you want to do?')).not.toBeInTheDocument()
  })

  it('shows the group section list after a group click from the task landing', () => {
    renderHub('/settings')
    // apply-list row 44 (settings P-1): on the landing the navigation rows carry the group name only (the cards keep the descriptions)
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Setting groups' })).getByRole('button', { name: /^Drivers/ }))
    expect(screen.getByRole('button', { name: 'Assignment & scheduling' })).toBeInTheDocument()
    expect(screen.queryByText('What do you want to do?')).not.toBeInTheDocument()
  })

  it('opens and highlights the field when a task is clicked', () => {
    renderHub('/settings')
    fireEvent.click(screen.getByRole('button', { name: 'Let stores reject incoming orders' }))
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('enterprise_orders_management')
    expect(screen.getByTestId('hub-focus')).toHaveTextContent('reject_orders_enabled')
  })

  it('opens the assignment field when that task is clicked', () => {
    renderHub('/settings')
    fireEvent.click(screen.getByRole('button', { name: 'Configure driver assignment rules' }))
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('enterprise_delivery_driver_assignment_and_scheduling')
    expect(screen.getByTestId('hub-focus')).toHaveTextContent('assign_driver_enabled')
  })

  it('opens the auto-assignment field when that task is clicked', () => {
    renderHub('/settings')
    fireEvent.click(screen.getByRole('button', { name: 'Configure auto-assignment retries' }))
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('enterprise_delivery_auto_assignment_penalties')
    expect(screen.getByTestId('hub-focus')).toHaveTextContent('autoassign_time_to_attempt_again')
  })

  it('opens the Stripe card keys when that task is clicked', () => {
    renderHub('/settings')
    fireEvent.click(screen.getByRole('button', { name: 'Set the Stripe card keys' }))
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('stripe')
    expect(screen.getByTestId('hub-focus')).toHaveTextContent('stripe_publishable')
  })

  it('opens the reCAPTCHA field when that task is clicked', () => {
    renderHub('/settings')
    fireEvent.click(screen.getByRole('button', { name: 'Protect login with reCAPTCHA' }))
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('recaptcha')
    expect(screen.getByTestId('hub-focus')).toHaveTextContent('security_recaptcha_auth')
  })

  it('keeps the section list after a task jump when another section is clicked', () => {
    renderHub('/settings')
    fireEvent.click(screen.getByRole('button', { name: 'Configure driver assignment rules' }))
    fireEvent.click(screen.getByRole('button', { name: 'Assignment & scheduling' }))
    expect(screen.getByRole('button', { name: 'Assignment & scheduling' })).toBeInTheDocument()
    expect(screen.queryByText('What do you want to do?')).not.toBeInTheDocument()
    expect(screen.getByTestId('hub-focus')).toHaveTextContent('')
  })

  it('returns to the task list from the suggestions button', () => {
    renderHub('/settings?group=payments&category=stripe&focus=stripe_publishable')
    fireEvent.click(screen.getByRole('button', { name: 'Suggestions' }))
    expect(screen.getByText('What do you want to do?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Let drivers reject assigned orders' })).toBeInTheDocument()
    // redesign settings A: the landing's group cards list a group's first sections, so a section button can be
    // there; what must be gone is the open group in the navigation (no `aria-current` row, no expanded group)
    const groups = screen.getByRole('navigation', { name: 'Setting groups' })
    expect(groups.querySelector('[aria-current="page"]')).toBeNull()
    expect(groups.querySelector('[aria-expanded="true"]')).toBeNull()
    expect(screen.queryByTestId('hub-detail')).not.toBeInTheDocument()
    expect(screen.getByTestId('hub-location')).toHaveTextContent('/settings')
    expect(screen.getByTestId('hub-location')).not.toHaveTextContent('group=')
    expect(screen.getByTestId('hub-location')).not.toHaveTextContent('view=')
  })

  it('returns to the task list when search is cleared', () => {
    renderHub('/settings?q=reject')
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(screen.getByLabelText('Search settings')).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
    expect(screen.getByText('What do you want to do?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Let drivers reject assigned orders' })).toBeInTheDocument()
    expect(screen.getByTestId('hub-location')).toHaveTextContent('/settings')
    expect(screen.getByTestId('hub-location')).not.toHaveTextContent('q=')
    expect(screen.getByTestId('hub-location')).not.toHaveTextContent('view=')
  })

  it('keeps the task list when moving with arrow keys', () => {
    renderHub('/settings')
    const firstTask = screen.getByRole('button', { name: 'Let drivers reject assigned orders' })
    firstTask.focus()
    fireEvent.keyDown(firstTask, { key: 'ArrowDown' })
    expect(screen.getByText('What do you want to do?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Let drivers reject assigned orders' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Assignment' })).not.toBeInTheDocument()
  })

  it('lists a field, not only a section, for a typed query', () => {
    renderHub('/settings?q=reject')
    expect(screen.getByRole('button', { name: /Allow drivers to reject assigned orders/ })).toBeInTheDocument()
  })

  // apply-list row 44 (settings P-2, D-65): while searching, the results (with a count) take the place of the groups
  it('filters sections by search query', () => {
    renderHub('/settings?group=payments&q=stripe_publishable')

    const results = screen.getByRole('navigation', { name: 'Search results' })
    expect(screen.getByText('1 result')).toBeInTheDocument()
    expect(results).toHaveTextContent('Publishable key')
    expect(results).toHaveTextContent('Payments › Card payments (Stripe)')
    expect(screen.getAllByRole('button', { name: /Card payments \(Stripe\)/ })).toHaveLength(1)
    expect(screen.queryByRole('navigation', { name: 'Setting groups' })).not.toBeInTheDocument()
  })

  // redesign settings A: the group row carries `aria-expanded`; `aria-current` is on the open section row.
  // apply-list row 44 (settings P-2): the groups come back with the owning group open when the search is cleared
  it('keeps the owning group selected while searching', () => {
    renderHub('/settings?group=orders&category=stripe&q=stripe')
    expect(screen.queryByRole('navigation', { name: 'Setting groups' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))

    const groups = screen.getByRole('navigation', { name: 'Setting groups' })
    const expanded = groups.querySelector('[aria-expanded="true"]')
    expect(expanded).toHaveTextContent('Payments')
    expect(expanded).not.toHaveTextContent('Orders')
    expect(groups.querySelectorAll('[aria-expanded="true"]')).toHaveLength(1)
    expect(groups.querySelector('[aria-current="page"]')).toHaveTextContent('Card payments (Stripe)')
  })

  it('shows an empty search state', () => {
    renderHub('/settings?q=zzz-not-there')
    expect(screen.getByText('No settings match that search.')).toBeInTheDocument()
  })

  it('shows an error state', () => {
    renderWithProviders(
      <SettingsHub categoryLists={{}} loadingCategories={false} categoriesError={new Error('fail')} configs={{}} />,
      { initialEntries: ['/settings'], routePath: '/settings' }
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Settings could not be loaded')
  })

  it('on mobile the suggestions button leaves the detail and shows tasks', () => {
    windowSize.width = 500
    renderHub('/settings?group=payments&category=stripe')
    fireEvent.click(screen.getByRole('button', { name: 'Suggestions' }))
    expect(screen.getByText('What do you want to do?')).toBeInTheDocument()
    expect(screen.queryByTestId('hub-detail')).not.toBeInTheDocument()
    expect(screen.getByTestId('hub-location')).toHaveTextContent('/settings')
    expect(screen.getByTestId('hub-location')).not.toHaveTextContent('group=')
  })

  it('on mobile shows the list first and the detail after a section is chosen', () => {
    windowSize.width = 500
    renderHub('/settings?group=payments&focus=stripe_publishable')

    expect(screen.getByRole('button', { name: 'Card payments (Stripe)' })).toBeInTheDocument()
    expect(screen.queryByTestId('hub-detail')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Card payments (Stripe)' }))
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('stripe')
    // redesign settings A (decision 6): the back row says where it goes («‹ Payments»), not «Back to settings»
    expect(screen.getByRole('button', { name: 'Payments' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back to settings' })).not.toBeInTheDocument()
  })
})

// redesign settings A: the new shell
describe('SettingsHub shell (redesign settings A)', () => {
  beforeEach(() => {
    windowSize.width = 1200
  })

  it('unfolds the open group with its description and marks the open section', () => {
    renderHub('/settings?group=payments&category=stripe')
    const nav = screen.getByRole('navigation', { name: 'Setting groups' })

    const payments = within(nav).getByRole('button', { name: /^Payments/ })
    expect(payments).toHaveAttribute('aria-expanded', 'true')
    expect(payments).toHaveTextContent('Card payments, wallets, gift cards and payment gateways.')
    expect(within(nav).getByRole('button', { name: 'Card payments (Stripe)' })).toHaveAttribute('aria-current', 'page')
    // only the open group lists its sections
    expect(within(nav).queryByRole('button', { name: 'Order types' })).not.toBeInTheDocument()
  })

  // apply-list row 44 (settings P-1, D-65): only the open group shows its description in the navigation
  it('shows the description of the open group only', () => {
    renderHub('/settings?group=payments&category=stripe')
    const nav = screen.getByRole('navigation', { name: 'Setting groups' })

    const orders = within(nav).getByRole('button', { name: /^Orders & checkout/ })
    expect(orders).toHaveAttribute('aria-expanded', 'false')
    expect(within(nav).queryByText('Order types, checkout fields, scheduled orders, catering and reservations.')).not.toBeInTheDocument()
    expect(within(nav).queryByText('Date and time, currency, distance, fees, registration and terms.')).not.toBeInTheDocument()
  })

  // apply-list row 44 (settings P-1): the descriptions stay on the landing, in the group cards on the desktop
  it('keeps every description on the desktop landing cards, not in the navigation', () => {
    renderHub('/settings')
    const nav = screen.getByRole('navigation', { name: 'Setting groups' })
    expect(within(nav).queryByText('Order types, checkout fields, scheduled orders, catering and reservations.')).not.toBeInTheDocument()
    expect(screen.getByText('Order types, checkout fields, scheduled orders, catering and reservations.')).toBeVisible()
  })

  // apply-list row 44 (settings P-1): the phone has no group cards (its navigation is the landing), so there the list keeps them
  it('keeps every description in the phone landing list', () => {
    windowSize.width = 500
    renderHub('/settings')
    const nav = screen.getByRole('navigation', { name: 'Setting groups' })
    expect(within(nav).getByText('Order types, checkout fields, scheduled orders, catering and reservations.')).toBeInTheDocument()
    expect(within(nav).getByText('Date and time, currency, distance, fees, registration and terms.')).toBeInTheDocument()
  })

  it('opens the first section of a group from the navigation on the desktop', () => {
    renderHub('/settings?group=payments&category=stripe')
    fireEvent.click(screen.getByRole('button', { name: /^Drivers/ }))
    const location = screen.getByTestId('hub-location')
    expect(location).toHaveTextContent('group=drivers')
    expect(location).toHaveTextContent('category=')
    expect(screen.getByTestId('hub-group-label')).toHaveTextContent('Drivers')
  })

  // review J4 #3: a search of spaces only is no search, so the groups stay
  it('keeps the groups for a search of spaces only', () => {
    renderHub('/settings?group=payments&category=stripe&q=%20%20%20')
    expect(screen.getByRole('navigation', { name: 'Setting groups' })).toBeInTheDocument()
  })

  // apply-list row 44 (settings P-2, D-65): the results replace the groups; the open section stays beside them
  it('shows the section beside a search and the results in place of the groups', () => {
    renderHub('/settings?group=payments&category=stripe&q=stripe')
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('stripe')
    expect(screen.getByRole('navigation', { name: 'Search results' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Setting groups' })).not.toBeInTheDocument()
  })

  it('counts the results in the plural and in the singular', () => {
    renderHub('/settings?q=reject')
    expect(screen.getByText(/^\d+ results$/)).toBeInTheDocument()
  })

  it('typing in the search keeps the open section and the editor params', () => {
    renderHub('/settings?group=payments&category=stripe&id=webhooks&site=3&country=US&city=9&page=2&pageSize=25')
    fireEvent.change(screen.getByLabelText('Search settings'), { target: { value: 'zz' } })
    const location = screen.getByTestId('hub-location')
    for (const part of ['group=payments', 'category=stripe', 'q=zz', 'id=webhooks', 'site=3', 'country=US', 'city=9', 'page=2', 'pageSize=25']) {
      expect(location).toHaveTextContent(part)
    }
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('stripe')
  })

  it('clearing the search keeps group, category, focus and the editor params', () => {
    renderHub('/settings?group=payments&category=stripe&focus=stripe_publishable&id=webhooks&q=stripe')
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    const location = screen.getByTestId('hub-location')
    expect(location).toHaveTextContent('group=payments')
    expect(location).toHaveTextContent('category=stripe')
    expect(location).toHaveTextContent('focus=stripe_publishable')
    expect(location).toHaveTextContent('id=webhooks')
    expect(location).not.toHaveTextContent('q=')
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('stripe')
    expect(screen.queryByText('What do you want to do?')).not.toBeInTheDocument()
  })

  it('Escape with text clears the search and keeps the section', () => {
    renderHub('/settings?group=payments&category=stripe&q=stripe')
    fireEvent.keyDown(screen.getByLabelText('Search settings'), { key: 'Escape' })
    const location = screen.getByTestId('hub-location')
    expect(location).not.toHaveTextContent('q=')
    expect(location).toHaveTextContent('category=stripe')
  })

  it('opening a result in another section drops the editor params of the old one', () => {
    renderHub('/settings?group=payments&category=stripe&id=webhooks&q=reject')
    fireEvent.click(screen.getByRole('button', { name: /Allow drivers to reject assigned orders/ }))
    const location = screen.getByTestId('hub-location')
    expect(location).toHaveTextContent('group=drivers')
    expect(location).toHaveTextContent('q=reject')
    expect(location).not.toHaveTextContent('id=webhooks')
  })

  it('opening a section result keeps the search and sets no focus', () => {
    renderHub('/settings?q=Order types')
    const results = screen.getByRole('navigation', { name: 'Search results' })
    fireEvent.click(within(results).getByRole('button', { name: /Order types/ }))
    const location = screen.getByTestId('hub-location')
    expect(location).toHaveTextContent('category=basic_order_types')
    expect(location).toHaveTextContent('q=Order+types')
    expect(location).not.toHaveTextContent('focus=')
  })

  it('shows the landing beside a search that has opened nothing', () => {
    renderHub('/settings?q=reject')
    expect(screen.getByText('What do you want to do?')).toBeInTheDocument()
    expect(screen.queryByTestId('hub-detail')).not.toBeInTheDocument()
  })

  it('the landing has a card per group with up to three sections and a +n that opens the group', () => {
    renderHub('/settings')
    const card = screen.getByRole('heading', { level: 3, name: 'Payments' }).closest('section')
    expect(within(card).getByText('Card payments, wallets, gift cards and payment gateways.')).toBeInTheDocument()
    const links = within(card).getAllByRole('button')
    expect(links.length).toBeGreaterThan(0)
    expect(links.length).toBeLessThanOrEqual(4)

    const more = screen.getAllByRole('button', { name: /^\+\d+ / })
    expect(more.length).toBeGreaterThan(0)
    fireEvent.click(more[0])
    expect(screen.getByTestId('hub-location')).toHaveTextContent('group=')
    expect(screen.queryByText('What do you want to do?')).not.toBeInTheDocument()
  })

  it('a section of a landing card opens it', () => {
    renderHub('/settings')
    const card = screen.getByRole('heading', { level: 3, name: 'Payments' }).closest('section')
    fireEvent.click(within(card).getByRole('button', { name: 'Card payments (Stripe)' }))
    expect(screen.getByTestId('hub-location')).toHaveTextContent('category=stripe')
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('stripe')
  })

  it('does not announce the content column as a live region', () => {
    const { container } = renderHub('/settings?group=payments&category=stripe')
    expect(container.querySelector('.odc-hub-content [aria-live]')).toBeNull()
  })

  describe('phone', () => {
    beforeEach(() => {
      windowSize.width = 390
    })

    // redesign settings R-05: arrows open the group and the section on the phone too, as in main
    it('arrows activate the rows on the phone', () => {
      renderHub('/settings?group=platform')
      const platform = screen.getAllByRole('button', { name: /^Platform/ }).find(node => node.dataset.kind === 'group')
      platform.focus()
      fireEvent.keyDown(platform, { key: 'ArrowDown' })
      // the open group lists its sections: ArrowDown lands on the first one and opens it
      expect(screen.getByTestId('hub-location')).toHaveTextContent('category=')
    })

    it('shows the navigation alone, then the section alone with the group as its back row', () => {
      const { container } = renderHub('/settings?group=payments')
      expect(screen.getByRole('navigation', { name: 'Setting groups' })).toBeInTheDocument()
      expect(screen.queryByTestId('hub-detail')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Card payments (Stripe)' }))
      expect(screen.queryByRole('navigation', { name: 'Setting groups' })).not.toBeInTheDocument()
      expect(screen.getByTestId('hub-detail')).toHaveTextContent('stripe')
      expect(screen.getByTestId('hub-focus-heading')).toHaveTextContent('true')
      expect(screen.getByTestId('hub-group-label')).toHaveTextContent('')
      // redesign settings A: the header (Suggestions, search, menu) stays on the section screen, as in main
      expect(container.querySelector('.odc-hub-header')).not.toHaveAttribute('data-hidden')
      expect(screen.getByRole('button', { name: 'Suggestions' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Payments' }))
      expect(screen.getByRole('navigation', { name: 'Setting groups' })).toBeInTheDocument()
      expect(screen.queryByTestId('hub-detail')).not.toBeInTheDocument()
      const location = screen.getByTestId('hub-location')
      expect(location).toHaveTextContent('group=payments')
      expect(location).not.toHaveTextContent('category=')
    })

    // (settings P-7): opening a section from the list is a new history entry, so the system Back returns to the
    // list instead of leaving Settings; the back row walks back along that same entry.
    it('the system Back returns from a section to the list', () => {
      renderHub('/settings?group=payments')
      fireEvent.click(screen.getByRole('button', { name: 'Card payments (Stripe)' }))
      expect(screen.getByTestId('hub-location')).toHaveTextContent('category=stripe')
      expect(router.history.length).toBe(2)

      act(() => router.history.goBack())
      expect(screen.getByRole('navigation', { name: 'Setting groups' })).toBeInTheDocument()
      expect(screen.queryByTestId('hub-detail')).not.toBeInTheDocument()
      expect(screen.getByTestId('hub-location')).toHaveTextContent('/settings?group=payments')
      expect(screen.getByTestId('hub-location')).not.toHaveTextContent('category=')
    })

    it('the back row does not leave an extra entry behind', () => {
      renderHub('/settings?group=payments')
      fireEvent.click(screen.getByRole('button', { name: 'Card payments (Stripe)' }))
      fireEvent.click(screen.getByRole('button', { name: 'Payments' }))
      expect(screen.getByRole('navigation', { name: 'Setting groups' })).toBeInTheDocument()
      expect(router.history.index).toBe(0)
      expect(screen.getByTestId('hub-location')).not.toHaveTextContent('category=')
    })

    // review R-2: the editors inside a section replace the URL without state (webhooks, places, sites…)
    it('the back row still walks back after an editor of the section replaced the URL without state', () => {
      renderHub('/settings?group=payments')
      fireEvent.click(screen.getByRole('button', { name: 'Card payments (Stripe)' }))
      act(() => router.history.replace('/settings?group=payments&category=stripe&id=3'))
      fireEvent.click(screen.getByRole('button', { name: 'Payments' }))
      expect(router.history.index).toBe(0)
      expect(router.history.length).toBe(2)
      expect(screen.getByTestId('hub-location')).not.toHaveTextContent('category=')
    })

    it('a section opened from the URL keeps its back row on the same entry', () => {
      renderHub('/settings?group=payments&category=stripe')
      fireEvent.click(screen.getByRole('button', { name: 'Payments' }))
      expect(router.history.length).toBe(1)
      expect(screen.getByTestId('hub-location')).toHaveTextContent('group=payments')
      expect(screen.getByTestId('hub-location')).not.toHaveTextContent('category=')
    })

    it('with a search, the back row is «Search results» and the search stays', () => {
      renderHub('/settings?group=payments&category=stripe&q=stripe')
      fireEvent.click(screen.getByRole('button', { name: 'Search results' }))
      expect(screen.getByTestId('hub-location')).toHaveTextContent('q=stripe')
      expect(screen.getByTestId('hub-location')).not.toHaveTextContent('category=')
      expect(screen.getByRole('navigation', { name: 'Search results' })).toBeInTheDocument()
      expect(screen.getByLabelText('Search settings')).toHaveValue('stripe')
    })

    it('shows the tasks under the groups on the landing', () => {
      renderHub('/settings')
      expect(screen.getByRole('navigation', { name: 'Setting groups' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Let drivers reject assigned orders' })).toBeInTheDocument()
      // the navigation already lists the groups: no cards
      expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument()
    })

    it('a task opens its section as a screen', () => {
      renderHub('/settings')
      fireEvent.click(screen.getByRole('button', { name: 'Set the Stripe card keys' }))
      expect(screen.getByTestId('hub-detail')).toHaveTextContent('stripe')
      expect(screen.queryByRole('navigation', { name: 'Setting groups' })).not.toBeInTheDocument()
    })
  })

  describe('states', () => {
    it('draws a busy skeleton while the catalog loads', () => {
      const { container } = renderWithProviders(
        <SettingsHub categoryLists={{}} loadingCategories categoriesError={null} configs={{}} />,
        { initialEntries: ['/settings'], routePath: '/settings' }
      )
      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
      expect(container.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    })

    it('offers Retry on a catalog error when the controller can reload', () => {
      const onRetry = vi.fn()
      renderWithProviders(
        <SettingsHub categoryLists={{}} loadingCategories={false} categoriesError={new Error('fail')} configs={{}} onRetry={onRetry} />,
        { initialEntries: ['/settings'], routePath: '/settings' }
      )
      expect(screen.getByRole('alert')).toHaveTextContent('Settings could not be loaded')
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
      expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('shows only the text when nothing can reload (the controller exposes no reload today)', () => {
      renderWithProviders(
        <SettingsHub categoryLists={{}} loadingCategories={false} categoriesError={new Error('fail')} configs={{}} />,
        { initialEntries: ['/settings'], routePath: '/settings' }
      )
      expect(screen.getByRole('alert')).toHaveTextContent('Settings could not be loaded')
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    })
  })
})

// (tanda H, row #2): `?focus=<config key>` opens the section that holds the key, not the first one.
describe('SettingsHub focus relocation', () => {
  beforeEach(() => {
    windowSize.width = 1200
  })

  it('opens the section of the focused key when group and category are missing', () => {
    renderHub('/settings?focus=stripe_publishable')
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('stripe')
    const location = screen.getByTestId('hub-location')
    expect(location).toHaveTextContent('group=payments')
    expect(location).toHaveTextContent('category=stripe')
    expect(location).toHaveTextContent('focus=stripe_publishable')
    expect(screen.getByTestId('hub-focus')).toHaveTextContent('stripe_publishable')
  })

  it('opens the section of the focused key when the group is wrong or the category does not hold it', () => {
    renderHub('/settings?group=platform&category=platform_date_time_formats&focus=stripe_publishable')
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('stripe')
    const location = screen.getByTestId('hub-location')
    expect(location).toHaveTextContent('group=payments')
    expect(location).toHaveTextContent('category=stripe')
  })

  it('keeps a matching group, category and focus untouched', () => {
    renderHub('/settings?group=payments&category=stripe&focus=stripe_publishable')
    expect(screen.getByTestId('hub-location')).toHaveTextContent('/settings?group=payments&category=stripe&focus=stripe_publishable')
  })

  it('leaves an unknown focus key as before: the first section, the key still in the URL', () => {
    renderHub('/settings?focus=not_a_config_key')
    const location = screen.getByTestId('hub-location')
    expect(location).toHaveTextContent('focus=not_a_config_key')
    expect(location).not.toHaveTextContent('category=stripe')
    expect(screen.getByTestId('hub-detail')).not.toHaveTextContent('stripe')
  })

  it('on the phone, with no group, opens the section of the focused key', () => {
    windowSize.width = 500
    renderHub('/settings?focus=stripe_publishable')
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('stripe')
    expect(screen.getByTestId('hub-location')).toHaveTextContent('category=stripe')
  })
})

// the URL carries the group and section the hub really opens, and the hub does not rewrite it without a catalog.
describe('SettingsHub URL normalisation', () => {
  beforeEach(() => {
    windowSize.width = 1200
  })

  const lists = {
    ...categoryLists,
    key_basic: [
      ...categoryLists.key_basic,
      { id: 20, key: 'google_maps', name: 'Google Maps', rank: 9, configs: [{ key: 'google_maps_api_key', name: 'API key', rank: 1 }] }
    ],
    key_enterprise: [
      ...categoryLists.key_enterprise,
      { id: 21, key: 'enterprise_orders_slas', name: 'Deadlines & SLAs', rank: 5, configs: [{ key: 'order_sla', name: 'Order SLA', rank: 1 }] }
    ]
  }

  const renderWith = (path, props = {}) => renderWithProviders(
    <>
      <LocationProbe />
      <SettingsHub categoryLists={lists} loadingCategories={false} categoriesError={null} configs={{}} {...props} />
    </>,
    { initialEntries: [path], routePath: '/settings' }
  )

  it('puts the real group of the category in the URL', () => {
    renderWith('/settings?group=drivers&category=enterprise_orders_slas')
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('enterprise_orders_slas')
    expect(screen.getByTestId('hub-location')).toHaveTextContent('/settings?group=orders&category=enterprise_orders_slas')
  })

  it('drops a category that does not exist and keeps the group', () => {
    renderWith('/settings?group=platform&category=999999')
    const location = screen.getByTestId('hub-location')
    expect(location).not.toHaveTextContent('999999')
    expect(location).toHaveTextContent('/settings?group=platform')
  })

  it('on the phone, a category that does not exist leaves the list of its group', () => {
    windowSize.width = 390
    renderWith('/settings?group=platform&category=999999')
    expect(screen.getByTestId('hub-location')).toHaveTextContent('/settings?group=platform')
    expect(screen.getByTestId('hub-location')).not.toHaveTextContent('category=')
    expect(screen.getByRole('navigation', { name: 'Setting groups' })).toBeInTheDocument()
  })

  it('sends the empty basic_maps folder to Maps (google_maps)', () => {
    renderWith('/settings?group=platform&category=basic_maps')
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('google_maps')
    expect(screen.getByTestId('hub-location')).toHaveTextContent('/settings?group=locations&category=google_maps')
  })

  it('keeps a numeric category id as it came, with its real group', () => {
    renderWith('/settings?group=drivers&category=21')
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('enterprise_orders_slas')
    expect(screen.getByTestId('hub-location')).toHaveTextContent('/settings?group=orders&category=21')
  })

  it('does not rewrite group or category while the catalog failed, nor after Retry loads it', () => {
    const { rerender } = renderWith('/settings?group=payments&category=stripe', { categoryLists: {}, categoriesError: new Error('fail') })
    expect(screen.getByRole('alert')).toHaveTextContent('Settings could not be loaded')
    expect(screen.getByTestId('hub-location')).toHaveTextContent('/settings?group=payments&category=stripe')

    rerender(
      <>
        <LocationProbe />
        <SettingsHub categoryLists={lists} loadingCategories={false} categoriesError={null} configs={{}} />
      </>
    )
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('stripe')
    expect(screen.getByTestId('hub-location')).toHaveTextContent('/settings?group=payments&category=stripe')
  })

  it('does not rewrite the URL while the catalog loads', () => {
    renderWith('/settings?group=payments&category=stripe', { categoryLists: {}, loadingCategories: true })
    expect(screen.getByTestId('hub-location')).toHaveTextContent('/settings?group=payments&category=stripe')
  })
})

// on the phone, «‹ group» returns to the list with the focus on the section it came from.
describe('SettingsHub phone back focus', () => {
  beforeEach(() => {
    windowSize.width = 390
  })

  it('moves the focus to the row of the section the user came from', () => {
    renderHub('/settings?group=payments')
    fireEvent.click(screen.getByRole('button', { name: 'Card payments (Stripe)' }))
    const back = screen.getByRole('button', { name: 'Payments' })
    back.focus()
    expect(document.activeElement).toBe(back)

    fireEvent.click(back)
    expect(screen.getByRole('navigation', { name: 'Setting groups' })).toBeInTheDocument()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Card payments (Stripe)' }))
  })

  it('with a search, the focus goes to the result row of the section the user came from', () => {
    const { container } = renderHub('/settings?group=payments&category=stripe&q=stripe')
    const back = screen.getByRole('button', { name: 'Search results' })
    back.focus()
    fireEvent.click(back)
    expect(screen.getByRole('navigation', { name: 'Search results' })).toBeInTheDocument()
    const row = container.querySelector('button[data-row-id^="section:payments:stripe"], button[data-row-id^="config:payments:stripe:"]')
    expect(row).not.toBeNull()
    expect(document.activeElement).toBe(row)
  })

  it('does not take the focus from an element the user already focused', () => {
    renderHub('/settings?group=payments&category=stripe')
    const search = screen.getByLabelText('Search settings')
    fireEvent.focus(search)
    search.focus()
    fireEvent.click(screen.getByRole('button', { name: 'Payments' }))
    expect(document.activeElement).toBe(search)
  })

  it('a deep link that waited for the catalog gets the focus back on its own row, not on the provisional group', () => {
    const { rerender } = renderWithProviders(
      <SettingsHub categoryLists={{}} loadingCategories categoriesError={null} configs={{}} />,
      { initialEntries: ['/settings?group=payments&category=stripe'], routePath: '/settings' }
    )
    rerender(<SettingsHub categoryLists={categoryLists} loadingCategories={false} categoriesError={null} configs={{}} />)
    const back = screen.getByRole('button', { name: 'Payments' })
    back.focus()
    fireEvent.click(back)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Card payments (Stripe)' }))
  })

  it('a section opened from the URL gets the focus back on its row too', () => {
    renderHub('/settings?group=payments&category=stripe')
    const back = screen.getByRole('button', { name: 'Payments' })
    back.focus()
    fireEvent.click(back)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Card payments (Stripe)' }))
  })
})

// the search finds what the screen shows, e.g. «Custom format» of the Date and time block
describe('SettingsHub search of visible labels', () => {
  beforeEach(() => {
    windowSize.width = 1200
  })

  it('finds «Custom format» under Date and time instead of «No settings match»', () => {
    renderHub('/settings?q=Custom%20format')
    expect(screen.queryByText('No settings match that search.')).not.toBeInTheDocument()
    expect(screen.getByText('1 result')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Date and time format.*Date & time format/ })).toBeInTheDocument()
  })
})

// redesign (owner decision 32 A): a search result is named as the hub names the setting, not as the API does
describe('SettingsHub search results named by the dashboard', () => {
  beforeEach(() => {
    windowSize.width = 1200
  })

  const lists = {
    ...categoryLists,
    key_enterprise: [
      ...categoryLists.key_enterprise,
      {
        id: 30,
        key: 'enterprise_delivery_driver_permissions_and_controls',
        name: 'Driver permissions',
        rank: 6,
        configs: [
          { key: 'location_validation_enabled_status_26', name: 'Location Validation Status 26', rank: 1 },
          { key: 'disable_delivery_priority', name: 'Disable Delivery Priority', rank: 2 }
        ]
      }
    ]
  }

  const renderWith = (path) => renderWithProviders(
    <>
      <LocationProbe />
      <SettingsHub categoryLists={lists} loadingCategories={false} categoriesError={null} configs={{}} />
    </>,
    { initialEntries: [path], routePath: '/settings' }
  )

  it('finds a location check by its API name and shows the name of its cell', () => {
    renderWith('/settings?q=Location%20Validation%20Status%2026')
    expect(screen.getByRole('button', { name: /Waiting for the customer — Enable/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Location Validation Status 26/ })).toBeNull()
  })

  it('finds «Disable Delivery Priority» by its API name and shows it as «Delivery priority»', () => {
    renderWith('/settings?q=Disable%20Delivery%20Priority')
    expect(screen.getByRole('button', { name: /^Delivery priority/ })).toBeInTheDocument()
  })
})
