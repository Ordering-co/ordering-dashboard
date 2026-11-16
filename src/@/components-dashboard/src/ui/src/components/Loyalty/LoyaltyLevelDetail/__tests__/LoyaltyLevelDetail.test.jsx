/* eslint-disable import/first */
// the editor of one level in Product pieces. The controller is a stand-in that hands the UI spies and a given `formState`;
// the Product pieces are the real ones. Covered: Save is a primary P/Button (busy while saving, disabled without changes), the fields
// are P/TextField with their names, the expiration is a P/RadioGroup, the «⋯» is a P/Menu whose Delete asks in a P/ConfirmDialog, and
// every action calls the controller as main did (same handler, same arguments, same validations and alerts).
import React from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const ctl = vi.hoisted(() => ({ formState: null, spies: null, alert: null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: url => `optimized:${url}` }],
  LoyaltyLevelDetail: ({ UIComponent, ...props }) => <UIComponent {...props} formState={ctl.formState} {...ctl.spies} />
}))
vi.mock('../../../Shared', () => ({
  Alert: ({ open, content }) => {
    ctl.alert = open ? content : null
    return open ? <div role='alertdialog'>{Array.isArray(content) ? content.join(' ') : content}</div> : null
  }
}))

import { LoyaltyLevelDetail } from '../index'

const LEVEL = { id: 3, name: 'Gold', accumulation_rate: 2, minimum_points: 10, maximum_accumulation_fixed: 500, expire_after_minutes: 2 * 24 * 60, image: 'gold.png' }

const renderDetail = (level = LEVEL, formState = { loading: false, error: null, changes: {} }) => {
  ctl.formState = formState
  return renderWithProviders(<LoyaltyLevelDetail level={level} />)
}

beforeEach(() => {
  ctl.alert = null
  ctl.spies = {
    handleDeleteLevel: vi.fn(),
    handleChangeInput: vi.fn(),
    handleChangeItem: vi.fn(),
    addLevel: vi.fn(),
    updateLevel: vi.fn(),
    handlechangeImage: vi.fn()
  }
})

describe('LoyaltyLevelDetail · Product pieces', () => {
  it('Save is a primary Product button, disabled with no changes and busy while saving', () => {
    const { unmount } = renderDetail()
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toHaveClass('odc-btn')
    expect(save).toHaveAttribute('data-variant', 'primary')
    expect(save).toBeDisabled()
    unmount()

    renderDetail(LEVEL, { loading: true, error: null, changes: { name: 'Platinum' } })
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-busy', 'true')
  })

  it('a new level says Add and has no menu', () => {
    renderDetail({})
    expect(screen.getByRole('heading', { name: 'New level' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toHaveClass('odc-btn')
    expect(screen.queryByRole('button', { name: 'Actions' })).toBeNull()
  })

  it('draws the fields as Product text fields named by their labels, with the saved values', () => {
    renderDetail()
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Gold')
    expect(screen.getByRole('textbox', { name: 'Accumulation rate' })).toHaveValue('2')
    expect(screen.getByRole('textbox', { name: 'Points required' })).toHaveValue('10')
    expect(screen.getByRole('textbox', { name: 'Maximum of points' })).toHaveValue('500')
    expect(screen.getByRole('textbox', { name: 'Days' })).toHaveValue('2')
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveClass('odc-field-input')
    expect(screen.getByRole('radiogroup', { name: 'Expiration' })).toBeInTheDocument()
  })

  it('a typed value reaches handleChangeInput as an event with the field name, like the legacy input', () => {
    renderDetail()
    fireEvent.change(screen.getByRole('textbox', { name: 'Accumulation rate' }), { target: { value: '7' } })
    expect(ctl.spies.handleChangeInput).toHaveBeenLastCalledWith({ target: { name: 'accumulation_rate', value: '7' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Platinum' } })
    expect(ctl.spies.handleChangeInput).toHaveBeenLastCalledWith({ target: { name: 'name', value: 'Platinum' } })
  })

  it('the number fields refuse a key that is not a digit, as main', () => {
    renderDetail()
    const field = screen.getByRole('textbox', { name: 'Points required' })
    expect(fireEvent.keyPress(field, { key: 'a', charCode: 97 })).toBe(false)
    expect(fireEvent.keyPress(field, { key: '5', charCode: 53 })).toBe(true)
  })

  it('expiration: «No» clears it, the days are sent in minutes', async () => {
    const user = userEvent.setup()
    renderDetail()
    fireEvent.change(screen.getByRole('textbox', { name: 'Days' }), { target: { value: '3' } })
    expect(ctl.spies.handleChangeItem).toHaveBeenLastCalledWith({ expire_after_minutes: 3 * 24 * 60 })
    await user.click(screen.getByRole('radio', { name: 'No' }))
    expect(ctl.spies.handleChangeItem).toHaveBeenLastCalledWith({ expire_after_minutes: null })
    expect(screen.queryByRole('textbox', { name: 'Days' })).toBeNull()
    // a radio inside the form does not submit it
    expect(ctl.spies.updateLevel).not.toHaveBeenCalled()
    expect(ctl.spies.addLevel).not.toHaveBeenCalled()
  })

  it('Save updates a saved level and adds a new one', async () => {
    const { unmount } = renderDetail(LEVEL, { loading: false, error: null, changes: { name: 'Platinum' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(ctl.spies.updateLevel).toHaveBeenCalledTimes(1))
    expect(ctl.spies.addLevel).not.toHaveBeenCalled()
    unmount()

    renderDetail({}, { loading: false, error: null, changes: { name: 'Bronze', accumulation_rate: '1', minimum_points: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(ctl.spies.addLevel).toHaveBeenCalledTimes(1))
  })

  it('an emptied required field stops the save with main\'s alert', async () => {
    renderDetail(LEVEL, { loading: false, error: null, changes: { minimum_points: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(ctl.alert).toBe('Value is required'))
    expect(ctl.spies.updateLevel).not.toHaveBeenCalled()
  })

  it('Delete is an item of the Product menu and asks in a Product confirm before deleting', async () => {
    const user = userEvent.setup()
    renderDetail()
    await user.click(screen.getByRole('button', { name: 'Actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Are you sure to delete this Level?' })
    expect(ctl.spies.handleDeleteLevel).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(ctl.spies.handleDeleteLevel).toHaveBeenCalledTimes(1)
    expect(ctl.spies.handleDeleteLevel).toHaveBeenCalledWith()
  })

  it('the image is a Product image field; a file that is not an image gets main\'s alert and is not held', () => {
    renderDetail()
    expect(screen.getByRole('group', { name: 'Image' })).toBeInTheDocument()
    const input = document.querySelector('.odc-image-field input[type="file"]')
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] } })
    expect(ctl.alert).toEqual(['Only images can be accepted'])
    expect(ctl.spies.handlechangeImage).not.toHaveBeenCalled()

    const png = new File(['x'], 'a.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [png] } })
    expect(ctl.spies.handlechangeImage).toHaveBeenCalledWith(png)
  })

  it('has no legacy controls left', () => {
    const { container } = renderDetail()
    expect(container.querySelector('.dropdown, .btn')).toBeNull()
    expect(document.querySelectorAll('button:not(.odc-btn):not([role="radio"])').length).toBe(0)
  })
})
