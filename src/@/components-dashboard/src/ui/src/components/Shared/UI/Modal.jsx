import React from 'react'

import { Popup, useLanguage } from '../../../../../index'
import { X } from '../Icon'
import { Button, IconButton } from './Button'
import {
  ModalActions,
  ModalDialog,
  ModalDialogInnerContainer,
  ModalHeader,
  ModalIcon,
  ModalTitle
} from './modal-styles'
import './modal.css'

const ModalUI = props => {
  const {
    title,
    children,
    onAccept,
    onCancel,
    onClose,
    onRemove,
    acceptText,
    cancelText,
    isTransparent,
    hideCloseDefault,
    className
  } = props
  const [, t] = useLanguage()

  const handleClose = () => {
    if (onRemove) onRemove()
    else onClose()
  }

  return (
    <ModalDialog
      className={`popup-dialog ${className || ''}`}
      height={props.height}
      width={props.width}
      maxWidth={props.maxWidth}
      $anchorTop={props.anchorTop}
      isTransparent={isTransparent}
    >
      <ModalDialogInnerContainer
        padding={props.padding}
        isTransparent={isTransparent}
        overflow={props.overflow}
        className='dialog-inner'
      >
        {!hideCloseDefault && (
          <ModalIcon className='modal-close-icon'>
            <IconButton
              type='button'
              compatibility='legacy'
              color='black'
              aria-label={t('CLOSE', 'Close')}
              onClick={handleClose}
            >
              <X />
            </IconButton>
          </ModalIcon>
        )}
        <ModalHeader>
          {title && <ModalTitle>{title}</ModalTitle>}
        </ModalHeader>
        {children}
        {(onCancel || onAccept) && (
          <ModalActions>
            {onAccept && (
              <Button
                compatibility='legacy'
                className='od-button-legacy'
                color='darkBlue'
                onClick={() => onAccept()}
              >
                {acceptText || t('ACCEPT', 'Accept')}
              </Button>
            )}
            {onCancel && (
              <Button
                compatibility='legacy'
                className='od-button-legacy'
                color='primary'
                onClick={() => onCancel()}
              >
                {cancelText || t('CANCEL', 'Cancel')}
              </Button>
            )}
          </ModalActions>
        )}
      </ModalDialogInnerContainer>
    </ModalDialog>
  )
}

export const Modal = props => (
  <Popup {...props} UIComponent={ModalUI} />
)
