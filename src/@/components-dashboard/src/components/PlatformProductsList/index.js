import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'

/**
 * Component to manage platform products list behavior without UI component
 */
export const PlatformProductsList = (props) => {
  const {
    UIComponent
  } = props

  const [{ token }] = useSession()
  const [ordering] = useApi()

  const [platformProductsListState, setPlatformProductsListState] = useState({ loading: true, products: [], error: null })

  /**
   * Method to get the platform products from API
   */
  const getPlatformProductsList = async () => {
    try {
      setPlatformProductsListState({
        ...platformProductsListState,
        loading: true
      })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/platform_products?mode=dashboard`, requestOptions)
      const { error, result } = await response.json()
      setPlatformProductsListState({
        loading: false,
        products: error ? [] : result,
        error: error ? result : null
      })
    } catch (error) {
      setPlatformProductsListState({
        ...platformProductsListState,
        loading: false,
        error: [error.message]
      })
    }
  }

  /**
   * Add a product
   */
  const handleSuccessAddProduct = (result) => {
    setPlatformProductsListState({
      ...platformProductsListState,
      products: [...platformProductsListState.products, result]
    })
  }

  /**
   * Update a product
   */
  const handleSuccessUpdateProduct = (result) => {
    const updatedProducts = platformProductsListState.products.map(product => {
      if (product.id === result.id) return result
      else return product
    })
    setPlatformProductsListState({ ...platformProductsListState, products: updatedProducts })
  }

  /**
   * Delete a product
   */
  const handleSuccessDeleteProduct = (productId) => {
    const products = platformProductsListState.products?.filter(item => item.id !== productId)
    setPlatformProductsListState({ ...platformProductsListState, products })
  }

  useEffect(() => {
    getPlatformProductsList()
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          platformProductsListState={platformProductsListState}
          handleSuccessDeleteProduct={handleSuccessDeleteProduct}
          handleSuccessUpdateProduct={handleSuccessUpdateProduct}
          handleSuccessAddProduct={handleSuccessAddProduct}
        />
      )}
    </>
  )
}

PlatformProductsList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
