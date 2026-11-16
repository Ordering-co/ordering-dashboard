import React from 'react'
import PropTypes, { string } from 'prop-types'
import { Dialog } from '../../ui/src/components/Shared/UI/Dialog'

/**
 * Component to manage login behavior without UI component
 */
export const Popup = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    open,
    backdropClassName,
    closeOnBackdrop,
    onClose,
    isTopPosition,
    initialFocus,
    title
  } = props
  const accessibilityProps = Object.fromEntries(
    ['role', 'aria-label', 'aria-labelledby', 'aria-describedby']
      .filter(key => props[key] !== undefined)
      .map(key => [key, props[key]])
  )

  return (
    <Dialog
      open={open}
      backdropClassName={backdropClassName}
      closeOnBackdrop={closeOnBackdrop}
      onClose={onClose}
      isTopPosition={isTopPosition}
      initialFocus={initialFocus}
      title={title}
      {...accessibilityProps}
    >
      {UIComponent && <UIComponent {...props} />}
    </Dialog>
  )
}

Popup.propTypes = {
  UIComponent: PropTypes.elementType,
  /**
   * Show or hide popup
   */
  open: PropTypes.bool,
  /**
   * Close popup when backdrop was clicked
   */
  closeOnBackdrop: PropTypes.bool,
  /**
   * Close popup when ESC key was pressed
   */
  closeWithKeyboard: PropTypes.bool,
  /**
   * Title of popup
   */
  title: PropTypes.string,
  /**
   * Content of popup
   */
  content: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(string),
    PropTypes.elementType,
    PropTypes.element
  ]),
  /**
   * Function when accept popup
   */
  onAccept: PropTypes.func,
  /**
   * Function when cancel popup
   */
  onCancel: PropTypes.func,
  /**
   * Function when close popup
   */
  onClose: PropTypes.func
}

const defaultProps = {
  open: false,
  closeOnBackdrop: true,
  closeWithKeyboard: true
}
