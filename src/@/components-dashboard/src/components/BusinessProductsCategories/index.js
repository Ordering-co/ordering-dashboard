import React from 'react'
import PropTypes from 'prop-types'

export const BusinessProductsCategories = (props) => {
  const {
    categories,
    onClickCategory,
    UIComponent
  } = props

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          categories={categories}
          handlerClickCategory={onClickCategory}
        />
      )}
    </>
  )
}

BusinessProductsCategories.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * categories, this must be contains an array of products categories
   */
  categories: PropTypes.arrayOf(PropTypes.object)
}
