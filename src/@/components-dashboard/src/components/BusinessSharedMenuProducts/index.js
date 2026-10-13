import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

export const BusinessSharedMenuProducts = (props) => {
  const {
    menu,
    UIComponent,
    business,
    setMenuList,
    menuList
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [menuState, setMenuState] = useState({ loading: false, error: null, menu: menu || {} })
  const [actionState, setActionState] = useState({ loading: false, error: null })

  /**
   * Method to update the business shared menu product
   * @param {Number} productId product id to update
   * @param {Object} changes changes to update
   */
  const handleUpdateBusinessSharedMenuProduct = async (productId, changes) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/menus_shared/${menu.id}/products/${productId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        const menusShared = menuList?.menusShared?.map(sharedMenu => {
          const products = sharedMenu.products.map(product => {
            if (product.id === productId) {
              return {
                ...product,
                ...changes
              }
            }
            return product
          })
          return {
            ...sharedMenu,
            products
          }
        })
        showToast(ToastType.Success, t('PRODUCT_SAVED', 'Product saved'))
        setActionState({
          loading: false,
          error: null
        })
        setMenuList({
          ...menuList,
          menusShared
        })
        setMenuState({
          ...menuState,
          menu: menusShared.find(_menu => _menu?.id === menu?.id)
        })
      } else {
        setActionState({
          loading: false,
          error: content.resulut
        })
      }
    } catch (err) {
      setActionState({
        loading: false,
        error: [err.message]
      })
    }
  }

  useEffect(() => {
    setMenuState({ ...menuState, menu: menu || {} })
  }, [menu])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            menuState={menuState}
            actionState={actionState}
            handleUpdateBusinessSharedMenuProduct={handleUpdateBusinessSharedMenuProduct}
          />
        )
      }
    </>
  )
}

BusinessSharedMenuProducts.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
