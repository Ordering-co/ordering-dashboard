import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { AssistantDestinations } from '../AssistantDestinations'

const api = vi.hoisted(() => ({ open: vi.fn(), chooseBusiness: vi.fn(), scope: 'demo:7' }))
const palette = vi.hoisted(() => ({ open: vi.fn(), isAvailable: true }))
const language = vi.hoisted(() => ({ code: 'en', dictionary: {} }))
vi.mock('../../../../../index', () => ({ useLanguage: () => [{ language }, (key, fallback) => language.dictionary[key] || fallback] }))
vi.mock('../../../contexts/DashboardDestinationsContext', () => ({ useDashboardDestinations: () => api }))
vi.mock('../../../contexts/CommandPaletteContext', () => ({ useCommandPalette: () => palette }))

const result = {
  version: 2,
  mode: 'open',
  scope: 'demo:7',
  revision: 'before',
  query: 'notifications',
  status: 'ok',
  items: [{ id: 'settings-group:notifications', title: 'Notifications' }],
  errors: []
}

describe('Mia guided navigation', () => {
  beforeEach(() => {
    language.code = 'en'
    language.dictionary = {}
    api.scope = 'demo:7'
    api.open.mockReset().mockResolvedValue({ status: 'opened' })
    api.chooseBusiness.mockReset().mockResolvedValue({ status: 'needs_business' })
    palette.open.mockReset()
  })

  it('offers one next step and revalidates only on click', async () => {
    renderWithProviders(<AssistantDestinations result={result} />)
    expect(api.open).not.toHaveBeenCalled()
    expect(screen.getAllByRole('button')).toHaveLength(2)
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveClass('mia:focus-visible:outline-solid', 'mia:focus-visible:outline-2', 'mia:focus-visible:outline-ring')
    }
    fireEvent.click(screen.getByRole('button', { name: 'Go to Notifications' }))
    await waitFor(() => expect(api.open).toHaveBeenCalledWith(result.items[0], {
      scope: 'demo:7', revision: 'before', signal: expect.any(AbortSignal)
    }))
  })

  it('delegates the store picker to the shared revalidated palette opener', async () => {
    const item = { id: 'action:business-schedule', title: 'Schedule', requires_business: true }
    renderWithProviders(<AssistantDestinations result={{ ...result, mode: 'choose_business', items: [item] }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Choose store for Schedule' }))
    await waitFor(() => expect(api.chooseBusiness).toHaveBeenCalledWith(item, {
      scope: result.scope, revision: result.revision, signal: expect.any(AbortSignal)
    }))
    expect(api.open).not.toHaveBeenCalled()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })

  it('makes exploration voluntary and seeds the real palette', () => {
    renderWithProviders(<AssistantDestinations result={result} />)
    fireEvent.click(screen.getByRole('button', { name: 'Search the Dashboard' }))
    expect(palette.open).toHaveBeenCalledWith({ query: 'notifications', fromAssistant: true })
    expect(api.open).not.toHaveBeenCalled()
  })

  it('distinguishes homonyms by ID without automatically opening one', async () => {
    const items = [{ id: 'business:1', title: "McDonald's", subtitle: '#1' }, { id: 'business:199', title: "McDonald's", subtitle: '#199' }]
    renderWithProviders(<AssistantDestinations result={{ ...result, mode: 'clarify', items }} />)
    expect(screen.getByRole('button', { name: "McDonald's · #1" })).toBeEnabled()
    expect(screen.getByRole('button', { name: "McDonald's · #199" })).toBeEnabled()
    expect(api.open).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: "McDonald's · #199" }))
    await waitFor(() => expect(api.open).toHaveBeenCalledWith(items[1], expect.any(Object)))
  })

  it('explains a revoked destination and offers a fresh palette search', async () => {
    api.open.mockResolvedValue({ status: 'unavailable' })
    renderWithProviders(<AssistantDestinations result={result} />)
    fireEvent.click(screen.getByRole('button', { name: 'Go to Notifications' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Search the Dashboard' }))
    expect(palette.open).toHaveBeenCalledOnce()
  })

  it('retains safe local results after partial failure and does not fabricate unavailable buttons', () => {
    const first = renderWithProviders(<AssistantDestinations result={{ ...result, status: 'partial' }} />)
    expect(screen.getByRole('button', { name: 'Go to Notifications' })).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent('Some results could not be loaded.')
    first.unmount()
    renderWithProviders(<AssistantDestinations result={{ ...result, status: 'unavailable', items: [] }} />)
    expect(screen.queryByRole('button', { name: 'Go to Notifications' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search the Dashboard' })).toBeEnabled()
  })

  it('hides foreign scopes and aborts an in-flight open on unmount', async () => {
    api.scope = 'another:9'
    const first = renderWithProviders(<AssistantDestinations result={result} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    first.unmount()
    api.scope = 'demo:7'
    api.open.mockImplementation(() => new Promise(() => {}))
    const second = renderWithProviders(<AssistantDestinations result={result} />)
    fireEvent.click(screen.getByRole('button', { name: 'Go to Notifications' }))
    await waitFor(() => expect(api.open).toHaveBeenCalledOnce())
    const signal = api.open.mock.calls[0][1].signal
    second.unmount()
    expect(signal.aborted).toBe(true)
  })

  it('bounds legacy menus to three choices and keeps exploration available', () => {
    renderWithProviders(<AssistantDestinations result={{ ...result, version: 1, items: Array.from({ length: 12 }, (_, index) => ({ id: String(index), title: 'Choice ' + index })) }} />)
    expect(screen.getAllByRole('button')).toHaveLength(4)
  })

  it('uses the locale catalog for Spanish labels when remote keys are not synced', async () => {
    language.code = 'es-MX'
    api.open.mockResolvedValue({ status: 'unavailable' })
    const first = renderWithProviders(<AssistantDestinations result={result} />)
    expect(screen.getByRole('region', { name: 'Navegación del Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buscar en el Dashboard' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Notifications' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Este destino ya no está disponible. Vuelve a buscar en el Dashboard.')
    first.unmount()
    renderWithProviders(<AssistantDestinations result={{ ...result, mode: 'choose_business', items: [{ id: 'integration:clover', title: 'Clover', requires_business: true }] }} />)
    expect(screen.getByRole('button', { name: 'Elegir tienda para Clover' })).toBeEnabled()
  })

  it('preserves remote translations and falls back safely for unsupported locales', () => {
    language.code = 'es'
    language.dictionary = { ASSISTANT_NAV_GO_TO: 'Abrir {{title}}' }
    const first = renderWithProviders(<AssistantDestinations result={result} />)
    expect(screen.getByRole('button', { name: 'Abrir Notifications' })).toBeEnabled()
    first.unmount()
    language.code = 'unknown'
    language.dictionary = {}
    renderWithProviders(<AssistantDestinations result={result} />)
    expect(screen.getByRole('button', { name: 'Go to Notifications' })).toBeEnabled()
  })
})
