/* eslint-disable import/first */
// redesign stores 5.15a (; G5-04, G5-07, G5-08, G5-09): the QR codes of a store on P/SectionSplit.
// - one address for the store (`useStoreWebsiteUrl`), never `…/store/undefined`;
// - «Generate code» says why it cannot;
// - the table or spot number keeps main's characters, also when pasted, and a missing one is said under the field;
// - the printed node is the QR and, under it, the store and the table or spot or the order type (J2 row 18, O1); the link is
//   shown outside it with «Copy link».
import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({}))
const reset = () => {
  state.project = { websiteProduct: 'web_marketplace_26' }
  state.site = { sites: [], loading: false }
  state.storeUrl = (slug) => slug ? `https://shop.example.com/store/${encodeURIComponent(slug)}` : null
}
reset()

// `~components` and the relative index are the same module: both mocks must say the same
const mockModule = vi.hoisted(() => async () => {
  const { createElement } = await import('react')
  return {
    useLanguage: () => [{ language: { code: 'en' } }, (_key, text) => text],
    useSite: () => [state.site],
    BusinessQRCodeOptions: ({ UIComponent, ...props }) => createElement(UIComponent, props)
  }
})
vi.mock('../../../../../../index', mockModule)
vi.mock('~components', mockModule)
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1440, height: 900 }) }))
vi.mock('../../../../hooks/useWebsiteUrl', () => ({ useStoreWebsiteUrl: (slug) => state.storeUrl(slug) }))
vi.mock('../../../../contexts/ProjectContext', () => ({ useProjectState: () => [state.project] }))
vi.mock('react-qr-code', async () => {
  const { createElement } = await import('react')
  return { default: ({ value }) => createElement('svg', { 'data-testid': 'qr', 'data-value': value }) }
})
vi.mock('react-to-print', async () => {
  const { cloneElement } = await import('react')
  return { default: ({ trigger, content }) => cloneElement(trigger(), { onClick: () => { window.__printed = content() } }) }
})

import { BusinessQRCodeOptions } from '../index'

let writeText
beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})
afterEach(() => {
  delete navigator.clipboard
  delete window.__printed
  reset()
})

const setup = (business = { id: 2, slug: 'fastbite' }) => {
  const setIsExtendExtraOpen = vi.fn()
  render(<BusinessQRCodeOptions business={business} setIsExtendExtraOpen={setIsExtendExtraOpen} />)
  return { setIsExtendExtraOpen }
}
const open = (name) => fireEvent.click(screen.getByRole('button', { name }))
const generate = () => fireEvent.click(screen.getByRole('button', { name: 'Generate Code' }))

describe('QR codes · list and detail', () => {
  it('is titled as the menu and lists the five order types as buttons', () => {
    setup()
    expect(screen.getByRole('heading', { level: 1, name: 'QR Codes' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'QR Code for Drive Thru' })).toBeInTheDocument()
  })

  it('opens the detail of a row (named by it) and gives the section the width, as main did', () => {
    const { setIsExtendExtraOpen } = setup()
    open('QR Code for Eat in')
    expect(screen.getByRole('heading', { name: 'QR Code for Eat in', level: 3 })).toBeInTheDocument()
    expect(setIsExtendExtraOpen).toHaveBeenLastCalledWith(true)
    expect(screen.getByRole('button', { name: 'QR Code for Eat in' }).closest('li')).toHaveAttribute('aria-current', 'true')
  })
})

describe('QR codes · the store address (G5-08)', () => {
  it('a delivery QR opens the store address with the order type', () => {
    setup()
    open('QR Code for Delivery')
    generate()
    expect(screen.getByTestId('qr')).toHaveAttribute('data-value', 'https://shop.example.com/store/fastbite?order_type=1')
  })

  it('a table QR carries the table number', () => {
    setup()
    open('QR Code for Eat in')
    fireEvent.change(screen.getByRole('textbox', { name: 'Table number' }), { target: { value: '12' } })
    generate()
    expect(screen.getByTestId('qr')).toHaveAttribute('data-value', 'https://shop.example.com/store/fastbite?order_type=3&table_number=12')
  })

  it('a curbside QR carries the spot number', () => {
    setup()
    open('QR Code for Curbside')
    fireEvent.change(screen.getByRole('textbox', { name: 'Spot number' }), { target: { value: '4' } })
    generate()
    expect(screen.getByTestId('qr')).toHaveAttribute('data-value', 'https://shop.example.com/store/fastbite?order_type=4&spot_number=4')
  })
})

