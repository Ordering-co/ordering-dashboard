import React from 'react'
import PropTypes from 'prop-types'

export const SingleProductCard = (props) => {
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

SingleProductCard.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Check if a product is sold out status
   */
  isSoldOut: PropTypes.bool,
  /**
   * Product images
   */
  images: PropTypes.string,
  /**
   * Product name
   */
  name: PropTypes.string,
  /**
   * Product description
   */
  description: PropTypes.string,
  /**
   * Product price
   */
  price: PropTypes.number
}
