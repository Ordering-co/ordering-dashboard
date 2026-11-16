/* eslint-disable import/first */
// redesign W0-7 (T0-28b): PhoneField is the Product frame around the legacy InputPhoneNumber. The piece is the real
// one (the library's input is simulated, as in its own tests); what the tests pin is that the wrapper hands it the
// same props, ties the visible label to the number input, and links the hint, the error and the piece's own
// invalid message to it.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const seen = vi.hoisted(() => ({ props: [] }))

vi.mock('../../../../../../index', () => ({
  useConfig: () => [{ configs: { default_country_code: { value: 'us' }, validation_phone_number_lib: { value: 1 } } }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ auth: false }]
}))

vi.mock('react-phone-number-input', async () => {
  const ReactModule = await import('react')
  const PhoneInput = ReactModule.forwardRef(function ContractPhoneInput (props, ref) {
    const InputComponent = props.inputComponent || 'input'
    return (
      <div className='PhoneInput'>
        <div className='PhoneInputCountry'>
          <select aria-label='Phone country' className='PhoneInputCountrySelect' disabled={props.disabled}>
            <option value='US'>United States</option>
          </select>
        </div>
        <InputComponent
          ref={ref}
          className='PhoneInputInput'
          type='tel'
          disabled={props.disabled}
          placeholder={props.placeholder}
          value={props.value || ''}
          onChange={event => props.onChange(event.target.value)}
        />
      </div>
    )
  })
  return { default: PhoneInput }
})

// The real InputPhoneNumber, with a recorder on the props it receives.
vi.mock('../../UI/InputPhoneNumber', async importOriginal => {
  const actual = await importOriginal()
  const Recorded = props => {
    seen.props.push(props)
    return <actual.InputPhoneNumber {...props} />
  }
  return { ...actual, InputPhoneNumber: Recorded }
})

import { InputPhoneNumber } from '../../UI/InputPhoneNumber'
import { PhoneField } from '../PhoneField'

const lightTheme = createDashboardTheme(theme)
const wrap = ui => <ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>
const renderField = (props = {}) => render(wrap(<PhoneField label='Mobile phone' countryLabel='Mobile phone country' {...props} />))

const VALID = '+14155552671'
const INVALID = '+1415'

