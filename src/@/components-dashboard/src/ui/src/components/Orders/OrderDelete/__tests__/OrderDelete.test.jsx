/* eslint-disable import/first */
// redesign 5.2 polish: OrderDelete keeps its legacy trigger everywhere (order detail, /all-in-one)
// and takes `triggerVariant='selection'` for the selection bar of the orders list: a Product
// button with the icon first, opening the same confirmation with the same handler.
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ width: 1200 }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))
vi.mock('../../../../hooks/useWindowSize', () => ({
  useWindowSize: () => ({ width: mocks.width })
}))
vi.mock('../../../Shared', () => ({
  ConfirmAdmin: ({ open, onConfirm, onClose }) => open
    ? (
      <div role='alertdialog' aria-label='Confirm'>
        <button type='button' onClick={() => onConfirm()}>Confirm delete</button>
        <button type='button' onClick={onClose}>Cancel delete</button>
      </div>
      )
    : null
}))

import { OrderDelete } from '..'

beforeEach(() => { mocks.width = 1200 })

describe('OrderDelete (legacy trigger)', () => {
  it('keeps the legacy button with the text before the icon, named Delete', () => {
    render(<OrderDelete handleDeleteMultiOrders={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Delete' })
    expect(button).not.toHaveClass('odc-btn')
    expect(button.textContent).toBe('Delete')
    expect(button.lastElementChild.tagName.toLowerCase()).toBe('svg')
  })

  it('opens the confirmation and calls the handler only on confirm', async () => {
    const user = userEvent.setup()
    const handleDeleteMultiOrders = vi.fn()
    render(<OrderDelete handleDeleteMultiOrders={handleDeleteMultiOrders} />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(handleDeleteMultiOrders).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))
    expect(handleDeleteMultiOrders).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe("OrderDelete triggerVariant='selection'", () => {
  it('draws a Product button, small, danger tone, with the icon first and the text Delete…', () => {
    render(<OrderDelete triggerVariant='selection' handleDeleteMultiOrders={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Delete…' })
    expect(button).toHaveClass('odc-btn')
    expect(button).toHaveAttribute('data-size', 'sm')
    expect(button).toHaveAttribute('data-tone', 'danger')
    expect(button.firstElementChild.tagName.toLowerCase()).toBe('svg')
    expect(button.firstElementChild).toHaveClass('odc-icon')
    expect(button.textContent).toBe('Delete…')
  })

  it('opens the same confirmation and calls the same handler on confirm', async () => {
    const user = userEvent.setup()
    const handleDeleteMultiOrders = vi.fn()
    render(<OrderDelete triggerVariant='selection' handleDeleteMultiOrders={handleDeleteMultiOrders} />)
    await user.click(screen.getByRole('button', { name: 'Delete…' }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(handleDeleteMultiOrders).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))
    expect(handleDeleteMultiOrders).toHaveBeenCalledTimes(1)
  })

  it('does not call the handler when the confirmation is cancelled', async () => {
    const user = userEvent.setup()
    const handleDeleteMultiOrders = vi.fn()
    render(<OrderDelete triggerVariant='selection' handleDeleteMultiOrders={handleDeleteMultiOrders} />)
    await user.click(screen.getByRole('button', { name: 'Delete…' }))
    await user.click(screen.getByRole('button', { name: 'Cancel delete' }))
    expect(handleDeleteMultiOrders).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('keeps the text on a narrow screen, where the legacy trigger drops it', () => {
    mocks.width = 400
    render(<OrderDelete triggerVariant='selection' handleDeleteMultiOrders={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Delete…' }).textContent).toBe('Delete…')
  })
})
