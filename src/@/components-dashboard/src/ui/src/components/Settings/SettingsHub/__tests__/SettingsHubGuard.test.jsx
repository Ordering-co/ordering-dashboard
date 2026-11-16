import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { useHistory, useLocation } from 'react-router-dom'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign settings A (decision 5 / owner decision 17): the discard guard of the hub, through the whole hub with a
// fake section that tells the hub its state with `report`, like SettingsList, EmailSetting and NotificationSetting do.

const windowSize = vi.hoisted(() => ({ width: 1200, height: 800 }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]
}))

vi.mock('../../../../hooks/useWindowSize', () => ({
  useWindowSize: () => windowSize
}))

vi.mock('../SettingsHubDetail', () => ({
  SettingsHubDetail: ({ section, report }) => (
    <div>
      <div data-testid='hub-detail'>{section?.key || 'empty'}</div>
      <button type='button' onClick={() => report(section.key, { dirty: true, saving: false })}>Make dirty</button>
      <button type='button' onClick={() => report(section.key, { dirty: true, saving: true })}>Start saving</button>
      <button type='button' onClick={() => report(section.key, null)}>Make clean</button>
    </div>
  )
}))

import { SettingsHub } from '../index'

const categoryLists = {
  key_basic: [
    { id: 1, key: 'stripe', name: 'Card Payments', rank: 1, configs: [{ key: 'stripe_publishable', name: 'Publishable key', rank: 1 }] },
    { id: 2, key: 'pro_payments', name: 'Wallet payments', rank: 2, configs: [{ key: 'apple_pay_enabled', name: 'Apple Pay', rank: 1 }] },
    { id: 3, key: 'platform_date_time_formats', name: 'Date and time', rank: 3, configs: [{ key: 'dates_general_format', name: 'Date format', rank: 1 }] }
  ]
}

let hubHistory = null
const Probe = () => {
  hubHistory = useHistory()
  const location = useLocation()
  return <div data-testid='hub-location'>{`${location.pathname}${location.search}`}</div>
}

const renderHub = (path = '/settings?group=payments&category=stripe') => renderWithProviders(
  <>
    <Probe />
    <SettingsHub categoryLists={categoryLists} loadingCategories={false} categoriesError={null} configs={{}} />
  </>,
  { initialEntries: [path], routePath: '/settings' }
)

const location = () => screen.getByTestId('hub-location')
const makeDirty = () => fireEvent.click(screen.getByRole('button', { name: 'Make dirty' }))
// another section of the same group (Payments)
const otherSection = () => screen.getByRole('button', { name: 'Apple Pay & Google Pay' })

describe('SettingsHub discard guard', () => {
  beforeEach(() => {
    windowSize.width = 1200
    hubHistory = null
  })

  it('navigates straight away when nothing is dirty', () => {
    renderHub()
    fireEvent.click(otherSection())
    expect(location()).toHaveTextContent('category=pro_payments')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('asks before leaving a dirty section, and Keep editing stays with the focus back where it was', async () => {
    renderHub()
    makeDirty()
    const row = otherSection()
    row.focus()
    fireEvent.click(row)

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Discard your changes?')
    expect(dialog).toHaveTextContent('You have unsaved changes in Card payments (Stripe). If you leave, they are lost.')
    // the safe choice has the focus
    await waitFor(() => expect(screen.getByRole('button', { name: 'Keep editing' })).toHaveFocus())
    expect(location()).toHaveTextContent('category=stripe')

    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(location()).toHaveTextContent('category=stripe')
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('stripe')
    await waitFor(() => expect(row).toHaveFocus())
  })

  it('Discard leaves and repeats the navigation that was intercepted', async () => {
    renderHub()
    makeDirty()
    fireEvent.click(otherSection())
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }))

    await waitFor(() => expect(location()).toHaveTextContent('category=pro_payments'))
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('pro_payments')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('stops being a guard once the form says it is clean again', () => {
    renderHub()
    makeDirty()
    fireEvent.click(screen.getByRole('button', { name: 'Make clean' }))
    fireEvent.click(otherSection())
    expect(location()).toHaveTextContent('category=pro_payments')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('intercepts the landing, another group and the Suggestions button', async () => {
    renderHub()
    makeDirty()
    fireEvent.click(screen.getByRole('button', { name: 'Suggestions' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(location()).toHaveTextContent('category=stripe')
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /^Platform/ }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(location()).toHaveTextContent('category=stripe')
  })

  it('intercepts a navigation from outside the hub (⌘K, a link, the sidebar)', async () => {
    renderHub()
    makeDirty()
    act(() => { hubHistory.push('/orders') })

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(location()).toHaveTextContent('/settings?group=payments&category=stripe')

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(hubHistory.location.pathname).toBe('/orders'))
  })

  it('intercepts the browser back button and repeats it on Discard', async () => {
    renderHub()
    // a clean visit to another section first, so there is an entry behind the dirty one
    act(() => { hubHistory.push('/settings?group=platform&category=platform_date_time_formats') })
    expect(screen.getByTestId('hub-detail')).toHaveTextContent('platform_date_time_formats')
    makeDirty()
    act(() => { hubHistory.goBack() })

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(location()).toHaveTextContent('category=platform_date_time_formats')

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(location()).toHaveTextContent('category=stripe'))
    expect(hubHistory.index).toBe(0)
  })

  it('lets through what stays in the same section: typing in the search, focus and the editor params', () => {
    renderHub('/settings?group=payments&category=stripe&id=webhooks')
    makeDirty()

    fireEvent.change(screen.getByLabelText('Search settings'), { target: { value: 'stri' } })
    expect(location()).toHaveTextContent('q=stri')
    expect(location()).toHaveTextContent('id=webhooks')

    act(() => { hubHistory.replace('/settings?group=payments&category=stripe&q=stri&focus=stripe_publishable') })
    act(() => { hubHistory.push('/settings?category=stripe&page=2') })
    expect(location()).toHaveTextContent('page=2')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('also guards a saving form, with the saving text', async () => {
    renderHub()
    fireEvent.click(screen.getByRole('button', { name: 'Start saving' }))
    fireEvent.click(otherSection())
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Your changes are still saving. If you leave, some may not be saved.')
  })

  it('warns on reload or closing the tab only while something is dirty', () => {
    renderHub()
    const clean = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(clean)
    expect(clean.defaultPrevented).toBe(false)

    makeDirty()
    const dirty = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(dirty)
    expect(dirty.defaultPrevented).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Make clean' }))
    const after = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(after)
    expect(after.defaultPrevented).toBe(false)
  })

  it('on the phone the back row of a dirty section asks first', async () => {
    windowSize.width = 390
    renderHub()
    makeDirty()
    fireEvent.click(screen.getByRole('button', { name: 'Payments' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(location()).toHaveTextContent('category=stripe')

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(location()).not.toHaveTextContent('category='))
  })
})