const CSS = readFileSync(path.resolve(__dirname, '../legacy-fields.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const ruleBody = selector => {
  const start = CSS.indexOf(`${selector} {`)
  return start === -1 ? '' : CSS.slice(CSS.indexOf('{', start) + 1, CSS.indexOf('}', start))
}
const mediaBody = () => {
  const start = CSS.indexOf('@media (pointer: coarse), (max-width: 767px) {')
  let depth = 0
  for (let index = CSS.indexOf('{', start); index < CSS.length; index += 1) {
    if (CSS[index] === '{') depth += 1
    if (CSS[index] === '}') depth -= 1
    if (depth === 0) return CSS.slice(CSS.indexOf('{', start) + 1, index)
  }
  return ''
}

afterEach(() => {
  seen.props.length = 0
})

describe('PhoneField · name and frame', () => {
  it('throws without a label (missing, not empty) and without a requiredLabel when required', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(wrap(<PhoneField />))).toThrow('PhoneField needs a label')
    expect(() => render(wrap(<PhoneField label={null} />))).toThrow('PhoneField needs a label')
    expect(() => render(wrap(<PhoneField label='Mobile phone' countryLabel='Country' required />))).toThrow('PhoneField needs a requiredLabel')
    spy.mockRestore()
  })

  // redesign tramo B r2 (W0-QB1-08): the name of the country selector arrives by prop, never the library's English default
  it('throws without a countryLabel (undefined or null) and paints an empty one empty', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(wrap(<PhoneField label='Mobile phone' />))).toThrow('PhoneField needs a countryLabel')
    expect(() => render(wrap(<PhoneField label='Mobile phone' countryLabel={null} />))).toThrow('PhoneField needs a countryLabel')
    spy.mockRestore()
    const { container } = render(wrap(<PhoneField label='Mobile phone' countryLabel='' />))
    expect(container.querySelector('select.PhoneInputCountrySelect')).toHaveAttribute('aria-label', '')
  })

  it('names each country selector with the prop it is given, so several phones in a form sound different', () => {
    render(wrap(<><PhoneField label='Mobile phone' countryLabel='Mobile phone country' /><PhoneField label='Backup phone' countryLabel='Backup phone country' /></>))
    expect(screen.getByRole('combobox', { name: 'Mobile phone country' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Backup phone country' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Phone country' })).toBeNull()
  })

  it('paints an empty label instead of throwing', () => {
    const { container } = renderField({ label: '' })
    expect(container.querySelector('.odc-legacy-field-label-text')).toHaveTextContent('')
  })

  it('ties the visible label to the number input, not to the country select', () => {
    renderField()
    const input = screen.getByRole('textbox', { name: 'Mobile phone' })
    expect(input).toHaveClass('PhoneInputInput')
    expect(screen.getByLabelText('Mobile phone')).toBe(input)
    expect(screen.getByRole('combobox', { name: 'Mobile phone country' })).toBeInTheDocument()
  })

  it('focuses the number input from a click on the label', async () => {
    const user = userEvent.setup()
    renderField()
    await user.click(screen.getByText('Mobile phone'))
    expect(screen.getByRole('textbox', { name: 'Mobile phone' })).toHaveFocus()
  })

  it('links the hint to the input', () => {
    renderField({ hint: 'With the country code' })
    const hint = screen.getByText('With the country code')
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', hint.id)
  })

  it('shows its own error as an alert, links it and marks the input invalid', () => {
    const { container } = renderField({ hint: 'Hint text', error: 'Enter a phone number' })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Enter a phone number')
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input.getAttribute('aria-describedby').split(' ')).toContain(alert.id)
    expect(container.querySelector('.odc-phone-field')).toHaveAttribute('data-invalid')
  })

  it('has no alert, no aria-invalid and no data-invalid without an error', () => {
    const { container } = renderField({ error: '', value: VALID })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid')
    expect(container.querySelector('[data-invalid]')).toBeNull()
  })

  it('links the legacy piece’s own invalid message and clears it when the number is valid', () => {
    const { container, rerender } = renderField({ value: INVALID })
    const own = container.querySelector('.od-phone-input-error')
    expect(own).toHaveTextContent('The Phone Number field is invalid')
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input.getAttribute('aria-describedby').split(' ')).toContain(own.id)

    rerender(wrap(<PhoneField label='Mobile phone' countryLabel='Mobile phone country' value={VALID} />))
    expect(container.querySelector('.od-phone-input-error')).toBeNull()
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid')
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-describedby')
  })

  it('marks required with aria-required and text the label carries', () => {
    const { container } = renderField({ required: true, requiredLabel: 'Required' })
    expect(screen.getByRole('textbox', { name: /Mobile phone\s+Required/ })).toHaveAttribute('aria-required', 'true')
    expect(container.querySelector('.odc-phone-field')).toHaveAttribute('data-required')
  })

  it('disables the input and the country select and marks the root', () => {
    const { container } = renderField({ disabled: true, value: INVALID })
    expect(container.querySelector('.odc-phone-field')).toHaveAttribute('data-disabled')
    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('combobox')).toBeDisabled()
    expect(container.querySelector('.od-phone-input-error')).toBeNull()
  })
})

describe('PhoneField · parity with the legacy InputPhoneNumber', () => {
  it('hands the piece the same props, with the same callbacks', () => {
    const setValue = vi.fn()
    const handleIsValid = vi.fn()
    const user = { country_phone_code: '1' }
    renderField({ value: VALID, setValue, handleIsValid, user, isUser: true, disabled: true })
    const received = seen.props.at(-1)
    expect(received.value).toBe(VALID)
    expect(received.setValue).toBe(setValue)
    expect(received.handleIsValid).toBe(handleIsValid)
    expect(received.user).toBe(user)
    expect(received.isUser).toBe(true)
    expect(received.disabled).toBe(true)
  })

  it('does not add props the legacy piece does not know', () => {
    renderField({ value: VALID, setValue: vi.fn() })
    expect(Object.keys(seen.props.at(-1)).sort()).toEqual(['disabled', 'handleIsValid', 'isUser', 'setValue', 'user', 'value'])
  })

  it('calls setValue and handleIsValid exactly as the legacy piece alone does', () => {
    const typed = '+14155552671'
    const legacySet = vi.fn()
    const legacyValid = vi.fn()
    const alone = render(wrap(<InputPhoneNumber value='' setValue={legacySet} handleIsValid={legacyValid} />))
    fireEvent.change(alone.container.querySelector('input.PhoneInputInput'), { target: { value: typed } })
    alone.rerender(wrap(<InputPhoneNumber value={typed} setValue={legacySet} handleIsValid={legacyValid} />))
    alone.unmount()

    const setValue = vi.fn()
    const handleIsValid = vi.fn()
    const wrapped = renderField({ value: '', setValue, handleIsValid })
    fireEvent.change(screen.getByRole('textbox', { name: 'Mobile phone' }), { target: { value: typed } })
    wrapped.rerender(wrap(<PhoneField label='Mobile phone' countryLabel='Mobile phone country' value={typed} setValue={setValue} handleIsValid={handleIsValid} />))

    expect(setValue.mock.calls).toEqual(legacySet.mock.calls)
    expect(setValue).toHaveBeenCalledWith(typed, true, typed)
    expect(handleIsValid.mock.calls).toEqual(legacyValid.mock.calls)
  })

  it('keeps the library’s placeholder: the wrapper adds no text of its own', () => {
    renderField()
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Phone number')
  })
})

