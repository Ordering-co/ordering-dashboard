/* eslint-disable import/first */
import React, { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { FirstSelect } from '../../UI/FirstSelect'
import { SelectSurfaceContext } from '../../UI/selectPlacement'
import { Field, NumberField, PasswordField, TextArea, TextField, useFieldFrame } from '../Field'

// redesign W0-7 (T0-21): the field family. Real Base UI, no mocks; jsdom has no layout, so sizes are
// the browser spec's job (gallery + ui:test:browser), and these tests pin the wiring.

const described = element => (element.getAttribute('aria-describedby') || '')
  .split(' ')
  .filter(Boolean)
  .map(id => document.getElementById(id))

describe('Field family: the label names the control', () => {
  it.each([
    ['TextField', props => <TextField label='Business name' {...props} />, 'textbox'],
    ['TextArea', props => <TextArea label='Business name' {...props} />, 'textbox'],
    ['NumberField', props => <NumberField label='Business name' {...props} />, 'textbox'],
    ['PasswordField', props => <PasswordField label='Business name' showLabel='Show' hideLabel='Hide' {...props} />, null]
  ])('%s: <label for> points at the control', (_, make, role) => {
    const { container } = render(make({}))
    const label = container.querySelector('label')
    expect(label).toHaveTextContent('Business name')
    const control = container.querySelector('input:not([type=button]), textarea')
    expect(label.getAttribute('for')).toBe(control.id)
    expect(control.id).not.toBe('')
    if (role) expect(screen.getByRole(role, { name: 'Business name' })).toBe(control)
    else expect(screen.getByLabelText('Business name')).toBe(control)
  })

  it('uses the id the caller passes and forwards name', () => {
    render(<TextField label='Phone' id='store-phone' name='phone' />)
    const input = screen.getByRole('textbox', { name: 'Phone' })
    expect(input).toHaveAttribute('id', 'store-phone')
    expect(input).toHaveAttribute('name', 'phone')
    expect(document.querySelector('label')).toHaveAttribute('for', 'store-phone')
  })

  it('names the control with aria-label when there is no visible label', () => {
    render(<TextField aria-label='Search stores' />)
    expect(screen.getByRole('textbox', { name: 'Search stores' })).toBeInTheDocument()
    expect(document.querySelector('label')).toBeNull()
  })

  it('a text field is a 32px-height field of the family: classes and no inline styles', () => {
    render(<TextField label='Name' />)
    const input = screen.getByRole('textbox', { name: 'Name' })
    expect(input).toHaveClass('odc-field-input')
    expect(input.closest('.odc-field')).toHaveClass('odc-root')
    expect(input.getAttribute('style')).toBeNull()
  })
})

describe('Field family: hint and error describe the control', () => {
  it('the hint describes the input', () => {
    render(<TextField label='Name' hint='As it shows on receipts' />)
    const input = screen.getByRole('textbox', { name: 'Name' })
    expect(input).toHaveAccessibleDescription('As it shows on receipts')
    expect(described(input)).toHaveLength(1)
  })

  it('the error describes the input, with the hint first, and is announced as an alert', () => {
    render(<TextField label='Name' hint='As it shows on receipts' error='Enter a name' />)
    const input = screen.getByRole('textbox', { name: 'Name' })
    expect(input).toHaveAccessibleDescription('As it shows on receipts Enter a name')
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Enter a name')
    expect(described(input)).toContain(alert)
    expect(described(input)).toHaveLength(2)
  })

  it('with an error: aria-invalid on the control and data-invalid on the root and the control', () => {
    const { container } = render(<TextField label='Name' error='Enter a name' />)
    const input = screen.getByRole('textbox', { name: 'Name' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('data-invalid')
    expect(container.querySelector('.odc-field')).toHaveAttribute('data-invalid')
  })

  it('without an error: not invalid, no alert, and the empty message node paints nothing', () => {
    const { container, rerender } = render(<TextField label='Name' />)
    const input = screen.getByRole('textbox', { name: 'Name' })
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).not.toHaveAttribute('data-invalid')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(container.querySelector('.odc-field')).not.toHaveAttribute('data-invalid')
    rerender(<TextField label='Name' error='Enter a name' />)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    rerender(<TextField label='Name' error='' />)
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('the error also describes a textarea and a number field', () => {
    render(
      <>
        <TextArea label='Notes' error='Too long' />
        <NumberField label='Quantity' error='Must be positive' />
      </>
    )
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveAccessibleDescription('Too long')
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('textbox', { name: 'Quantity' })).toHaveAccessibleDescription('Must be positive')
    expect(screen.getByRole('textbox', { name: 'Quantity' })).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('Field family: required', () => {
  it('marks the control aria-required and gives the asterisk a name', () => {
    const { container } = render(<TextField label='Name' required requiredLabel='Required' />)
    const input = screen.getByRole('textbox', { name: /Name/ })
    expect(input).toHaveAttribute('aria-required', 'true')
    expect(input).toHaveAccessibleName('Name Required')
    const asterisk = container.querySelector('.odc-field-required')
    expect(asterisk).toHaveTextContent('*')
    expect(asterisk).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.odc-field')).toHaveAttribute('data-required')
  })

  it('not required: no aria-required and no asterisk', () => {
    const { container } = render(<TextField label='Name' />)
    expect(screen.getByRole('textbox', { name: 'Name' })).not.toHaveAttribute('aria-required')
    expect(container.querySelector('.odc-field-required')).toBeNull()
  })

  it('required needs its requiredLabel in every field of the family', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TextField label='Name' required />)).toThrow('TextField needs a requiredLabel')
    expect(() => render(<TextArea label='Name' required />)).toThrow('TextArea needs a requiredLabel')
    expect(() => render(<NumberField label='Name' required />)).toThrow('NumberField needs a requiredLabel')
    expect(() => render(<PasswordField label='Name' required showLabel='Show' hideLabel='Hide' />)).toThrow('PasswordField needs a requiredLabel')
    expect(() => render(<Field label='Name' required><input aria-label='x' /></Field>)).toThrow('Field needs a requiredLabel')
    spy.mockRestore()
  })

  it('required with an empty requiredLabel is a name that paints empty, not a missing one', () => {
    render(<TextField label='Name' required requiredLabel='' />)
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('aria-required', 'true')
  })
})

describe('Field family: a missing name throws, an empty one paints', () => {
  it('throws without label or aria-label; null counts as missing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TextField />)).toThrow('TextField needs a label')
    expect(() => render(<TextField label={null} />)).toThrow('TextField needs a label')
    expect(() => render(<TextArea />)).toThrow('TextArea needs a label')
    expect(() => render(<NumberField />)).toThrow('NumberField needs a label')
    expect(() => render(<PasswordField showLabel='Show' hideLabel='Hide' />)).toThrow('PasswordField needs a label')
    expect(() => render(<Field><input aria-label='x' /></Field>)).toThrow('Field needs a label')
    spy.mockRestore()
  })

  it("an empty label '' paints an empty label and does not throw", () => {
    const { container } = render(<TextField label='' />)
    expect(container.querySelector('label')).toBeInTheDocument()
    expect(container.querySelector('label')).toHaveTextContent('')
    expect(container.querySelector('input')).toBeInTheDocument()
  })

  it("an empty showLabel '' paints an empty name; a missing one throws", () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<PasswordField label='Password' hideLabel='Hide' />)).toThrow('PasswordField needs a showLabel')
    expect(() => render(<PasswordField label='Password' showLabel='Show' />)).toThrow('PasswordField needs a hideLabel')
    spy.mockRestore()
    render(<PasswordField label='Password' showLabel='' hideLabel='Hide' />)
    expect(document.querySelector('button')).toHaveAttribute('aria-label', '')
  })

  it('the frame of a custom control carries the family wiring', () => {
    render(
      <Field label='Slug' hint='Lower case' error='Taken'>
        <input aria-label='Slug input' />
      </Field>
    )
    expect(screen.getByLabelText('Slug input')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Taken')
  })
})

describe('TextField and TextArea: value, defaultValue, onChange', () => {
  it('uncontrolled: starts from defaultValue and reports the string typed', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TextField label='Name' defaultValue='Pizza' onChange={onChange} />)
    const input = screen.getByRole('textbox', { name: 'Name' })
    expect(input).toHaveValue('Pizza')
    await user.type(input, '!')
    expect(input).toHaveValue('Pizza!')
    expect(onChange).toHaveBeenLastCalledWith('Pizza!', expect.anything())
  })

  it('controlled: the value is the prop', async () => {
    const user = userEvent.setup()
    const Harness = () => {
      const [value, setValue] = useState('a')
      return <TextField label='Name' value={value} onChange={next => setValue(next.toUpperCase())} />
    }
    render(<Harness />)
    const input = screen.getByRole('textbox', { name: 'Name' })
    await user.type(input, 'bc')
    expect(input).toHaveValue('ABC')
  })

  it('passes input attributes through and sets the type', () => {
    render(<TextField label='Email' type='email' placeholder='you@shop.com' autoComplete='email' maxLength={40} />)
    const input = screen.getByRole('textbox', { name: 'Email' })
    expect(input).toHaveAttribute('type', 'email')
    expect(input).toHaveAttribute('placeholder', 'you@shop.com')
    expect(input).toHaveAttribute('autocomplete', 'email')
    expect(input).toHaveAttribute('maxlength', '40')
  })

  it('TextArea is a <textarea> with rows and the same wiring', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TextArea label='Notes' rows={5} hint='Optional' onChange={onChange} />)
    const area = screen.getByRole('textbox', { name: 'Notes' })
    expect(area.tagName).toBe('TEXTAREA')
    expect(area).toHaveAttribute('rows', '5')
    expect(area).toHaveAccessibleDescription('Optional')
    await user.type(area, 'hi')
    expect(onChange).toHaveBeenLastCalledWith('hi', expect.anything())
  })

  it('disabled: the control and the root say so, and typing does nothing', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { container } = render(<TextField label='Name' disabled defaultValue='x' onChange={onChange} />)
    const input = screen.getByRole('textbox', { name: 'Name' })
    expect(input).toBeDisabled()
    expect(input).toHaveAttribute('data-disabled')
    expect(container.querySelector('.odc-field')).toHaveAttribute('data-disabled')
    await user.type(input, 'y')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('Tab reaches the control from the document and the label click focuses it', async () => {
    const user = userEvent.setup()
    render(<TextField label='Name' />)
    await user.tab()
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus()
    await user.tab()
    await user.click(screen.getByText('Name'))
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus()
  })
})

