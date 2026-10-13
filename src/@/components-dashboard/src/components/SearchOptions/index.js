import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useOrder } from '../../contexts/OrderContext'

export const SearchOptions = (props) => {
  const {
    UIComponent
  } = props

  const [optionSelected, setOptionSelected] = useState(null)

  const [orderState] = useOrder(null)

  /**
   * Method to handle tabs options
   * @param {String} val
   */
  const onClickOption = (val) => {
    const value = val === optionSelected ? null : val
    setOptionSelected(value)
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          orderState={orderState}
          optionSelected={optionSelected}
          handleClickOption={onClickOption}
        />
      )}
    </>
  )
}

SearchOptions.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