describe('PhoneField · keyboard, focus, size and RTL', () => {
  it('reaches the country select and then the number with Tab', async () => {
    const user = userEvent.setup()
    renderField()
    await user.tab()
    expect(screen.getByRole('combobox')).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('textbox')).toHaveFocus()
  })

  it('draws country and number as one 32px field with one house focus ring', () => {
    const box = ruleBody('.odc-phone-field .od-phone-input .PhoneInput')
    expect(box).toContain('block-size: var(--od-x-control-height)')
    expect(box).toContain('border: var(--od-x-hairline) solid var(--od-x-field-border)')
    // redesign W0-7 (T0-29): the ring is on the number input itself (keyboard focus) or on the field when the country select has it
    const ring = 'outline: var(--od-focus-ring-width) solid var(--od-focus-ring-color)'
    expect(ruleBody('.odc-phone-field .od-phone-input .PhoneInput:has(.PhoneInputCountrySelect:focus-visible)')).toContain(ring)
    expect(ruleBody('.odc-phone-field .od-phone-input input.PhoneInputInput:focus-visible')).toContain(ring)
    const input = ruleBody('.odc-phone-field .od-phone-input input.PhoneInputInput')
    expect(input).toContain('border: 0')
    expect(input).toContain('block-size: 100%')
  })

  // redesign tramo B r3 (W0-QB2-02): was 44px visible; decision 12 says 32px visible with a 44px area, here on the box (an <input> takes no ::after)
  it('keeps the box 32px on a phone with a 44px area on the box, and the country select fills its half', () => {
    const phone = mediaBody()
    expect(phone).not.toMatch(/\.PhoneInput \{[^}]*block-size/)
    expect(phone).not.toMatch(/\.PhoneInputInput \{[^}]*(?<![-\w])block-size/)
    expect(phone).toMatch(/\.PhoneInput \{[^}]*position: relative/)
    expect(phone.replace(/\s+/g, ' ')).toMatch(/\.PhoneInput::after \{[^}]*content: ''; position: absolute; inset: var\(--od-x-target-inset\)/s)
    expect(phone).toMatch(/\.PhoneInputCountrySelect \{[^}]*inset-block: calc\(var\(--od-x-hairline\) \* -1\)/)
    expect(phone).toMatch(/\.PhoneInputCountry \{[^}]*min-block-size: 0/)
    expect(phone).toMatch(/\.PhoneInputInput \{[^}]*font-size: var\(--od-x-type-lead-size\)/)
  })

  // redesign tramo B r3 (W0-QB2-02): a press on the area that is outside the number and the country (the box itself) focuses the number
  it('a press on the box, outside the number and the country, focuses the number; a press on the country is left alone', () => {
    const { container } = renderField()
    const box = container.querySelector('.PhoneInput')
    expect(fireEvent.mouseDown(box)).toBe(false)
    expect(container.querySelector('input.PhoneInputInput')).toHaveFocus()
    expect(fireEvent.mouseDown(container.querySelector('select.PhoneInputCountrySelect'))).toBe(true)
  })

  it('isolates the digits left-to-right so an RTL page does not reorder them', () => {
    const input = ruleBody('.odc-phone-field .od-phone-input input.PhoneInputInput')
    expect(input).toContain('direction: ltr')
    expect(input).toContain('unicode-bidi: isolate')
    expect(ruleBody('.odc-phone-field .od-phone-input input.PhoneInputInput:placeholder-shown')).toContain('direction: inherit')
  })

  it('renders the same structure under dir="rtl"', () => {
    render(wrap(<div dir='rtl'><PhoneField label='Teléfono' countryLabel='País del teléfono' value={VALID} /></div>))
    expect(screen.getByRole('textbox', { name: 'Teléfono' })).toBeInTheDocument()
  })
})
