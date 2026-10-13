import React from 'react'
import { render as rtlRender, screen, fireEvent, cleanup } from '@testing-library/react'
import { vi, it, expect, afterEach } from 'vitest'
import { ThemeProvider } from 'styled-components'
import theme from '~/theme.json'
import { StoreOnboardingUI } from './index'
import { createDraft } from '../../../../../utils/storeOnboarding'
vi.mock('../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [null, (key, fallback) => fallback] }))
vi.mock('./HoursEditor', () => ({ HoursEditor: () => <div>Native schedule editor</div> }))
vi.mock('./BusinessAddressEditor', () => ({ BusinessAddressEditor: () => <div>Native business address</div> }))
vi.mock('./ZoneEditor', () => ({ ZoneEditor: () => <div>Zone map</div> }))
const render = element => { const result = rtlRender(<ThemeProvider theme={theme}>{element}</ThemeProvider>); return { ...result, rerender: next => result.rerender(<ThemeProvider theme={theme}>{next}</ThemeProvider>) } }
afterEach(cleanup)
const props = step => ({ appearance: { siteId: 1, themeId: 2, color: '#112233' }, draft: { ...createDraft('owner@example.com'), step }, meta: { configs: {}, paymethods: [{ gateway: 'cash' }, { gateway: 'card_delivery' }] }, site: {}, update: vi.fn(), move: vi.fn(), chooseMenu: vi.fn(), publish: vi.fn(), errors: [], project: 'Test restaurant' })
it('shows reassuring copy and one clear primary action on every setup step', () => {
  for (let step = 0; step < 6; step++) {
    const view = render(<StoreOnboardingUI {...props(step)} />)
    expect(screen.getByText('You can change this later.')).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    view.unmount()
  }
})
it('offers only the two offline methods and two simple menu paths', () => {
  let p = props(4)
  const view = render(<StoreOnboardingUI {...p} />)
  expect(screen.getByLabelText('Cash')).toBeTruthy()
  expect(screen.getByLabelText('Card on delivery')).toBeTruthy()
  expect(screen.queryByText(/online/i)).toBeNull()
  view.unmount()
  p = props(5)
  render(<StoreOnboardingUI {...p} />)
  fireEvent.click(screen.getByRole('button', { name: /Use a sample menu/ }))
  expect(p.chooseMenu).toHaveBeenCalledWith(true)
  expect(screen.queryByText(/import|point of sale/i)).toBeNull()
})
it('opens the existing product form with images and keeps publication disabled while editing', () => {
  const p = props(5)
  p.draft.form.menuMode = 'sample'
  p.draft.form.categories = [{ key: 'category', name: 'Pizzas', products: [{ key: 'product', name: 'Margherita', price: '12' }] }]
  render(<StoreOnboardingUI {...p} />)
  fireEvent.click(screen.getByRole('button', { name: 'Edit Margherita' }))
  expect(screen.getByPlaceholderText('Write price')).toHaveValue(12)
  expect(document.querySelector('input[type=file]')).toBeTruthy()
  expect(screen.getByRole('button', { name: /Publish my restaurant/ })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.getByRole('button', { name: /Publish my restaurant/ })).not.toBeDisabled()
})
it('shows no invented link while the website is unavailable and displays the resolved restaurant URL', () => {
  const p = props(6)
  p.draft.journal.published = true
  const view = render(<StoreOnboardingUI {...p} />)
  expect(screen.queryByRole('link', { name: /View/ })).toBeNull()
  expect(screen.getByText(/website is not available yet/i)).toBeTruthy()
  view.rerender(<StoreOnboardingUI {...p} site={{ url: 'https://real-franchise.example/store/restaurant' }} />)
  expect(screen.getByRole('link', { name: /View my restaurant/ }).href).toBe('https://real-franchise.example/store/restaurant')
})

it('removes Save and exit and allows returning to the menu path selector', () => {
  const p = props(5); p.draft.form.menuMode = 'sample'; render(<StoreOnboardingUI {...p} />)
  expect(screen.queryByText('Save and exit')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  fireEvent.click(screen.getByText('Change menu option')); expect(p.chooseMenu).toHaveBeenCalledWith(null)
})

it('uses the current dashboard brand fallback and honors a project logo', () => {
  const p = props(0); const view = render(<StoreOnboardingUI {...p} />)
  expect(screen.getByRole('img', { name: 'Dashboard' }).getAttribute('src')).toContain('ordering-lockup-color.svg')
  p.meta.configs.dashboard_logo = { value: 'https://brand.example/logo.png' }
  view.rerender(<StoreOnboardingUI {...p} />)
  expect(screen.getByRole('img', { name: 'Test restaurant' }).getAttribute('src')).toBe('https://brand.example/logo.png')
})

it('uses a restaurant icon or its uploaded logo instead of an unexplained circle', () => {
  const p = props(0)
  const view = render(<StoreOnboardingUI {...p} />)
  expect(screen.queryByText('◉')).toBeNull()
  p.draft.form.logo = 'data:image/png;base64,test'
  view.rerender(<StoreOnboardingUI {...p} />)
  expect(screen.getByRole('img', { name: 'Logo' }).getAttribute('src')).toBe(p.draft.form.logo)
})

it('lets publication explain missing fields instead of leaving a disabled dead end', () => {
  const p = props(5)
  p.draft.form.menuMode = 'manual'
  render(<StoreOnboardingUI {...p} />)
  expect(screen.getByRole('button', { name: /Publish my restaurant/ })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  fireEvent.click(screen.getByRole('button', { name: /Publish my restaurant/ }))
  expect(p.publish).toHaveBeenCalledTimes(1)
})

it('lets an unavailable selected payment be removed, without allowing it to be enabled again', () => {
  const p = props(4); p.meta.paymethods = [{ gateway: 'card_delivery' }]
  const view = render(<StoreOnboardingUI {...p} />)
  const cash = screen.getByRole('checkbox', { name: /Cash/ })
  expect(cash).toBeChecked(); expect(cash).not.toBeDisabled()
  fireEvent.click(cash); expect(p.update).toHaveBeenCalledWith({ payments: [] })
  p.draft.form.payments = []
  view.rerender(<StoreOnboardingUI {...p} />)
  expect(screen.getByRole('checkbox', { name: /Cash/ })).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox', { name: /Card on delivery/ }))
  expect(p.update).toHaveBeenLastCalledWith({ payments: ['card_delivery'] })
})

it('shows five steps with delivery and cash together, and back from menu returns to delivery', () => {
  const p = props(3)
  const view = render(<StoreOnboardingUI {...p} />)
  expect(screen.getByRole('navigation').querySelectorAll('li')).toHaveLength(5)
  expect(screen.getByLabelText('Cash')).toBeChecked()
  expect(screen.getByText('Everywhere')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
  expect(p.move).toHaveBeenCalledWith(5)
  view.rerender(<StoreOnboardingUI {...props(5)} move={p.move} />)
  fireEvent.click(screen.getByRole('button', { name: /Back/ }))
  expect(p.move).toHaveBeenLastCalledWith(3)
})

it('latest chosen logo owns completion when file reads resolve out of order', () => {
  const readers = []
  vi.stubGlobal('FileReader', class { constructor () { readers.push(this) } readAsDataURL () {} })
  try {
    const p = props(1); render(<StoreOnboardingUI {...p} />)
    const input = screen.getByLabelText('Upload logo')
    fireEvent.change(input, { target: { files: [new File(['first'], 'first.png', { type: 'image/png' })] } })
    fireEvent.change(input, { target: { files: [new File(['second'], 'second.png', { type: 'image/png' })] } })
    readers[1].result = 'data:image/png;base64,SECOND'; readers[1].onload()
    readers[0].result = 'data:image/png;base64,FIRST'; readers[0].onload()
    expect(p.update.mock.calls.at(-1)[0].logo).toBe('data:image/png;base64,SECOND')
  } finally { vi.unstubAllGlobals() }
})
it('removing the logo cancels a pending replacement', () => {
  const readers = []
  vi.stubGlobal('FileReader', class { constructor () { readers.push(this) } readAsDataURL () {} })
  try {
    const p = props(1); p.draft.form.logo = 'data:image/png;base64,OLD'; render(<StoreOnboardingUI {...p} />)
    fireEvent.change(screen.getByLabelText('Upload logo'), { target: { files: [new File(['new'], 'new.png', { type: 'image/png' })] } })
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    readers[0].result = 'data:image/png;base64,NEW'; readers[0].onload()
    expect(p.update.mock.calls.at(-1)[0].logo).toBe('')
  } finally { vi.unstubAllGlobals() }
})

it.each(['unmount', 'publishing'])('ignores a pending logo after %s', mode => {
  const readers = []
  vi.stubGlobal('FileReader', class { constructor () { readers.push(this) } readAsDataURL () {} })
  try {
    const p = props(1)
    const view = render(<StoreOnboardingUI {...p} />)
    fireEvent.change(screen.getByLabelText('Upload logo'), { target: { files: [new File(['new'], 'new.png', { type: 'image/png' })] } })
    if (mode === 'unmount') view.unmount()
    else view.rerender(<StoreOnboardingUI {...p} publishing />)
    readers[0].result = 'data:image/png;base64,NEW'; readers[0].onload()
    expect(p.update).not.toHaveBeenCalled()
  } finally { vi.unstubAllGlobals() }
})

it('shows one editable prefilled email without disclosure or technical regional summary', () => {
  const p = props(0)
  p.draft.form.email = 'edited-owner@example.com'
  p.meta.configs = { stripe_currency: { value: 'MXN' }, format_number_currency: { value: '$' }, distance_unit: { value: 'km' } }
  render(<StoreOnboardingUI {...p} />)
  const email = screen.getByLabelText('Email')
  expect(email).toBeVisible()
  expect(email).toHaveValue('edited-owner@example.com')
  expect(email.closest('details')).toBeNull()
  expect(screen.queryByText('MXN · $ · km')).toBeNull()
  fireEvent.change(email, { target: { value: 'new-owner@example.com' } })
  expect(p.update).toHaveBeenCalledWith({ email: 'new-owner@example.com' })
})

it('keeps the zone name open and renders the map for Everywhere', () => {
  render(<StoreOnboardingUI {...props(3)} />)
  expect(screen.getByLabelText('Name').closest('details')).toBeNull()
  expect(screen.getByText('Zone map')).toBeTruthy()
})

it('shows the card-payment hint and only website and Home completion actions', () => {
  const p = props(3)
  const view = render(<StoreOnboardingUI {...p} />)
  expect(screen.getByText('You can select card payments once you finish setting up your store.')).toBeVisible()
  p.draft.step = 6; p.draft.journal.published = true; p.onComplete = vi.fn()
  view.rerender(<StoreOnboardingUI {...p} site={{ url: 'https://restaurant.example/store/pizza' }} testOrder={{ enabled: true }} />)
  expect(screen.getAllByRole('link')).toHaveLength(1)
  expect(screen.getAllByRole('button')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: /Continue to Home/ }))
  expect(p.onComplete).toHaveBeenCalledWith()
  expect(screen.queryByRole('button', { name: /Orders manager/ })).toBeNull()
})

it('binds the chosen website color to its actual theme and offers a preview', () => {
  const p = props(1)
  render(<StoreOnboardingUI {...p} />)
  fireEvent.change(screen.getByLabelText('Color code'), { target: { value: '#abcdef' } })
  expect(p.update).toHaveBeenCalledWith({ websiteColor: '#abcdef', websiteAppearanceTarget: { siteId: 1, themeId: 2 } })
  expect(screen.getByRole('button', { name: 'Website preview' })).toBeEnabled()
})
