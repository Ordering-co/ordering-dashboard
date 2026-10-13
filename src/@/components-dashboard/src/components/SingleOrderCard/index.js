import React from 'react'
import PropTypes from 'prop-types'

export const SingleOrderCard = (props) => {
  const {
    UIComponent
  } = props

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
        />
      )}
    </>
  )
}

SingleOrderCard.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Order details to render
   */
  order: PropTypes.object.isRequired,
  /**
   * Order type to validate: [active, previous]
   */
  orderType: PropTypes.string.isRequired
}
