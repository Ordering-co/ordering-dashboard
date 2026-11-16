import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

/**
 * Component to manage ProfessionalServices behavior without UI component
 */
export const ProfessionalServices = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    businessId,
    services,
    userId,
    handleUpdateServices,
    propsToFetch
  } = props

  const [ordering] = useApi()
  const [, t] = useLanguage()
  const [, { showToast, hideToast }] = useToast()
  const [{ token }] = useSession()

  const [subCategoriesList, setSubCategoriesList] = useState([])
  const [selectedProductsIds, setSelectedProductsIds] = useState([])
  const [selectedProducts, setSelectedProducts] = useState([])
  const [actionState, setActionState] = useState({ loading: false, result: { error: false } })
  const [businessState, setBusinessState] = useState({ loading: true, business: {}, error: null })

  /**
   * Function to create treeview category list
   * @param {Array} _selectedProductsIds array of product id
   */
  const handleSetSubCategoryList = (_selectedProductsIds) => {
    if (businessState?.business?.categories?.length) {
      const _subCategoriesList = []
      const iterateCategories = (categories) => {
        return (
          categories?.length > 0 && categories?.forEach(category => {
            let productIds = []
            const _productIds = category.products?.reduce((ids, product) => [...ids, product.id], [])
            productIds = [...productIds, ..._productIds]
            if (category?.subcategories?.length) {
              category.subcategories.forEach(function iterate (category) {
                const _productIds = category.products?.reduce((ids, product) => [...ids, product.id], [])
                productIds = [...productIds, ..._productIds]
                Array.isArray(category?.subcategories) && category.subcategories.forEach(iterate)
              })
            }

            _subCategoriesList.push({
              id: category.id,
              name: category.name,
              productIds,
              isChecked:
                productIds.length === 0
                  ? false
                  : productIds.every(id => _selectedProductsIds.includes(id))
            })
            iterateCategories(category.subcategories)
          })
        )
      }
      setSubCategoriesList(_subCategoriesList)
      iterateCategories(businessState?.business?.categories)
    }
  }

  /**
   * the selection as `services` stores it. Called when a save fails, so a check box the UI already
   * flipped goes back (`services` did not change, so the effect below does not run again by itself).
   */
  const restoreSelection = () => {
    const stored = Array.isArray(services) ? services : []
    const ids = stored.map(service => service.product_id)
    setSelectedProductsIds(ids)
    setSelectedProducts(stored.map(service => service.product))
    handleSetSubCategoryList(ids)
  }
  // always the latest render's closure: the request may end after `services` or the business changed
  const restoreSelectionRef = useRef(restoreSelection)
  restoreSelectionRef.current = restoreSelection

  // A failed save: `actionState.result` already carries the error, which the UI shows in its Alert (as in main; a toast
  // would say it twice), and the selection goes back to what is stored
  // The «Loading» toast raised on submit goes down too; it would otherwise stay until its own timeout
  const handleSaveFailure = () => {
    hideToast?.()
    restoreSelectionRef.current()
  }

  /**
   * Create a service for a user
   * @param {number} productId product id
   */
  const handleCreateService = (productId) => {
    const changes = {
      product_id: productId,
      business_id: businessId,
      user_id: userId
    }
    createService(changes)
  }

  /**
   * Delete a service for a user
   * @param {number} productId product id
   */
  const handleDeleteService = (productId) => {
    const found = services.find(service => service.product_id === productId)
    deleteService(found.id)
  }

  // Function get business data from API
  const getBusiness = async () => {
    try {
      setBusinessState({ ...businessState, loading: true })

      const { content: { result, error } } = await ordering.businesses(businessId).asDashboard().select(propsToFetch).get()
      if (!error) {
        setBusinessState({
          ...businessState,
          business: result,
          loading: false,
          error: null
        })
      } else {
        setBusinessState({
          ...businessState,
          error: result,
          loading: false
        })
      }
    } catch (err) {
      setBusinessState({
        ...businessState,
        loading: false,
        error: [err.message]
      })
    }
  }

  // Function create a service
  const createService = async (changes) => {
    try {
      setActionState({ ...actionState, loading: true })
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/users/${userId}/products`, requestOptions)
      const content = await response.json()
      if (!content?.error) {
        setActionState({
          ...actionState,
          result: { error: false },
          loading: false
        })
        if (handleUpdateServices) {
          handleUpdateServices([...services, content.result])
        }
        showToast(ToastType.Success, t('SERVICE_ADDED', 'Service added'))
      } else {
        setActionState({
          ...actionState,
          result: content,
          loading: false
        })
        handleSaveFailure()
      }
    } catch (err) {
      setActionState({
        ...actionState,
        result: {
          error: true,
          // not the raw network message («Failed to fetch»); same array shape as the API error branch
          result: [t('STORES_CHANGE_FAILED', "We couldn't save the change.")]
        },
        loading: false
      })
      handleSaveFailure()
    }
  }

  // Function to remove a service
  const deleteService = async (serviceId) => {
    try {
      setActionState({ ...actionState, loading: true })
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/users/${userId}/products/${serviceId}`, requestOptions)
      const content = await response.json()
      if (!content?.error) {
        setActionState({
          ...actionState,
          result: { error: false },
          loading: false
        })
        if (handleUpdateServices) {
          const updatedServices = services.filter(service => service.id !== serviceId)
          handleUpdateServices(updatedServices)
        }
        showToast(ToastType.Success, t('SERVICE_DELETED', 'Service deleted'))
      } else {
        setActionState({
          ...actionState,
          result: content,
          loading: false
        })
        handleSaveFailure()
      }
    } catch (err) {
      setActionState({
        ...actionState,
        result: {
          error: true,
          // not the raw network message («Failed to fetch»); same array shape as the API error branch
          result: [t('STORES_CHANGE_FAILED', "We couldn't save the change.")]
        },
        loading: false
      })
      handleSaveFailure()
    }
  }

  useEffect(() => {
    let _selectedProductsIds = []
    if (services?.length > 0) {
      _selectedProductsIds = services.reduce((ids, service) => [...ids, service.product_id], [])
      setSelectedProductsIds(_selectedProductsIds)
      const products = services.reduce((ids, service) => [...ids, service.product], [])
      setSelectedProducts(products)
    } else {
      setSelectedProductsIds([])
      setSelectedProducts([])
    }
    handleSetSubCategoryList(_selectedProductsIds)
  }, [services, businessState?.business])

  useEffect(() => {
    getBusiness()
  }, [businessId])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          selectedProducts={selectedProducts}
          subCategoriesList={subCategoriesList}
          selectedProductsIds={selectedProductsIds}
          setSelectedProducts={setSelectedProducts}
          setSelectedProductsIds={setSelectedProductsIds}
          handleCreateService={handleCreateService}
          handleDeleteService={handleDeleteService}
          businessState={businessState}
          actionState={actionState}
        />
      )}
    </>
  )
}

ProfessionalServices.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}

const defaultProps = {
  propsToFetch: ['id', 'name', 'header', 'logo', 'name', 'schedule', 'open', 'delivery_price', 'distance', 'delivery_time', 'pickup_time', 'reviews', 'featured', 'offers', 'food', 'laundry', 'alcohol', 'groceries', 'slug']
}
