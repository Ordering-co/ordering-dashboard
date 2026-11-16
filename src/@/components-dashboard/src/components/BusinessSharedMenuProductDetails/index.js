import React, { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

// redesign stores 5.6 (G3-04 / G3-06): contract of the shared menu product detail controller. Price and
// quantity edits wait in `formState.changes` (`handleChangeField`, no autosave) until `saveChanges()` sends only the
// `pendingChangeKeys` (keys whose value differs from the stored one) in one PUT; `discardChanges()` drops them.
// `handleToggleProperty` (inventoried / featured / upselling) and `handleUpdateExtra` / `Option` / `Suboption` PUT on
// their own. Every write answers `{ ok, error? }` (throw, non-ok or error:true fail with `content.result || message`),
// raises no Loading toast, and on success merges immutably into `productState.product` (never the incoming product or
// menuList), calls `onProductChange(productId, patch)` and updates `menuList.menusShared` through the functional
// `setMenuList`. `saving` is only for `saveChanges()` and is always settled.

const readJson = async (response) => {
  try {
    return await response.json()
  } catch (err) {
    return null
  }
}

const isEmpty = (value) => value === '' || value === null || value === undefined
const isNumeric = (value) => (
  (typeof value === 'number' && Number.isFinite(value)) ||
  (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)))
)
const sameValue = (a, b) => {
  if (isEmpty(a) || isEmpty(b)) return isEmpty(a) && isEmpty(b)
  if (isNumeric(a) && isNumeric(b)) return Number(a) === Number(b)
  return a === b
}

const toBodyValue = (key, value) => {
  if (isEmpty(value)) return ''
  if (key === 'quantity' && isNumeric(value)) return String(Math.trunc(Number(value)))
  return String(value)
}

const mapExtras = (extras, mapExtra) => (extras || []).map(mapExtra)
const mapOptions = (extra, mapOption) => extra?.options ? { ...extra, options: extra.options.map(mapOption) } : extra

