/* eslint-disable import/first */
// redesign W0-7 (T0-28b): ColorField is the Product frame around the legacy ColorPicker. The picker is the real
// one (its SketchPicker is simulated); what the tests pin is that the wrapper passes it the same values and
// callbacks, never rewrites the color, and ties the visible label, the hint and the error to its trigger.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const seen = vi.hoisted(() => ({ props: [] }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback]
}))

vi.mock('react-color', () => ({
  SketchPicker: ({ color, onChange }) => (
    <div data-testid='sketch-picker' data-color={color}>
      <button type='button' onClick={() => typeof onChange === 'function' && onChange({ hex: '#aA00bB' })}>Pick mixed case</button>
    </div>
  )
}))

// The real ColorPicker, with a recorder on the props it receives.
vi.mock('../../UI/ColorPicker', async importOriginal => {
  const actual = await importOriginal()
  const Recorded = props => {
    seen.props.push(props)
    return <actual.ColorPicker {...props} />
  }
  return { ...actual, ColorPicker: Recorded }
})

import { ColorPicker } from '../../UI/ColorPicker'
import { ColorField } from '../ColorField'

const lightTheme = createDashboardTheme(theme)
const wrap = ui => <ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>
const renderField = (props = {}) => render(wrap(<ColorField label='Brand color' value='#112233' {...props} />))

const CSS = readFileSync(path.resolve(__dirname, '../legacy-fields.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const ruleBody = selector => {
  const start = CSS.indexOf(`${selector} {`)
  return start === -1 ? '' : CSS.slice(CSS.indexOf('{', start) + 1, CSS.indexOf('}', start))
}

afterEach(() => {
  seen.props.length = 0
  vi.useRealTimers()
})

describe('ColorField · name and frame', () => {
  it('throws without a label (missing, not empty) and without a requiredLabel when required', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(wrap(<ColorField value='#112233' />))).toThrow('ColorField needs a label')
    expect(() => render(wrap(<ColorField label={null} />))).toThrow('ColorField needs a label')
    expect(() => render(wrap(<ColorField label='Brand color' required />))).toThrow('ColorField needs a requiredLabel')
    spy.mockRestore()
  })

  it('paints an empty label instead of throwing', () => {
    const { container } = renderField({ label: '' })
    expect(container.querySelector('.odc-legacy-field-label-text')).toHaveTextContent('')
  })

  it('names the group and the trigger with the visible label and the value', () => {
    renderField()
    expect(screen.getByRole('group', { name: 'Brand color' })).toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: 'Brand color #112233' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    expect(screen.getByLabelText('Brand color', { selector: 'button' })).toBe(trigger)
  })

  it('opens the picker from a click on the visible label', async () => {
    const user = userEvent.setup()
    renderField()
    await user.click(screen.getByText('Brand color'))
    expect(screen.getByRole('dialog', { name: 'Select color' })).toBeInTheDocument()
  })

  it('shows the hint and links it to the trigger and the group', () => {
    renderField({ hint: 'Used on the storefront header' })
    const hint = screen.getByText('Used on the storefront header')
    const trigger = screen.getByRole('button', { name: 'Brand color #112233' })
    expect(trigger).toHaveAttribute('aria-describedby', hint.id)
    expect(screen.getByRole('group')).toHaveAttribute('aria-describedby', hint.id)
  })

  it('shows an error as an alert, linked and marked invalid in data-*', () => {
    const { container } = renderField({ hint: 'Hint text', error: 'Pick a color that is not white' })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Pick a color that is not white')
    const trigger = screen.getByRole('button', { name: 'Brand color #112233' })
    expect(trigger.getAttribute('aria-describedby').split(' ')).toContain(alert.id)
    expect(screen.getByRole('group').getAttribute('aria-describedby').split(' ')).toContain(alert.id)
    expect(container.querySelector('.odc-color-field')).toHaveAttribute('data-invalid')
    expect(container.querySelector('.odc-color-field-control')).toHaveAttribute('data-invalid')
  })

  it('has no alert and no data-invalid without an error', () => {
    const { container } = renderField({ error: '' })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(container.querySelector('[data-invalid]')).toBeNull()
  })

  it('marks required with visible text the name carries', () => {
    const { container } = renderField({ required: true, requiredLabel: 'Required' })
    expect(container.querySelector('.odc-color-field')).toHaveAttribute('data-required')
    expect(screen.getByRole('group', { name: /Brand color\s+Required/ })).toBeInTheDocument()
  })

  it('disables the trigger and marks the root', () => {
    const { container } = renderField({ disabled: true })
    expect(container.querySelector('.odc-color-field')).toHaveAttribute('data-disabled')
    expect(screen.getByRole('button', { name: 'Brand color #112233' })).toBeDisabled()
  })
})

