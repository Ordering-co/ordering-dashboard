/* eslint-disable import/first */
// redesign SB-B3 (; G5-30, G5-46, M-SB5, auditor 4 and 14): the General tab of a brand on Product.
// Covered: renaming never touches the slug of a saved brand and derives it when creating (G5-46); the slug refuses a space; an empty
// ribbon text does not save and says so in the field; the shapes are a radio group the arrows move; the save bar counts and names
// what changed; Discard goes back to what is saved; a failed save keeps the pending logo in the preview (M-SB5); the logo goes through
// the same validation as before (type, 2 MB); in the create form the bar is always there with «Create brand»; a reported color is
// held and saved, and Discard drops one the picker has not reported yet.
// The controller is a stand-in with the contract SB-B1 gives it (`handleUpdateClick()` → { ok, error }, `handleDiscard()`,
// `brandFormState`); it keeps `changes` like the real one and reads them from the render that built `handleUpdateClick`, as the
// real one does. P/ImageField is stood in (the crop has its own tests); ColorField and the real ColorPicker are used, with the
// SketchPicker simulated.
import React, { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const probe = vi.hoisted(() => ({ spies: {}, answers: {}, image: null, saved: undefined }))

const mockModule = vi.hoisted(() => async () => {
  const ReactModule = await import('react')
  return {
    useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
    useUtils: () => [{ optimizeImage: url => url }],
    // The controller's part (SB-B1 contract).
    BusinessBrandGENDetail: ({ UIComponent, ...props }) => {
      const [state, setState] = ReactModule.useState({ loading: false, changes: {}, result: { error: false } })
      const handlers = {
        handleChangeItem: (changes) => setState(prev => ({ ...prev, changes: { ...prev.changes, ...changes } })),
        handleChangeRibbon: (changes) => setState(prev => ({
          ...prev,
          changes: { ...prev.changes, ribbon: { ...(prev.changes.ribbon || {}), ...changes } }
        })),
        // reads `state` of the render it was built in, like main's closure over `formState`
        handleUpdateClick: async () => {
          probe.spies.save?.(state.changes)
          const answer = probe.answers.save ?? { ok: true }
          if (answer.ok) {
            setState(prev => ({ ...prev, changes: {}, result: { error: false } }))
            props.onSelectedBrand?.({ ...(props.brand || { id: 9 }), ...probe.saved })
          } else {
            setState(prev => ({ ...prev, result: { error: true, result: answer.error } }))
          }
          return answer
        },
        handleDiscard: () => {
          probe.spies.discard?.()
          setState(prev => ({ ...prev, changes: {}, result: { error: false } }))
        }
      }
      return ReactModule.createElement(UIComponent, { ...props, brandFormState: state, ...handlers })
    }
  }
})
// `~components` and the relative index are the same module: both mocks must say the same
vi.mock('../../../../../../index', mockModule)
vi.mock('~components', mockModule)

vi.mock('../../../Shared/Product/ImageField', () => ({
  ImageField: (props) => (
    <div data-testid='image-field' data-value={props.value} data-droppable={String(props.droppable)} data-too-many={props.tooManyFilesText} data-accept={props.accept ?? 'default'}>
      <span>{props.label}</span>
      <button type='button' onClick={() => props.onChange('data:image/png;base64,AAA')}>Pick image</button>
      <button type='button' onClick={() => { probe.image = props.validateFile({ type: 'text/plain', size: 10 }) }}>Pick text file</button>
      <button type='button' onClick={() => { probe.image = props.validateFile({ type: 'image/png', size: 3000 * 1024 }) }}>Pick big image</button>
      <button type='button' onClick={() => { probe.image = props.validateFile({ type: 'image/png', size: 1000 }) }}>Pick small image</button>
      {props.error && <p role='alert'>{props.error}</p>}
    </div>
  )
}))

// the SketchPicker stand-in: one button that reports a color the way react-color does
vi.mock('react-color', () => ({
  SketchPicker: ({ onChange }) => (
    <button type='button' onClick={() => typeof onChange === 'function' && onChange({ hex: '#ff0000' })}>Pick red</button>
  )
}))

import { LeaveGuardContext, useLeaveGuardHost } from '../../../Shared/Product'
import { BusinessBrandGENDetail } from '../index'

const lightTheme = createDashboardTheme(theme)

const BRAND = {
  id: 1,
  name: 'Burger Palace',
  slug: 'burger_palace',
  logo: 'logo.png',
  ribbon: { enabled: true, text: 'New', color: '#e63757', shape: 'rectangle_round' }
}
const PLAIN = { id: 2, name: 'Vips', slug: 'vips', logo: null, ribbon: null }

const guard = { current: null }

const Harness = ({ initial = BRAND, onDirtyChange, onSelectedBrand }) => {
  const [brand, setBrand] = useState(initial)
  const host = useLeaveGuardHost()
  guard.current = host
  return (
    <ThemeProvider theme={lightTheme}>
      <LeaveGuardContext.Provider value={host.context}>
        <BusinessBrandGENDetail
          brand={brand}
          brandListState={{ brands: brand ? [brand] : [] }}
          handleUpdateBrandList={() => {}}
          onDirtyChange={onDirtyChange}
          onSelectedBrand={(next) => {
            onSelectedBrand?.(next)
            setBrand(next)
          }}
        />
      </LeaveGuardContext.Provider>
    </ThemeProvider>
  )
}

const nameField = () => screen.getByRole('textbox', { name: /^Name/ })
const slugField = () => screen.getByRole('textbox', { name: /^Slug/ })
const ribbonTextField = () => screen.getByRole('textbox', { name: /^Ribbon text/ })
const ribbonSwitch = () => screen.getByRole('switch', { name: 'Ribbon' })
const saveButton = (name = 'Save changes') => screen.getByRole('button', { name })
const wait = (ms) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)) })

