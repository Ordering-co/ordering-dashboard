import React from 'react'
import { Popup, useLanguage } from '../../../../../index'
import { Button, IconButton } from '../../../styles'
import { useTheme } from 'styled-components'
import { XLg } from 'react-bootstrap-icons'
import { stringToSlug } from '../../../utils'
import {
  PopupDialog,
  PopupActions,
  PopupTitle,
  PopupContent,
  PopupIcon
} from './styles'

const ConfirmUI = (props) => {
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

  const errors = {
    ERROR_REPORT_MAX_A_DAY_AS_PERIOD: 'Error report, max a day as period',
    ERROR_REPORT_VERY_LONG_PERIOD: 'Error report, very long period'
  }

  const translateAlertMessage = (message) => {
    if (typeof message !== 'string') return message
    const key = stringToSlug(message).toUpperCase()
    return t(key, errors[message] || message)
  }

  return (
    <PopupDialog
      className='popup-dialog'
      width={props.width}
    >
      <PopupIcon>
        <IconButton color='black' onClick={() => onClose()}>
          <XLg />
        </IconButton>
      </PopupIcon>
      {title && <PopupTitle>{title}</PopupTitle>}
      <PopupContent>
        {content && typeof content === 'string' && translateAlertMessage(content)}
        {content && typeof content === 'object' && Array.isArray(content) && (
          <ul>
            {content.map((item, i) => (
              <React.Fragment key={i}>
                {Array.isArray(item)
                  ? (
                      item.map((err, index) => (
                        typeof err === 'string' && (
                      <li key={index}>{translateAlertMessage(err)}</li>
                        )
                      ))
                    )
                  : (
                      typeof item === 'string' && <li>{translateAlertMessage(item)}</li>
                    )}
              </React.Fragment>
            ))}
          </ul>
        )}
        {children}
      </PopupContent>
      {(onCancel || onAccept || onClose) && (
        <PopupActions>
          {onCancel && <Button outline onClick={() => onCancel()}>{cancelText || t('CANCEL', 'Cancel')}</Button>}
          {onAccept && <Button color='primary' onClick={() => onAccept()}>{acceptText || t('ACCEPT', 'Accept')}</Button>}
        </PopupActions>)}
    </PopupDialog>
  )
}

export const Confirm = (props) => {
  const popupProps = {
    ...props,
    UIComponent: ConfirmUI
  }

  const theme = useTheme()

  return (
    <>
      {
        theme && <Popup {...popupProps} />
      }
    </>
  )
}

export const Alert = Confirm
