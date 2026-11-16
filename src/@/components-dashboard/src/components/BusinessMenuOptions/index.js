import React, { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

export const BusinessMenuOptions = (props) => {
  const {
    business,
    menu,
    UIComponent,
    isSelectedSharedMenus,
    sitesState,
    menuList,
    setMenuList,
    setCurrentMenu
  } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  const [businessMenuState, setBusinessMenuState] = useState({ loading: false, error: null, menu: menu || {} })
  const [formState, setFormState] = useState({ loading: false, changes: {}, error: null })
  const [orderTypeState, setOrderTypeSate] = useState({})
  const [selectedProductsIds, setSelectedProductsIds] = useState([])
  // redesign stores 5.18 (review F4): whether the products of the open menu were ever read. A menu that came without them
  // (or whose shared product list failed) opens with none chosen, and a save of something else must not send that empty list.
  const productsKnownRef = useRef(true)
  const [selectedProducts, setSelectedProducts] = useState([])
  const [subCategoriesList, setSubCategoriesList] = useState([])

  /**
   * Update business menu name and comment
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeInput = (e) => {
    const currentChanges = {
      [e.target.name]: e.target.value
    }

    setFormState({
      ...formState,
      changes: { ...formState.changes, ...currentChanges }
    })
  }

  /**
   * Method to contol order type selection
   * @param {String} orderType params key of order type
   */
  const handleCheckOrderType = (orderType) => {
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        [orderType]: !orderTypeState[orderType]
      }
    })
    setOrderTypeSate({ ...orderTypeState, [orderType]: !orderTypeState[orderType] })
  }

  /**
   * Method to update the busienss menu option from API
   * redesign stores 2.F: `handleUpdateBusinessMenuOption({ snooze_until }, { keepPendingChanges: true })`
   * saves only the given keys and leaves the other pending edits of the form (and `result`) alone. Without the option it
   * sends every pending change, as before.
   * @param {Object} partialChanges changes to send, only read with `options.keepPendingChanges`
   * @param {Object} options { keepPendingChanges }
   * @returns {Promise<{ ok: true } | { ok: false, error }>}
   */
  const handleUpdateBusinessMenuOption = async (partialChanges, options) => {
    const keepPending = !!options?.keepPendingChanges &&
      !!partialChanges && Object.getPrototypeOf(partialChanges) === Object.prototype
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      if (keepPending) {
        setFormState(prev => ({ ...prev, loading: true }))
      } else {
        setFormState({ ...formState, loading: true, result: { error: false } })
      }
      const changes = { ...(keepPending ? partialChanges : formState.changes) }
      // (main): an «All products» menu never sends its product list. (redesign): an empty list the form
      // never loaded is not sent either.
      if ((changes.all_products ?? businessMenuState.menu?.all_products) ||
        (!keepPending && !productsKnownRef.current && Array.isArray(changes.products) && changes.products.length === 0)) {
        delete changes.products
      }
      for (const key in changes) {
        if ((typeof changes[key] === 'object' && changes[key] !== null) || Array.isArray(changes[key])) {
          changes[key] = JSON.stringify(changes[key])
        }
      }
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }

      const endPoint = isSelectedSharedMenus
        ? `${ordering.root}/business/${business.id}/menus_shared/${menu.id}`
        : `${ordering.root}/business/${business.id}/menus/${menu.id}`
      const response = await fetch(endPoint, requestOptions)
      const content = await response.json()

      if (keepPending) {
        const sentKeys = Object.keys(partialChanges)
        setFormState(prev => {
          const sentPending = !content.error && sentKeys.some(key => key in prev.changes)
          return {
            ...prev,
            loading: false,
            changes: sentPending
              ? Object.fromEntries(Object.entries(prev.changes).filter(([key]) => !sentKeys.includes(key)))
              : prev.changes
          }
        })
      } else {
        setFormState({
          ...formState,
          changes: content.error ? formState.changes : {},
          result: {
            error: content.error,
            result: content.result
          },
          loading: false
        })
      }

      if (!content.error) {
        const menus = menuList?.menus?.filter(menu => {
          if (menu.id === content.result.id) {
            Object.assign(menu, content.result)
            const isUpdatedProducts = typeof (changes?.products) !== 'undefined'
            if (isUpdatedProducts) {
              menu.products = [...selectedProducts]
            }
            // redesign stores 2.F (review R-2): a new open menu resets the form (`useEffect([menu])` below), which
            // would drop the edits keepPendingChanges keeps; the row and businessMenuState take the answer instead.
            if (!keepPending) setCurrentMenu({ menu })
          }
          return true
        })
        setMenuList({
          ...menuList,
          menus
        })
        setBusinessMenuState({
          ...businessMenuState,
          menu: {
            ...businessMenuState.menu,
            ...content.result
          }
        })
        showToast(ToastType.Success, t('MENU_SAVED', 'Products catalog saved'))
        return { ok: true }
      }
      return { ok: false, error: content.result }
    } catch (err) {
      if (keepPending) {
        setFormState(prev => ({ ...prev, loading: false }))
      } else {
        setFormState({ ...formState, loading: false, result: { error: true, result: err.message } })
      }
      return { ok: false, error: err.message }
    }
  }

  /**
   * Method to add the busienss menu option from API
   */
  const handleAddBusinessMenuOption = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true, result: { error: false } })

      const changes = { ...formState?.changes }
      if (changes?.products) {
        changes.products = JSON.stringify(changes?.products)
      }
      if (changes?.schedule) {
        changes.schedule = JSON.stringify(changes?.schedule)
      } else {
        const schedule = []
        for (let i = 0; i < 7; i++) {
          schedule.push({
            enabled: true,
            lapses: [
              {
                open: {
                  hour: 0,
                  minute: 0
                },
                close: {
                  hour: 23,
                  // redesign bugs F row 10: the Schedule UI shows 23:59, so that is what a new menu sends
                  minute: 59
                }
              }
            ]
          })
        }
        changes.schedule = JSON.stringify(schedule)
      }

      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/menus`, requestOptions)
      const content = await response.json()

      setFormState({
        ...formState,
        changes: content.error ? formState.changes : {},
        result: {
          error: content.error,
          result: content.result
        },
        loading: false
      })

      if (!content.error) {
        let _menu = { ...content.result, enabled: true }

        // redesign stores 5.5b (G3-08): a store without categories, or an answer without products, still adds the row
        let allProducts = []
        const categories = business?.categories || []
        categories.forEach(function iterate (category) {
          allProducts = [...allProducts, ...category.products]
          Array.isArray(category?.subcategories) && category.subcategories.forEach(iterate)
        })

        let products = []
        if (changes?.all_products) {
          products = [...allProducts]
        } else {
          products = allProducts.filter(product => (_menu.products || []).includes(product.id))
        }
        _menu = { ..._menu, products }
        const menusArray = menuList?.menus
        menusArray.push(_menu)
        setMenuList({
          ...menuList,
          menus: menusArray
        })
        showToast(ToastType.Success, t('MENU_ADDED', 'Products catalog added'))
        props.onClose && props.onClose()
        return { ok: true }
      }
      return { ok: false, error: content.result }
    } catch (err) {
      setFormState({ ...formState, loading: false, result: { error: true, result: err.message } })
      return { ok: false, error: err.message }
    }
  }

  /**
   * Method to delete the business menu from API
   * @returns {Promise<{ ok: true } | { ok: false, error }>}
   */
  const handleDeleteMenu = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const endPoint = isSelectedSharedMenus
        ? `${ordering.root}/business/${business.id}/menus_shared/${menu.id}`
        : `${ordering.root}/business/${business.id}/menus/${menu.id}`
      const response = await fetch(endPoint, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setFormState({
          ...formState,
          loading: false,
          error: null
        })
        let menus, menusShared
        if (isSelectedSharedMenus) {
          menusShared = menuList?.menusShared?.filter(_menu => _menu.id !== menu.id)
          setMenuList({
            ...menuList,
            menusShared
          })
        } else {
          menus = menuList?.menus?.filter(_menu => _menu.id !== menu.id)
          setMenuList({
            ...menuList,
            menus
          })
        }
        showToast(ToastType.Success, t('MENU_DELETED', 'Products catalog deleted'))
        props.onClose && props.onClose()
        return { ok: true }
      }
      setFormState({
        ...formState,
        loading: false,
        error: content.result
      })
      return { ok: false, error: content.result }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: err
      })
      return { ok: false, error: err.message }
    }
  }

  const handleChangeScheduleState = (scheduleChanges) => {
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        schedule: scheduleChanges
      }
    })
  }

  const handleChangeMenuSite = (site) => {
    const sites = [
      ...(menu?.sites || []).map(s => s?.id ?? s).filter(s => formState.changes.sites ? formState.changes.sites?.includes(s) : true),
      ...formState.changes.sites || []
    ]
    const isRemove = sites.includes(site)
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        sites:
          isRemove
            ? sites.filter(s => s !== site)
            : [...sites, site]
      }
    })
  }

  const handleSelectAllChannels = () => {
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        sites: sitesState?.sites.map(s => s.id)
      }
    })
  }

  const handleSelectNoneChannels = () => {
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        sites: []
      }
    })
  }

  const getSharedMenuProducts = async () => {
    try {
      setCurrentMenu({ loading: true })
      // redesign stores 5.18 (from 5.6): `quantity` too, which the product detail draws and saves (main left it out, so the
      // field opened empty). The API intersects `params` with the model's fields: a field it does not have is dropped, never an error.
      const paramsToFetch = ['id', 'name', 'enabled', 'featured', 'upselling', 'price', 'extras', 'inventoried', 'category_id', 'quantity']
      const response = await fetch(`${ordering.root}/business/${business?.id}/menus_shared/${menu?.id}/products?params=${paramsToFetch}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      })
      const { result, error } = await response.json()
      if (!error) {
        // redesign stores 5.18: no list is no product chosen, not a crash
        const products = Array.isArray(result) ? result : []
        productsKnownRef.current = Array.isArray(result)
        const _selectedProductsIds = products.reduce((ids, product) => [...ids, product.id], [])
        setSelectedProductsIds(_selectedProductsIds)
        setSelectedProducts(products)
        setCurrentMenu({
          menu: {
            ...menu,
            products: result
          },
          loading: false
        })
        return
      }
      setCurrentMenu({ loading: false })
      setFormState({
        ...formState,
        error: result
      })
    } catch (err) {
      setCurrentMenu({ loading: false })
      setFormState({
        ...formState,
        error: err.message
      })
    }
  }

  useEffect(() => {
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        products: selectedProductsIds
      }
    })
  }, [selectedProductsIds])

  /**
   * Leaves the form as freshly opened on the current `menu` (what the `[menu]` effect does on every new menu)
   */
  const resetForm = () => {
    setFormState({ ...formState, changes: {} })
    setBusinessMenuState({ ...businessMenuState, menu: menu || {} })
    setOrderTypeSate({
      delivery: menu?.delivery,
      pickup: menu?.pickup,
      eatin: menu?.eatin,
      curbside: menu?.curbside,
      driver_thru: menu?.driver_thru
    })
    let _selectedProductsIds = []
    if (Object.keys(menu || {}).length) {
      // redesign stores 5.18 (from 5.6): a menu that comes without `products` opens with none chosen (it took the editor
      // down: the ids were undefined), as 5.5b guarded the create
      const menuProducts = Array.isArray(menu.products) ? menu.products : []
      productsKnownRef.current = Array.isArray(menu.products)
      _selectedProductsIds = menuProducts.reduce((ids, product) => [...ids, product.id], [])
      setSelectedProductsIds(_selectedProductsIds)
      setSelectedProducts(menuProducts)
    } else {
      productsKnownRef.current = true // a new menu: its empty list is the user's
      setSelectedProductsIds([])
      setSelectedProducts([])
      setOrderTypeSate({
        delivery: true,
        pickup: true,
        eatin: false,
        curbside: false,
        driver_thru: false
      })
      setFormState({
        ...formState,
        changes: {
          delivery: true,
          pickup: true
        }
      })
    }
    handleSetSubCategoryList(_selectedProductsIds)
  }

  /**
   * Drops every pending edit and reopens the form on the saved menu
   */
  const discardChanges = () => {
    resetForm()
  }

  useEffect(() => {
    resetForm()
  }, [menu])

  useEffect(() => {
    if (isSelectedSharedMenus && menu?.id) {
      getSharedMenuProducts()
    }
  }, [isSelectedSharedMenus, menu?.id])

  // Keys of `formState.changes` that differ from what is saved. `changes.products` is seeded on open (the
  // `selectedProductsIds` effect), so it only counts when the set of ids differs from `menu.products`.
  const isEmptyValue = (value) => value === undefined || value === null || value === ''
  const idOf = (item) => (item !== null && typeof item === 'object') ? item.id : item
  const sameIdSet = (a, b) => {
    const left = new Set((Array.isArray(a) ? a : []).map(item => String(idOf(item))))
    const right = new Set((Array.isArray(b) ? b : []).map(item => String(idOf(item))))
    return left.size === right.size && [...left].every(id => right.has(id))
  }
  const isPendingChange = (key, value) => {
    if (!menu?.id) {
      if ((key === 'delivery' || key === 'pickup') && value === true) return false
      if (key === 'products' && Array.isArray(value) && value.length === 0) return false
      return true
    }
    const saved = menu[key]
    if (key === 'products' || key === 'sites') return !sameIdSet(value, saved)
    if (key === 'schedule') return JSON.stringify(value) !== JSON.stringify(saved)
    if (typeof value === 'boolean' || typeof saved === 'boolean') return Boolean(value) !== Boolean(saved)
    if (isEmptyValue(value) && isEmptyValue(saved)) return false
    return value !== saved
  }
  const pendingChangeKeys = Object.keys(formState.changes || {}).filter(key => isPendingChange(key, formState.changes[key]))
  const isDirty = pendingChangeKeys.length > 0

  const handleSetSubCategoryList = (_selectedProductsIds) => {
    if (business?.categories?.length) {
      const _subCategoriesList = []
      const iterateCategories = (categories) => {
        return (
          categories?.length > 0 && categories?.forEach(category => {
            let productIds = []
            const _productIds = (category.products || []).reduce((ids, product) => [...ids, product.id], [])
            productIds = [...productIds, ..._productIds]
            if (category?.subcategories?.length) {
              category.subcategories.forEach(function iterate (category) {
                const _productIds = (category.products || []).reduce((ids, product) => [...ids, product.id], [])
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
      iterateCategories(business?.categories)
    }
  }

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            businessMenuState={businessMenuState}
            formState={formState}
            selectedProductsIds={selectedProductsIds}
            setSelectedProductsIds={setSelectedProductsIds}
            selectedProducts={selectedProducts}
            setSelectedProducts={setSelectedProducts}
            handleChangeInput={handleChangeInput}
            handleCheckOrderType={handleCheckOrderType}
            handleUpdateBusinessMenuOption={handleUpdateBusinessMenuOption}
            handleAddBusinessMenuOption={handleAddBusinessMenuOption}
            handleChangeScheduleState={handleChangeScheduleState}
            handleDeleteMenu={handleDeleteMenu}
            handleChangeMenuSite={handleChangeMenuSite}
            handleSelectAllChannels={handleSelectAllChannels}
            handleSelectNoneChannels={handleSelectNoneChannels}
            subCategoriesList={subCategoriesList}
            pendingChangeKeys={pendingChangeKeys}
            isDirty={isDirty}
            discardChanges={discardChanges}
          />
        )
      }
    </>
  )
}

BusinessMenuOptions.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
  * Business, this must be contains an object with all business info
  */
  business: PropTypes.object
}
