import React, { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import styled, { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

const popupProps = vi.hoisted(() => vi.fn())

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  Popup: ({ UIComponent, ...props }) => {
    popupProps(props)
    if (!props.open) return null
    return (
      <div role='dialog' aria-label={typeof props.title === 'string' ? props.title : undefined}>
        <UIComponent {...props} />
      </div>
    )
  }
}))

import { Modal as LegacyModal } from '../Modal'
import * as legacyStyles from '../Modal/styles'
import { Modal } from './Modal'
import * as modalStyles from './modal-styles'

const lightTheme = {
  rtl: false,
  colors: {
    backgroundPage: '#fefefe',
    headingColor: '#121212',
    borderColor: '#dddddd'
  },
  fonts: { primary: { family: 'Tenant Sans' } },
  ordering: {
    semantic: {
      action: { default: '#266df0', focus: '#266df0' },
      surface: { default: '#ffffff', subtle: '#f6f7f7' },
      text: { default: '#0b0c0d', muted: '#3f4145', subtle: '#707278' },
      border: { default: '#dee0e3', strong: '#989aa0' },
      state: { danger: { functional: '#c92929' } }
    },
    font: {
      family: { sans: 'Ordering Sans' },
      size: { productContent: '14px' }
    },
    radius: { panel: '10px', control: '4px' },
    component: {
      density: { touchTargetMinimum: '44px', iconSize: '16px' },
      focusRing: { width: '2px', offset: '2px' }
    }
  }
}

const darkTheme = {
  ...lightTheme,
  rtl: true,
  fonts: { primary: { family: 'Tenant Dark Sans' } },
  ordering: {
    ...lightTheme.ordering,
    semantic: {
      ...lightTheme.ordering.semantic,
      surface: { default: '#17181a', subtle: '#212224' },
      text: { default: '#ffffff', muted: '#c4c6ca', subtle: '#989aa0' }
    },
    radius: { ...lightTheme.ordering.radius, panel: '12px' },
    component: {
      ...lightTheme.ordering.component,
      density: { touchTargetMinimum: '48px', iconSize: '18px' }
    }
  }
}

