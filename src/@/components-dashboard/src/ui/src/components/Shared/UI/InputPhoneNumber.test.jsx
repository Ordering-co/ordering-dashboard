import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const context = vi.hoisted(() => ({
  auth: false,
  configs: {
    default_country_code: { value: 'us' },
    validation_phone_number_lib: { value: 1 }
  }
}))

vi.mock('../../../../../index', () => ({
  useConfig: () => [{ configs: context.configs }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ auth: context.auth }]
}))

vi.mock('react-phone-number-input', async () => {
  const ReactModule = await import('react')
  const PhoneInput = ReactModule.forwardRef(function ContractPhoneInput (props, ref) {
    const InputComponent = props.inputComponent || 'input'
    return (
      <div
        className='PhoneInput'
        data-default-country={props.defaultCountry}
        data-international={String(Boolean(props.international))}
        data-local={String(Boolean(props.displayInitialValueAsLocalNumber))}
      >
        <div className='PhoneInputCountry'>
          <select aria-label='Phone country' className='PhoneInputCountrySelect' disabled={props.disabled}>
            <option value='US'>United States</option>
            <option value='GB'>United Kingdom</option>
          </select>
          <span className='PhoneInputCountryIcon PhoneInputCountryIcon--border'>
            <img alt='' className='PhoneInputCountryIconImg' />
          </span>
          <span className='PhoneInputCountrySelectArrow' />
        </div>
        <InputComponent
          ref={ref}
          className='PhoneInputInput'
          type='tel'
          autoComplete='tel'
          disabled={props.disabled}
          placeholder={props.placeholder}
          value={props.value || ''}
          onChange={event => {
            const contractValue = event.target.getAttribute('data-phone-value')
            props.onChange(contractValue === '__undefined__' ? undefined : contractValue || event.target.value)
          }}
        />
      </div>
    )
  })
  return { default: PhoneInput }
})

import { InputPhoneNumber } from './InputPhoneNumber'

const lightTheme = createDashboardTheme(theme)

const renderPhone = (props = {}, customTheme = lightTheme) => render(
  <ThemeProvider theme={customTheme}>
    <InputPhoneNumber {...props} />
  </ThemeProvider>
)

afterEach(() => {
  context.auth = false
  context.configs = {
    default_country_code: { value: 'us' },
    validation_phone_number_lib: { value: 1 }
  }
})

describe('Ordering phone input owner', () => {
  it('uses the public inputComponent with a stable native Base input and exact callback payloads', () => {
    const setValue = vi.fn()
    const { rerender } = renderPhone({ setValue })
    const input = screen.getByPlaceholderText('Phone number')
    const widget = input.closest('.PhoneInput')

    expect(input.tagName).toBe('INPUT')
    expect(input).toHaveClass('od-ui', 'od-phone-input-control', 'PhoneInputInput')
    expect(input).not.toHaveAttribute('id')
    expect(input.type).toBe('tel')
    expect(input.autocomplete).toBe('tel')
    expect(widget).toHaveAttribute('data-default-country', 'US')
    expect(widget).toHaveAttribute('data-local', 'true')
    expect(widget).toHaveAttribute('data-international', 'false')

    fireEvent.change(input, { target: { value: '2' } })
    expect(setValue).toHaveBeenLastCalledWith('2', undefined, '2')
    expect(setValue.mock.lastCall).toHaveLength(3)

    fireEvent.change(input, { target: { value: '+1202' } })
    expect(setValue).toHaveBeenLastCalledWith('+1202', false, '+1202')

    rerender(
      <ThemeProvider theme={lightTheme}>
        <InputPhoneNumber setValue={setValue} value='+1202' />
      </ThemeProvider>
    )
    expect(screen.getByPlaceholderText('Phone number')).toBe(input)
    input.setAttribute('data-phone-value', '__undefined__')
    fireEvent.change(input, { target: { value: '' } })
    expect(setValue).toHaveBeenLastCalledWith(undefined, undefined, null)
    expect(setValue.mock.lastCall).toHaveLength(3)

    input.removeAttribute('data-phone-value')
    fireEvent.change(input, { target: { value: '+12025550123' } })
    expect(setValue).toHaveBeenLastCalledWith('+12025550123', true, '+12025550123')
    expect(setValue).toHaveBeenCalledTimes(4)

    rerender(
      <ThemeProvider theme={lightTheme}>
        <InputPhoneNumber setValue={setValue} value='+12025550123' />
      </ThemeProvider>
    )
    expect(screen.getByPlaceholderText('Phone number')).toBe(input)
  })

  it('preserves the UK raw-number path, isUser formatting flags and disabled native controls', () => {
    const setValue = vi.fn()
    renderPhone({
      value: '+442079460018',
      setValue,
      disabled: true,
      isUser: true
    })
    const input = screen.getByPlaceholderText('Phone number')
    const country = screen.getByRole('combobox', { name: 'Phone country' })

    expect(input).toBeDisabled()
    expect(country).toBeDisabled()
    expect(input.closest('.PhoneInput')).toHaveAttribute('data-local', 'false')
    expect(input.closest('.PhoneInput')).toHaveAttribute('data-international', 'true')

    input.setAttribute('data-phone-value', '+442079460018')
    fireEvent.change(input, { target: { value: '020 7946 0018' } })
    expect(setValue).toHaveBeenCalledWith(
      '+442079460018',
      true,
      { number: '02079460018', countryCallingCode: '+44' }
    )
  })

  it('keeps validation effects, config bypass and auth-specific error copy', async () => {
    const handleIsValid = vi.fn()
    const setValue = vi.fn()
    const { rerender } = renderPhone({ value: '+12025550123', handleIsValid, setValue })

    await waitFor(() => expect(handleIsValid).toHaveBeenCalledWith(true))
    rerender(
      <ThemeProvider theme={lightTheme}>
        <InputPhoneNumber value='' handleIsValid={handleIsValid} setValue={setValue} />
      </ThemeProvider>
    )
    expect(handleIsValid).toHaveBeenCalledTimes(1)

    rerender(
      <ThemeProvider theme={lightTheme}>
        <InputPhoneNumber value='2' handleIsValid={handleIsValid} setValue={setValue} />
      </ThemeProvider>
    )
    expect(await screen.findByText('The Phone Number field is invalid')).toBeInTheDocument()

    context.auth = true
    rerender(
      <ThemeProvider theme={lightTheme}>
        <InputPhoneNumber value='2' user={{}} setValue={setValue} />
      </ThemeProvider>
    )
    expect(await screen.findByText('The country code of the phone number is invalid')).toBeInTheDocument()

    context.configs = {
      ...context.configs,
      validation_phone_number_lib: { value: 0 }
    }
    rerender(
      <ThemeProvider theme={lightTheme}>
        <InputPhoneNumber value='2' user={{}} setValue={setValue} />
      </ThemeProvider>
    )
    expect(screen.queryByText(/phone number is invalid/i)).not.toBeInTheDocument()
    const input = screen.getByPlaceholderText('Phone number')
    fireEvent.change(input, { target: { value: '3' } })
    expect(setValue).toHaveBeenLastCalledWith('3', true, null)
  })
})
