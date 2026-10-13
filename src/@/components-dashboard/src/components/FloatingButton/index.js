import React from 'react'
import PropTypes from 'prop-types'

export const FloatingButton = (props) => {
  const {
    handleClick,
    btnText,
    btnValue,
    UIComponent
  } = props

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          handleButtonClick={handleClick}
          btnText={btnText}
          btnValue={btnValue}
        />
      )}
    </>
  )
}

FloatingButton.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Text for button
   */
  btnText: PropTypes.string.isRequired,
  /**
   * Value to show in button
   */
  btnValue: PropTypes.number,
  /**
   * handle click button
   */
  handleClick: PropTypes.func
}
