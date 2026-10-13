import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

export const ProductsList = (props) => {
  const {
    categories,
    UIComponent
  } = props

  const [categoriesFiltered, setCategoriesFiltered] = useState(categories)

  useEffect(() => {
    setCategoriesFiltered(
      categories.filter(category => category.id)
    )
  }, [categories])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          categories={categoriesFiltered}
        />
      )}
    </>
  )
}

ProductsList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * productslist, this must be contains an object with products, loading and error data
   */
  productsList: PropTypes.object,
  /**
   * categories, this must be contains an array of products categories
   */
  categories: PropTypes.arrayOf(PropTypes.object),
  /**
   * flag shows categories with products or only products
   */
  isAllCategory: PropTypes.bool
}
