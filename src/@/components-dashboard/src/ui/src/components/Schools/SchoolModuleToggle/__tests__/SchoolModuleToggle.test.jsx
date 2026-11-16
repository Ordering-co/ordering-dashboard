/* eslint-disable import/first */
// redesign SC-B5 (decision 4): the switch of the School module on Product pieces. The controller (K/SchoolModuleToggle, untouched) is
// played by a stand-in that hands the UI the props it computes; Button and ConfirmDialog are the real Product pieces.
import React from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({ catalog: {}, controller: {} }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (key, text) => mockState.catalog[key] ?? text]
}))
vi.mock('../../../../../../components/Schools/SchoolModuleToggle', () => ({
  SchoolModuleToggle: ({ UIComponent, ...props }) => <UIComponent {...props} {...mockState.controller} />
}))

import { SchoolModuleToggle } from '../index'

const controller = (overrides = {}) => {
  mockState.controller = {
    isEnabled: true,
    canToggle: true,
    saving: false,
    handleEnable: vi.fn(),
    handleDisable: vi.fn().mockResolvedValue(true),
    ...overrides
  }
  return mockState.controller
}

beforeEach(() => { mockState.catalog = {} })
afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

describe('module on', () => {
  it('shows «Disable school module» as a secondary button, not a bare text button', () => {
    controller()
    render(<SchoolModuleToggle />)
    const button = screen.getByRole('button', { name: 'Disable school module' })
    expect(button).toHaveAttribute('data-variant', 'secondary')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('takes its words from SCHOOL_MODULE_DISABLE_ACTION, not from the shared SCHOOL_MODULE_DISABLE', () => {
    controller()
    mockState.catalog = { SCHOOL_MODULE_DISABLE: 'Desactivar', SCHOOL_MODULE_DISABLE_ACTION: 'Desactivar el módulo' }
    render(<SchoolModuleToggle />)
    expect(screen.getByRole('button', { name: 'Desactivar el módulo' })).toBeInTheDocument()
  })

  it('asks first: the confirmation has the title and the text of today, «Disable module» and Cancel', async () => {
    const user = userEvent.setup()
    const { handleDisable } = controller()
    render(<SchoolModuleToggle />)
    await user.click(screen.getByRole('button', { name: 'Disable school module' }))

    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Disable the School module?')).toBeInTheDocument()
    expect(within(dialog).getByText(/Businesses with the School vertical keep their data/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Disable module' })).toHaveAttribute('data-variant', 'danger')
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(handleDisable).not.toHaveBeenCalled()
  })

  it('Cancel closes without calling handleDisable', async () => {
    const user = userEvent.setup()
    const { handleDisable } = controller()
    render(<SchoolModuleToggle />)
    await user.click(screen.getByRole('button', { name: 'Disable school module' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(handleDisable).not.toHaveBeenCalled()
  })

  it('«Disable module» calls handleDisable once, stays open and busy while it runs, and closes when it resolves', async () => {
    const user = userEvent.setup()
    let finish
    const { handleDisable } = controller({ handleDisable: vi.fn(() => new Promise((resolve) => { finish = resolve })) })
    const view = render(<SchoolModuleToggle />)
    await user.click(screen.getByRole('button', { name: 'Disable school module' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Disable module' }))

    expect(handleDisable).toHaveBeenCalledTimes(1)
    // the request is in flight: the dialog is still there
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()

    // the controller reports `saving` while it works: the confirm action is busy and nothing can be repeated
    controller({ handleDisable, saving: true })
    view.rerender(<SchoolModuleToggle />)
    const confirm = within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Disable module' })
    expect(confirm).toHaveAttribute('aria-busy', 'true')
    await user.click(confirm)
    expect(handleDisable).toHaveBeenCalledTimes(1)

    await act(async () => { finish(true) })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('while saving the opener is busy too', () => {
    controller({ saving: true })
    render(<SchoolModuleToggle />)
    expect(screen.getByRole('button', { name: 'Disable school module' })).toHaveAttribute('aria-busy', 'true')
  })
})

describe('module off', () => {
  it('shows «Enable school module» as the one primary action, with no confirmation', async () => {
    const user = userEvent.setup()
    const { handleEnable } = controller({ isEnabled: false })
    render(<SchoolModuleToggle />)
    const button = screen.getByRole('button', { name: 'Enable school module' })
    expect(button).toHaveAttribute('data-variant', 'primary')
    await user.click(button)
    expect(handleEnable).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('is busy while saving and does not repeat the request', async () => {
    const user = userEvent.setup()
    const { handleEnable } = controller({ isEnabled: false, saving: true })
    render(<SchoolModuleToggle />)
    const button = screen.getByRole('button', { name: 'Enable school module' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    await user.click(button)
    expect(handleEnable).not.toHaveBeenCalled()
  })
})

describe('without canToggle', () => {
  it.each([[true], [false]])('draws nothing (module enabled: %s)', (isEnabled) => {
    controller({ isEnabled, canToggle: false })
    const { container } = render(<SchoolModuleToggle />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
