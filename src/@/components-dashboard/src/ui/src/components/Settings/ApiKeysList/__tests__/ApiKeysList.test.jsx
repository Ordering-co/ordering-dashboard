/* eslint-disable import/first */
// Owner decision 25 B (2026-10-21, , security): Settings › Developers › API keys showed every key whole, so anyone who saw
// the screen or a capture took them. A key now reads «Ends in …k3Fz» (the P/SecretField criterion of hidden by default,
// the last four characters only from 12 characters on) with «Copy», which copies the whole key, and «Show», one more step to read it.
// The full key is not in the page until «Show» is pressed. The row menu (Copy, Delete) is main's.
import React from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ props: {} }))

vi.mock('../../../../../../index', async () => {
  const react = await import('react')
  const Controller = ({ UIComponent, ...rest }) => react.createElement(UIComponent, { ...rest, ...runtime.props })
  return {
    useLanguage: () => [{ dictionary: {}, language: { code: 'en' } }, (_key, text) => text],
    ApiKeysList: Controller
  }
})

import { ApiKeysList } from '../index'

const theme = { rtl: false, colors: new Proxy({}, { get: () => '#123456' }) }
const renderWith = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)

const LONG = 'mock_01_xxxxxxxxxxxxxxK3Fz'
const OTHER = 'mock_02_xxxxxxxxxxxxxx7Q2w'
const SHORT = 'key-alpha'
const noop = () => {}
let writeText

beforeEach(() => {
  writeText = vi.fn(() => Promise.resolve())
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  runtime.props = {
    apiKeysList: { loading: false, keys: [{ id: 1, key: LONG }, { id: 2, key: OTHER }, { id: 3, key: SHORT }] },
    actionState: {},
    handleDeleteApiKey: noop,
    handleAddApiKey: noop
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ApiKeysList · keys are hidden (owner decision 25)', () => {
  it('shows only the last four characters, and no whole key anywhere in the page', () => {
    const { container } = renderWith(<ApiKeysList />)
    expect(screen.getByText((_, node) => node?.textContent === 'Ends in …K3Fz' && node.childElementCount > 0)).toBeInTheDocument()
    expect(screen.getByText((_, node) => node?.textContent === 'Ends in …7Q2w' && node.childElementCount > 0)).toBeInTheDocument()
    const html = container.innerHTML + document.body.innerHTML
    for (const key of [LONG, OTHER, SHORT]) expect(html).not.toContain(key)
  })

  it('a key under 12 characters shows no ending (four characters would be a third of it)', () => {
    renderWith(<ApiKeysList />)
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[2]).not.toHaveTextContent('Ends in')
    expect(rows[2]).not.toHaveTextContent('lpha')
  })

  it('names the row menu after the ending, never the key', () => {
    renderWith(<ApiKeysList />)
    expect(screen.getByRole('button', { name: 'Actions for API key ending in …K3Fz' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Actions for API key 3' })).toBeInTheDocument()
  })

  it('«Copy» copies the whole key', async () => {
    const user = userEvent.setup()
    renderWith(<ApiKeysList />)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await user.click(screen.getByRole('button', { name: 'Copy API key ending in …K3Fz' }))
    await act(async () => {})
    expect(writeText).toHaveBeenCalledWith(LONG)
  })

  it('«Show» reads the whole key in its row only, and «Hide» hides it again', async () => {
    const user = userEvent.setup()
    renderWith(<ApiKeysList />)
    await user.click(screen.getByRole('button', { name: 'Show API key ending in …K3Fz' }))
    const row = screen.getAllByRole('row')[1]
    expect(within(row).getByText(LONG)).toBeInTheDocument()
    expect(document.body.innerHTML).not.toContain(OTHER)
    await user.click(within(row).getByRole('button', { name: 'Hide API key ending in …K3Fz' }))
    expect(document.body.innerHTML).not.toContain(LONG)
  })
})
