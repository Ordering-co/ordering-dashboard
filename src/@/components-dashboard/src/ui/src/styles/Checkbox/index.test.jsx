import React, { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import styled, { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

import { Checkbox, RadioButton } from '.'

const renderWithTheme = content => render(
  <ThemeProvider theme={createDashboardTheme(theme)}>{content}</ThemeProvider>
)

describe('Checkbox element contracts', () => {
  it('keeps the native checkbox tag, ref, values, events and form behavior', () => {
    const ref = createRef()
    const change = vi.fn()
    renderWithTheme(
      <form aria-label='Selections'>
        <Checkbox ref={ref} aria-label='Included' name='included' value='yes' defaultChecked onChange={change} />
        <Checkbox aria-label='Excluded' name='excluded' value='no' />
        <Checkbox aria-label='Disabled' name='disabled' value='no' disabled defaultChecked />
      </form>
    )

    const included = screen.getByLabelText('Included')
    expect(included.tagName).toBe('INPUT')
    expect(included.type).toBe('checkbox')
    expect(included).not.toHaveAttribute('id')
    expect(included.checked).toBe(true)
    expect(ref.current).toBe(included)
    expect(Object.fromEntries(new FormData(screen.getByRole('form', { name: 'Selections' })).entries())).toEqual({ included: 'yes' })

    fireEvent.click(included)
    expect(included.checked).toBe(false)
    expect(change).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Disabled')).toBeDisabled()
  })

  it('preserves the native indeterminate property used by bulk-selection rows', () => {
    renderWithTheme(
      <Checkbox
        aria-label='Select visible rows'
        defaultChecked
        ref={input => {
          if (input) input.indeterminate = true
        }}
      />
    )

    const checkbox = screen.getByLabelText('Select visible rows')
    expect(checkbox.indeterminate).toBe(true)
    expect(checkbox.checked).toBe(true)
    fireEvent.click(checkbox)
    expect(checkbox.indeterminate).toBe(false)
  })

  it('keeps RadioButton as the existing checkbox-shaped native contract', () => {
    const ref = createRef()
    const CheckboxSelector = styled.div`
      ${Checkbox} {
        margin-left: 9px;
      }
    `
    renderWithTheme(
      <CheckboxSelector>
        <Checkbox aria-label='Selected checkbox identity' />
        <RadioButton ref={ref} aria-label='Preview option' id='preview-option' />
      </CheckboxSelector>
    )

    const radioButton = screen.getByLabelText('Preview option')
    expect(Checkbox.styledComponentId).not.toBe(RadioButton.styledComponentId)
    expect(radioButton.tagName).toBe('INPUT')
    expect(radioButton.type).toBe('checkbox')
    expect(radioButton.id).toBe('preview-option')
    expect(ref.current).toBe(radioButton)
    expect(screen.getByLabelText('Selected checkbox identity')).toHaveStyle({ marginLeft: '9px' })
    expect(radioButton).not.toHaveStyle({ marginLeft: '9px' })
  })

  it('preserves static checkbox types, native values, reset and styled polymorphism', () => {
    const LateTypeCheckbox = styled(Checkbox).attrs({ type: 'radio' })``
    renderWithTheme(
      <form aria-label='Native checkbox values'>
        <Checkbox aria-label='Absent value' name='absent' defaultChecked type='radio' />
        <Checkbox aria-label='Null value' name='null' value={null} defaultChecked />
        <Checkbox aria-label='Default value' name='default' defaultValue='default-value' defaultChecked />
        <Checkbox aria-label='Explicit value' name='explicit' value='explicit-value' defaultChecked />
        <RadioButton aria-label='Radio contract' name='radio' defaultChecked type='radio' />
        <LateTypeCheckbox aria-label='Late type' />
        <Checkbox as='textarea' aria-label='Checkbox as' />
        <Checkbox forwardedAs='textarea' aria-label='Checkbox forwarded' />
      </form>
    )

    expect(screen.getByLabelText('Absent value').type).toBe('checkbox')
    expect(screen.getByLabelText('Radio contract').type).toBe('checkbox')
    expect(screen.getByLabelText('Late type').type).toBe('radio')
    expect(screen.getByLabelText('Checkbox as').tagName).toBe('TEXTAREA')
    expect(screen.getByLabelText('Checkbox as')).toHaveAttribute('type', 'checkbox')
    expect(screen.getByLabelText('Checkbox forwarded').tagName).toBe('INPUT')
    expect(screen.getByLabelText('Checkbox forwarded')).toHaveAttribute('as', 'textarea')
    expect(Object.fromEntries(new FormData(screen.getByRole('form', { name: 'Native checkbox values' })).entries())).toEqual({
      absent: 'on',
      null: '',
      default: 'default-value',
      explicit: 'explicit-value',
      radio: 'on'
    })

    fireEvent.click(screen.getByLabelText('Absent value'))
    screen.getByRole('form', { name: 'Native checkbox values' }).reset()
    expect(screen.getByLabelText('Absent value')).toBeChecked()
  })
})