describe('ColorField · parity with the legacy ColorPicker', () => {
  it('hands the picker the same value, disabled flag and a callback that forwards its argument', () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    renderField({ value: '#112233', onChange })
    const received = seen.props.at(-1)
    expect(received.defaultColor).toBe('#112233')
    expect(received.isDisabled).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Brand color #112233' }))
    expect(screen.getByTestId('sketch-picker')).toHaveAttribute('data-color', '#112233')
    fireEvent.click(screen.getByRole('button', { name: 'Pick mixed case' }))
    act(() => vi.advanceTimersByTime(749))
    expect(onChange).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith('#aA00bB')
  })

  it('calls onChange exactly as the legacy picker alone calls onChangeColor', () => {
    vi.useFakeTimers()
    const legacy = vi.fn()
    const { unmount } = render(wrap(<ColorPicker defaultColor='#112233' onChangeColor={legacy} />))
    fireEvent.click(screen.getByRole('button', { name: 'Select color' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pick mixed case' }))
    act(() => vi.advanceTimersByTime(750))
    unmount()

    const wrapped = vi.fn()
    renderField({ value: '#112233', onChange: wrapped })
    fireEvent.click(screen.getByRole('button', { name: 'Brand color #112233' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pick mixed case' }))
    act(() => vi.advanceTimersByTime(750))
    expect(wrapped.mock.calls).toEqual(legacy.mock.calls)
  })

  it('passes disabled as isDisabled', () => {
    renderField({ disabled: true })
    expect(seen.props.at(-1).isDisabled).toBe(true)
  })

  it('re-seeds the picker when value changes, like a changed defaultColor', () => {
    const { rerender } = renderField({ value: '#112233' })
    rerender(wrap(<ColorField label='Brand color' value='#445566' />))
    expect(seen.props.at(-1).defaultColor).toBe('#445566')
    expect(screen.getByRole('button', { name: 'Brand color #445566' })).toBeInTheDocument()
  })
})

describe('ColorField · the value is never rewritten (white label, decision 30)', () => {
  it.each([
    ['#aBc123', 'lower and upper case'],
    ['rebeccapurple', 'a name'],
    ['#FFFFFF', 'white, below contrast on white'],
    ['  #123  ', 'padding']
  ])('shows %s exactly (%s)', (value) => {
    const { container } = renderField({ value })
    expect(container.querySelector('.odc-color-field-value').textContent).toBe(value)
    expect(seen.props.at(-1).defaultColor).toBe(value)
  })

  it('shows the hex the picker emits as it is, and the swatch value text follows it', () => {
    vi.useFakeTimers()
    const { container } = renderField({ value: '#112233' })
    fireEvent.click(screen.getByRole('button', { name: 'Brand color #112233' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pick mixed case' }))
    act(() => vi.advanceTimersByTime(750))
    expect(container.querySelector('.odc-color-field-value').textContent).toBe('#aA00bB')
  })

  it('paints no value text when there is no value', () => {
    const { container } = renderField({ value: undefined })
    expect(container.querySelector('.odc-color-field-value')).toBeNull()
    expect(screen.getByRole('button', { name: 'Brand color' })).toBeInTheDocument()
  })

  it('marks the value as a mono figure', () => {
    const { container } = renderField()
    const value = container.querySelector('.odc-color-field-value')
    expect(value).toHaveClass('odc-figure', 'odc-mono')
    expect(ruleBody('.odc-color-field-value')).toContain('font-family: var(--od-font-mono)')
    expect(ruleBody('.odc-color-field-value')).toContain('unicode-bidi: isolate')
  })
})

describe('ColorField · keyboard and focus', () => {
  it('reaches the trigger with Tab, opens with Enter and Escape returns focus to it', async () => {
    const user = userEvent.setup()
    renderField()
    await user.tab()
    const trigger = screen.getByRole('button', { name: 'Brand color #112233' })
    expect(trigger).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('dialog', { name: 'Select color' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(trigger).toHaveFocus()
  })

  it('draws the house focus ring on the trigger and a 44px hit area on a phone', () => {
    expect(ruleBody('.odc-color-field .od-color-picker-trigger:focus-visible')).toContain('outline: var(--od-focus-ring-width) solid var(--od-focus-ring-color)')
    // The hit area is the trigger's ::after, taken back by the 1px border of the box; the legacy Button clips
    // its overflow, so the trigger must show it (measured live: 44px high, hit at 21px from the centre).
    expect(CSS).toMatch(/@media \(pointer: coarse\), \(max-width: 767px\) \{[\s\S]*\.odc-color-field \.od-color-picker-trigger::after \{[^}]*inset: calc\(var\(--od-x-target-inset\) - var\(--od-x-hairline\)\)/)
    expect(ruleBody('.odc-color-field .od-color-picker-trigger')).toContain('overflow: visible')
  })
})
