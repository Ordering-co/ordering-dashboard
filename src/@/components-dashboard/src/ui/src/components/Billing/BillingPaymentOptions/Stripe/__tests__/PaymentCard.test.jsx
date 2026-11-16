// redesign (row 82): the saved card's ⋮ menu in the legacy Stripe list. The ⋮ was an svg with an onClick inside a span
// and «Delete» a div, so the menu could not be reached or used with the keyboard. It is a real button now, with a role='menu'.
import React from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('~components', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

vi.mock('../../../../../utils', () => ({
  getIconCard: () => <i data-testid='brand-icon' />
}))

import { PaymentCard } from '../PaymentCard'

const card = { id: 2, default: false, data: { brand: 'visa', last4: '4242' } }
const selected = { id: 1 }

const renderCard = (overrides = {}) => {
  const props = {
    card,
    cardsLength: 2,
    isLoading: false,
    cardSelected: selected,
    handleDeleteCard: vi.fn(),
    handleCardClick: vi.fn(),
    ...overrides
  }
  renderWithProviders(<PaymentCard {...props} />)
  return props
}

describe('PaymentCard actions menu', () => {
  it('has a ⋮ that is a button reachable by Tab, named after the card', async () => {
    const user = userEvent.setup()
    renderCard()
    const trigger = screen.getByRole('button', { name: 'Card actions: visa 4242' })
    expect(trigger.tagName).toBe('BUTTON')
    expect(trigger).toHaveAttribute('type', 'button')
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await user.tab()
    expect(trigger).toHaveFocus()
  })

  it('opens the menu with Enter and Delete is a button that calls the delete handler', async () => {
    const user = userEvent.setup()
    const props = renderCard()
    await user.tab()
    await user.keyboard('{Enter}')

    const trigger = screen.getByRole('button', { name: 'Card actions: visa 4242' })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu')).toBeInTheDocument()
    const del = screen.getByRole('menuitem', { name: 'Delete' })
    expect(del.tagName).toBe('BUTTON')
    expect(del).toHaveAttribute('type', 'button')
    expect(del).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(props.handleDeleteCard).toHaveBeenCalledTimes(1)
    expect(props.handleCardClick).not.toHaveBeenCalled()
  })

  it('closes with Escape and returns the focus to the trigger', async () => {
    const user = userEvent.setup()
    renderCard()
    await user.tab()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: 'Card actions: visa 4242' })
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens with a click too, and does not select the card when the ⋮ is pressed', async () => {
    const user = userEvent.setup()
    const props = renderCard()
    await user.click(screen.getByRole('button', { name: 'Card actions: visa 4242' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(props.handleCardClick).not.toHaveBeenCalled()
  })

  it('has no menu for the default card', () => {
    renderCard({ card: { ...card, default: true } })
    expect(screen.queryByRole('button', { name: /Card actions/ })).not.toBeInTheDocument()
  })
})
