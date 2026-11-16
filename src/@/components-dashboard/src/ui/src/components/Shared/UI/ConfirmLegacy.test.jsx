import React, { createRef } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createOrderingTheme } from '~/brand/adapter'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { LegacyConfirm } from './Confirm'

const legacyTheme = {
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
}

const darkTheme = createOrderingTheme({ ...legacyTheme, rtl: true }, { mode: 'dark' })

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

describe('Ordering legacy Confirm adapter', () => {
  it('preserves the real legacy DOM, translations, implicit buttons and scalar callbacks', async () => {
    const user = userEvent.setup()
    const onAccept = vi.fn()
    const onCancel = vi.fn()
    const onClose = vi.fn()
    const ref = createRef()

    render(
      <ThemeProvider theme={darkTheme}>
        <LegacyConfirm
          ref={ref}
          open
          title={<span>Delete tenant?</span>}
          content={['First warning', ['Nested warning'], { ignored: true }]}
          width='620px'
          onAccept={onAccept}
          onCancel={onCancel}
          onClose={onClose}
        >
          <strong>Stored data remains.</strong>
        </LegacyConfirm>
      </ThemeProvider>
    )

    const alertDialog = await screen.findByRole('alertdialog', { name: 'Delete tenant?' })
    const popup = alertDialog.querySelector(':scope > .popup-dialog')
    const title = screen.getByRole('heading', { name: 'Delete tenant?' })
    const content = screen.getByText('Stored data remains.').closest('.od-confirm-legacy-content')
    const close = screen.getByRole('button', { name: 'Close' })
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    const accept = screen.getByRole('button', { name: 'Accept' })

    expect(alertDialog).toBe(ref.current)
    expect(alertDialog).toHaveClass('popup-component', 'od-dialog-legacy-popup')
    expect(popup).toHaveClass('od-ui', 'od-confirm-legacy-dialog')
    expect(getComputedStyle(popup).getPropertyValue('--od-confirm-legacy-width')).toBe('620px')
    expect(alertDialog).toHaveAttribute('aria-labelledby', title.id)
    expect(alertDialog).toHaveAttribute('aria-describedby', content.id)
    expect(screen.getByText('First warning')).toBeInTheDocument()
    expect(screen.getByText('Nested warning')).toBeInTheDocument()
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument()
    expect(getComputedStyle(title).getPropertyValue('--od-confirm-legacy-text')).toBe('#FFFFFF')
    expect(getComputedStyle(content).getPropertyValue('--od-confirm-legacy-text')).toBe('#FFFFFF')
    expect(title).toHaveStyle({ textAlign: 'right' })
    expect(content).toHaveStyle({ textAlign: 'right' })
    expect(close.querySelector('svg')).toHaveClass('lucide-x')

    for (const button of [close, cancel, accept]) {
      expect(button).not.toHaveAttribute('type')
      expect(button.type).toBe('submit')
    }

    await user.click(cancel)
    await user.click(accept)
    await user.click(close)
    expect(onCancel).toHaveBeenCalledWith()
    expect(onAccept).toHaveBeenCalledWith()
    expect(onClose).toHaveBeenCalledWith()
  })

  it('delegates dismissal and naming to Dialog without inventing empty descriptions', async () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <ThemeProvider theme={darkTheme}>
        <LegacyConfirm
          open
          aria-label='Caller supplied confirmation'
          closeOnBackdrop={false}
          onClose={onClose}
        />
      </ThemeProvider>
    )

    const alertDialog = await screen.findByRole('alertdialog', { name: 'Caller supplied confirmation' })
    expect(alertDialog).not.toHaveAttribute('aria-labelledby')
    expect(alertDialog).not.toHaveAttribute('aria-describedby')

    await userEvent.click(document.querySelector('.od-dialog-legacy-backdrop'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape', keyCode: 27 })
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())

    rerender(
      <ThemeProvider theme={darkTheme}>
        <LegacyConfirm open title='Hidden body' content='' onClose={onClose} />
      </ThemeProvider>
    )
    expect(await screen.findByRole('alertdialog', { name: 'Hidden body' })).not.toHaveAttribute('aria-describedby')

    rerender(
      <ThemeProvider theme={darkTheme}>
        <LegacyConfirm
          open
          title='Visible title'
          aria-label='Explicit confirmation name'
          content={[[['Ignored deep string']]]}
          onClose={onClose}
        />
      </ThemeProvider>
    )
    const explicitlyNamed = await screen.findByRole('alertdialog', { name: 'Explicit confirmation name' })
    expect(explicitlyNamed).not.toHaveAttribute('aria-labelledby')
    expect(explicitlyNamed).not.toHaveAttribute('aria-describedby')
    expect(screen.getByRole('heading', { name: 'Visible title' })).toBeInTheDocument()
    expect(screen.queryByText('Ignored deep string')).not.toBeInTheDocument()
  })
})
