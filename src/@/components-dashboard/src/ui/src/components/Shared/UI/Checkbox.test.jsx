import React, { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import styled, { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'
import { mergeThemePrimary } from '~/utils/bootTheme'

import { Checkbox, RadioButton } from './Checkbox'

const currentTheme = createDashboardTheme(theme)
const renderWithTheme = content => render(<ThemeProvider theme={currentTheme}>{content}</ThemeProvider>)

describe('Ordering.co Checkbox wrappers', () => {
  it('preserves one native input, ref, checked state, values, events and reset', () => {
    const ref = createRef()
    const change = vi.fn()
    renderWithTheme(
      <form aria-label='Selections'>
        <Checkbox ref={ref} aria-label='Absent' name='absent' defaultChecked onChange={change} />
        <Checkbox aria-label='Null' name='null' value={null} defaultChecked />
        <Checkbox aria-label='Default' name='default' defaultValue='default-value' defaultChecked />
        <Checkbox aria-label='Explicit' name='explicit' value='explicit-value' defaultChecked />
        <Checkbox aria-label='Disabled' name='disabled' defaultChecked disabled />
      </form>
    )

    const form = screen.getByRole('form', { name: 'Selections' })
    const absent = screen.getByLabelText('Absent')
    expect(form.querySelectorAll('input')).toHaveLength(5)
    expect(absent.tagName).toBe('INPUT')
    expect(absent.type).toBe('checkbox')
    expect(absent).toBeChecked()
    expect(ref.current).toBe(absent)
    expect(Object.fromEntries(new FormData(form).entries())).toEqual({
      absent: 'on',
      null: '',
      default: 'default-value',
      explicit: 'explicit-value'
    })

    fireEvent.click(absent)
    expect(change).toHaveBeenCalledTimes(1)
    expect(absent).not.toBeChecked()
    form.reset()
    expect(absent).toBeChecked()
    expect(screen.getByLabelText('Disabled')).toBeDisabled()
  })

  it('keeps indeterminate native and clears it on activation', () => {
    renderWithTheme(
      <Checkbox
        aria-label='Visible rows'
        defaultChecked
        ref={input => {
          if (input) input.indeterminate = true
        }}
      />
    )

    const checkbox = screen.getByLabelText('Visible rows')
    expect(checkbox.indeterminate).toBe(true)
    fireEvent.click(checkbox)
    expect(checkbox.indeterminate).toBe(false)
  })

  it('keeps the same focused native root when a missing value becomes defaultValue', () => {
    const { rerender } = renderWithTheme(<Checkbox aria-label='Dynamic value' defaultChecked />)
    const initial = screen.getByLabelText('Dynamic value')
    initial.indeterminate = true
    initial.focus()

    rerender(
      <ThemeProvider theme={currentTheme}>
        <Checkbox aria-label='Dynamic value' defaultChecked defaultValue='yes' />
      </ThemeProvider>
    )

    const updated = screen.getByLabelText('Dynamic value')
    expect(updated).toBe(initial)
    expect(updated).toBeChecked()
    expect(updated.indeterminate).toBe(true)
    expect(document.activeElement).toBe(updated)
    expect(updated.value).toBe('yes')
  })

  it('keeps checkbox and circular RadioButton independent with static and late type precedence', () => {
    const LateCheckboxType = styled(Checkbox).attrs({ type: 'radio' })``
    renderWithTheme(
      <>
        <Checkbox aria-label='Checkbox' type='radio' />
        <RadioButton aria-label='Radio appearance' type='radio' />
        <LateCheckboxType aria-label='Late type' />
      </>
    )

    expect(Checkbox.styledComponentId).not.toBe(RadioButton.styledComponentId)
    expect(screen.getByLabelText('Checkbox').type).toBe('checkbox')
    expect(screen.getByLabelText('Radio appearance').type).toBe('checkbox')
    expect(screen.getByLabelText('Radio appearance')).toHaveClass('od-radio-button')
    expect(screen.getByLabelText('Radio appearance')).not.toHaveClass('od-checkbox')
    expect(screen.getByLabelText('Late type').type).toBe('radio')
  })

  it('keeps polymorphism, caller styles and theme attrs on the final facade props', () => {
    const tenantTheme = mergeThemePrimary(currentTheme, '#F5A300')
    const ThemedCheckbox = styled(Checkbox).attrs({ theme: tenantTheme })`
      margin-left: 7px;
    `
    renderWithTheme(
      <>
        <ThemedCheckbox aria-label='Themed' className='consumer-checkbox' />
        <Checkbox as='textarea' aria-label='Checkbox as' />
        <Checkbox forwardedAs='textarea' aria-label='Checkbox forwarded' />
      </>
    )

    const themed = screen.getByLabelText('Themed')
    expect(themed).toHaveClass('consumer-checkbox')
    expect(themed).toHaveStyle({ marginLeft: '7px' })
    expect(getComputedStyle(themed).getPropertyValue('--od-field-action')).toBe('#F5A300')
    expect(screen.getByLabelText('Checkbox as').tagName).toBe('TEXTAREA')
    expect(screen.getByLabelText('Checkbox as')).toHaveAttribute('type', 'checkbox')
    expect(screen.getByLabelText('Checkbox forwarded').tagName).toBe('INPUT')
    expect(screen.getByLabelText('Checkbox forwarded')).toHaveAttribute('as', 'textarea')
  })
})
