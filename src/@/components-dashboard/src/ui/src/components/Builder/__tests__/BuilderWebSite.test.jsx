import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

import SCHEMA from './themeNodesFixture.json'

const state = vi.hoisted(() => ({ site: {}, showToast: vi.fn() }))

vi.mock('../../../../../index', () => ({
  BuilderSiteSettings: ({ UIComponent, ...props }) => <UIComponent {...props} {...state.site} />,
  ToastType: { Success: 'SUCCESS', Error: 'ERROR' },
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useToast: () => [{}, { showToast: state.showToast }]
}))

import { BuilderWebSiteSettings } from '../BuilderWebSite'

const product = { id: 45, name: 'Burger Town website', product_type: 'marketplace_website' }

const renderSettings = (extra = {}) => {
  state.site = {
    schemaState: { loading: false, error: false, schema: SCHEMA, format: null },
    reloadSchema: vi.fn(),
    current: { site: { name: 'Burger Town' } },
    edits: {},
    fieldErrors: {},
    errorCodes: [],
    scope: { businessId: null, franchiseId: null },
    scopeOptions: {},
    hasEdits: false,
    saving: false,
    setValue: vi.fn(),
    setScope: vi.fn(),
    loadScopeOptions: vi.fn(),
    save: vi.fn(async () => ({ ok: true, errorCodes: [] })),
    discard: vi.fn(),
    ...extra
  }
  renderWithProviders(<BuilderWebSiteSettings product={product} />)
}

describe('Settings of a website', () => {
  beforeEach(() => { state.showToast.mockReset() })

  it('edits the website’s settings from its schema, and saves them with a toast', async () => {
    renderSettings({ hasEdits: true })
    expect(screen.getByRole('textbox', { name: 'Website name' })).toHaveValue('Burger Town')
    fireEvent.change(screen.getByRole('textbox', { name: 'Website name' }), { target: { value: 'Burger Town Online' } })
    expect(state.site.setValue).toHaveBeenCalledWith(['site', 'name'], 'Burger Town Online')
    // redesign B3a: Discard and Save are Product buttons in the notice
    expect(screen.getByRole('button', { name: 'Discard' })).toHaveClass('odc-btn')
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('odc-btn')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    expect(state.site.save).toHaveBeenCalled()
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Website settings saved')
  })

  it('offers to try again when the schema doesn’t load', () => {
    renderSettings({ schemaState: { loading: false, error: true, schema: null } })
    // redesign B3a: a Product error state, announced, with its retry
    const alert = screen.getByRole('alert')
    expect(alert).toHaveClass('odc-state')
    expect(within(alert).getByRole('heading', { level: 2, name: 'We couldn’t load the website settings' })).toBeInTheDocument()
    expect(within(alert).getByText('Check your connection and try again.')).toBeInTheDocument()
    expect(within(alert).getByRole('button', { name: 'Try again' })).toHaveClass('odc-btn')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(state.site.reloadSchema).toHaveBeenCalled()
  })

  it('says the settings wait for an active theme, and goes to the themes', () => {
    const onGoToTheme = vi.fn()
    renderSettings({ hasActiveTheme: false, onGoToTheme })
    expect(screen.getByText('Your website doesn’t use these settings yet')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Go to Theme' }))
    expect(onGoToTheme).toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Website name' })).toHaveValue('Burger Town')
  })

  it.each([true, null])('says nothing about the theme when it has an active one, or before it knows (%s)', (hasActiveTheme) => {
    renderSettings({ hasActiveTheme })
    expect(screen.queryByText('Your website doesn’t use these settings yet')).toBeNull()
  })

  it('says when the website’s schema isn’t in the new format yet', () => {
    renderSettings({ schemaState: { loading: false, error: false, schema: { site: {} } } })
    expect(screen.getByText('The editor for this website isn’t ready yet')).toBeTruthy()
    // redesign B3a: a Product empty state, not an alert
    expect(screen.getByRole('heading', { level: 2, name: 'The editor for this website isn’t ready yet' }).closest('.odc-state')).not.toBeNull()
    expect(screen.getByText('Its theme schema hasn’t moved to the new format. Try again later.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  // redesign B3a: Product skeletons while the schema loads the first time
  it('shows the shape of the settings while their schema loads', () => {
    renderSettings({ schemaState: { loading: true, error: false, schema: null } })
    const busy = document.querySelector('[aria-busy="true"]')
    expect(busy).not.toBeNull()
    expect(busy.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(within(busy).getByText('Loading')).toBeInTheDocument()
  })

  it('warns before leaving the page only while there are edits', () => {
    const add = vi.spyOn(window, 'addEventListener')
    renderSettings({ hasEdits: false })
    expect(add.mock.calls.some(([type]) => type === 'beforeunload')).toBe(false)
    cleanup()
    renderSettings({ hasEdits: true })
    const warn = add.mock.calls.find(([type]) => type === 'beforeunload')?.[1]
    const event = { preventDefault: vi.fn(), returnValue: 'x' }
    warn(event)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(event.returnValue).toBe('')
    add.mockRestore()
  })
})
