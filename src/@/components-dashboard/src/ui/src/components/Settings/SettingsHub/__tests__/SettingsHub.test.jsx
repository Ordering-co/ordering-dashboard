import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const windowSize = vi.hoisted(() => ({ width: 1200, height: 800 }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: true }, { handleMenuCollapse: vi.fn() }]
}))

vi.mock('../../../../hooks/useWindowSize', () => ({
  useWindowSize: () => windowSize
}))

vi.mock('../SettingsHubDetail', () => ({
  SettingsHubDetail: ({ section, onBack, focus }) => (
    <div>
      <div data-testid='hub-detail'>{section?.key || 'empty'}</div>
      <div data-testid='hub-focus'>{focus || ''}</div>
      {onBack && <button type='button' onClick={onBack}>Back to settings</button>}
    </div>
  )
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

const LocationProbe = () => {
  const location = useLocation()
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
  })

  it('renders groups, sections and the selected detail', () => {
    renderHub('/settings?group=payments&category=stripe&focus=stripe_publishable')

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Payments/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Card payments (Stripe)' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add-ons/ })).not.toBeInTheDocument()
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('stripe')
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

  it('opens the group and leaves search when a result is chosen', () => {
    renderHub('/settings?q=reject')
    fireEvent.click(screen.getByRole('button', { name: /Allow drivers to reject assigned orders/ }))
    const location = screen.getByTestId('hub-location')
    expect(location).not.toHaveTextContent('q=')
    expect(location).toHaveTextContent('group=drivers')
    expect(location).toHaveTextContent('focus=allow_driver_reject_order')
    expect(screen.queryByText('Search results')).not.toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('button', { name: /Driver permissions, location checks/ }))
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
    expect(screen.queryByRole('button', { name: 'Card payments (Stripe)' })).not.toBeInTheDocument()
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

  it('filters sections by search query', () => {
    renderHub('/settings?group=payments&q=stripe_publishable')

    expect(screen.getByText('Search results')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Card payments \(Stripe\)/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Order types' })).not.toBeInTheDocument()
  })

  it('keeps the owning group selected while searching', () => {
    renderHub('/settings?group=orders&category=stripe&q=stripe')

    const groups = screen.getByRole('navigation', { name: 'Setting groups' })
    expect(groups.querySelector('[aria-current="page"]')).toHaveTextContent('Payments')
    expect(groups.querySelector('[aria-current="page"]')).not.toHaveTextContent('Orders')
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
    expect(screen.getByRole('button', { name: 'Back to settings' })).toBeInTheDocument()
  })
})
