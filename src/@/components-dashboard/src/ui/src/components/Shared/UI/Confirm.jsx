// Adapted from shadcn/ui Base UI alert-dialog, commit
// 7c9eaba1c0a6404c990c144a654792e3313c650d (MIT).
import React, { useEffect, useId, useRef } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'

import { useLanguage } from '../../../../../index'
import { getApiMessageDefault, translateApiMessage } from '../../../../../utils/translateApiMessage'
import { X } from '../Icon'
import { Button, IconButton } from './Button'
import {
  PopupActions,
  PopupContent,
  PopupDialog,
  PopupIcon,
  PopupTitle
} from './confirm-legacy-styles'
import { Dialog } from './Dialog'
import { CONFIRM_DIALOG_LAYER, useDialogLayer } from './dialog-layer'
import { useOrderingUI } from './theme'
import './confirm-legacy.css'
import './dialog.css'

const combineRefs = (forwardedRef, localRef) => node => {
  localRef.current = node
  if (typeof forwardedRef === 'function') forwardedRef(node)
  else if (forwardedRef) forwardedRef.current = node
}

export const Confirm = React.forwardRef(function OrderingConfirm ({
  title,
  children,
  content,
  onAccept,
  onCancel,
  onClose,
  acceptText,
  cancelText,
  width,
  closeOnBackdrop = true,
  open = false
}, forwardedRef) {
  const [, t] = useLanguage()
  const { style, dir } = useOrderingUI()
  const popupRef = useRef(null)
  const closeRef = useRef(null)
  const openerRef = useRef(null)
  const previousOpenRef = useRef(false)
  const lastFocusedRef = useRef(null)
  const layer = useDialogLayer({ open, kind: CONFIRM_DIALOG_LAYER, popupRef, lastFocusedRef })

  if (open && !previousOpenRef.current && typeof document !== 'undefined') {
    openerRef.current = document.activeElement
  }

  useEffect(() => {
    previousOpenRef.current = open
  }, [open])

  // redesign W0-2d (T0-7): the shared helper. Anything that is not a string comes back as it came, and the
  // text by default for an unknown key is the table (API_MESSAGE_DEFAULTS, W0-2 r2).
  const translateAlertMessage = message => {
    if (typeof message !== 'string') return message
    return translateApiMessage(t, message, message, getApiMessageDefault(message))
  }

  const handleOpenChange = (nextOpen, eventDetails) => {
    if (nextOpen || !open) return
    if (!layer.isActive || eventDetails.reason !== 'escape-key' || !onClose) {
      eventDetails.cancel()
      return
    }
    onClose()
  }

  const handleBackdropClick = () => {
    if (layer.isActive && closeOnBackdrop) onClose?.()
  }

  const finalFocus = () => layer.resolveFinalFocus(openerRef.current)

  if (!layer.ready) return null

  return (
    <DialogPrimitive.Root open={open} modal={layer.isActive} disablePointerDismissal onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal
        container={layer.host}
        className='od-ui od-dialog-confirm-portal'
        style={{ ...style, '--od-dialog-layer': layer.order }}
        dir={dir}
      >
        <DialogPrimitive.Backdrop
          className='od-dialog-backdrop'
          onClick={handleBackdropClick}
        />
        <div
          className='od-dialog-positioner od-flex od-items-center od-justify-center'
          onClick={event => {
            if (event.target === event.currentTarget) handleBackdropClick()
          }}
        >
          <DialogPrimitive.Popup
            ref={combineRefs(forwardedRef, popupRef)}
            className='od-ui od-dialog-popup'
            style={{ ...style, width: width || '70%', maxWidth: 'calc(100vw - 32px)' }}
            dir={dir}
            initialFocus={layer.isActive ? closeRef : false}
            finalFocus={finalFocus}
            role='alertdialog'
            onFocusCapture={event => {
              lastFocusedRef.current = event.target
            }}
          >
            <Button
              ref={closeRef}
              type='button'
              outline
              className='od-dialog-close'
              aria-label={t('CLOSE', 'Close')}
              onClick={() => onClose?.()}
            >
              <X />
            </Button>

            {title && (
              <DialogPrimitive.Title className='od-dialog-title'>
                {title}
              </DialogPrimitive.Title>
            )}

            <DialogPrimitive.Description
              className='od-dialog-content'
              render={<div />}
            >
              {content && typeof content === 'string' && translateAlertMessage(content)}
              {content && Array.isArray(content) && (
                <ul>
                  {content.map((item, index) => (
                    <React.Fragment key={index}>
                      {Array.isArray(item)
                        ? item.map((error, errorIndex) => (
                          typeof error === 'string' && (
                            <li key={errorIndex}>{translateAlertMessage(error)}</li>
                          )
                        ))
                        : (typeof item === 'string' && <li>{translateAlertMessage(item)}</li>)}
                    </React.Fragment>
                  ))}
                </ul>
              )}
              {children}
            </DialogPrimitive.Description>

            {(onCancel || onAccept || onClose) && (
              <div className='od-dialog-actions od-flex od-items-center od-justify-between od-gap-2'>
                {onCancel && (
                  <Button type='button' outline onClick={() => onCancel()}>
                    {cancelText || t('CANCEL', 'Cancel')}
                  </Button>
                )}
                {onAccept && (
                  <Button type='button' color='primary' onClick={() => onAccept()}>
                    {acceptText || t('ACCEPT', 'Accept')}
                  </Button>
                )}
              </div>
            )}
          </DialogPrimitive.Popup>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
})

Confirm.displayName = 'OrderingConfirm'

export const Alert = Confirm

const hasTranslatedContent = content => {
  if (typeof content === 'string') return Boolean(content)
  if (!Array.isArray(content)) return false
  return content.some(item => (
    (typeof item === 'string' && Boolean(item)) ||
    (Array.isArray(item) && item.some(value => typeof value === 'string' && Boolean(value)))
  ))
}

export const LegacyConfirm = React.forwardRef(function OrderingLegacyConfirm (props, forwardedRef) {
  const {
    title,
    children,
    content,
    onAccept,
    onCancel,
    onClose,
    acceptText,
    cancelText
  } = props
  const [, t] = useLanguage()
  const generatedTitleId = useId()
  const generatedContentId = useId()
  const titleId = props['aria-labelledby'] ?? (!props['aria-label'] && title ? generatedTitleId : undefined)
  const hasDescription = hasTranslatedContent(content) || React.Children.toArray(children).length > 0
  const contentId = props['aria-describedby'] ?? (hasDescription ? generatedContentId : undefined)

  // redesign W0-2d (T0-7): the shared helper. Anything that is not a string comes back as it came, and the
  // text by default for an unknown key is the table (API_MESSAGE_DEFAULTS, W0-2 r2).
  const translateAlertMessage = message => {
    if (typeof message !== 'string') return message
    return translateApiMessage(t, message, message, getApiMessageDefault(message))
  }

  return (
    <Dialog
      ref={forwardedRef}
      open={props.open}
      onClose={onClose}
      closeOnBackdrop={props.closeOnBackdrop}
      isTopPosition={props.isTopPosition}
      backdropClassName={props.backdropClassName}
      initialFocus={props.initialFocus}
      title={title}
      role='alertdialog'
      aria-label={props['aria-label']}
      aria-labelledby={titleId}
      aria-describedby={contentId}
    >
      <PopupDialog className='popup-dialog' width={props.width}>
        <PopupIcon>
          <IconButton
            compatibility='legacy'
            color='black'
            aria-label={t('CLOSE', 'Close')}
            onClick={() => onClose()}
          >
            <X />
          </IconButton>
        </PopupIcon>
        {title && <PopupTitle id={generatedTitleId}>{title}</PopupTitle>}
        <PopupContent id={generatedContentId}>
          {content && typeof content === 'string' && translateAlertMessage(content)}
          {content && typeof content === 'object' && Array.isArray(content) && (
            <ul>
              {content.map((item, index) => (
                <React.Fragment key={index}>
                  {Array.isArray(item)
                    ? item.map((error, errorIndex) => (
                      typeof error === 'string' && (
                        <li key={errorIndex}>{translateAlertMessage(error)}</li>
                      )
                    ))
                    : (typeof item === 'string' && <li>{translateAlertMessage(item)}</li>)}
                </React.Fragment>
              ))}
            </ul>
          )}
          {children}
        </PopupContent>
        {(onCancel || onAccept || onClose) && (
          <PopupActions>
            {onCancel && (
              <Button
                compatibility='legacy'
                className='od-button-legacy'
                outline
                onClick={() => onCancel()}
              >
                {cancelText || t('CANCEL', 'Cancel')}
              </Button>
            )}
            {onAccept && (
              <Button
                compatibility='legacy'
                className='od-button-legacy'
                color='primary'
                onClick={() => onAccept()}
              >
                {acceptText || t('ACCEPT', 'Accept')}
              </Button>
            )}
          </PopupActions>
        )}
      </PopupDialog>
    </Dialog>
  )
})

LegacyConfirm.displayName = 'OrderingLegacyConfirm'
