import React from 'react'
import PropTypes from 'prop-types'

export const SingleBusinessCard = (props) => {
  props = { ...defaultProps, ...props }
  const { UIComponent } = props
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

SingleBusinessCard.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Business name
   */
  name: PropTypes.string,
  /**
   * Minimun amount for an order of each business
   */
  minimun: PropTypes.number,
  /**
   * Price in dollars of delivery for each business
   */
  delivery_price: PropTypes.number,
  /**
   * Some useful description about business
   */
  description: PropTypes.string,
  /**
   * Distance between the customer and business
   */
  distance: PropTypes.number,
  /**
   * Time for deliveries of each business
   */
  delivery_time: PropTypes.string,
  /**
   * Time for pickup of each business
   */
  pickup_time: PropTypes.string
}

const defaultProps = {
  id: 0,
  name: '',
  minimun: 0,
  delivery_price: 0,
  description: '',
  distance: 0,
  delivery_time: ''
}