export const BusinessSharedMenuProductDetails = (props) => {
  const {
    menu,
    product,
    UIComponent,
    business,
    setMenuList,
    onProductChange
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [productState, setProductState] = useState({ loading: false, error: null, product: product || {} })
  const [formState, setFormState] = useState({ changes: {}, saving: false, error: null })
  const productRef = useRef(productState.product)

  const storedProduct = productState.product
  const pendingChangeKeys = Object.keys(formState.changes).filter(key => !sameValue(formState.changes[key], storedProduct?.[key]))
  const isDirty = pendingChangeKeys.length > 0

  /**
   * PUT to a shared menu endpoint. Never throws.
   * @param {String} path path after menus_shared/:menuId/
   * @param {Object} body request body
   * @returns {Promise<{ ok: true } | { ok: false, error }>}
   */
  const send = async (path, body) => {
    try {
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/menus_shared/${menu.id}/${path}`, requestOptions)
      const content = await readJson(response)
      if (!response.ok || content?.error) {
        return { ok: false, error: content?.result || response.statusText || `HTTP ${response.status}` }
      }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }

  /**
   * After a successful write: merge the patch into the product, tell the parent, update the shared menus and toast
   */
  const applyProductPatch = (patch) => {
    productRef.current = { ...productRef.current, ...patch }
    setProductState(prev => ({ ...prev, product: { ...prev.product, ...patch } }))
    onProductChange?.(product?.id, patch)
    setMenuList?.(prev => ({
      ...prev,
      menusShared: prev?.menusShared?.map(sharedMenu => sharedMenu?.id === menu?.id
        ? {
            ...sharedMenu,
            products: (sharedMenu.products || []).map(_product => _product?.id === product?.id ? { ..._product, ...patch } : _product)
          }
        : sharedMenu)
    }))
    showToast(ToastType.Success, t('PRODUCT_SAVED', 'Product saved'))
  }

  /**
   * Method to keep a price / quantity edit in the form (no request)
   * @param {String} name field name
   * @param {*} value new value
   */
  const handleChangeField = (name, value) => {
    setFormState(prev => ({ ...prev, changes: { ...prev.changes, [name]: value } }))
  }

  const discardChanges = () => {
    setFormState(prev => ({ ...prev, changes: {}, error: null }))
  }

  /**
   * Method to save the pending price / quantity changes
   * @returns {Promise<{ ok: boolean, error? }>}
   */
  const saveChanges = async () => {
    if (pendingChangeKeys.length === 0) return { ok: true }
    const patch = {}
    // review 5.6 R1/R2: the body is what main sent, text (an emptied field is ''), and the quantity is a whole number
    pendingChangeKeys.forEach(key => { patch[key] = toBodyValue(key, formState.changes[key]) })
    setFormState(prev => ({ ...prev, saving: true }))
    const result = await send(`products/${product.id}`, patch)
    if (!result.ok) {
      setFormState(prev => ({ ...prev, saving: false, error: result.error }))
      return result
    }
    applyProductPatch(patch)
    setFormState({ changes: {}, saving: false, error: null })
    return { ok: true }
  }

  /**
   * Method to toggle inventoried / featured / upselling
   * @param {String} key property name
   * @param {Boolean} value new value
   * @returns {Promise<{ ok: boolean, error? }>}
   */
  const handleToggleProperty = async (key, value) => {
    const result = await send(`products/${product.id}`, { [key]: value })
    if (!result.ok) return result
    applyProductPatch({ [key]: value })
    return { ok: true }
  }

  /**
   * Updates one level of the extras tree: PUT { enabled }, then an immutable rebuild of `extras`
   */
  const updateTree = async (path, enabled, rebuild) => {
    const result = await send(path, { enabled })
    if (!result.ok) return result
    applyProductPatch({ extras: rebuild(productRef.current?.extras) })
    return { ok: true }
  }

  /**
   * Method to update extra state
   * @param {Number} extraId extra id
   * @param {Boolean} enabled enabled state
   */
  const handleUpdateExtra = (extraId, enabled) => updateTree(
    `extras/${extraId}`,
    enabled,
    extras => mapExtras(extras, extra => extra?.id === extraId ? { ...extra, enabled } : extra)
  )

  /**
   * Method to update option state
   * @param {Number} optionId option id
   * @param {Boolean} enabled enabled state
   */
  const handleUpdateOption = (optionId, enabled) => updateTree(
    `options/${optionId}`,
    enabled,
    extras => mapExtras(extras, extra => mapOptions(extra, option => option?.id === optionId ? { ...option, enabled } : option))
  )

  /**
   * Method to update suboption state
   * @param {Number} suboptionId suboption id
   * @param {Boolean} enabled enabled state
   */
  const handleUpdateSuboption = (suboptionId, enabled) => updateTree(
    `suboptions/${suboptionId}`,
    enabled,
    extras => mapExtras(extras, extra => mapOptions(extra, option => option?.suboptions
      ? { ...option, suboptions: option.suboptions.map(suboption => suboption?.id === suboptionId ? { ...suboption, enabled } : suboption) }
      : option))
  )

  useEffect(() => {
    productRef.current = product || {}
    setProductState(prev => ({ ...prev, product: product || {} }))
  }, [product])

  useEffect(() => {
    setFormState(prev => ({ ...prev, changes: {}, error: null }))
  }, [product?.id])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            productState={productState}
            formState={formState}
            pendingChangeKeys={pendingChangeKeys}
            isDirty={isDirty}
            handleChangeField={handleChangeField}
            discardChanges={discardChanges}
            saveChanges={saveChanges}
            handleToggleProperty={handleToggleProperty}
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
  UIComponent: PropTypes.elementType,
  /**
   * Called as (productId, patch) after a successful write, so the parent can keep its copy fresh
   */
  onProductChange: PropTypes.func
}
