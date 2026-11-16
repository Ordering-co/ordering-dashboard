import React, { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import styled, { ThemeProvider } from 'styled-components'
import { describe, expect, it } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

import { SideBar as OwnerSideBar } from '../UI/SideBar'
import * as ownerStyles from '../UI/sidebar-styles'
import { SideBar } from '.'
import * as legacyStyles from './styles'

const currentTheme = createDashboardTheme(theme)

describe('legacy SideBar facade', () => {
  it('reexports the owner and exact styled identities with native polymorphism', () => {
    expect(SideBar).toBe(OwnerSideBar)
    expect(legacyStyles.BarContainer).toBe(ownerStyles.BarContainer)
    expect(legacyStyles.IconButtonWrapper).toBe(ownerStyles.IconButtonWrapper)

    const ref = createRef()
    const RtlBar = styled(legacyStyles.BarContainer).attrs({
      theme: { ...currentTheme, rtl: true },
      isBorderShow: true,
      moveDistance: 36
    })``
    render(
      <ThemeProvider theme={currentTheme}>
        <RtlBar ref={ref} as='section' className='consumer-sidebar' />
        <legacyStyles.BarContainer forwardedAs='aside' data-testid='forwarded-sidebar' />
      </ThemeProvider>
    )

    expect(ref.current.tagName).toBe('SECTION')
    expect(ref.current).toHaveClass('od-ui', 'od-sidebar', 'consumer-sidebar')
    expect(getComputedStyle(ref.current).left).toBe('var(--assistant-offset,0px)')
    expect(getComputedStyle(ref.current).paddingLeft).toBe('36px')
    expect(getComputedStyle(ref.current).getPropertyValue('--od-sidebar-border')).toBe('#DEE0E3')
    expect(screen.getByTestId('forwarded-sidebar').tagName).toBe('DIV')
    expect(screen.getByTestId('forwarded-sidebar')).toHaveAttribute('as', 'aside')
  })
})
