import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback]
}))

vi.mock('../../../Shared', () => ({
  Alert: () => null,
  SideBar: () => null,
  Modal: () => null,
  RecipientSelect: () => null
}))

vi.mock('../../../../styles/Select/FirstSelect', () => ({ Select: () => <div /> }))
vi.mock('../../EnterprisePromotionConditions', () => ({ EnterprisePromotionConditions: () => null }))

import { EnterprisePromotionRules } from '../index'

const renderRules = ({ type = 2, changes = {}, promotion = {} } = {}) => {
  const handleChangeItem = vi.fn()
  renderWithProviders(
    <EnterprisePromotionRules
      isAddMode
      promotionState={{ promotion: { type, condition_type: 1, ...promotion } }}
      formState={{ changes, loading: false }}
      actionState={{ loading: false }}
      handleChangeInput={vi.fn()}
      handleChangeItem={handleChangeItem}
      handleAddPromotion={vi.fn()}
      handleUpdateClick={vi.fn()}
      setMoveDistance={vi.fn()}
      setSideBarWidth={vi.fn()}
    />
  )
  return { handleChangeItem }
}

describe('EnterprisePromotionRules how-it-is-applied pair', () => {
  it('is a radiogroup named by its section title with exact checked state', () => {
    renderRules({ type: 2 })
    const group = screen.getByRole('radiogroup', { name: "How it's going to be applied?" })
    const radios = within(group).getAllByRole('radio')
    expect(radios.map(r => r.tagName)).toEqual(['BUTTON', 'BUTTON'])
    expect(radios.map(r => r.getAttribute('type'))).toEqual(['button', 'button'])
    expect(screen.getByRole('radio', { name: 'Coupon' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'discount' })).toHaveAttribute('aria-checked', 'false')
    radios.forEach(radio => expect(radio.querySelector('svg')).toHaveAttribute('aria-hidden', 'true'))
  })

  it('flips the checked pair when the form change selects discount', () => {
    renderRules({ type: 1 })
    expect(screen.getByRole('radio', { name: 'Coupon' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: 'discount' })).toHaveAttribute('aria-checked', 'true')
  })

  it('Space on each radio calls handleChangeItem with the exact object', async () => {
    const user = userEvent.setup()
    const { handleChangeItem } = renderRules({ type: 2 })

    const discount = screen.getByRole('radio', { name: 'discount' })
    discount.focus()
    expect(discount).toHaveFocus()
    await user.keyboard(' ')
    expect(handleChangeItem).toHaveBeenLastCalledWith({ type: 1 })

    const coupon = screen.getByRole('radio', { name: 'Coupon' })
    coupon.focus()
    await user.keyboard(' ')
    expect(handleChangeItem).toHaveBeenLastCalledWith({ type: 2 })
  })

  it('click still calls handleChangeItem with the same objects', () => {
    const { handleChangeItem } = renderRules({ type: 2 })
    fireEvent.click(screen.getByRole('radio', { name: 'discount' }))
    expect(handleChangeItem).toHaveBeenLastCalledWith({ type: 1 })
  })
})

