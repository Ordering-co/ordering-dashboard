/* eslint-disable import/first */
import React from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign fix-qa E3: the sub option is marked by pressing anywhere on its row, as in main.
const mocks = vi.hoisted(() => ({ toggleSelect: vi.fn(), increment: vi.fn(), changePosition: vi.fn(), state: { selected: false, quantity: 0, position: 'whole' } }))

vi.mock('../../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{ parsePrice: value => `$${Number(value).toFixed(2)}` }],
  ProductOptionSuboption: ({ UIComponent, ...props }) => (
    <UIComponent
      state={mocks.state}
      balance={0}
      toggleSelect={mocks.toggleSelect}
      increment={mocks.increment}
      decrement={vi.fn()}
      changePosition={mocks.changePosition}
      {...props}
    />
  )
}))

import { ProductOptionSubOption } from '..'

const option = { id: 1, min: 0, max: 3, allow_suboption_quantity: true, with_half_option: false, suboptions: [{ id: 1 }, { id: 2 }] }
const suboption = { id: 1, name: 'Extra cheese', price: 1.5 }

beforeEach(() => {
  mocks.toggleSelect.mockClear()
  mocks.increment.mockClear()
  mocks.state = { selected: false, quantity: 0, position: 'whole' }
})

describe('ProductOptionSubOption · row press', () => {
  it('marks the sub option from its name, as before', async () => {
    renderWithProviders(<ProductOptionSubOption option={option} suboption={suboption} />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Extra cheese/ }))
    expect(mocks.toggleSelect).toHaveBeenCalledTimes(1)
  })

  it('marks it too when the press lands on the price or the empty part of the row', async () => {
    const user = userEvent.setup()
    const { container } = renderWithProviders(<ProductOptionSubOption option={option} suboption={suboption} />)
    await user.click(screen.getByText('+ $1.50'))
    expect(mocks.toggleSelect).toHaveBeenCalledTimes(1)
    await user.click(container.firstChild)
    expect(mocks.toggleSelect).toHaveBeenCalledTimes(2)
  })

  it('does not mark it twice from the name', async () => {
    renderWithProviders(<ProductOptionSubOption option={option} suboption={suboption} />)
    await userEvent.setup().click(screen.getByText('Extra cheese'))
    expect(mocks.toggleSelect).toHaveBeenCalledTimes(1)
  })

  it('the quantity buttons keep their own action and do not toggle the row', async () => {
    mocks.state = { selected: true, quantity: 1, position: 'whole' }
    renderWithProviders(<ProductOptionSubOption option={option} suboption={suboption} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Increase quantity' }))
    expect(mocks.increment).toHaveBeenCalledTimes(1)
    expect(mocks.toggleSelect).not.toHaveBeenCalled()
  })
})
