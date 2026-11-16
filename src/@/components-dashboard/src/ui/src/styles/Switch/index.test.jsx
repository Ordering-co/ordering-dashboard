import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

import { Switch } from '.'

const renderSwitch = (props, options = {}) => render(
  <ThemeProvider theme={options.theme ?? createDashboardTheme(theme)}>
    <Switch {...props} />
  </ThemeProvider>
)

describe('Switch behavior contracts', () => {
  it('keeps its native checkbox and emits boolean changes', async () => {
    const change = vi.fn()
    const { container } = renderSwitch({ defaultChecked: true, onChange: change, className: 'consumer-switch' })
    const wrapper = container.firstElementChild
    const input = container.querySelector('input')

    expect(wrapper.tagName).toBe('LABEL')
    expect(wrapper).toHaveClass('consumer-switch')
    expect(getComputedStyle(wrapper).flexShrink).toBe('0')
    expect(input.type).toBe('checkbox')
    await waitFor(() => expect(input).toBeChecked())

    fireEvent.click(input)
    expect(change).toHaveBeenCalledWith(false)
    expect(input).not.toBeChecked()
  })

  it('keeps notAsync externally controlled and responds to defaultChecked updates', async () => {
    const change = vi.fn()
    const { container, rerender } = renderSwitch({ defaultChecked: false, notAsync: true, onChange: change })
    const input = container.querySelector('input')

    fireEvent.click(input)
    expect(change).toHaveBeenCalledWith(true)
    expect(input).not.toBeChecked()

    rerender(
      <ThemeProvider theme={createDashboardTheme(theme)}>
        <Switch defaultChecked notAsync onChange={change} />
      </ThemeProvider>
    )
    await waitFor(() => expect(input).toBeChecked())
  })

  // (main): disabled is also the native attribute of the input, so the keyboard cannot turn it either
  it('keeps disabled as the pointer guard and disables the native input', () => {
    const { container } = renderSwitch({ defaultChecked: false, disabled: true, onChange: vi.fn() })
    const wrapper = container.firstElementChild
    const input = container.querySelector('input')

    expect(wrapper).toHaveAttribute('disabled')
    expect(input).toBeDisabled()
  })

  it('names the input with ariaLabel', () => {
    const { container } = renderSwitch({ defaultChecked: false, ariaLabel: 'Enable bot', onChange: vi.fn() })
    expect(container.querySelector('input')).toHaveAttribute('aria-label', 'Enable bot')
  })

  it('stops the emitted change event from bubbling to consumer containers', () => {
    const parentChange = vi.fn()
    const switchChange = vi.fn()
    const { container } = render(
      <ThemeProvider theme={createDashboardTheme(theme)}>
        <div onChange={parentChange}>
          <Switch defaultChecked={false} onChange={switchChange} />
        </div>
      </ThemeProvider>
    )

    fireEvent.click(container.querySelector('input'))
    expect(switchChange).toHaveBeenCalledWith(true)
    expect(parentChange).not.toHaveBeenCalled()
  })
})