beforeEach(() => {
  probe.spies = {}
  probe.answers = {}
  probe.saved = undefined
  probe.image = null
})

describe('BusinessBrandGENDetail · fields', () => {
  it('shows the stored values, paints no ID and no save bar while nothing changed', () => {
    render(<Harness />)
    expect(nameField().value).toBe('Burger Palace')
    expect(slugField().value).toBe('burger_palace')
    expect(ribbonSwitch().getAttribute('aria-checked')).toBe('true')
    expect(ribbonTextField().value).toBe('New')
    expect(screen.queryByRole('textbox', { name: /^ID/ })).toBeNull()
    expect(screen.queryByText(/unsaved change/)).toBeNull()
    expect(screen.getByTestId('image-field').getAttribute('data-value')).toBe('logo.png')
  })

  it('G5-46: renaming a saved brand does not touch its slug', async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    probe.spies.save = save
    render(<Harness />)
    await user.clear(nameField())
    await user.type(nameField(), 'Burger Palace Express')
    expect(slugField().value).toBe('burger_palace')
    await user.click(saveButton())
    await waitFor(() => expect(save).toHaveBeenCalled())
    const changes = save.mock.calls[0][0]
    expect(changes.name).toBe('Burger Palace Express')
    expect('slug' in changes).toBe(false)
  })

  it('G5-46: creating derives the slug from the name, and the slug field is not drawn', async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    probe.spies.save = save
    render(<Harness initial={null} />)
    expect(screen.queryByRole('textbox', { name: /^Slug/ })).toBeNull()
    await user.type(nameField(), 'Burger Hub')
    await user.click(saveButton('Create brand'))
    await waitFor(() => expect(save).toHaveBeenCalled())
    expect(save.mock.calls[0][0]).toMatchObject({ name: 'Burger Hub', slug: 'burger_hub' })
  })

  it('refuses a space in the slug and holds the typed slug', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.clear(slugField())
    await user.type(slugField(), 'my brand')
    expect(slugField().value).toBe('mybrand')
    expect(screen.getByText('1 unsaved change', { exact: false })).toBeTruthy()
  })

  it('an empty ribbon text does not save and says so in the field', async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    probe.spies.save = save
    render(<Harness />)
    await user.clear(ribbonTextField())
    await user.click(saveButton())
    expect(await screen.findByText('Value is required')).toBeTruthy()
    expect(ribbonTextField().getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('Fix 1 field to save.')).toBeTruthy()
    expect(save).not.toHaveBeenCalled()
    // typing again takes the error away
    await user.type(ribbonTextField(), 'Hot')
    expect(screen.queryByText('Value is required')).toBeNull()
  })

  it('the shapes are a radio group the arrows move', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const group = screen.getByRole('radiogroup', { name: 'Shape' })
    expect(group.getAttribute('data-variant')).toBe('cards')
    const rounded = screen.getByRole('radio', { name: 'Rounded rectangle' })
    expect(rounded.getAttribute('aria-checked')).toBe('true')
    expect(screen.getAllByRole('radio').map(radio => radio.textContent)).toEqual(['Rectangle', 'Rounded rectangle', 'Capsule'])
    rounded.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Capsule' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('1 unsaved change', { exact: false })).toBeTruthy()
    await user.keyboard('{Home}')
    expect(screen.getByRole('radio', { name: 'Rectangle' }).getAttribute('aria-checked')).toBe('true')
  })

  // redesign bugs C: the text used to be seeded with «ribbon», which customers then saw on the brand
  it('turning the ribbon on for a brand without one asks for its text, and seeds only the color and the shape', async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    probe.spies.save = save
    render(<Harness initial={PLAIN} />)
    expect(screen.queryByRole('textbox', { name: /^Ribbon text/ })).toBeNull()
    await user.click(ribbonSwitch())
    expect(ribbonTextField().value).toBe('')
    // seeded defaults are not edits: one field changed (Ribbon)
    expect(screen.getByText('1 unsaved change', { exact: false })).toBeTruthy()
    await user.click(saveButton())
    expect(await screen.findByText('Value is required')).toBeTruthy()
    expect(ribbonTextField().getAttribute('aria-invalid')).toBe('true')
    expect(save).not.toHaveBeenCalled()
    await user.type(ribbonTextField(), 'Hot')
    await user.click(saveButton())
    await waitFor(() => expect(save).toHaveBeenCalled())
    expect(save.mock.calls[0][0].ribbon).toMatchObject({ enabled: true, text: 'Hot', shape: 'rectangle' })
    expect(save.mock.calls[0][0].ribbon.color).toBeTruthy()
  })

  it('a text of spaces does not save either', async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    probe.spies.save = save
    render(<Harness initial={PLAIN} />)
    await user.click(ribbonSwitch())
    await user.type(ribbonTextField(), '   ')
    await user.click(saveButton())
    expect(await screen.findByText('Value is required')).toBeTruthy()
    expect(save).not.toHaveBeenCalled()
  })

  it('turning a saved ribbon off sends enabled false only', async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    probe.spies.save = save
    render(<Harness />)
    await user.click(ribbonSwitch())
    expect(screen.queryByRole('textbox', { name: /^Ribbon text/ })).toBeNull()
    await user.click(saveButton())
    await waitFor(() => expect(save).toHaveBeenCalled())
    expect(save.mock.calls[0][0].ribbon).toEqual({ enabled: false })
  })
})

