/* eslint-disable import/first */
// redesign stores 5.2 (; decisions 4, 5, D7, D9; G2-05, G2-09, G2-10, G2-26): the detail form of one business type on Product.
// Covered: the name is required (an empty name shows an error and does not save); the save bar counts and names what changed; Save on a
// saved type calls the update and on a new one the add («Add category»); a failed save says why; Discard calls `cleanChanges`; delete
// exists only for a saved type (`deleteRef.current`), asks first with the title and body of the whole-project question, and confirms
// through `handleDeleteProductType`. The controller is a stand-in that keeps `changes` like the real one; P/ImageField is stood in
// (the crop has its own tests).
import React, { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const probe = vi.hoisted(() => ({ spies: {}, answers: {} }))

const mockModule = vi.hoisted(() => async () => {
  const ReactModule = await import('react')
  return {
    useLanguage: () => [{}, (_key, fallback) => fallback],
    useUtils: () => [{ optimizeImage: url => url }],
    // The controller's part: `changes` held until the save answers.
    BusinessTypeDetail: ({ UIComponent, businessType, ...props }) => {
      const [changes, setChanges] = ReactModule.useState({})
      const state = { businessType: businessType ?? null }
      const answer = (name) => probe.answers[name] ?? { ok: true }
      const handlers = {
        handleChangeItem: (key, value) => setChanges(prev => ({ ...prev, [key]: value })),
        handleUpdateProductType: async () => {
          probe.spies.update?.(changes)
          const result = answer('update')
          if (result.ok) setChanges({})
          return result
        },
        handleAddProductType: async () => {
          probe.spies.add?.(changes)
          const result = answer('add')
          if (result.ok) setChanges({})
          return result
        },
        handleDeleteProductType: async () => {
          probe.spies.remove?.()
          return answer('remove')
        },
        cleanChanges: () => {
          probe.spies.clean?.()
          setChanges({})
        }
      }
      return ReactModule.createElement(UIComponent, {
        ...props,
        businessTypeState: state,
        typeFormState: { loading: false, changes, error: null },
        ...handlers
      })
    }
  }
})
// `~components` and the relative index are the same module: both mocks must say the same
vi.mock('../../../../../../index', mockModule)
vi.mock('~components', mockModule)
vi.mock('../../../Shared/Product/ImageField', () => ({
  ImageField: (props) => (
    <div data-testid='image-field' data-value={props.value}>
      <span>{props.label}</span>
      <button type='button' onClick={() => props.onChange('data:image/png;base64,AAA')}>Pick image</button>
    </div>
  )
}))

import { BusinessTypeDetail } from '../index'

const PIZZA = { id: 4, name: 'Pizza', image: 'pizza.png' }

const deleteRef = { current: undefined }

const Harness = ({ businessType = PIZZA }) => {
  const [type] = useState(businessType)
  return <BusinessTypeDetail businessType={type} businessTypes={[PIZZA]} setBusinessTypes={() => {}} deleteRef={deleteRef} onClose={() => {}} />
}

const nameField = () => screen.getByRole('textbox', { name: /Name/ })
const saveButton = (name) => screen.getByRole('button', { name })

beforeEach(() => {
  probe.spies = {}
  probe.answers = {}
  deleteRef.current = undefined
})

describe('BusinessTypeDetail', () => {
  it('shows the stored name and image, and no save bar while nothing changed', () => {
    render(<Harness />)
    expect(nameField().value).toBe('Pizza')
    expect(screen.getByTestId('image-field').getAttribute('data-value')).toBe('pizza.png')
    expect(screen.queryByText(/unsaved change/)).toBeNull()
  })

  it('requires a name: saving with it empty shows the error and does not call the save', async () => {
    const user = userEvent.setup()
    const update = vi.fn()
    probe.spies.update = update
    render(<Harness />)
    await user.clear(nameField())
    await user.click(saveButton('Save changes'))
    expect(await screen.findByText('Enter a name for the category.')).toBeTruthy()
    expect(screen.getByText('Fix 1 field to save.')).toBeTruthy()
    expect(update).not.toHaveBeenCalled()
    // typing again takes the error away
    await user.type(nameField(), 'Pizzeria')
    expect(screen.queryByText('Enter a name for the category.')).toBeNull()
  })

  it('requires a name for a new type too, even when only the image changed', async () => {
    const user = userEvent.setup()
    const add = vi.fn()
    probe.spies.add = add
    render(<Harness businessType={null} />)
    await user.click(screen.getByRole('button', { name: 'Pick image' }))
    await user.click(saveButton('Add category'))
    expect(await screen.findByText('Enter a name for the category.')).toBeTruthy()
    expect(add).not.toHaveBeenCalled()
  })

  it('counts and names what changed in the save bar', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(nameField(), 's')
    const bar = screen.getByRole('group', { name: 'Save changes' })
    expect(within(bar).getByText('1 unsaved change')).toBeTruthy()
    expect(within(bar).getByText(/Name/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Pick image' }))
    expect(within(bar).getByText('2 unsaved changes')).toBeTruthy()
    expect(within(bar).getByText(/Image/)).toBeTruthy()
    // typing the stored name back is not a change
    await user.click(saveButton('Discard'))
    await user.type(nameField(), 'x')
    await user.keyboard('{Backspace}')
    expect(screen.queryByText(/unsaved change/)).toBeNull()
  })

  it('Save on a saved type calls the update with the changes and says «Saved»', async () => {
    const user = userEvent.setup()
    const update = vi.fn()
    const add = vi.fn()
    probe.spies = { update, add }
    render(<Harness />)
    await user.type(nameField(), 's')
    await user.click(saveButton('Save changes'))
    expect(update).toHaveBeenCalledWith({ name: 'Pizzas' })
    expect(add).not.toHaveBeenCalled()
    expect(await screen.findByText('Saved')).toBeTruthy()
  })

  it('Save on a new type calls the add, with the button labelled «Add category»', async () => {
    const user = userEvent.setup()
    const update = vi.fn()
    const add = vi.fn()
    probe.spies = { update, add }
    render(<Harness businessType={null} />)
    expect(nameField().value).toBe('')
    await user.type(nameField(), 'Tacos')
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull()
    await user.click(saveButton('Add category'))
    expect(add).toHaveBeenCalledWith({ name: 'Tacos' })
    expect(update).not.toHaveBeenCalled()
  })

  it('says why a save failed, keeps the changes and offers «Try again»', async () => {
    const user = userEvent.setup()
    const update = vi.fn()
    probe.spies.update = update
    probe.answers.update = { ok: false, error: ['Name is taken'] }
    render(<Harness />)
    await user.type(nameField(), 's')
    await user.click(saveButton('Save changes'))
    expect(await screen.findByText('Name is taken')).toBeTruthy()
    expect(nameField().value).toBe('Pizzas')
    expect(screen.queryByText('Saved')).toBeNull()
    probe.answers.update = { ok: true }
    await user.click(saveButton('Try again'))
    expect(update).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(screen.queryByText('Name is taken')).toBeNull())
  })

  it('falls back to a generic reason when the API sends none', async () => {
    const user = userEvent.setup()
    probe.answers.update = { ok: false, error: [] }
    render(<Harness />)
    await user.type(nameField(), 's')
    await user.click(saveButton('Save changes'))
    expect(await screen.findByText('The category could not be saved.')).toBeTruthy()
  })

  it('Discard calls cleanChanges and puts the stored name back', async () => {
    const user = userEvent.setup()
    const clean = vi.fn()
    probe.spies.clean = clean
    render(<Harness />)
    await user.type(nameField(), 'zzz')
    await user.click(saveButton('Discard'))
    expect(clean).toHaveBeenCalledTimes(1)
    expect(nameField().value).toBe('Pizza')
    expect(screen.queryByText(/unsaved change/)).toBeNull()
  })

  it('for a saved type deleteRef.current asks first, with the whole-project question, and deletes only after the confirmation', async () => {
    const user = userEvent.setup()
    const remove = vi.fn()
    probe.spies.remove = remove
    render(<Harness />)
    expect(typeof deleteRef.current).toBe('function')
    act(() => deleteRef.current())
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Delete Pizza for the whole project?')).toBeTruthy()
    expect(within(dialog).getByText(/It is removed from every store that uses it/)).toBeTruthy()
    expect(remove).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Delete category' }))
    expect(remove).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('Cancel in the confirmation deletes nothing', async () => {
    const user = userEvent.setup()
    const remove = vi.fn()
    probe.spies.remove = remove
    render(<Harness />)
    act(() => deleteRef.current())
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(remove).not.toHaveBeenCalled()
  })

  it('a failed delete closes the question and says why in the form', async () => {
    const user = userEvent.setup()
    probe.answers.remove = { ok: false, error: ['The category is in use'] }
    render(<Harness />)
    act(() => deleteRef.current())
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete category' }))
    expect(await screen.findByText('The category is in use')).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    // review r1-5: going on with the form takes the delete failure away
    await user.type(screen.getByRole('textbox', { name: /Name/ }), 's')
    expect(screen.queryByText('The category is in use')).toBeNull()
  })

  it('for a new type deleteRef.current is null', () => {
    render(<Harness businessType={null} />)
    expect(deleteRef.current).toBeNull()
  })
})
