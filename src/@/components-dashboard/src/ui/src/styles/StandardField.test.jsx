import React, { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import styled, { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../index', () => ({
  useSession: () => [{}],
  useLanguage: () => [{}, (_, fallback) => fallback]
}))

vi.mock('react-popper', () => ({
  usePopper: () => ({ styles: {}, attributes: {}, update: vi.fn() })
}))

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

import { StandardField } from './StandardField'
import { Select as FirstSelect } from './Select/FirstSelect'
import { Select as LegacySelect } from './Select'
import { MultiSelect } from './MultiSelect'

describe('StandardField class contracts', () => {
  it('keeps select and multi-select hooks at full width with compact children', () => {
    render(
      <ThemeProvider theme={createDashboardTheme(theme)}>
        <StandardField>
          <div className='select' data-testid='single-select'><div data-testid='single-trigger' /></div>
          <div className='multi-select' data-testid='multi-select'><div data-testid='multi-trigger' /></div>
        </StandardField>
      </ThemeProvider>
    )

    expect(getComputedStyle(screen.getByTestId('single-select')).width).toBe('100%')
    expect(getComputedStyle(screen.getByTestId('multi-select')).width).toBe('100%')
    expect(getComputedStyle(screen.getByTestId('single-trigger')).minHeight).toBe('32px')
    expect(getComputedStyle(screen.getByTestId('multi-trigger')).minHeight).toBe('32px')
  })

  it('matches the real FirstSelect, MultiSelect and legacy Select root topology', () => {
    render(
      <ThemeProvider theme={createDashboardTheme(theme)}>
        <>
          <StandardField data-testid='first-field'>
            <FirstSelect placeholder='First control' options={[{ value: 1, content: 'One' }]} onChange={vi.fn()} />
          </StandardField>
          <StandardField data-testid='multi-field'>
            <MultiSelect placeholder='Multi control' options={[{ value: 1, content: 'One' }]} defaultValue={[]} onChange={vi.fn()} />
          </StandardField>
          <StandardField data-testid='legacy-field'>
            <LegacySelect placeholder='Legacy control' options={[{ value: 1, content: 'One' }]} onChange={vi.fn()} />
          </StandardField>
        </>
      </ThemeProvider>
    )

    const firstRoot = screen.getByTestId('first-field').querySelector('[data-slot="first-select"]')
    const multiRoot = screen.getByTestId('multi-field').querySelector('[data-slot="multi-select"]')
    const legacyTrigger = screen.getByRole('button', { name: 'Legacy control' })
    expect(firstRoot).toHaveClass('select')
    expect(multiRoot).toHaveClass('multi-select')
    expect(legacyTrigger).toHaveClass('select')
    expect(getComputedStyle(firstRoot).width).toBe('100%')
    expect(getComputedStyle(firstRoot.firstElementChild).minHeight).toBe('32px')
    expect(getComputedStyle(multiRoot).width).toBe('100%')
    expect(getComputedStyle(multiRoot.firstElementChild).minHeight).toBe('32px')
    expect(getComputedStyle(legacyTrigger).width).toBe('100%')
    expect(getComputedStyle(legacyTrigger.firstElementChild).minHeight).toBe('32px')
  })

  it('preserves styled identity, ref, class, style, polymorphism and final attrs theme', () => {
    const ref = createRef()
    const tenantTheme = createDashboardTheme({
      ...theme,
      fonts: {
        ...theme.fonts,
        primary: { name: 'Tenant Sans', family: "'Tenant Sans', system-ui", weights: [400] }
      }
    })
    const ExtendedField = styled(StandardField).attrs({
      as: 'section',
      theme: tenantTheme,
      title: 'Extended field'
    })`
      margin-left: 9px;
    `
    render(
      <ThemeProvider theme={createDashboardTheme(theme)}>
        <>
          <ExtendedField ref={ref} className='consumer-field' data-testid='extended-field'>
            <div className='select' data-testid='themed-select'><div /></div>
          </ExtendedField>
          <StandardField forwardedAs='section' data-testid='forwarded-field' />
          <StandardField
            data-testid='inline-variable-field'
            style={{ '--od-standard-field-font': 'Caller Font', paddingTop: '7px' }}
          />
        </>
      </ThemeProvider>
    )

    const extended = screen.getByTestId('extended-field')
    expect(typeof StandardField.styledComponentId).toBe('string')
    expect(ref.current).toBe(extended)
    expect(extended.tagName).toBe('SECTION')
    expect(extended).toHaveClass('od-ui', 'od-standard-field', 'consumer-field')
    expect(extended).toHaveAttribute('title', 'Extended field')
    expect(extended).toHaveStyle({ marginLeft: '9px' })
    expect(getComputedStyle(screen.getByTestId('themed-select')).fontFamily).toBe('"Tenant Sans", system-ui')
    expect(getComputedStyle(extended).getPropertyValue('--od-standard-field-touch-target')).toBe('44px')
    expect(screen.getByTestId('forwarded-field').tagName).toBe('DIV')
    expect(screen.getByTestId('forwarded-field')).toHaveAttribute('as', 'section')
    expect(getComputedStyle(screen.getByTestId('inline-variable-field')).getPropertyValue('--od-standard-field-font')).toBe('Caller Font')
    expect(screen.getByTestId('inline-variable-field')).toHaveStyle({ paddingTop: '7px' })
  })

  it('does not leak legacy hook styles outside its own scope or to similar class names', () => {
    render(
      <ThemeProvider theme={createDashboardTheme(theme)}>
        <>
          <StandardField>
            <div className='select-input' data-testid='similar-hook'><div data-testid='similar-child' /></div>
          </StandardField>
          <div className='select' data-testid='outside-hook'><div data-testid='outside-child' /></div>
        </>
      </ThemeProvider>
    )

    expect(getComputedStyle(screen.getByTestId('similar-hook')).width).toBe('')
    expect(getComputedStyle(screen.getByTestId('similar-child')).minHeight).toBe('')
    expect(getComputedStyle(screen.getByTestId('outside-hook')).width).toBe('')
    expect(getComputedStyle(screen.getByTestId('outside-child')).minHeight).toBe('')
  })
})