describe('Ordering Modal L2 contract', () => {
  it('preserves dimensions, hooks and scalar actions while naming the Lucide close control', async () => {
    const user = userEvent.setup()
    const onAccept = vi.fn()
    const onCancel = vi.fn()
    const onClose = vi.fn()
    const onRemove = vi.fn()

    render(
      <ThemeProvider theme={darkTheme}>
        <Modal
          open
          title='Tenant details'
          width='640px'
          height='70vh'
          maxWidth='720px'
          padding='28px'
          overflow='scroll'
          className='consumer-modal'
          onAccept={onAccept}
          onCancel={onCancel}
          onClose={onClose}
          onRemove={onRemove}
        >
          <p>Modal body</p>
        </Modal>
      </ThemeProvider>
    )

    const dialog = document.querySelector('.popup-dialog')
    const inner = document.querySelector('.dialog-inner')
    const title = screen.getByRole('heading', { name: 'Tenant details' })
    const close = screen.getByRole('button', { name: 'Close' })

    expect(screen.getByRole('dialog', { name: 'Tenant details' })).toBeInTheDocument()
    expect(dialog).toHaveClass('od-ui', 'od-modal-dialog', 'consumer-modal')
    expect(inner).toHaveClass('od-ui', 'od-modal-inner')
    expect(inner.parentElement).toBe(dialog)
    expect(getComputedStyle(dialog).getPropertyValue('--od-modal-width')).toBe('640px')
    expect(getComputedStyle(dialog).getPropertyValue('--od-modal-height')).toBe('70vh')
    expect(getComputedStyle(dialog).getPropertyValue('--od-modal-dialog-surface')).toBe('#17181a')
    expect(dialog).toHaveStyle({ maxWidth: '720px' })
    expect(getComputedStyle(inner).getPropertyValue('--od-modal-padding')).toBe('28px')
    expect(getComputedStyle(inner).getPropertyValue('--od-modal-overflow')).toBe('scroll')
    expect(getComputedStyle(inner).getPropertyValue('--od-modal-inner-surface')).toBe('#17181a')
    expect(getComputedStyle(title).getPropertyValue('--od-modal-text')).toBe('#ffffff')
    expect(getComputedStyle(title).getPropertyValue('--od-modal-font')).toBe('Tenant Dark Sans')
    expect(title).toHaveStyle({ textAlign: 'right', paddingRight: '10px', paddingLeft: '0px' })
    expect(close).toHaveAttribute('type', 'button')
    expect(close.querySelector('svg')).toHaveClass('lucide-x')

    await user.click(close)
    expect(onRemove).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()

    const accept = screen.getByRole('button', { name: 'Accept' })
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    expect(accept).not.toHaveAttribute('type')
    expect(cancel).not.toHaveAttribute('type')
    await user.click(accept)
    await user.click(cancel)
    expect(onAccept).toHaveBeenCalledWith()
    expect(onCancel).toHaveBeenCalledWith()
  })

  it('keeps transparent and hidden-close states and delegates Escape and autofocus to Popup', () => {
    const onClose = vi.fn()

    render(
      <ThemeProvider theme={lightTheme}>
        <Modal
          open
          title='Autofocus modal'
          isTransparent
          hideCloseDefault
          onClose={onClose}
        >
          <input aria-label='First field' autoFocus />
        </Modal>
      </ThemeProvider>
    )

    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    expect(getComputedStyle(document.querySelector('.popup-dialog')).getPropertyValue('--od-modal-dialog-surface')).toBe('transparent')
    expect(getComputedStyle(document.querySelector('.dialog-inner')).getPropertyValue('--od-modal-inner-surface')).toBe('transparent')
    expect(screen.getByLabelText('First field')).toHaveFocus()
    expect(popupProps).toHaveBeenLastCalledWith(expect.not.objectContaining({ initialFocus: expect.anything() }))

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('keeps native styled identities, polymorphism and final attrs theme precedence', () => {
    const dialogRef = createRef()
    const AttrDialog = styled(modalStyles.ModalDialog).attrs({
      width: '41rem',
      theme: darkTheme
    })``
    const AttrTitle = styled(modalStyles.ModalTitle).attrs({ theme: darkTheme })``

    render(
      <ThemeProvider theme={lightTheme}>
        <AttrDialog
          ref={dialogRef}
          as='section'
          className='derived-dialog'
          style={{ '--od-modal-width': '47rem' }}
        />
        <modalStyles.ModalDialog forwardedAs='section' data-testid='forwarded-dialog' />
        <AttrTitle>Derived title</AttrTitle>
      </ThemeProvider>
    )

    expect(dialogRef.current.tagName).toBe('SECTION')
    expect(dialogRef.current).toHaveClass('od-ui', 'od-modal-dialog', 'derived-dialog')
    expect(getComputedStyle(dialogRef.current).getPropertyValue('--od-modal-width')).toBe('47rem')
    expect(getComputedStyle(dialogRef.current).getPropertyValue('--od-modal-radius-panel')).toBe('12px')
    expect(screen.getByTestId('forwarded-dialog').tagName).toBe('DIV')
    expect(screen.getByTestId('forwarded-dialog')).toHaveAttribute('as', 'section')
    expect(getComputedStyle(screen.getByText('Derived title')).getPropertyValue('--od-modal-text')).toBe('#ffffff')

    expect(LegacyModal).toBe(Modal)
    expect(legacyStyles.Container).toBe(modalStyles.Container)
    expect(legacyStyles.ModalDialog).toBe(modalStyles.ModalDialog)
    expect(legacyStyles.ModalDialogInnerContainer).toBe(modalStyles.ModalDialogInnerContainer)
    expect(legacyStyles.ModalActions).toBe(modalStyles.ModalActions)
    expect(legacyStyles.ModalHeader).toBe(modalStyles.ModalHeader)
    expect(legacyStyles.ModalTitle).toBe(modalStyles.ModalTitle)
    expect(legacyStyles.ModalOrderTypes).toBe(modalStyles.ModalOrderTypes)
    expect(legacyStyles.ModalIcon).toBe(modalStyles.ModalIcon)
  })
})
