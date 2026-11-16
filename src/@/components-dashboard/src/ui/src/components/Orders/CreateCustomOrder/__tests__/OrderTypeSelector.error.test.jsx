/* eslint-disable import/first */
import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign F6c (Q2-13): a failed change of the order type used to open the global legacy Alert (empty «Error»,
// a 968px blue «Accept», no Escape). The wizard now asks the context for a quiet failure and tells it in a Product
// dialog, with the text the API gave.
const mocks = vi.hoisted(() => ({ changeType: vi.fn() }))

vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  return {
    // P4-03: the translation of the app, by key; a key it does not know answers the fallback text.
    useLanguage: () => [null, (key, fallback) => ({ INTERNAL_ERROR: 'Internal error. Try again later.' }[key] ?? fallback)],
    useConfig: () => [{ configs: { order_types_allowed: { value: '1|2|3' } } }],
    useOrder: () => [{ options: { type: 1 } }, { changeType: mocks.changeType }],
    // The controller keeps the type of the order and gives the handler it was handed to the UI.
    OrderTypeControl: ({ UIComponent, ...props }) => {
      const [current] = React.useState(1)
      return <UIComponent {...props} typeSelected={current} />
    }
  }
})

import { OrderTypeSelector } from '../OrderTypeSelector'

// redesign F6d (Q3-12, P4-03): the refusal is no longer a dialog centred on the page (it crossed the edge of the
// wizard and repeated the inline banner of the step). Inside the wizard the host (`onFailure`) writes it in its one
// banner; on its own the selector writes it under the control. Either way the text is translated like the global Alert.
const pressedLabel = () => within(screen.getByRole('group', { name: 'Delivery type' }))
  .getAllByRole('button').find(button => button.getAttribute('aria-pressed') === 'true')?.textContent

describe('OrderTypeSelector · a type the order options refuse (Q2-13, Q3-12)', () => {
  beforeEach(() => mocks.changeType.mockReset())

  it('changes the type quietly, so the global Alert stays closed', async () => {
    mocks.changeType.mockResolvedValue({ ok: true })
    renderWithProviders(<OrderTypeSelector />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Pickup' }))
    expect(mocks.changeType).toHaveBeenCalledWith(2, { silent: true })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('writes the error the API gave under the control, never in a dialog, and the order keeps its type', async () => {
    mocks.changeType.mockResolvedValue({ ok: false, error: 'Pickup is not available for this address' })
    renderWithProviders(<OrderTypeSelector />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Pickup' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Pickup is not available for this address')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(pressedLabel()).toBe('Delivery')
  })

  it('says «Something went wrong. Try again.» when the failure carries no text', async () => {
    mocks.changeType.mockResolvedValue({ ok: false, error: '' })
    renderWithProviders(<OrderTypeSelector />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Pickup' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Try again.')
  })

  it('translates an error key the way the global Alert does (P4-03)', async () => {
    mocks.changeType.mockResolvedValue({ ok: false, error: 'INTERNAL_ERROR' })
    renderWithProviders(<OrderTypeSelector />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Pickup' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Internal error. Try again later.')
    expect(alert).not.toHaveTextContent('INTERNAL_ERROR')
  })

  it('leaves the focus on the control that was pressed', async () => {
    mocks.changeType.mockResolvedValue({ ok: false, error: 'No' })
    renderWithProviders(<OrderTypeSelector />)
    const pickup = screen.getByRole('button', { name: 'Pickup' })
    await userEvent.setup().click(pickup)
    await screen.findByRole('alert')
    expect(pickup).toHaveFocus()
  })

  it('hands the translated error to the host instead of drawing its own notice, and clears it when a change works', async () => {
    const onFailure = vi.fn()
    mocks.changeType.mockResolvedValueOnce({ ok: false, error: 'INTERNAL_ERROR' }).mockResolvedValueOnce({ ok: true })
    const user = userEvent.setup()
    renderWithProviders(<OrderTypeSelector onFailure={onFailure} />)
    await user.click(screen.getByRole('button', { name: 'Pickup' }))
    await waitFor(() => expect(onFailure).toHaveBeenCalledWith('Internal error. Try again later.', expect.any(Function))) // redesign F6e: plus the retry
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Pickup' }))
    await waitFor(() => expect(onFailure).toHaveBeenLastCalledWith(null))
  })

  it('shows the type that was pressed while the options are saving', async () => {
    let finish
    mocks.changeType.mockReturnValue(new Promise(resolve => { finish = resolve }))
    renderWithProviders(<OrderTypeSelector />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Pickup' }))
    expect(pressedLabel()).toBe('Pickup')
    finish({ ok: false, error: 'No' })
    await screen.findByRole('alert')
    expect(pressedLabel()).toBe('Delivery')
  })

  // redesign F6e (P5-01): the host gets the way to retry the type that was refused, and a refusal without text
  // does not say «Try again» (the host's notice already carries that action).
  it('gives the host a retry that asks for the same type again', async () => {
    const onFailure = vi.fn()
    mocks.changeType.mockResolvedValueOnce({ ok: false, error: 'No' }).mockResolvedValueOnce({ ok: true })
    renderWithProviders(<OrderTypeSelector onFailure={onFailure} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Pickup' }))
    await waitFor(() => expect(onFailure).toHaveBeenCalledWith('No', expect.any(Function)))
    await onFailure.mock.calls[0][1]()
    expect(mocks.changeType).toHaveBeenCalledTimes(2)
    expect(mocks.changeType).toHaveBeenLastCalledWith(2, { silent: true })
    expect(onFailure).toHaveBeenLastCalledWith(null)
  })

  it('tells a refusal without text in one sentence when a host has the action (no second «try again»)', async () => {
    const onFailure = vi.fn()
    mocks.changeType.mockResolvedValue({ ok: false, error: '' })
    renderWithProviders(<OrderTypeSelector onFailure={onFailure} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Pickup' }))
    await waitFor(() => expect(onFailure).toHaveBeenCalledWith('The delivery type could not be changed.', expect.any(Function)))
  })

  // redesign F6f (Q5-03): the wizard gives the focus to this control when a retry of the type works.
  it('marks its control, so the host can give it the focus', () => {
    renderWithProviders(<OrderTypeSelector />)
    const marked = document.querySelector('[data-order-type]')
    expect(marked).toContainElement(screen.getByRole('group', { name: 'Delivery type' }))
    expect(marked.querySelector('[aria-pressed="true"]')).toHaveTextContent('Delivery')
  })
})
