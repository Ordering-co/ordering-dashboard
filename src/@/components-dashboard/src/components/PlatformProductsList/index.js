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
      // redesign GC-A (GC-A6): functional state, not the one captured by this closure
      setPlatformProductsListState(prev => ({
        ...prev,
        loading: true,
        error: null
      }))
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
      setPlatformProductsListState(prev => ({
        ...prev,
        loading: false,
        error: [error.message]
      }))
    }
  }

  /**
   * Add a product
   * redesign GC-A (GC-A6): the three handleSuccess* use the functional form, so two in the same tick do not overwrite each other
   */
  const handleSuccessAddProduct = (result) => {
    setPlatformProductsListState(prev => ({
      ...prev,
      products: [...prev.products, result]
    }))
  }

  /**
   * Update a product
   */
  const handleSuccessUpdateProduct = (result) => {
    setPlatformProductsListState(prev => ({
      ...prev,
      products: prev.products.map(product => {
        if (product.id === result.id) return result
        else return product
      })
    }))
  }

  /**
   * Delete a product
   */
  const handleSuccessDeleteProduct = (productId) => {
    setPlatformProductsListState(prev => ({
      ...prev,
      products: prev.products?.filter(item => item.id !== productId)
    }))
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
          reload={getPlatformProductsList}
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
