import React from 'react'
import PropTypes from 'prop-types'

export const BusinessProductsSearch = (props) => {
  const {
    onChangeSearch,
    UIComponent
  } = props

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          handleChangeSearch={onChangeSearch}
        />
      )}
    </>
  )
}

BusinessProductsSearch.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
