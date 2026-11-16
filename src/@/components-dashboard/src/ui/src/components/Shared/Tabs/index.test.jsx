import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import styled, { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

import { Tab, Tabs } from '.'
import {
  SharedTab,
  SharedTabs,
  Tab as GenericTab,
  Tabs as GenericTabs
} from '../UI/Tabs'

const currentTheme = createDashboardTheme(theme)
const renderTabs = content => render(<ThemeProvider theme={currentTheme}>{content}</ThemeProvider>)

describe('shared bordered Tabs contracts', () => {
  it('keeps external selection and emits mouse, Enter and Space exactly once', async () => {
    const user = userEvent.setup()
    const click = vi.fn()
    renderTabs(
      <Tabs>
        <Tab active onClick={click}>Current</Tab>
        <Tab onClick={click}>Other</Tab>
      </Tabs>
    )

    const current = screen.getByRole('button', { name: 'Current' })
    const other = screen.getByRole('button', { name: 'Other' })
    expect(click).not.toHaveBeenCalled()
    expect(current).toHaveAttribute('aria-pressed', 'true')
    expect(other).toHaveAttribute('aria-pressed', 'false')
    await user.click(other)
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(click).toHaveBeenCalledTimes(3)
    expect(current).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps four independent styled identities and native polymorphic refs', () => {
    const asRef = React.createRef()
    const forwardedRef = React.createRef()
    renderTabs(
      <>
        <Tab ref={asRef} as='button' aria-label='Shared as button'>As</Tab>
        <Tab ref={forwardedRef} forwardedAs='button' aria-label='Shared forwarded'>Forwarded</Tab>
      </>
    )

    const asButton = screen.getByRole('button', { name: 'Shared as button' })
    const forwarded = screen.getByRole('button', { name: 'Shared forwarded' })
    expect(Tab).toBe(SharedTab)
    expect(Tabs).toBe(SharedTabs)
    expect(Tab.styledComponentId).not.toBe(GenericTab.styledComponentId)
    expect(Tabs.styledComponentId).not.toBe(GenericTabs.styledComponentId)
    expect(asButton.tagName).toBe('BUTTON')
    expect(asButton).not.toHaveAttribute('type')
    expect(asButton.type).toBe('submit')
    expect(asRef.current).toBe(asButton)
    expect(forwarded.tagName).toBe('DIV')
    expect(forwarded).toHaveAttribute('as', 'button')
    expect(forwardedRef.current).toBe(forwarded)
  })

  it('uses readable inactive roles and preserves active border, weight and one-sided RTL margin', () => {
    const rtlTheme = { ...createDashboardTheme(theme, { mode: 'dark' }), rtl: true }
    const RtlActive = styled(Tab).attrs({ active: true, theme: rtlTheme })`
      margin-right: 8px;
    `
    renderTabs(
      <>
        <RtlActive data-testid='rtl-active' active={false}>Active</RtlActive>
        <Tab data-testid='inactive'>Inactive</Tab>
        <div style={{ fontWeight: 600 }}><Tab data-testid='inherited-weight'>Inherited weight</Tab></div>
      </>
    )

    const active = screen.getByTestId('rtl-active')
    expect(getComputedStyle(active).getPropertyValue('--od-tab-shared-color')).toBe('#FFFFFF')
    expect(getComputedStyle(active).getPropertyValue('--od-tab-shared-border-width')).toBe('3px')
    expect(getComputedStyle(active).fontWeight).toBe('500')
    expect(active).toHaveStyle({ marginLeft: '30px', marginRight: '8px' })
    expect(active).toHaveAttribute('aria-pressed', 'true')
    expect(getComputedStyle(screen.getByTestId('inactive')).getPropertyValue('--od-tab-shared-color')).toBe('#3F4145')
    expect(getComputedStyle(screen.getByTestId('inherited-weight')).fontWeight).not.toBe('normal')
  })
})