describe('EnterprisePromotionRules radio keyboard contract', () => {
  it('only the checked radio is a Tab stop', async () => {
    const user = userEvent.setup()
    renderRules({ type: 1 })
    expect(screen.getByRole('radio', { name: 'discount' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', { name: 'Coupon' })).toHaveAttribute('tabindex', '-1')

    const stops = []
    for (let i = 0; i < 40; i++) {
      await user.tab()
      const el = document.activeElement
      if (!el || el === document.body || stops.includes(el)) break
      stops.push(el)
    }
    expect(stops.filter(el => el.getAttribute('role') === 'radio').map(el => el.textContent)).toEqual(['discount'])
  })

  it('the first radio is the Tab stop when none is checked', () => {
    renderRules({ type: undefined })
    expect(screen.getByRole('radio', { name: 'Coupon' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', { name: 'discount' })).toHaveAttribute('tabindex', '-1')
  })

  it('ArrowRight / ArrowDown select the next radio and move focus', async () => {
    const user = userEvent.setup()
    const { handleChangeItem } = renderRules({ type: 2 })
    const coupon = screen.getByRole('radio', { name: 'Coupon' })
    const discount = screen.getByRole('radio', { name: 'discount' })

    coupon.focus()
    await user.keyboard('{ArrowRight}')
    expect(handleChangeItem).toHaveBeenLastCalledWith({ type: 1 })
    expect(discount).toHaveFocus()

    // Wraps around back to Coupon.
    await user.keyboard('{ArrowDown}')
    expect(handleChangeItem).toHaveBeenLastCalledWith({ type: 2 })
    expect(coupon).toHaveFocus()
  })

  it('ArrowLeft / ArrowUp, Home and End reach the other radio', async () => {
    const user = userEvent.setup()
    const { handleChangeItem } = renderRules({ type: 2 })
    const coupon = screen.getByRole('radio', { name: 'Coupon' })
    const discount = screen.getByRole('radio', { name: 'discount' })

    coupon.focus()
    await user.keyboard('{ArrowUp}')
    expect(handleChangeItem).toHaveBeenLastCalledWith({ type: 1 })
    expect(discount).toHaveFocus()

    await user.keyboard('{ArrowLeft}')
    expect(handleChangeItem).toHaveBeenLastCalledWith({ type: 2 })
    expect(coupon).toHaveFocus()

    await user.keyboard('{End}')
    expect(handleChangeItem).toHaveBeenLastCalledWith({ type: 1 })
    expect(discount).toHaveFocus()

    handleChangeItem.mockClear()
    await user.keyboard('{Home}')
    expect(handleChangeItem).toHaveBeenLastCalledWith({ type: 2 })
    expect(coupon).toHaveFocus()
  })
})

const FOCUSABLE = 'button, input, select, textarea, a[href], [tabindex]'

describe('EnterprisePromotionRules radiogroup scope', () => {
  it('the radiogroup wraps only the title and the two radios, not the whole form', () => {
    renderRules({ type: 1 })
    const group = screen.getByRole('radiogroup', { name: "How it's going to be applied?" })
    // Discount selected: the only controls inside the group are the two radios.
    const controls = Array.from(group.querySelectorAll(FOCUSABLE))
    expect(controls.map(el => el.getAttribute('role'))).toEqual(['radio', 'radio'])
    // The form's own fields and checkboxes live outside it.
    expect(within(group).queryAllByRole('checkbox')).toHaveLength(0)
    expect(within(group).queryByRole('button', { name: 'Add' })).toBeNull()
    expect(within(group).queryByRole('textbox', { name: 'Value' })).toBeNull()
    expect(group.contains(document.getElementById('discount_value'))).toBe(false)
  })

  it('with Coupon selected the only non-radio control inside the group is the coupon code field', () => {
    renderRules({ type: 2 })
    const group = screen.getByRole('radiogroup', { name: "How it's going to be applied?" })
    const controls = Array.from(group.querySelectorAll(FOCUSABLE))
    expect(controls.map(el => el.getAttribute('role') || el.tagName)).toEqual(['radio', 'INPUT', 'radio'])
    expect(controls[1]).toHaveAttribute('name', 'coupon')
    expect(within(group).getAllByRole('radio')).toHaveLength(2)
    expect(group.contains(document.getElementById('discount_value'))).toBe(false)
  })

  it('the wrapper adds no box of its own (display: contents)', () => {
    renderRules({ type: 1 })
    const group = screen.getByRole('radiogroup', { name: "How it's going to be applied?" })
    expect(group.style.display).toBe('contents')
    expect(group.parentElement.getAttribute('role')).toBeNull()
  })
})

// redesign (row 81, PE-19 D10): opening Rules wrote rate_type 2 / target 1 whenever the condition is not Subtotal,
// even when the record already had them, so merely opening the section made the form dirty.
describe('EnterprisePromotionRules does not dirty the form on open (PE-19 D10)', () => {
  it('writes nothing when the record already is a fixed-price, order-level promotion', () => {
    const { handleChangeItem } = renderRules({ promotion: { condition_type: 2, rate_type: 2, target: 1 } })
    expect(handleChangeItem).not.toHaveBeenCalled()
  })

  it('writes nothing when the pending changes already hold those values', () => {
    const { handleChangeItem } = renderRules({ promotion: { condition_type: 2, rate_type: 1, target: 2 }, changes: { rate_type: 2, target: 1 } })
    expect(handleChangeItem).not.toHaveBeenCalled()
  })

  it('still forces them when the stored values differ', () => {
    const { handleChangeItem } = renderRules({ promotion: { condition_type: 2, rate_type: 1, target: 1 } })
    expect(handleChangeItem).toHaveBeenCalledTimes(1)
    expect(handleChangeItem).toHaveBeenCalledWith({ rate_type: 2 })
  })

  it('forces both when neither matches', () => {
    const { handleChangeItem } = renderRules({ promotion: { condition_type: 3, rate_type: 1, target: 2 } })
    expect(handleChangeItem).toHaveBeenCalledWith({ rate_type: 2, target: 1 })
  })
})
