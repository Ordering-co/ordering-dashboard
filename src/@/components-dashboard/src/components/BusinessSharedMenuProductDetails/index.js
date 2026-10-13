import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

export const BusinessSharedMenuProductDetails = (props) => {
  const {
    menu,
    product,
    UIComponent,
    business,
    setMenuList,
    menuList
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [productState, setProductState] = useState({ loading: false, error: null, product: product || {} })
  const [formState, setFormState] = useState({ loading: false, changes: {}, error: null })
  const [timeoutState, setTimeoutState] = useState(null)

  /**
   * Method to update the business shared menu product
   * @param {Object} changes changes to update
   */
  const handleUpdateBusinessSharedMenuProduct = async (changes) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState(prevState => ({
        ...prevState,
        loading: false
      }))
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/menus_shared/${menu.id}/products/${product.id}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setProductState({
          ...productState,
          product: { ...productState.product, ...changes }
        })
        const menusShared = menuList?.menusShared?.filter(sharedMenu => {
          const products = sharedMenu.products.map(_product => {
            if (_product.id === product?.id) {
              return {
                ..._product,
                ...changes
              }
            }
            return _product
          })
          sharedMenu.products = [...products]
          return true
        })
        showToast(ToastType.Success, t('PRODUCT_SAVED', 'Product saved'))
        setMenuList({
          ...menuList,
          menusShared
        })
        setFormState({
          loading: false,
          changes: {},
          error: null
        })
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Method to update extra state
   * @param {Number} extraId extra id
   * @param {Boolean} enabled enabled state
   */
  const handleUpdateExtra = async (extraId, enabled) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true })
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ enabled })
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/menus_shared/${menu.id}/extras/${extraId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        const updatedExtras = productState.product.extras.filter(extra => {
          if (extra.id === extraId) {
            extra.enabled = enabled
          }
          return true
        })
        const updatedProduct = { ...productState.product, extras: updatedExtras }
        setProductState({
          ...productState,
          product: { ...productState.product, ...updatedProduct }
        })
        const menusShared = menuList?.menusShared?.filter(sharedMenu => {
          const products = sharedMenu.products.map(_product => {
            if (_product.id === product?.id) {
              return {
                ..._product,
                ...updatedProduct
              }
            }
            return _product
          })
          sharedMenu.products = [...products]
          return true
        })
        showToast(ToastType.Success, t('PRODUCT_SAVED', 'Product saved'))
        setMenuList({
          ...menuList,
          menusShared
        })
        setFormState({
          loading: false,
          changes: {},
          error: null
        })
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Method to update option state
   * @param {Number} optionId option id
   * @param {Boolean} enabled enabled state
   */
  const handleUpdateOption = async (optionId, enabled) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true })
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ enabled })
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/menus_shared/${menu.id}/options/${optionId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        const updatedExtras = productState.product.extras.filter(extra => {
          const options = extra.options.map(option => {
            if (option.id === optionId) {
              return {
                ...option,
                enabled
              }
            }
            return option
          })
          extra.options = [...options]
          return true
        })
        const updatedProduct = { ...productState.product, extras: updatedExtras }
        setProductState({
          ...productState,
          product: { ...productState.product, ...updatedProduct }
        })
        const menusShared = menuList?.menusShared?.filter(sharedMenu => {
          const products = sharedMenu.products.map(_product => {
            if (_product.id === product?.id) {
              return {
                ..._product,
                ...updatedProduct
              }
            }
            return _product
          })
          sharedMenu.products = [...products]
          return true
        })
        showToast(ToastType.Success, t('PRODUCT_SAVED', 'Product saved'))
        setMenuList({
          ...menuList,
          menusShared
        })
        setFormState({
          loading: false,
          changes: {},
          error: null
        })
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: [err.message]
      })
    }
  }
  /**
   * Method to update suboption state
   * @param {Number} suboptionId suboption id
   * @param {Boolean} enabled enabled state
   */
  const handleUpdateSuboption = async (suboptionId, enabled) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState(prevState => ({
        ...prevState,
        loading: false
      }))
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ enabled })
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/menus_shared/${menu.id}/suboptions/${suboptionId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        const updatedExtras = productState.product.extras.filter(extra => {
          const options = extra.options.filter(option => {
            const suboptions = option?.suboptions?.map?.(suboption => {
              if (suboption.id === suboptionId) {
                return {
                  ...suboption,
                  enabled
                }
              }
              return suboption
            })
            option.suboptions = [...suboptions]
            return true
          })
          extra.options = [...options]
          return true
        })
        const updatedProduct = { ...productState.product, extras: updatedExtras }
        setProductState({
          ...productState,
          product: { ...productState.product, ...updatedProduct }
        })
        const menusShared = menuList?.menusShared?.filter(sharedMenu => {
          const products = sharedMenu.products.map(_product => {
            if (_product.id === product?.id) {
              return {
                ..._product,
                ...updatedProduct
              }
            }
            return _product
          })
          sharedMenu.products = [...products]
          return true
        })
        showToast(ToastType.Success, t('PRODUCT_SAVED', 'Product saved'))
        setMenuList({
          ...menuList,
          menusShared
        })
        setFormState({
          loading: false,
          changes: {},
          error: null
        })
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: [err.message]
      })
    }
  }

  const handleChangeInput = (e) => {
    e.persist()
    setFormState(prevState => ({
      ...prevState,
      changes: {
        ...formState.changes,
        [e.target.name]: e.target.value
      }
    }))
    clearTimeout(timeoutState)
    setTimeoutState(
      setTimeout(function () {
        handleUpdateBusinessSharedMenuProduct({ [e.target.name]: e.target.value })
      }, 750)
    )
  }

  const handleChangeItem = (itemChange) => {
    setFormState(prevState => ({
      ...prevState,
      changes: {
        ...formState.changes,
        ...itemChange
      }
    }))
    handleUpdateBusinessSharedMenuProduct(itemChange)
  }

  useEffect(() => {
    setFormState({
      ...formState,
      changes: {},
      error: null
    })
    setProductState({ ...productState, product: product || {} })
  }, [product])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            productState={productState}
            formState={formState}
            handleUpdateBusinessSharedMenuProduct={handleUpdateBusinessSharedMenuProduct}
            handleChangeInput={handleChangeInput}
            handleChangeItem={handleChangeItem}
            handleUpdateExtra={handleUpdateExtra}
            handleUpdateOption={handleUpdateOption}
            handleUpdateSuboption={handleUpdateSuboption}
          />
        )
      }
    </>
  )
}

BusinessSharedMenuProductDetails.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