describe('BusinessBrandGENDetail · save bar', () => {
  it('counts and names what changed, and onDirtyChange follows', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    render(<Harness onDirtyChange={onDirtyChange} />)
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    await user.type(nameField(), ' 2')
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    await user.click(screen.getByRole('radio', { name: 'Capsule' }))
    const bar = screen.getByRole('group', { name: 'Save changes' })
    expect(bar.textContent).toContain('2 unsaved changes')
    expect(bar.textContent).toContain('Name, Shape')
  })

  it('typing the stored value back is not a change', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(nameField(), 'x')
    expect(screen.getByText('1 unsaved change', { exact: false })).toBeTruthy()
    await user.type(nameField(), '{Backspace}')
    expect(screen.queryByText(/unsaved change/)).toBeNull()
  })

  it('Discard calls handleDiscard and goes back to what is saved', async () => {
    const user = userEvent.setup()
    const discard = vi.fn()
    probe.spies.discard = discard
    const onDirtyChange = vi.fn()
    render(<Harness onDirtyChange={onDirtyChange} />)
    await user.type(nameField(), ' Express')
    await user.click(screen.getByRole('button', { name: 'Pick image' }))
    expect(screen.getByTestId('image-field').getAttribute('data-value')).toBe('data:image/png;base64,AAA')
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(discard).toHaveBeenCalledTimes(1)
    expect(nameField().value).toBe('Burger Palace')
    expect(screen.getByTestId('image-field').getAttribute('data-value')).toBe('logo.png')
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    expect(screen.queryByText(/unsaved change/)).toBeNull()
  })

  it('a good save says «Saved»', async () => {
    const user = userEvent.setup()
    probe.saved = { name: 'Burger Palace Express' }
    render(<Harness />)
    await user.type(nameField(), ' Express')
    await user.click(saveButton())
    expect(await screen.findByText('Saved')).toBeTruthy()
  })

  it('M-SB5: a failed save says why, offers a retry and the preview keeps the pending logo', async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    probe.spies.save = save
    probe.answers.save = { ok: false, error: ['Unauthorized'] }
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Pick image' }))
    await user.click(saveButton())
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Unauthorized')
    expect(screen.getByTestId('image-field').getAttribute('data-value')).toBe('data:image/png;base64,AAA')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
  })

  it('create form: the bar is always there with «Create brand»', () => {
    render(<Harness initial={null} />)
    expect(saveButton('Create brand')).toBeTruthy()
  })
})

