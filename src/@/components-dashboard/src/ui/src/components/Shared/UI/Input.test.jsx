import React, { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import styled, { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'
import { mergeThemePrimary } from '~/utils/bootTheme'

import {
  Input,
  InputGroup,
  InputGroupLeft,
  InputGroupPrimary,
  InputGroupRight,
  InputPrimary,
  InputSecundary,
  TextArea
} from './Input'

const currentTheme = createDashboardTheme(theme)
const renderWithTheme = content => render(
  <ThemeProvider theme={currentTheme}>{content}</ThemeProvider>
)

describe('Ordering.co Input wrapper', () => {
  it('keeps the native input contract through Base UI without adding wrapper elements', () => {
    const inputRef = createRef()
    const change = vi.fn()
    const submit = vi.fn(event => event.preventDefault())
    renderWithTheme(
      <form aria-label='Account' onSubmit={submit}>
        <Input
          ref={inputRef}
          aria-label='Email'
          name='email'
          type='email'
          required
          defaultValue='owner@example.test'
          onChange={change}
          data-consumer='kept'
        />
        <Input aria-label='Readonly' name='readonly' readOnly defaultValue='kept' />
        <Input aria-label='Disabled' name='disabled' disabled defaultValue='excluded' />
        <button type='submit'>Submit</button>
      </form>
    )

    const form = screen.getByRole('form', { name: 'Account' })
    const email = screen.getByLabelText('Email')
    expect(email.tagName).toBe('INPUT')
    expect(email.parentElement).toBe(form)
    expect(email).toHaveAttribute('data-slot', 'input')
    expect(email).toHaveAttribute('data-consumer', 'kept')
    expect(inputRef.current).toBe(email)
    expect(email.type).toBe('email')
    expect(email.required).toBe(true)
    expect(email.checkValidity()).toBe(true)
    expect(Object.fromEntries(new FormData(form).entries())).toEqual({
      email: 'owner@example.test',
      readonly: 'kept'
    })

    fireEvent.change(email, { target: { value: 'invalid' } })
    expect(change).toHaveBeenCalledTimes(1)
    expect(email.checkValidity()).toBe(false)
    form.reset()
    expect(email).toHaveValue('owner@example.test')
    fireEvent.submit(form)
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('preserves controlled values, textarea semantics, classes, styles and polymorphism', () => {
    const textareaRef = createRef()
    const change = vi.fn()
    renderWithTheme(
      <>
        <Input aria-label='Controlled' value='fixed' onChange={change} className='consumer-class' style={{ letterSpacing: '2px' }} />
        <TextArea ref={textareaRef} aria-label='Notes' name='notes' rows={3} defaultValue='Body' onChange={change} />
        <Input as='textarea' aria-label='Input as textarea' rows={2} />
        <Input forwardedAs='textarea' aria-label='Input forwarded' />
      </>
    )

    const controlled = screen.getByLabelText('Controlled')
    const notes = screen.getByLabelText('Notes')
    fireEvent.change(controlled, { target: { value: 'next' } })
    fireEvent.change(notes, { target: { value: 'Changed' } })
    expect(change).toHaveBeenCalledTimes(2)
    expect(controlled).toHaveValue('fixed')
    expect(controlled).toHaveClass('consumer-class', 'od-field-input')
    expect(controlled).toHaveStyle({ letterSpacing: '2px' })
    expect(notes.tagName).toBe('TEXTAREA')
    expect(notes.rows).toBe(3)
    expect(textareaRef.current).toBe(notes)
    expect(screen.getByLabelText('Input as textarea').tagName).toBe('TEXTAREA')
    expect(screen.getByLabelText('Input forwarded').tagName).toBe('INPUT')
    expect(screen.getByLabelText('Input forwarded')).toHaveAttribute('as', 'textarea')
  })

  it('resolves variables from final attrs props while caller inline variables retain precedence', () => {
    const attrsTheme = mergeThemePrimary(createDashboardTheme(theme, { mode: 'dark' }), '#F5A300')
    const ThemeAttrs = styled(Input).attrs({ theme: attrsTheme })``
    renderWithTheme(
      <>
        <ThemeAttrs aria-label='Attrs theme' />
        <Input aria-label='Caller variable' style={{ '--od-field-surface': '#123456' }} />
      </>
    )

    const attrsInput = screen.getByLabelText('Attrs theme')
    expect(getComputedStyle(attrsInput).getPropertyValue('--od-field-surface')).toBe('#17181A')
    expect(getComputedStyle(attrsInput).getPropertyValue('--od-field-action')).toBe('#F5A300')
    expect(getComputedStyle(screen.getByLabelText('Caller variable')).getPropertyValue('--od-field-surface')).toBe('#123456')
  })

  it('exposes distinct variants and noninteractive groups without changing their element shape', () => {
    const rtlTheme = { ...currentTheme, rtl: true }
    const groupTheme = mergeThemePrimary(currentTheme, '#123456')
    const RtlRightGroup = styled(InputGroupRight).attrs({ theme: rtlTheme })``
    const ThemedPrimaryGroup = styled(InputGroupPrimary).attrs({ theme: groupTheme })``
    const ExtendedPrimary = styled(InputPrimary)`
      color: rgb(1, 2, 3);
      margin-left: 9px;
    `
    renderWithTheme(
      <>
        <InputPrimary aria-label='Primary' />
        <InputSecundary aria-label='Secondary' />
        <ExtendedPrimary aria-label='Extended primary' />
        <InputGroup data-testid='group'><Input aria-label='Grouped' /></InputGroup>
        <InputGroupPrimary data-testid='primary-group'><InputGroupLeft>Left</InputGroupLeft></InputGroupPrimary>
        <ThemedPrimaryGroup data-testid='themed-primary-group'><InputGroupLeft data-testid='themed-left'>Themed left</InputGroupLeft></ThemedPrimaryGroup>
        <InputGroupRight data-testid='right-group'>Right</InputGroupRight>
        <RtlRightGroup data-testid='rtl-right-group'>RTL right</RtlRightGroup>
      </>
    )

    expect(screen.getByLabelText('Primary')).toHaveClass('od-field-primary')
    expect(screen.getByLabelText('Secondary')).toHaveClass('od-field-secondary')
    expect(screen.getByTestId('group').tagName).toBe('DIV')
    expect(screen.getByTestId('group')).not.toHaveAttribute('role')
    expect(screen.getByLabelText('Grouped').parentElement).toBe(screen.getByTestId('group'))
    expect(screen.getByTestId('primary-group')).toHaveClass('od-input-group-primary')
    expect(screen.getByTestId('themed-left')).toHaveStyle({ color: '#123456', borderColor: '#123456' })
    expect(screen.getByTestId('right-group')).toHaveClass('od-input-group-left', 'od-input-group-right')
    expect(screen.getByTestId('rtl-right-group')).toHaveClass('od-input-group-right')
    expect(screen.getByTestId('rtl-right-group')).toHaveStyle({ borderLeftWidth: '1px', borderRightWidth: '0' })
    expect(screen.getByLabelText('Extended primary')).toHaveStyle({ color: 'rgb(1, 2, 3)', marginLeft: '9px' })
  })
})
