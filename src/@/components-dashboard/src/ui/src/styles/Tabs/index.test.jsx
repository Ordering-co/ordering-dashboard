import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import styled, { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'
import { mergeThemePrimary } from '~/utils/bootTheme'

import { Tab, Tabs } from '.'
import { Tab as SharedOwnerTab, Tabs as SharedOwnerTabs } from '../../components/Shared/UI/Tabs'

const currentTheme = createDashboardTheme(theme)
const renderTabs = content => render(<ThemeProvider theme={currentTheme}>{content}</ThemeProvider>)

describe('generic Tabs contracts', () => {
  it('adds button keyboard behavior without selecting or calling back on mount', async () => {
    const user = userEvent.setup()
    const click = vi.fn()
    renderTabs(
      <Tabs>
        <Tab active onClick={click}>Active</Tab>
        <Tab onClick={click}>Inactive</Tab>
      </Tabs>
    )

    const active = screen.getByRole('button', { name: 'Active' })
    const inactive = screen.getByRole('button', { name: 'Inactive' })
    expect(click).not.toHaveBeenCalled()
    expect(active.tagName).toBe('DIV')
    expect(active).toHaveAttribute('aria-pressed', 'true')
    expect(inactive).toHaveAttribute('aria-pressed', 'false')
    await user.click(inactive)
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(click).toHaveBeenCalledTimes(3)
  })

  it('keeps disabled cosmetic on the default div while as=button remains native', async () => {
    const user = userEvent.setup()
    const cosmeticClick = vi.fn()
    const nativeClick = vi.fn()
    renderTabs(
      <>
        <Tab disabled onClick={cosmeticClick}>Cosmetic disabled</Tab>
        <Tab as='button' disabled onClick={nativeClick}>Native disabled</Tab>
      </>
    )

    const cosmetic = screen.getByRole('button', { name: 'Cosmetic disabled' })
    const native = screen.getByRole('button', { name: 'Native disabled' })
    expect(cosmetic.tagName).toBe('DIV')
    expect(cosmetic).toHaveAttribute('disabled')
    expect(cosmetic).not.toHaveAttribute('aria-disabled')
    await user.click(cosmetic)
    cosmetic.focus()
    fireEvent.keyDown(cosmetic, { key: 'Enter' })
    expect(cosmeticClick).toHaveBeenCalledTimes(2)
    expect(native.tagName).toBe('BUTTON')
    expect(native).toBeDisabled()
    expect(native).not.toHaveAttribute('type')
    expect(native.type).toBe('submit')
    await user.click(native)
    expect(nativeClick).not.toHaveBeenCalled()
  })

  it('preserves refs, as, forwardedAs and explicit ARIA on the styled identity', () => {
    const asRef = React.createRef()
    const forwardedRef = React.createRef()
    renderTabs(
      <>
        <Tab ref={asRef} as='button' aria-label='As button' aria-pressed='false'>As</Tab>
        <Tab ref={forwardedRef} forwardedAs='button' aria-label='Forwarded div'>Forwarded</Tab>
      </>
    )

    const asButton = screen.getByRole('button', { name: 'As button' })
    const forwarded = screen.getByRole('button', { name: 'Forwarded div' })
    expect(Tab).toBe(SharedOwnerTab)
    expect(Tabs).toBe(SharedOwnerTabs)
    expect(typeof Tab.styledComponentId).toBe('string')
    expect(typeof Tabs.styledComponentId).toBe('string')
    expect(asButton.tagName).toBe('BUTTON')
    expect(asButton).toHaveAttribute('aria-pressed', 'false')
    expect(asRef.current).toBe(asButton)
    expect(forwarded.tagName).toBe('DIV')
    expect(forwarded).toHaveAttribute('as', 'button')
    expect(forwardedRef.current).toBe(forwarded)
  })

  it('keeps primary as tenant color only and resolves derived attrs from final props', () => {
    const tenantTheme = mergeThemePrimary(currentTheme, '#123456')
    const oldDefaultTheme = mergeThemePrimary(currentTheme, theme.colors.primary)
    const legacyTheme = {
      colors: {
        backgroundPage: '#FFFFFF',
        borderColor: '#DEE0E3',
        disabled: '#777777',
        headingColor: '#111111',
        primary: '#654321',
        secundary: '#F6F7F7',
        secundaryContrast: '#555555'
      }
    }
    const PrimaryTabs = styled(Tabs).attrs({ theme: tenantTheme, variant: 'primary' })``
    const OldDefaultTabs = styled(Tabs).attrs({ theme: oldDefaultTheme, variant: 'primary' })``
    const LegacyTabs = styled(Tabs).attrs({ theme: legacyTheme, variant: 'primary' })``
    const ActiveTab = styled(Tab).attrs({ active: true, theme: tenantTheme })`
      margin-left: 9px;
    `
    renderTabs(
      <>
        <PrimaryTabs data-testid='primary-tabs' variant='secondary'>
          <ActiveTab data-testid='active-tab' active={false}>Final active</ActiveTab>
          <Tab data-testid='inactive-tab'>Inactive</Tab>
        </PrimaryTabs>
        <OldDefaultTabs data-testid='old-default-tabs' />
        <LegacyTabs data-testid='legacy-tabs' />
      </>
    )

    const tabs = screen.getByTestId('primary-tabs')
    const active = screen.getByTestId('active-tab')
    expect(getComputedStyle(tabs).getPropertyValue('--od-tabs-generic-color')).toBe('#123456')
    expect(getComputedStyle(screen.getByTestId('old-default-tabs')).getPropertyValue('--od-tabs-generic-color')).toBe(theme.colors.primary)
    expect(getComputedStyle(screen.getByTestId('legacy-tabs')).getPropertyValue('--od-tabs-generic-color')).toBe('#654321')
    expect(tabs).not.toHaveStyle({ background: '#123456' })
    expect(getComputedStyle(active).getPropertyValue('--od-tab-generic-color')).toBe('inherit')
    expect(active).toHaveAttribute('aria-pressed', 'true')
    expect(active).toHaveStyle({ marginLeft: '9px' })
    expect(getComputedStyle(screen.getByTestId('inactive-tab')).getPropertyValue('--od-tab-generic-color')).toBe('#3F4145')
  })
})
