import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import styled, { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'
import { mergeThemePrimary } from '~/utils/bootTheme'

import { Switch, SwitchContainer, SwitchThumb } from './Switch'
import { Slider, ToggleSwitchContainer } from '../../../styles/Switch/styles'

const currentTheme = createDashboardTheme(theme)
const renderSwitch = (props, selectedTheme = currentTheme) => render(
  <ThemeProvider theme={selectedTheme}><Switch {...props} /></ThemeProvider>
)

describe('Ordering.co Switch wrapper', () => {
  it('keeps label > one native input + span and emits one boolean change without bubbling', async () => {
    const parentChange = vi.fn()
    const switchChange = vi.fn()
    const { container } = render(
      <ThemeProvider theme={currentTheme}>
        <div onChange={parentChange}>
          <Switch defaultChecked className='consumer-switch' onChange={switchChange} />
        </div>
      </ThemeProvider>
    )
    const wrapper = container.querySelector('label')
    const input = wrapper.querySelector('input')
    const thumb = wrapper.querySelector('span')

    expect(wrapper).toHaveClass('consumer-switch', 'od-switch')
    expect(wrapper.children).toHaveLength(2)
    expect(input).toBe(wrapper.firstElementChild)
    expect(thumb).toBe(wrapper.lastElementChild)
    expect(input.type).toBe('checkbox')
    expect(input).not.toHaveAttribute('id')
    await waitFor(() => expect(input).toBeChecked())

    fireEvent.click(input)
    expect(switchChange).toHaveBeenCalledTimes(1)
    expect(switchChange).toHaveBeenCalledWith(false)
    expect(parentChange).not.toHaveBeenCalled()
    expect(input).not.toBeChecked()
  })

  it('keeps notAsync externally controlled and tracks only defaultChecked updates', async () => {
    const change = vi.fn()
    const { container, rerender } = renderSwitch({ defaultChecked: false, notAsync: true, onChange: change })
    const input = container.querySelector('input')

    fireEvent.click(input)
    expect(change).toHaveBeenCalledWith(true)
    expect(input).not.toBeChecked()

    rerender(
      <ThemeProvider theme={currentTheme}>
        <Switch defaultChecked notAsync onChange={change} />
      </ThemeProvider>
    )
    await waitFor(() => expect(input).toBeChecked())
  })

  // (main): disabled now reaches the native input; the other unrelated props are still ignored
  it('disables the native input and continues ignoring unrelated props', () => {
    const ignoredClick = vi.fn()
    const { container } = renderSwitch({
      'aria-label': 'Ignored label',
      checked: true,
      defaultChecked: false,
      disabled: true,
      id: 'ignored-id',
      name: 'ignored-name',
      onClick: ignoredClick,
      type: 'radio',
      value: 'ignored-value'
    })
    const wrapper = container.querySelector('label')
    const input = container.querySelector('input')

    expect(wrapper).toHaveAttribute('disabled')
    expect(input).toBeDisabled()
    expect(input).not.toBeChecked()
    expect(input).not.toHaveAttribute('aria-label')
    expect(input).not.toHaveAttribute('id')
    expect(input).not.toHaveAttribute('name')
    expect(input).not.toHaveAttribute('value')
    expect(input.type).toBe('checkbox')
    fireEvent.click(input)
    expect(ignoredClick).not.toHaveBeenCalled()
  })

  it('resolves late theme and RTL variables on the container without child shadowing', () => {
    const rtlTheme = { ...createDashboardTheme(theme, { mode: 'dark' }), rtl: true }
    const parentTheme = mergeThemePrimary(currentTheme, '#123456')
    const ThemedContainer = styled(ToggleSwitchContainer).attrs({ theme: parentTheme })``
    const ThemedThumb = styled(Slider).attrs({ theme: rtlTheme })`
      width: 31px;
      height: 17px;
      background-color: rgb(101, 67, 33);
    `
    const { container } = render(
      <ThemeProvider theme={currentTheme}>
        <ThemedContainer><input type='checkbox' defaultChecked /><ThemedThumb data-testid='themed-thumb' /></ThemedContainer>
      </ThemeProvider>
    )
    const wrapper = container.querySelector('label')
    const themedThumb = container.querySelector('[data-testid="themed-thumb"]')

    expect(ToggleSwitchContainer).toBe(SwitchContainer)
    expect(Slider).toBe(SwitchThumb)
    expect(getComputedStyle(wrapper).getPropertyValue('--od-field-action')).toBe('#123456')
    expect(getComputedStyle(wrapper).getPropertyValue('--od-switch-checked-transform')).toBe('translateX(11px)')
    expect(getComputedStyle(themedThumb).getPropertyValue('--od-switch-thumb-own-surface-subtle')).toBe('#212224')
    expect(getComputedStyle(themedThumb).getPropertyValue('--od-switch-thumb-own-left')).toBe('auto')
    expect(getComputedStyle(themedThumb).getPropertyValue('--od-switch-thumb-own-right')).toBe('1px')
    expect(themedThumb).toHaveStyle({ width: '31px', height: '17px', backgroundColor: 'rgb(101, 67, 33)' })
  })
})