describe('BusinessBrandGENDetail · logo', () => {
  it('hands the ImageField the drop, the accept and the same checks as before', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const field = screen.getByTestId('image-field')
    expect(field.getAttribute('data-droppable')).toBe('true')
    expect(field.getAttribute('data-too-many')).toBe('Drop one image at a time.')
    expect(field.getAttribute('data-accept')).toBe('image/png, image/jpeg, image/jpg')
    await user.click(screen.getByRole('button', { name: 'Pick text file' }))
    expect(probe.image).toBe(false)
    expect(screen.getByRole('alert').textContent).toBe('Only images can be accepted')
    await user.click(screen.getByRole('button', { name: 'Pick big image' }))
    expect(probe.image).toBe(false)
    expect(screen.getByRole('alert').textContent).toBe('The maximum image size is 2 megabytes')
    await user.click(screen.getByRole('button', { name: 'Pick small image' }))
    expect(probe.image).toBe(true)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('BusinessBrandGENDetail · color', () => {
  // ColorPicker reports a picked color 750 ms later, as in main; once reported it is a held change that goes into the save
  it('a reported color is held, counted and saved', async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    probe.spies.save = save
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: /Color/ }))
    await user.click(screen.getByRole('button', { name: 'Pick red' }))
    expect(await screen.findByText('1 unsaved change', { exact: false }, { timeout: 2000 })).toBeTruthy()
    await user.click(saveButton())
    await waitFor(() => expect(save).toHaveBeenCalled())
    expect(save.mock.calls[0][0].ribbon.color).toBe('#ff0000')
  })

  it('discarding before the picker reports drops the color for good', async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    probe.spies.save = save
    render(<Harness />)
    await user.type(nameField(), 'x')
    await user.click(screen.getByRole('button', { name: /Color/ }))
    await user.click(screen.getByRole('button', { name: 'Pick red' }))
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    await wait(900)
    expect(screen.queryByText(/unsaved change/)).toBeNull()
    expect(save).not.toHaveBeenCalled()
  })
})
