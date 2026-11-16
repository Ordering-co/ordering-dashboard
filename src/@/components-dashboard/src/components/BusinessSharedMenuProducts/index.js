import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

// redesign stores 5.6 (G3-04 / G3-06): contract of the shared menu products controller.
// `handleUpdateBusinessSharedMenuProduct(productId, changes)` answers `{ ok: true } | { ok: false, error }` (throw,
// non-ok or error:true all fail with `content.result || message`), raises no Loading toast, and on success merges
// `changes` immutably into `menuState.menu.products` and into `menuList.menusShared` (functional `setMenuList`, only the
// shared menu of this id). `patchProduct(productId, patch)` is the same local merge with no request: the detail calls
// it after its own writes so reopening a product shows fresh values.

const readJson = async (response) => {
  try {
    return await response.json()
  } catch (err) {
    return null
  }
}

const mergeIntoProduct = (products, productId, patch) => (
  (products || []).map(product => product?.id === productId ? { ...product, ...patch } : product)
)

export const BusinessSharedMenuProducts = (props) => {
  const {
    menu,
    UIComponent,
    business,
    setMenuList
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [menuState, setMenuState] = useState({ loading: false, error: null, menu: menu || {} })
  const [actionState, setActionState] = useState({ loading: false, error: null })

  /**
   * Local-only merge of a patch into one product of the menu
   * @param {Number} productId product id
   * @param {Object} patch values to merge
   */
  const patchProduct = (productId, patch) => {
    setMenuState(prev => ({
      ...prev,
      menu: { ...prev.menu, products: mergeIntoProduct(prev.menu?.products, productId, patch) }
    }))
  }

  /**
   * Method to update the business shared menu product
   * @param {Number} productId product id to update
   * @param {Object} changes changes to update
   * @returns {Promise<{ ok: true } | { ok: false, error }>}
   */
  const handleUpdateBusinessSharedMenuProduct = async (productId, changes) => {
    setActionState(prev => ({ ...prev, loading: true }))
    try {
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/menus_shared/${menu.id}/products/${productId}`, requestOptions)
      const content = await readJson(response)
      if (!response.ok || content?.error) {
        const error = content?.result || response.statusText || `HTTP ${response.status}`
        setActionState({ loading: false, error })
        return { ok: false, error }
      }
      patchProduct(productId, changes)
      setMenuList?.(prev => ({
        ...prev,
        menusShared: prev?.menusShared?.map(sharedMenu => sharedMenu?.id === menu?.id
          ? { ...sharedMenu, products: mergeIntoProduct(sharedMenu.products, productId, changes) }
          : sharedMenu)
      }))
      showToast(ToastType.Success, t('PRODUCT_SAVED', 'Product saved'))
      setActionState({ loading: false, error: null })
      return { ok: true }
    } catch (err) {
      setActionState({ loading: false, error: err.message })
      return { ok: false, error: err.message }
    }
  }

  useEffect(() => {
    setMenuState(prev => ({ ...prev, menu: menu || {} }))
  }, [menu])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            menuState={menuState}
            actionState={actionState}
            patchProduct={patchProduct}
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
