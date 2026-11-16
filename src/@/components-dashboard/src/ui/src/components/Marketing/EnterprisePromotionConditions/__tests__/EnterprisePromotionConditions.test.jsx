import React, { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback]
}))

vi.mock('../../../Shared', () => ({
  Modal: ({ open, children }) => open ? <div data-testid='modal'>{children}</div> : null
}))

vi.mock('../../EnterprisePromotionEditCondition', () => ({ EnterprisePromotionEditCondition: ({ condition, title }) => <div data-testid='single-editor'>{condition}|{title}</div> }))
vi.mock('../../EnterprisePromotionOrderTypes', () => ({ EnterprisePromotionOrderTypes: () => null }))
vi.mock('../../EnterprisePromotionPaymethods', () => ({ EnterprisePromotionPaymethods: () => null }))
vi.mock('../../EnterprisePromotionSchedule', () => ({ EnterprisePromotionSchedule: () => null }))
vi.mock('../../EnterprisePromotionSpecficProducts', () => ({ EnterprisePromotionSpecficProducts: () => <div data-testid='products-editor' /> }))
vi.mock('../../EnterprisePromotionSpecficCategory', () => ({ EnterprisePromotionSpecficCategory: () => null }))
vi.mock('../../EnterprisePromotionDeliveryzones', () => ({ EnterprisePromotionDeliveryzones: () => null }))
vi.mock('../../EnterprisePromotionMaxOrders', () => ({ EnterprisePromotionMaxOrders: () => null }))

import { EnterprisePromotionConditions } from '../index'

// products and limit are set (active boxes), everything else is unset.
const renderConditions = () => {
  const handleChangeItem = vi.fn()
  renderWithProviders(
    <EnterprisePromotionConditions
      isAddMode={false}
      promotionState={{ promotion: { products: [{ id: 1 }], limit: 5, condition_type: 1 } }}
      formState={{ changes: {} }}
      actionState={{ loading: false }}
      selectedBusinessIds={[]}
      handleRemoveKey={vi.fn()}
      handleUpdateClick={vi.fn()}
      handleAddPromotion={vi.fn()}
      handleChangeItem={handleChangeItem}
    />
  )
  return { handleChangeItem }
}