describe('QR codes · Generate code says why it cannot (G5-07)', () => {
  it('a project without a website', () => {
    state.project = {}
    state.storeUrl = () => null
    setup()
    open('QR Code for Pickup')
    const button = screen.getByRole('button', { name: 'Generate Code' })
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleDescription('This project has no website, so a QR code would have nowhere to take customers.')
  })

  it('a store without an address (no slug): never …/store/undefined', () => {
    setup({ id: 2 })
    open('QR Code for Pickup')
    const button = screen.getByRole('button', { name: 'Generate Code' })
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleDescription('This store has no website address yet, so a QR code can\'t be made.')
    expect(screen.queryByTestId('qr')).toBeNull()
  })

  it('while the address loads', () => {
    state.storeUrl = () => null
    state.site = { sites: [], loading: true }
    setup()
    open('QR Code for Pickup')
    expect(screen.getByRole('button', { name: 'Generate Code' })).toHaveAccessibleDescription('Loading the store\'s address…')
  })

  it('while the project loads, it does not say there is no website', () => {
    state.storeUrl = () => null
    state.project = { loading: true, websiteProduct: null }
    setup()
    open('QR Code for Pickup')
    expect(screen.getByRole('button', { name: 'Generate Code' })).toHaveAccessibleDescription('Loading the store\'s address…')
  })
})

describe('QR codes · the number (G5-09)', () => {
  it('keeps digits and a point, typed or pasted', () => {
    setup()
    open('QR Code for Eat in')
    const field = screen.getByRole('textbox', { name: 'Table number' })
    fireEvent.change(field, { target: { value: '1a2-.5 ' } })
    expect(field).toHaveValue('12.5')
  })

  it('a missing number is said under the field and makes no code', () => {
    setup()
    open('QR Code for Drive Thru')
    generate()
    expect(screen.getByText('Spot number is required')).toBeInTheDocument()
    expect(screen.queryByTestId('qr')).toBeNull()
  })
})

// redesign bugs F row 36: after «Generate Code», a new number left the QR, its link and Print on the old one without a
// word (= main). Nothing is taken away: the code stays, and a notice says it is still the old number until it is generated again.
describe('QR codes · a number changed after generating (row 36)', () => {
  const tableNumber = () => screen.getByRole('textbox', { name: 'Table number' })

  it('says the code still uses the old number, and the notice goes once it is generated again', () => {
    setup()
    open('QR Code for Eat in')
    fireEvent.change(tableNumber(), { target: { value: '5' } })
    generate()
    expect(screen.queryByText(/still use number 5/)).toBeNull()
    fireEvent.change(tableNumber(), { target: { value: '6' } })
    expect(screen.getByText('This QR code and its link still use number 5. Generate the code again to use the new one.').closest('[role="status"]')).not.toBeNull()
    expect(screen.getByTestId('qr')).toHaveAttribute('data-value', expect.stringContaining('table_number=5'))
    expect(screen.getByRole('button', { name: 'Print' })).toBeEnabled()
    generate()
    expect(screen.queryByText(/still use number/)).toBeNull()
    expect(screen.getByTestId('qr')).toHaveAttribute('data-value', expect.stringContaining('table_number=6'))
  })

  it('a curbside spot says it too; going back to the generated number clears it', () => {
    setup()
    open('QR Code for Curbside')
    fireEvent.change(screen.getByRole('textbox', { name: 'Spot number' }), { target: { value: '4' } })
    generate()
    fireEvent.change(screen.getByRole('textbox', { name: 'Spot number' }), { target: { value: '41' } })
    expect(screen.getByText(/still use number 4\./)).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Spot number' }), { target: { value: '4' } })
    expect(screen.queryByText(/still use number/)).toBeNull()
  })
})

// review R-4 (bugs F): the notice lines up with the field and the buttons (its own margin is a filter bar's page gutter)
describe('QR codes · the outdated notice lines up (R-4)', () => {
  it('takes no margin of its own in the detail', async () => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const css = readFileSync(path.join(__dirname, '..', '..', 'BusinessQRCodeOption', 'qr-code.css'), 'utf8')
    expect(css).toMatch(/\.odc-qr-detail \.odc-notice \{ margin: 0; \}/)
  })
})

describe('QR codes · print and copy (G5-04, G5-09)', () => {
  it('Print waits for a code; the printed node is the QR and its caption (J2 row 18), never the link', () => {
    setup()
    open('QR Code for Delivery')
    expect(screen.getByRole('button', { name: 'Print' })).toBeDisabled()
    generate()
    fireEvent.click(screen.getByRole('button', { name: 'Print' }))
    expect(window.__printed.querySelector('[data-testid="qr"]')).not.toBeNull()
    expect(window.__printed.querySelector('.odc-qr-print-caption')).toHaveTextContent('Delivery')
    expect(window.__printed.textContent).not.toContain('https://')
    expect(window.__printed.querySelector('button')).toBeNull()
  })

  it('shows the link outside the print and copies it', async () => {
    setup()
    open('QR Code for Delivery')
    generate()
    expect(screen.getByText('https://shop.example.com/store/fastbite?order_type=1')).toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy link' })) })
    expect(writeText).toHaveBeenCalledWith('https://shop.example.com/store/fastbite?order_type=1')
  })
})
