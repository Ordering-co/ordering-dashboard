import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

import SCHEMA from './themeNodesFixture.json'

const state = vi.hoisted(() => ({ site: {}, showToast: vi.fn() }))

vi.mock('../../../../../index', () => ({
  BuilderSiteSettings: ({ UIComponent, ...props }) => <UIComponent {...props} {...state.site} />,
  ToastType: { Success: 'SUCCESS', Error: 'ERROR' },
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useToast: () => [{}, { showToast: state.showToast }]
}))
vi.mock('../../../styles', async () => {
  const ReactActual = await vi.importActual('react')
  return { Button: ReactActual.forwardRef(({ color, borderRadius, outline, ...props }, ref) => <button ref={ref} {...props} />) }
})

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
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    expect(state.site.save).toHaveBeenCalled()
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Website settings saved')
  })

  it('offers to try again when the schema doesn’t load', () => {
    renderSettings({ schemaState: { loading: false, error: true, schema: null } })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(state.site.reloadSchema).toHaveBeenCalled()
  })

  it('says when the website’s schema isn’t in the new format yet', () => {
    renderSettings({ schemaState: { loading: false, error: false, schema: { site: {} } } })
    expect(screen.getByText('The editor for this website isn’t ready yet')).toBeTruthy()
  })
})