describe('EnterprisePromotionConditions row controls', () => {
  it('rows are not buttons; only the active box and the pencils are controls', () => {
    renderConditions()
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.map(c => c.getAttribute('aria-label'))).toEqual(['Product specific', 'Max. amount of times that can be used '])
    checkboxes.forEach(c => {
      expect(c.tagName).toBe('BUTTON')
      expect(c).toHaveAttribute('type', 'button')
      expect(c).toHaveAttribute('aria-checked', 'true')
      expect(c.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
      // no control nested in a control
      expect(c.closest('button, [role="button"]')).toBe(c)
    })

    const edits = screen.getAllByRole('button', { name: /^Edit: / })
    expect(edits).toHaveLength(13)
    edits.forEach(e => {
      expect(e).toHaveAttribute('type', 'button')
      expect(e.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
      expect(e.parentElement.tagName).toBe('DIV')
      expect(e.parentElement.closest('button')).toBeNull()
    })
    expect(screen.getByRole('button', { name: 'Edit: Product specific' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit: Schedule limit' })).toBeInTheDocument()

    // The unchecked boxes are decorative.
    const hidden = document.querySelectorAll('.condition-checkbox[aria-hidden="true"]')
    expect(hidden).toHaveLength(11)
    hidden.forEach(h => expect(h.tagName).toBe('DIV'))

    // Include options stays a whole-row toggle.
    const include = screen.getByRole('button', { name: /Include options/ })
    expect(include).toHaveAttribute('type', 'button')
    expect(within(include).queryByRole('checkbox')).toBeNull()
  })

  it('Tab reaches the first active box and then its pencil', async () => {
    const user = userEvent.setup()
    renderConditions()
    await user.tab()
    expect(screen.getByRole('checkbox', { name: 'Product specific' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Edit: Product specific' })).toHaveFocus()
  })

  it('Space on the active box removes the condition and does not open the edit', async () => {
    const user = userEvent.setup()
    const { handleChangeItem } = renderConditions()
    const box = screen.getByRole('checkbox', { name: 'Product specific' })
    box.focus()
    await user.keyboard(' ')
    expect(handleChangeItem).toHaveBeenCalledTimes(1)
    expect(handleChangeItem).toHaveBeenCalledWith({ products: null })
    expect(screen.queryByTestId('modal')).toBeNull()
  })

  it('click on the active box removes the condition without opening the edit', () => {
    const { handleChangeItem } = renderConditions()
    fireEvent.click(screen.getByRole('checkbox', { name: /^Max\. amount of times that can be used$/ }))
    expect(handleChangeItem).toHaveBeenCalledWith({ limit: null })
    expect(screen.queryByTestId('modal')).toBeNull()
  })

  it('Enter on the pencil opens the edit once', async () => {
    const user = userEvent.setup()
    const { handleChangeItem } = renderConditions()
    const pencil = screen.getByRole('button', { name: 'Edit: Product specific' })
    pencil.focus()
    await user.keyboard('{Enter}')
    expect(screen.getAllByTestId('modal')).toHaveLength(1)
    expect(screen.getByTestId('products-editor')).toBeInTheDocument()
    expect(handleChangeItem).not.toHaveBeenCalled()
  })

  it('Enter on a single-value pencil opens the single editor with its title', async () => {
    const user = userEvent.setup()
    renderConditions()
    const pencil = screen.getByRole('button', { name: /^Edit: Max\. amount of times that can be used per user/ })
    pencil.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('single-editor')).toHaveTextContent('limit_per_user|Max. amount of times that can be used per user')
  })

  it('a click on the row still opens the edit', () => {
    renderConditions()
    fireEvent.click(screen.getByText('Schedule limit'))
    expect(screen.queryByTestId('modal')).not.toBeNull()
  })

  it('a click on the unchecked box does not open the edit', () => {
    renderConditions()
    fireEvent.click(document.querySelectorAll('.condition-checkbox[aria-hidden="true"]')[0])
    expect(screen.queryByTestId('modal')).toBeNull()
  })
})

// Same screen, but handleChangeItem really clears the condition, so the box unmounts like in the product.
const StatefulConditions = () => {
  const [promotion, setPromotion] = useState({ products: [{ id: 1 }], limit: 5, condition_type: 1 })
  return (
    <EnterprisePromotionConditions
      isAddMode={false}
      promotionState={{ promotion }}
      formState={{ changes: {} }}
      actionState={{ loading: false }}
      selectedBusinessIds={[]}
      handleRemoveKey={vi.fn()}
      handleUpdateClick={vi.fn()}
      handleAddPromotion={vi.fn()}
      handleChangeItem={changes => setPromotion(prev => ({ ...prev, ...changes }))}
    />
  )
}

describe('EnterprisePromotionConditions focus after removing a condition', () => {
  it('Space on the box moves focus to the pencil of that same row once the box is gone', async () => {
    const user = userEvent.setup()
    renderWithProviders(<StatefulConditions />)
    const box = screen.getByRole('checkbox', { name: 'Product specific' })
    box.focus()
    await user.keyboard(' ')

    expect(screen.queryByRole('checkbox', { name: 'Product specific' })).toBeNull()
    expect(box).not.toBeInTheDocument()
    const pencil = screen.getByRole('button', { name: 'Edit: Product specific' })
    expect(document.activeElement).toBe(pencil)
    expect(document.activeElement).not.toBe(document.body)
    // It is that row's pencil, not another one, and the edit did not open.
    expect(screen.queryByTestId('modal')).toBeNull()
  })

  it('a click on a later row\'s box lands on that row\'s pencil', () => {
    renderWithProviders(<StatefulConditions />)
    fireEvent.click(screen.getByRole('checkbox', { name: /^Max\. amount of times that can be used$/ }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Edit: Max\. amount of times that can be used$/ }))
  })
})