describe('PasswordField: show and hide', () => {
  it('starts hidden; the button toggles the type and its own name', async () => {
    const user = userEvent.setup()
    render(<PasswordField label='Password' showLabel='Show password' hideLabel='Hide password' defaultValue='s3cret' />)
    const input = screen.getByLabelText('Password')
    expect(input).toHaveAttribute('type', 'password')
    const show = screen.getByRole('button', { name: 'Show password' })
    expect(show).toHaveAttribute('type', 'button')
    await user.click(show)
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveValue('s3cret')
    expect(screen.queryByRole('button', { name: 'Show password' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(input).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument()
  })

  it('the toggle is one Tab stop after the input, works with the keyboard and keeps focus', async () => {
    const user = userEvent.setup()
    render(<PasswordField label='Password' showLabel='Show password' hideLabel='Hide password' />)
    await user.tab()
    expect(screen.getByLabelText('Password')).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveFocus()
  })

  it('reports onChange, carries the error wiring, and a disabled field disables the toggle', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(
      <PasswordField label='Password' showLabel='Show' hideLabel='Hide' onChange={onChange} error='Too short' />
    )
    const input = screen.getByLabelText('Password')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Too short')
    await user.type(input, 'ab')
    expect(onChange).toHaveBeenLastCalledWith('ab', expect.anything())
    rerender(<PasswordField label='Password' showLabel='Show' hideLabel='Hide' disabled />)
    expect(screen.getByRole('button', { name: 'Show' })).toBeDisabled()
  })
})

describe('NumberField', () => {
  it('ArrowUp and ArrowDown step by `step`, from defaultValue, and report numbers', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<NumberField label='Quantity' defaultValue={5} step={2} onChange={onChange} />)
    const input = screen.getByRole('textbox', { name: 'Quantity' })
    await user.click(input)
    await user.keyboard('{ArrowUp}')
    expect(input).toHaveValue('7')
    expect(onChange).toHaveBeenLastCalledWith(7)
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(input).toHaveValue('3')
    expect(onChange).toHaveBeenLastCalledWith(3)
  })

  it('min and max clamp the arrows, and Home and End jump to them', async () => {
    const user = userEvent.setup()
    render(<NumberField label='Quantity' defaultValue={2} min={1} max={3} />)
    const input = screen.getByRole('textbox', { name: 'Quantity' })
    await user.click(input)
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}')
    expect(input).toHaveValue('3')
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}')
    expect(input).toHaveValue('1')
    await user.keyboard('{End}')
    expect(input).toHaveValue('3')
    await user.keyboard('{Home}')
    expect(input).toHaveValue('1')
  })

  it('typing a number past max is clamped when the field commits', async () => {
    const user = userEvent.setup()
    render(<NumberField label='Quantity' defaultValue={2} min={1} max={10} />)
    const input = screen.getByRole('textbox', { name: 'Quantity' })
    await user.clear(input)
    await user.type(input, '99')
    await user.tab()
    expect(input).toHaveValue('10')
  })

  it('the steppers are opt-in and named; they step, and stop at min and max', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(<NumberField label='Quantity' defaultValue={1} min={0} max={2} onChange={onChange} />)
    expect(screen.queryByRole('button')).toBeNull()
    rerender(
      <NumberField label='Quantity' defaultValue={1} min={0} max={2} onChange={onChange} incrementLabel='More' decrementLabel='Less' />
    )
    const input = screen.getByRole('textbox', { name: 'Quantity' })
    await user.click(screen.getByRole('button', { name: 'More' }))
    expect(input).toHaveValue('2')
    expect(screen.getByRole('button', { name: 'More' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Less' }))
    await user.click(screen.getByRole('button', { name: 'Less' }))
    expect(input).toHaveValue('0')
    expect(screen.getByRole('button', { name: 'Less' })).toBeDisabled()
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  it('one stepper name without the other throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<NumberField label='Quantity' incrementLabel='More' />)).toThrow('NumberField needs a decrementLabel')
    expect(() => render(<NumberField label='Quantity' decrementLabel='Less' />)).toThrow('NumberField needs an incrementLabel')
    spy.mockRestore()
  })

  it('format shapes the text with Intl and the figure is mono with tabular digits', () => {
    render(<NumberField label='Price' defaultValue={1234.5} locale='en-US' format={{ style: 'currency', currency: 'USD' }} />)
    const input = screen.getByRole('textbox', { name: 'Price' })
    expect(input).toHaveValue('$1,234.50')
    expect(input).toHaveClass('odc-figure', 'odc-num')
  })

  it('controlled value, disabled, and the id and name reach the input', () => {
    render(<NumberField label='Quantity' value={4} onChange={() => {}} disabled id='qty' name='quantity' />)
    const input = screen.getByRole('textbox', { name: 'Quantity' })
    expect(input).toHaveValue('4')
    expect(input).toBeDisabled()
    expect(input).toHaveAttribute('id', 'qty')
    // Base UI keeps the name on the hidden input that a native form submits.
    expect(document.querySelector('input[name="quantity"]')).toHaveValue(4)
  })

  it('required puts aria-required on the input', () => {
    render(<NumberField label='Quantity' required requiredLabel='Required' />)
    expect(screen.getByRole('textbox', { name: /Quantity/ })).toHaveAttribute('aria-required', 'true')
  })
})

// redesign 2.E: a framed control that wires a second control reads the ids of the hint and the error.
describe('useFieldFrame: describedBy', () => {
  const Probe = () => {
    const frame = useFieldFrame()
    return <input aria-label='probe' data-described-by={frame.describedBy ?? 'none'} />
  }
  const describedBy = () => screen.getByLabelText('probe').getAttribute('data-described-by')

  it('is null without a hint and without an error', () => {
    render(<Field label='Time'><Probe /></Field>)
    expect(describedBy()).toBe('none')
  })

  it('an empty hint does not count', () => {
    render(<Field label='Time' hint=''><Probe /></Field>)
    expect(describedBy()).toBe('none')
  })

  it('is the hint id when a hint is shown, and the error id follows when an error arrives', () => {
    const { rerender } = render(<Field label='Time' hint='Pick one'><Probe /></Field>)
    const hintId = document.querySelector('.odc-field-hint').id
    expect(describedBy()).toBe(hintId)
    rerender(<Field label='Time' hint='Pick one' error='Required'><Probe /></Field>)
    const errorId = document.querySelector('.odc-field-error').id
    expect(errorId).not.toBe('')
    expect(describedBy()).toBe(`${hintId} ${errorId}`)
  })

  it('is only the error id with an error and no hint', () => {
    render(<Field label='Time' error='Required'><Probe /></Field>)
    expect(describedBy()).toBe(document.querySelector('.odc-field-error').id)
  })
})

// redesign 2.C: a control that names something after the field (SecretField's «Show <label>») points at the label's
// words alone, without the screen-reader «Required» that the label also holds.
describe('useFieldFrame: labelTextId', () => {
  const Probe = () => {
    const frame = useFieldFrame()
    return <input aria-label='probe' data-label-text-id={frame.labelTextId ?? 'none'} />
  }
  const labelTextId = () => screen.getByLabelText('probe').getAttribute('data-label-text-id')

  it('is the id of the visible label words, which leave out the required text', () => {
    render(<Field label='Secret key' required requiredLabel='Required'><Probe /></Field>)
    const node = document.getElementById(labelTextId())
    expect(node).toHaveClass('odc-field-label-text')
    expect(node.textContent).toBe('Secret key')
  })

  it('is null without a visible label', () => {
    render(<Field aria-label='Secret key'><Probe /></Field>)
    expect(labelTextId()).toBe('none')
  })
})

// SC-2 and SC-3 (from ): the C18 select (U/FirstSelect) inside a Field. Its trigger is a div role=button, which is
// not one of the controls the frame links, and its search field (a Base UI input) took the Field's label as its name.
describe('Field around a C18 FirstSelect (SC-2, SC-3)', () => {
  const OPTIONS = [{ value: 1, content: <span>Ana</span> }, { value: 2, content: <span>Beto</span> }]
  const renderSelect = (props = {}, field = {}) => render(
    <ThemeProvider theme={createDashboardTheme(theme)}>
      <SelectSurfaceContext.Provider value={{ fitTrigger: true }}>
        <Field label='Driver' {...field}>
          <FirstSelect placeholder='Pick one' options={OPTIONS} defaultValue={2} onChange={vi.fn()} {...props} />
        </Field>
      </SelectSurfaceContext.Provider>
    </ThemeProvider>
  )
  const trigger = () => document.querySelector('.od-first-select-trigger')

  it('SC-2: the label of the Field names the trigger, followed by its value', () => {
    renderSelect()
    expect(screen.getByRole('button', { name: 'Driver Beto' })).toBe(trigger())
  })

  it('SC-2: a required mark and the hint reach the trigger too, and the name survives a re-render of the field', () => {
    const { rerender } = renderSelect({}, { required: true, requiredLabel: 'Required', hint: 'Who takes it' })
    expect(trigger()).toHaveAccessibleName('Driver Required Beto')
    expect(trigger()).toHaveAccessibleDescription('Who takes it')
    rerender(
      <ThemeProvider theme={createDashboardTheme(theme)}>
        <SelectSurfaceContext.Provider value={{ fitTrigger: true }}>
          <Field label='Driver' required requiredLabel='Required' hint='Who takes it' error='Pick a driver'>
            <FirstSelect placeholder='Pick one' options={OPTIONS} defaultValue={2} onChange={vi.fn()} />
          </Field>
        </SelectSurfaceContext.Provider>
      </ThemeProvider>
    )
    expect(trigger()).toHaveAccessibleName('Driver Required Beto')
    expect(trigger()).toHaveAttribute('aria-invalid', 'true')
  })

  it('SC-2: a trigger that a surface already names (SelectFieldLabelContext, aria-label) keeps its own name', () => {
    renderSelect({ ariaLabel: 'Assigned driver' })
    expect(trigger()).toHaveAccessibleName('Assigned driver Beto')
  })

  it('SC-2: the other controls are linked as before (a native select still gets <label for>)', () => {
    render(<Field label='Kind'><select><option>One</option></select></Field>)
    expect(screen.getByRole('combobox', { name: 'Kind' })).toBe(document.querySelector('select'))
  })

  it('SC-3: the search field of the list keeps its own name «Search», and only the trigger takes the Field label', () => {
    renderSelect({ isShowSearchBar: true, handleChangeSearch: vi.fn(), searchValue: '' })
    fireEvent.click(trigger())
    const search = screen.getByRole('searchbox')
    expect(search).toHaveAccessibleName('Search')
    expect(search).not.toHaveAttribute('aria-labelledby')
    expect(search).not.toHaveAttribute('aria-describedby')
    expect(search).not.toHaveAttribute('aria-required')
    expect(trigger()).toHaveAccessibleName('Driver Beto')
    expect(document.querySelector('label').getAttribute('for')).toBe(trigger().id)
  })
})
