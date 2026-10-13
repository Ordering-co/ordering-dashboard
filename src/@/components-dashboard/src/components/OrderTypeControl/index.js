import React, { useState, useEffect } from 'react'
import PropTypes, { object } from 'prop-types'
import { useOrder } from '../../contexts/OrderContext'

export const OrderTypeControl = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent
  } = props
  const [orderState, { changeType }] = useOrder()
  const [typeSelected, setTypeSelected] = useState(null)

  const handleChangeOrderType = (orderType) => {
    setTypeSelected(orderType)
    changeType(orderType)
  }

  useEffect(() => {
    setTypeSelected(orderState.options.type)
  }, [orderState.options.type])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          typeSelected={typeSelected || orderState.options.type}
          handleChangeOrderType={props.handleChangeOrderType || handleChangeOrderType}
        />
      )}
    </>
  )
}

OrderTypeControl.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Order availables to the control
   */
  orderTypes: PropTypes.arrayOf(object),
  /**
   * Custom function to control order type changes
   */
  handleChangeOrderType: PropTypes.func
}

const defaultProps = {
  orderTypes: [1, 2, 3, 4, 5]
}
