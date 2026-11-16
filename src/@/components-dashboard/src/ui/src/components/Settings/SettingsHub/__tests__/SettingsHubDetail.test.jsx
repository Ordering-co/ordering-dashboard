import React, { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { useSettingsHubForm } from '../../SettingsHubForm/SettingsHubFormContext'

// redesign settings A: the open section of the hub. Heavy editors are replaced by stubs; the real thing under test
// is what the detail adds around them (its header, the `key` per section and the hub's form context).

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

vi.mock('../../../Shared', () => ({
  NotFoundSource: ({ content }) => <div data-testid='not-found'>{content}</div>
}))

vi.mock('../../SettingsList', () => ({
  SettingsList: ({ category, focus }) => {
    const hubForm = useSettingsHubForm()
    const [typed, setTyped] = useState('')
    return (
      <div data-testid='settings-list'>
        <span data-testid='list-category'>{category.key}</span>
        <span data-testid='list-focus'>{focus || ''}</span>
        <span data-testid='list-product'>{String(!!hubForm?.product)}</span>
        <input aria-label='typed' value={typed} onChange={event => setTyped(event.target.value)} />
        <button type='button' onClick={() => hubForm.report(category.key, { dirty: true, saving: false })}>report dirty</button>
      </div>
    )
  }
}))

vi.mock('../../InfoHelpBox', () => ({
  InfoHelpBox: ({ category }) => <div data-testid='info-box'>{category.key}</div>
}))

vi.mock('../../EmailSetting', () => ({ EmailSetting: ({ focus }) => <div data-testid='email' data-focus={focus || ''} /> }))
vi.mock('../../NotificationSetting', () => ({ NotificationSetting: () => <div data-testid='notification' /> }))
vi.mock('../../SettingsLoyaltyStores', () => ({ SettingsLoyaltyStores: ({ focus }) => <div data-testid='loyalty' data-focus={focus || ''} /> }))
vi.mock('../../LanguageSetting', () => ({ LanguageSetting: () => <div data-testid='languages' /> }))
vi.mock('../../PlaceListing', () => ({ PlaceListing: () => <div data-testid='places' /> }))
vi.mock('../../IntegrationListing', () => ({ IntegrationListing: () => <div data-testid='developers' /> }))
vi.mock('../../CustomOrder', () => ({ CustomOrder: () => <div data-testid='custom-order' /> }))
vi.mock('../../Cms', () => ({ Cms: () => <div data-testid='pages' /> }))
vi.mock('../../GuestCheckoutFieldsSetting', () => ({ GuestCheckoutFieldsSetting: () => <div data-testid='guest-checkout' /> }))
vi.mock('../../CheckoutFieldsSetting', () => ({ CheckoutFieldsSetting: () => <div data-testid='checkout-fields' /> }))
vi.mock('../../AddressFieldsSetting', () => ({ AddressFieldsSetting: () => <div data-testid='address-fields' /> }))
vi.mock('../../CardFieldsSetting', () => ({ CardFieldsSetting: () => <div data-testid='card-fields' /> }))
vi.mock('../../LanguageManager', () => ({ LanguageManager: () => <div data-testid='language-manager' /> }))
vi.mock('../../SitesAuthSettings', () => ({ SitesAuthSettings: () => <div data-testid='sites' /> }))
vi.mock('../../MultiCountrySettings', () => ({ MultiCountrySettings: () => <div data-testid='multi-country' /> }))
vi.mock('../../ApiUsageLimits', () => ({ ApiUsageLimits: () => <div data-testid='api-usage' /> }))

import { SettingsHubDetail } from '../SettingsHubDetail'

const makeSection = (key, overrides = {}) => ({
  type: 'category',
  key,
  copy: { label: `Title of ${key}`, descriptionKey: `DESC_${key}`, description: `About ${key}` },
  category: { key, configs: [{ key: `${key}_config`, name: 'A config' }] },
  ...overrides
})

describe('SettingsHubDetail', () => {
  it('draws the group as a muted route, the title as h2 and the description', () => {
    render(<SettingsHubDetail section={makeSection('stripe')} groupLabel='Payments' report={vi.fn()} />)

    expect(screen.getByText('Payments')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Title of stripe' })).toBeInTheDocument()
    expect(screen.getByText('About stripe')).toBeInTheDocument()
  })

  it('has no route line when it is given no group (the phone: the back row already says it)', () => {
    render(<SettingsHubDetail section={makeSection('stripe')} report={vi.fn()} />)
    expect(document.querySelector('.odc-hub-crumb')).toBeNull()
  })

  it('does not announce itself as a live region', () => {
    const { container } = render(<SettingsHubDetail section={makeSection('stripe')} report={vi.fn()} />)
    expect(container.querySelector('[aria-live]')).toBeNull()
  })

  it('gives its forms the hub context with the hub report', () => {
    const report = vi.fn()
    render(<SettingsHubDetail section={makeSection('stripe')} report={report} />)

    expect(screen.getByTestId('list-product')).toHaveTextContent('true')
    fireEvent.click(screen.getByRole('button', { name: 'report dirty' }))
    expect(report).toHaveBeenCalledWith('stripe', { dirty: true, saving: false })
  })

  it('passes focus to the list', () => {
    render(<SettingsHubDetail section={makeSection('stripe')} focus='stripe_publishable' report={vi.fn()} />)
    expect(screen.getByTestId('list-focus')).toHaveTextContent('stripe_publishable')
  })

  // the legacy editors need `?focus=` too, or a search result opens the section on top and leaves the field at the end
  it('passes focus to the email editor and to both wallet editors', () => {
    const { rerender } = render(
      <SettingsHubDetail section={makeSection('email_configs')} focus='email_business_states' report={vi.fn()} />
    )
    expect(screen.getByTestId('email')).toHaveAttribute('data-focus', 'email_business_states')

    const points = makeSection('addon_points_and_levels')
    rerender(<SettingsHubDetail section={points} focus='addon_points_and_levels' report={vi.fn()} />)
    expect(screen.getByTestId('loyalty')).toHaveAttribute('data-focus', 'addon_points_and_levels')

    const cash = makeSection('addon_cash_wallet_and_refunds')
    rerender(<SettingsHubDetail section={cash} focus='cash_wallet_enabled' report={vi.fn()} />)
    expect(screen.getByTestId('loyalty')).toHaveAttribute('data-focus', 'cash_wallet_enabled')
  })

  it('remounts what it renders when the section changes, so a form keeps nothing of the previous one', () => {
    const { rerender } = render(<SettingsHubDetail section={makeSection('stripe')} report={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('typed'), { target: { value: 'half-typed' } })
    expect(screen.getByLabelText('typed')).toHaveValue('half-typed')

    // the same section again keeps its state (a new `focus` is not a new section)
    rerender(<SettingsHubDetail section={makeSection('stripe')} focus='x' report={vi.fn()} />)
    expect(screen.getByLabelText('typed')).toHaveValue('half-typed')

    rerender(<SettingsHubDetail section={makeSection('pro_payments')} report={vi.fn()} />)
    expect(screen.getByTestId('list-category')).toHaveTextContent('pro_payments')
    expect(screen.getByLabelText('typed')).toHaveValue('')
  })

  it('moves the focus to the title when the hub asks for it (the phone section screen)', () => {
    render(<SettingsHubDetail section={makeSection('stripe')} focusHeading report={vi.fn()} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Title of stripe' })).toHaveFocus()
    expect(screen.getByRole('heading', { level: 2 })).toHaveAttribute('tabindex', '-1')
  })

  it('leaves the focus alone otherwise', () => {
    render(<SettingsHubDetail section={makeSection('stripe')} report={vi.fn()} />)
    expect(screen.getByRole('heading', { level: 2 })).not.toHaveFocus()
  })

  it('shows the video button only when the category has a video, and opens its box', () => {
    const { rerender } = render(<SettingsHubDetail section={makeSection('stripe')} report={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'More info' })).not.toBeInTheDocument()

    const withVideo = makeSection('stripe')
    withVideo.category.video = 'https://example.test/v'
    rerender(<SettingsHubDetail section={withVideo} report={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'More info' }))
    expect(screen.getByTestId('info-box')).toHaveTextContent('stripe')
  })

  it('draws the email and notification editors and the special screens as before', () => {
    const { rerender } = render(
      <SettingsHubDetail section={makeSection('email_configs')} report={vi.fn()} />
    )
    expect(screen.getByTestId('email')).toBeInTheDocument()

    rerender(<SettingsHubDetail section={makeSection('notification')} report={vi.fn()} />)
    expect(screen.getByTestId('notification')).toBeInTheDocument()

    rerender(<SettingsHubDetail section={{ type: 'screen', key: 'languages', copy: { label: 'Languages' } }} report={vi.fn()} />)
    expect(screen.getByTestId('languages')).toBeInTheDocument()
  })

  // (AC): the three legacy lists of «Checkout form fields» sit in one stack that spaces them with a token, instead of
  // each one carrying its own 20 px padding (which left a blank band under the last list)
  it('stacks the three checkout field lists in one spaced group, in the same order', () => {
    render(<SettingsHubDetail section={{ type: 'screen', key: 'user_information', copy: { label: 'Checkout form fields' } }} report={vi.fn()} />)
    const stack = document.querySelector('.odc-hub-detail-body > .odc-hub-fields-stack')
    expect(stack).toBeTruthy()
    expect([...stack.children].map(child => child.getAttribute('data-testid'))).toEqual(['checkout-fields', 'address-fields', 'card-fields'])
  })

  it('asks for a choice when there is no section', () => {
    render(<SettingsHubDetail section={null} report={vi.fn()} />)
    expect(screen.getByText('Choose a setting from the list.')).toBeInTheDocument()
  })

  it('reports nothing by itself and survives a missing report', () => {
    render(<SettingsHubDetail section={makeSection('stripe')} />)
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'report dirty' }))).not.toThrow()
  })
})
