import React, { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import styled, { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createOrderingTheme } from '~/brand/adapter'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { LegacyConfirm } from '../UI/Confirm'
import * as ownerStyles from '../UI/confirm-legacy-styles'
import { Alert, Confirm } from '.'
import * as legacyStyles from './styles'

const lightTheme = createOrderingTheme({
  colors: {
    backgroundPage: '#ffffff',
    borderColor: '#dddddd',
    disabled: '#aaaaaa',
    headingColor: '#111111',
    primary: '#266df0',
    primaryContrast: '#ffffff',
    secundary: '#f6f7f7',
    secundaryContrast: '#3f4145'
  },
  fonts: { primary: { family: 'Tenant Sans' } }
})
const darkTheme = createOrderingTheme({ ...lightTheme, rtl: true }, { mode: 'dark' })

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

describe('legacy Confirm facade', () => {
  it('keeps the ThemeProvider guard and exact Alert alias', async () => {
    const { container, rerender } = render(<Confirm open title='No theme' onClose={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
    expect(Alert).toBe(Confirm)

    rerender(
      <ThemeProvider theme={lightTheme}>
        <Confirm open title='With theme' onClose={vi.fn()} />
      </ThemeProvider>
    )
    expect(await screen.findByRole('alertdialog', { name: 'With theme' })).toBeInTheDocument()
    expect(Confirm).not.toBe(LegacyConfirm)
  })

  it('reexports the real styled identities with native polymorphism and final attrs', () => {
    const ref = createRef()
    const AttrDialog = styled(legacyStyles.PopupDialog).attrs({
      theme: darkTheme,
      width: '61%'
    })``
    const RtlActions = styled(legacyStyles.PopupActions).attrs({ theme: darkTheme })``

    render(
      <ThemeProvider theme={lightTheme}>
        <AttrDialog
          ref={ref}
          as='section'
          className='consumer-confirm'
          style={{ '--od-confirm-legacy-width': '63%' }}
        />
        <legacyStyles.PopupDialog forwardedAs='article' data-testid='forwarded-confirm' />
        <RtlActions>
          <button>First</button>
          <button>Last</button>
        </RtlActions>
      </ThemeProvider>
    )

    expect(ref.current.tagName).toBe('SECTION')
    expect(ref.current).toHaveClass('od-ui', 'od-confirm-legacy-dialog', 'consumer-confirm')
    expect(getComputedStyle(ref.current).getPropertyValue('--od-confirm-legacy-width')).toBe('63%')
    expect(getComputedStyle(ref.current).getPropertyValue('--od-confirm-legacy-text')).toBe('#FFFFFF')
    expect(screen.getByTestId('forwarded-confirm').tagName).toBe('DIV')
    expect(screen.getByTestId('forwarded-confirm')).toHaveAttribute('as', 'article')
    expect(screen.getByRole('button', { name: 'First' })).toHaveStyle({ marginLeft: '25px', marginRight: '0px' })
    expect(screen.getByRole('button', { name: 'Last' })).toHaveStyle({ marginLeft: '0px' })

    expect(legacyStyles.PopupWrap).toBe(ownerStyles.PopupWrap)
    expect(legacyStyles.PopupDialog).toBe(ownerStyles.PopupDialog)
    expect(legacyStyles.PopupActions).toBe(ownerStyles.PopupActions)
    expect(legacyStyles.PopupTitle).toBe(ownerStyles.PopupTitle)
    expect(legacyStyles.PopupContent).toBe(ownerStyles.PopupContent)
    expect(legacyStyles.PopupIcon).toBe(ownerStyles.PopupIcon)
  })
})
