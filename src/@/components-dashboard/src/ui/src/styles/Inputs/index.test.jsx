import React, { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { getContrast } from 'polished'
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
} from '.'
import { resolveFieldTheme } from '../fieldsTheme'

const renderWithTheme = (content, customTheme = createDashboardTheme(theme)) => render(
  <ThemeProvider theme={customTheme}>{content}</ThemeProvider>
)

describe('Input element contracts', () => {
  it('preserves native fields, refs, attributes, validity and form serialization', () => {
    const inputRef = createRef()
    const submit = vi.fn(event => event.preventDefault())
    renderWithTheme(
      <form aria-label='Profile' onSubmit={submit}>
        <Input ref={inputRef} aria-label='Email' name='email' type='email' required defaultValue='owner@example.test' />
        <Input id='explicit-input-id' aria-label='Explicit id' />
        <Input aria-label='Count' name='count' type='number' min='1' max='9' defaultValue='3' />
        <Input aria-label='Readonly' name='readonly' readOnly defaultValue='kept' />
        <Input aria-label='Disabled' name='disabled' disabled defaultValue='excluded' />
        <TextArea aria-label='Notes' name='notes' rows='3' defaultValue='Preserved notes' />
        <button type='submit'>Submit</button>
      </form>
    )

    const form = screen.getByRole('form', { name: 'Profile' })
    const email = screen.getByLabelText('Email')
    const count = screen.getByLabelText('Count')
    const notes = screen.getByLabelText('Notes')
    expect(email.tagName).toBe('INPUT')
    expect(notes.tagName).toBe('TEXTAREA')
    expect(inputRef.current).toBe(email)
    expect(email).not.toHaveAttribute('id')
    expect(screen.getByLabelText('Explicit id')).toHaveAttribute('id', 'explicit-input-id')
    expect(email.type).toBe('email')
    expect(email.required).toBe(true)
    expect(email.checkValidity()).toBe(true)
    expect(count.min).toBe('1')
    expect(count.max).toBe('9')
    expect(notes.rows).toBe(3)

    const data = new FormData(form)
    expect(Object.fromEntries(data.entries())).toEqual({
      email: 'owner@example.test',
      count: '3',
      readonly: 'kept',
      notes: 'Preserved notes'
    })

    fireEvent.change(email, { target: { value: 'invalid' } })
    expect(email.checkValidity()).toBe(false)
    fireEvent.submit(form)
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('keeps controlled changes and public field variants intact', () => {
    const change = vi.fn()
    renderWithTheme(
      <>
        <Input aria-label='Controlled' value='fixed' onChange={change} data-contract='input' />
        <InputPrimary aria-label='Primary' data-contract='primary' />
        <InputSecundary aria-label='Secondary' data-contract='secondary' />
        <TextArea aria-label='Description' onChange={change} />
      </>
    )

    const controlled = screen.getByLabelText('Controlled')
    fireEvent.change(controlled, { target: { value: 'next' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Body' } })
    expect(change).toHaveBeenCalledTimes(2)
    expect(controlled).toHaveValue('fixed')
    expect(screen.getByLabelText('Primary')).toHaveAttribute('data-contract', 'primary')
    expect(screen.getByLabelText('Primary')).toHaveClass('od-field-primary')
    expect(screen.getByLabelText('Secondary')).toHaveAttribute('data-contract', 'secondary')
    expect(screen.getByLabelText('Secondary')).toHaveClass('od-field-secondary')
  })

  it('allows fields to shrink only inside the existing InputGroup contract', () => {
    renderWithTheme(
      <InputGroup data-testid='input-group'>
        <Input aria-label='Grouped first' w />
        <Input aria-label='Grouped second' />
      </InputGroup>
    )

    expect(getComputedStyle(screen.getByLabelText('Grouped first')).minWidth).toBe('0')
    expect(getComputedStyle(screen.getByLabelText('Grouped second')).minWidth).toBe('0')
    expect(screen.getByLabelText('Grouped first')).toHaveStyle({ width: '20%' })
  })

  it('preserves the native styled polymorphic contract through extensions', () => {
    const ExtendedInput = styled(Input).attrs({ as: 'textarea', rows: 2, title: 'Legacy attrs' })`
      letter-spacing: 2px;
    `
    const LayeredInput = styled(Input)``
    const Selector = styled.div`
      ${Input} {
        text-transform: uppercase;
      }
    `
    renderWithTheme(
      <>
        <Input as='textarea' aria-label='Input as' />
        <Input forwardedAs='textarea' aria-label='Input forwarded' />
        <LayeredInput forwardedAs='textarea' aria-label='Layered forwarded' />
        <ExtendedInput aria-label='Extended input' />
        <Selector><Input aria-label='Selected input' /></Selector>
      </>
    )

    const facades = [Input, TextArea, InputPrimary, InputSecundary, InputGroup, InputGroupLeft, InputGroupRight, InputGroupPrimary]
    expect(facades.every(component => typeof component.styledComponentId === 'string')).toBe(true)
    expect(new Set(facades.map(component => component.styledComponentId)).size).toBe(facades.length)

    expect(screen.getByLabelText('Input as').tagName).toBe('TEXTAREA')
    expect(screen.getByLabelText('Input forwarded').tagName).toBe('INPUT')
    expect(screen.getByLabelText('Input forwarded')).toHaveAttribute('as', 'textarea')
    expect(screen.getByLabelText('Layered forwarded').tagName).toBe('INPUT')
    expect(screen.getByLabelText('Layered forwarded')).toHaveAttribute('as', 'textarea')
    expect(screen.getByLabelText('Extended input').tagName).toBe('TEXTAREA')
    expect(screen.getByLabelText('Extended input')).toHaveAttribute('rows', '2')
    expect(screen.getByLabelText('Extended input')).toHaveAttribute('title', 'Legacy attrs')
    expect(screen.getByLabelText('Extended input')).toHaveStyle({ letterSpacing: '2px' })
    expect(screen.getByLabelText('Selected input')).toHaveStyle({ textTransform: 'uppercase' })
  })
})

describe('field theme resolution', () => {
  it('uses semantic Light and Dark roles, canonical motion and compact density', () => {
    const light = resolveFieldTheme(createDashboardTheme(theme))
    const dark = resolveFieldTheme(createDashboardTheme(theme, { mode: 'dark' }))

    expect(light).toMatchObject({
      surface: '#FFFFFF',
      text: '#0B0C0D',
      textSubtle: '#3F4145',
      border: '#DEE0E3',
      focus: '#266DF0',
      compactHeight: '32px',
      touchTarget: '44px',
      radiusControl: '4px',
      focusWidth: '2px',
      focusOffset: '2px',
      easing: 'cubic-bezier(0.32, 0.72, 0, 1)'
    })
    expect(dark).toMatchObject({
      surface: '#17181A',
      text: '#FFFFFF',
      textSubtle: '#989AA0',
      border: '#34363A'
    })
    expect(getContrast(light.textSubtle, light.surface)).toBeGreaterThanOrEqual(4.5)
    expect(getContrast(dark.textSubtle, dark.surface)).toBeGreaterThanOrEqual(4.5)
    expect(getContrast(light.focus, light.surface)).toBeGreaterThanOrEqual(3)
    expect(getContrast(dark.focus, dark.surface)).toBeGreaterThanOrEqual(3)
  })

  it('preserves the exact tenant action and configured primary font', () => {
    const tenantFont = { name: 'Tenant Sans', family: "'Tenant Sans', system-ui", weights: [400] }
    const dashboardTheme = createDashboardTheme({
      ...theme,
      fonts: { ...theme.fonts, primary: tenantFont }
    })
    const tenantTheme = mergeThemePrimary(dashboardTheme, '#F5A300')
    const fields = resolveFieldTheme(tenantTheme)

    expect(fields.action).toBe('#F5A300')
    expect(fields.actionContent).toBe('#F5A300')
    expect(fields.fontFamily).toBe("'Tenant Sans', system-ui")

    const invalid = mergeThemePrimary(createDashboardTheme(theme), 'tenant-value-as-supplied')
    expect(() => resolveFieldTheme(invalid)).not.toThrow()
    expect(resolveFieldTheme(invalid).action).toBe('tenant-value-as-supplied')
  })
})
