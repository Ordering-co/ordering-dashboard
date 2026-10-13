import React, { useEffect, useRef, useState } from 'react'
import PropTypes, { string } from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useEvent } from '../../contexts/EventContext'
import { useAssistantPageEntities, useAssistantRecordChanges } from '../../contexts/AssistantContext'

/** The category tree with `update(category)` applied to each category, at any depth */
const mapCategories = (categories, update) => (categories || []).map(category => {
  const next = update(category)
  return Array.isArray(next?.subcategories)
    ? { ...next, subcategories: mapCategories(next.subcategories, update) }
    : next
})

/**
 * Force lazy load products to fix 504 of products with many suboptions
 * Remove when version v2 allow avoid bringing extras
 * @type {boolean}
 */
const forceLazyLoadProducts = true

export const BusinessProductsListing = (props) => {
  props = { ...defaultProps, ...props }
  const {
    isSearchByName,
    isSearchByDescription,
    slug,
    categoryId,
    productId,
    isAllCategoryProducts,
    isInitialRender,
    ordering,
    UIComponent,
    propsToFetch,
    version,
    businessId,
    initialProductPageSize,
    deferProductsUntilBusinessLoaded,
    restoreProductListOnSearchClear,
    shareWithAssistant
  } = props

  const [{ token }] = useSession()
  const [events] = useEvent()
  const [categorySelected, setCategorySelected] = useState(null)
  const [searchValue, setSearchValue] = useState(null)
  const [businessState, setBusinessState] = useState({ business: {}, menus: null, loading: true, error: null })
  const [categoriesState, setCategoriesState] = useState({})
  const [requestsState, setRequestsState] = useState({})
  const productsRequestRef = useRef({ id: 0, source: null })

  // The URL only has the store slug: tell the assistant which store and category this is.
  // Only the products page does; the pickers that reuse this controller show another store.
  const assistantBusiness = businessState.business
  const assistantCategory = categorySelected?.id && categorySelected.id !== 'featured' ? categorySelected : null
  useAssistantPageEntities(assistantBusiness?.id
    ? {
        business: { id: assistantBusiness.id, name: assistantBusiness.name ?? null },
        category: assistantCategory ? { id: assistantCategory.id, name: assistantCategory.name ?? null } : null
      }
    : null, !!shareWithAssistant)

  // The assistant changed this store, one of its categories or products: show the values it read back
  useAssistantRecordChanges(({ entity, id, ids, after }) => {
    const business = businessState.business
    if (!after || !id || !business?.id || ids.business_id !== business.id) return

    if (entity === 'Business') {
      setBusinessState(prev => ({ ...prev, business: { ...prev.business, ...after } }))
    } else if (entity === 'Category') {
      setBusinessState(prev => ({
        ...prev,
        business: {
          ...prev.business,
          categories: mapCategories(prev.business?.categories, category => category?.id === id ? { ...category, ...after } : category)
        }
      }))
      if (categorySelected?.id === id) setCategorySelected(prev => ({ ...prev, ...after }))
    } else if (entity === 'Product') {
      const updateProduct = product => product?.id === id ? { ...product, ...after } : product
      setBusinessState(prev => ({
        ...prev,
        business: {
          ...prev.business,
          categories: mapCategories(prev.business?.categories, category => (
            Array.isArray(category?.products) ? { ...category, products: category.products.map(updateProduct) } : category
          ))
        }
      }))
      setCategoryState(prev => Array.isArray(prev?.products) ? { ...prev, products: prev.products.map(updateProduct) } : prev)
    }
  })
  const previousSearchValueRef = useRef(searchValue)
  const [productModal, setProductModal] = useState({ product: null, loading: false, error: null })
  const [openCategories, setOpenCategories] = useState({ values: [] })
  const [businessSlug, setBusinessSlug] = useState(slug)
  const [isUpdateMode, setIsUpdateMode] = useState(false)
  const [taxes, setTaxes] = useState({})
  const [fees, setFees] = useState({})
  const [formTaxState, setFormTaxState] = useState({ loading: false, changes: {}, result: { error: false } })
  const [formFeeState, setFormFeeState] = useState({ loading: false, changes: {}, result: { error: false } })
  const [businessTypes, setBusinessTypes] = useState([])
  const [siteState, setSiteState] = useState({ site: null, loading: false, error: null })
  const canLoadProducts = !deferProductsUntilBusinessLoaded || !businessState.loading
  const hasInitialProductPageSize = Number(initialProductPageSize) > 0
  const productPageSize = hasInitialProductPageSize ? Number(initialProductPageSize) : 10
  const categoryStateDefault = {
    loading: true,
    pagination: { currentPage: 0, pageSize: productPageSize, totalItems: null, totalPages: 0, nextPageItems: productPageSize },
    products: []
  }

  const [categoryState, setCategoryState] = useState(categoryStateDefault)
  const [errors, setErrors] = useState(null)
  const [errorQuantityProducts, setErrorQuantityProducts] = useState(false)

  const getProductsStateKey = (search = searchValue) => {
    const businessScope = businessState.business?.id ?? businessId ?? businessSlug ?? slug ?? null
    const categoryScope = categorySelected?.id === 'featured'
      ? 'featured'
      : categorySelected?.id
        ? `categoryId:${categorySelected.id}`
        : 'all'
    const normalizedSearch = `${search || ''}`.trim().toLowerCase()
    return JSON.stringify([businessScope, categoryScope, normalizedSearch])
  }

  /**
   * Change category selected
   * @param {Object} category Category object
   */
  const handleChangeCategory = (e, category) => {
    if (e === null && category === null) {
      setCategorySelected(null)
    }
    const isInvalid = e?.target?.closest && (e?.target?.closest('.business_enable_control') || e.target.closest('.business_actions'))
    if (isInvalid || category?.id === categorySelected?.id) return
    setIsUpdateMode(false)
    if (category?.subcategories?.length) {
      if (!category?.parent_category_id) {
        openCategories.values = []
      }
      if (openCategories.values.includes(category?.id)) {
        openCategories.values = openCategories.values.filter(categoryId => categoryId !== category?.id)
      } else {
        openCategories.values.push(category?.id)
      }
      setOpenCategories({
        ...openCategories,
        values: openCategories.values
      })
    }
    if (category?.id === null) {
      setOpenCategories({ ...openCategories, values: [] })
    }
    setCategorySelected(category)
  }

  /**
   * Change search value
   * @param {string} search search string
   */
  const handleChangeSearch = (search) => {
    setSearchValue(search)
  }

  const isMatchSearch = (name, description) => {
    if (!searchValue) return true
    return (name && (name.toLowerCase().includes(searchValue.toLowerCase()) && isSearchByName)) ||
      (description && (description.toLowerCase().includes(searchValue.toLowerCase()) && isSearchByDescription))
  }

  const getProducts = async (newFetch, currentPage, currentPageSize) => {
    const requestId = productsRequestRef.current.id + 1
    productsRequestRef.current.source?.cancel?.()
    productsRequestRef.current = { id: requestId, source: null }
    setErrors(null)
    if (!forceLazyLoadProducts && !businessState?.business?.lazy_load_products_recommended) {
      const categoryState = {
        ...categoryStateDefault,
        loading: false
      }
      if (categorySelected) {
        let categoryFinded
        const _categories = [...businessState?.business?.categories]
        _categories.forEach(function iterate (category) {
          if (category?.id === categorySelected?.id) {
            categoryFinded = category
          }
          Array.isArray(category?.subcategories) && category.subcategories.forEach(iterate)
        })

        let productsFinded = [...categoryFinded?.products]
        if (categoryFinded && categoryFinded?.subcategories) {
          categoryFinded.subcategories.forEach(function iterate (category) {
            productsFinded = [...productsFinded, ...category.products]
            Array.isArray(category?.subcategories) && category.subcategories.forEach(iterate)
          })
        }

        let productsFiltered = productsFinded?.filter(
          product => isMatchSearch(product.name, product.description)
        )

        if (!productsFiltered) {
          productsFiltered = categorySelected?.products?.filter(
            product => isMatchSearch(product.name, product.description)
          )
        }
        categoryState.products = productsFiltered || []
      } else {
        const productsFiltered = businessState?.business?.categories?.reduce(
          (products, category) => {
            if (category.products) {
              return [...products, ...category.products]
            }
            return [...products]
          }
          , []
        ).filter(
          product => isMatchSearch(product.name, product.description)
        )
        categoryState.products = productsFiltered || []
      }

      setCategoryState({
        ...categoryState,
        products: [...new Map(categoryState.products.map(item => [item.id, item])).values()]
      })
      return
    }

    const categoryKey = getProductsStateKey()

    const cachedCategoryState = categoriesState[categoryKey] || categoryStateDefault
    const isSearchRequest = !!`${searchValue || ''}`.trim()
    const activePageSize = Number(categoryState?.pagination?.pageSize) > 0
      ? Number(categoryState.pagination.pageSize)
      : productPageSize
    const requestCategoryState = newFetch && isSearchRequest
      ? {
          ...categoryStateDefault,
          pagination: {
            ...categoryStateDefault.pagination,
            pageSize: activePageSize,
            nextPageItems: activePageSize
          }
        }
      : cachedCategoryState
    const pagination = requestCategoryState.pagination
    const requestedPageSize = Number(currentPageSize) > 0
      ? Number(currentPageSize)
      : pagination.pageSize

    if (!isUpdateMode) {
      setCategoryState({ ...requestCategoryState, loading: true })
    }

    const parameters = {
      page: currentPage || (newFetch ? 1 : pagination.currentPage + 1),
      page_size: requestedPageSize,
      version: 'v2'
    }

    let where = null
    const searchConditions = []
    if (searchValue) {
      if (isSearchByName) {
        searchConditions.push(
          {
            attribute: 'name',
            value: {
              condition: 'ilike',
              value: encodeURI(`%${searchValue}%`)
            }
          }
        )
      }
      if (isSearchByDescription) {
        searchConditions.push(
          {
            attribute: 'description',
            value: {
              condition: 'ilike',
              value: encodeURI(`%${searchValue}%`)
            }
          }
        )
      }
    }

    where = {
      conditions: searchConditions,
      conector: 'OR'
    }

    try {
      const resolvedBusinessId = businessState.business?.id || businessId
      if (!resolvedBusinessId) {
        throw new Error('A business is required to load products.')
      }
      const functionFetch = categorySelected?.id && categorySelected?.id !== 'featured'
        ? ordering.businesses(resolvedBusinessId).categories(categorySelected?.id).products()
        : ordering.businesses(resolvedBusinessId).products()
      const source = {}
      productsRequestRef.current = { id: requestId, source }
      const productEndpoint = where.conditions.length > 0
        ? functionFetch.parameters(parameters).where(where)
        : functionFetch.parameters(parameters)
      const { content: { error, result, pagination } } = await productEndpoint.get({ cancelToken: source })
      if (productsRequestRef.current.id !== requestId) return
      if (!error) {
        const responsePageSize = Number(pagination?.page_size)
        const newcategoryState = {
          pagination: {
            ...requestCategoryState.pagination,
            pageSize: responsePageSize > 0
              ? responsePageSize
              : requestedPageSize,
            currentPage: pagination?.current_page,
            totalItems: pagination?.total,
            totalPages: pagination?.total_pages
          },
          loading: false,
          products: newFetch ? [...result] : [...requestCategoryState.products, ...result]
        }

        if (forceLazyLoadProducts || businessState?.business?.lazy_load_products_recommended) {
          if (categorySelected?.id && categorySelected?.id !== 'featured') {
            const updatedCategorySelected = { ...categorySelected }

            if (newFetch) {
              updatedCategorySelected.products = [...result]
            } else {
              const existingProducts = updatedCategorySelected.products || []
              const combinedProducts = [...existingProducts, ...result]
              updatedCategorySelected.products = [...new Map(combinedProducts.map(item => [item.id, item])).values()]
            }

            setCategorySelected(updatedCategorySelected)
          }
        }

        categoriesState[categoryKey] = newcategoryState
        setCategoryState({
          ...newcategoryState,
          products: [...new Map(newcategoryState.products.map(item => [item.id, item])).values()]
        })
        setCategoriesState({ ...categoriesState })
      } else {
        setErrors(result)
      }
    } catch (err) {
      if (productsRequestRef.current.id !== requestId) return
      setErrors([err.message])
    } finally {
      if (productsRequestRef.current.id === requestId) {
        productsRequestRef.current = { id: requestId, source: null }
        setCategoryState(prev => ({ ...prev, loading: false }))
      }
    }
  }

  const getProduct = async () => {
    if (categoryId && productId && businessState.business?.id) {
      try {
        setProductModal({
          ...productModal,
          loading: true
        })
        const source = {}
        requestsState.product = source

        const { content: { result } } = await ordering
          .businesses(businessState.business?.id)
          .categories(categoryId)
          .products(productId)
          .parameters({ params: 'taxes', version: 'v2' })
          .get({ cancelToken: source })
        const product = Array.isArray(result) ? null : result
        setProductModal({
          ...productModal,
          product,
          loading: false
        })
      } catch (e) {
        setProductModal({
          ...productModal,
          loading: false,
          error: [e]
        })
      }
    }
  }

  const getTaxes = async () => {
    const taxesObject = {}
    setFormTaxState({
      ...formTaxState,
      loading: true
    })
    const response = await fetch(`${ordering.root}/taxes`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    })
    const { error, result } = await response.json()
    if (!error) {
      result.forEach(tax => (taxesObject[`id:${tax?.id}`] = tax))
      setTaxes(taxesObject)
      return
    }
    setFormTaxState({
      ...formTaxState,
      result: {
        error: true,
        result: taxesObject
      },
      loading: false
    })
  }

  const getFees = async () => {
    const feesObject = {}
    setFormFeeState({
      ...formFeeState,
      loading: true
    })
    const where = JSON.stringify({ type: 'product' })
    const response = await fetch(`${ordering.root}/fees?where=${where}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    })
    const { error, result } = await response.json()
    if (!error) {
      result.forEach(fee => (feesObject[`id:${fee?.id}`] = fee))
      setFees(feesObject)
      return
    }
    setFormFeeState({
      ...formFeeState,
      result: {
        error: true,
        result: feesObject
      },
      loading: false
    })
  }

  /**
   * Method to get the themes from API
   */
  const getSites = async () => {
    try {
      setSiteState({ ...siteState, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/sites`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        const site = result.find(site => site.code === 'website')
        setSiteState({ ...siteState, loading: false, site })
      } else {
        setSiteState({ ...siteState, loading: false, error: result })
      }
    } catch (err) {
      setSiteState({ ...siteState, loading: false, error: [err.message] })
    }
  }

  const getBusinessTypes = async () => {
    try {
      const response = await fetch(`${ordering.root}/business_types?where=[{"attribute":"enabled","value":true}]`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      const { error, result } = await response.json()
      if (!error) {
        setBusinessTypes(result)
      }
    } catch {}
  }

  useEffect(() => {
    if (isInitialRender) {
      getProduct()
    }
  }, [JSON.stringify(businessState.business?.id), isInitialRender])

  useEffect(() => {
    setBusinessSlug(slug)
  }, [slug])

  const getBusiness = async () => {
    try {
      setBusinessState({ ...businessState, loading: true })
      const source = {}
      requestsState.business = source
      setRequestsState({ ...requestsState })
      const parameters = {
        version: version || 'v2'
      }
      const { content: { result } } = await ordering.businesses(businessSlug).asDashboard().select(propsToFetch).parameters(parameters).get()

      if (!result?.categories || result?.categories?.length === 0) {
        setErrorQuantityProducts(true)
      }

      setBusinessState({
        ...businessState,
        business: result,
        loading: false
      })
    } catch (err) {
      setBusinessState({
        ...businessState,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Method to update the business
   */
  const handleUpdateBusinessState = (result) => {
    setIsUpdateMode(true)
    const business = { ...businessState?.business }
    Object.assign(business, result)
    if (categorySelected) {
      business.categories.forEach(function iterate (category) {
        if (category?.id === categorySelected?.id) {
          setCategorySelected(category)
        }
        Array.isArray(category?.subcategories) && category.subcategories.forEach(iterate)
      })
    }
    setBusinessState({
      ...businessState,
      business
    })
  }

  /**
   * Method to update the category state
   */
  const handleUpdateCategoryState = (updatedCategory) => {
    setCategoryState(updatedCategory)
  }

  const handleUpdateTaxesProducts = ({ tax, isRemove, id }) => {
    const _categories = [...businessState?.business?.categories]
    const replaceSameTaxes = (categories, tax) => {
      for (let i = 0; i < categories?.length; i++) {
        const category = categories[i]
        for (let j = 0; j < category.products?.length; j++) {
          const product = category.products[j]
          if (isRemove && (product.tax?.id === tax?.id || product.tax_id === tax?.id)) {
            product.tax = null
            product.tax_id = null
            if (Array.isArray(product.taxes)) {
              product.taxes = product.taxes.filter(t => (typeof t === 'object' ? t.id : t) !== tax?.id)
            }
          } else if (product.tax && product.tax?.id === tax?.id) {
            Object.assign(product.tax, tax)
            product.tax_id = tax?.id
            if (Array.isArray(product.taxes)) {
              product.taxes = product.taxes.map(t => {
                const taxId = typeof t === 'object' ? t.id : t
                return taxId === tax?.id ? tax : t
              })
            }
          } else if (Array.isArray(product.taxes) && product.taxes.some(t => (typeof t === 'object' ? t.id : t) === tax?.id)) {
            product.taxes = product.taxes.map(t => {
              const taxId = typeof t === 'object' ? t.id : t
              return taxId === tax?.id ? tax : t
            })
          }
        }
        if (category.subcategories?.length > 0) {
          categories.subcategories = replaceSameTaxes(categories.subcategories, tax)
        }
      }
      return categories
    }
    setBusinessState({
      ...businessState,
      business: {
        ...businessState.business,
        categories: replaceSameTaxes(_categories, tax)
      }
    })
  }

  const handleUpdateFeesProducts = ({ fee, isRemove }) => {
    const _categories = [...businessState?.business?.categories]
    const replaceSameFees = (categories, fee) => {
      for (let i = 0; i < categories?.length; i++) {
        const category = categories[i]
        for (let j = 0; j < category.products.length; j++) {
          const product = category.products[j]
          if (isRemove && product.fee?.id === fee?.id) {
            product.fee = null
            product.fee_id = null
          } else if (product.fee && product.fee?.id === fee?.id) {
            Object.assign(product.fee, fee)
            product.fee_id = fee?.id
          }
        }
        if (category.subcategories?.length > 0) {
          categories.subcategories = replaceSameFees(categories.subcategories, fee)
        }
      }
      return categories
    }
    setBusinessState({
      ...businessState,
      business: {
        ...businessState.business,
        categories: replaceSameFees(_categories, fee)
      }
    })
  }

  useEffect(() => {
    if (businessState.loading) return
    if (!businessState.loading && (categorySelected || isAllCategoryProducts)) {
      getProducts(true)
    }
  }, [businessState?.loading])

  useEffect(() => {
    if (!canLoadProducts) return
    const previousSearchValue = previousSearchValueRef.current
    previousSearchValueRef.current = searchValue
    const restoredCategoryKey = getProductsStateKey(null)
    const cachedCategoryState = categoriesState[restoredCategoryKey]

    if (restoreProductListOnSearchClear && previousSearchValue && !searchValue && cachedCategoryState) {
      productsRequestRef.current.source?.cancel?.()
      productsRequestRef.current = {
        id: productsRequestRef.current.id + 1,
        source: null
      }
      setErrors(null)
      setCategoryState({
        ...cachedCategoryState,
        loading: false,
        products: [...cachedCategoryState.products]
      })
      return
    }

    if (searchValue === null || searchValue === '') {
      if (hasInitialProductPageSize) {
        getProducts(true, 1, productPageSize)
      } else {
        getProducts(true, 1)
      }
    } else {
      getProducts(searchValue)
    }
  }, [categorySelected?.id, searchValue, canLoadProducts])

  useEffect(() => {
    if (businessSlug) {
      getBusiness()
    } else {
      setBusinessState({ ...businessState, loading: false, business: {} })
      setCategoriesState({})
      setCategoryState({ ...categoryStateDefault, loading: false })
      setCategorySelected(null)
    }
  }, [businessSlug])

  useEffect(() => {
    if (!businessState?.business) return
    if (Object.keys(businessState?.business)?.length > 0) {
      events.on('tax_changed', handleUpdateTaxesProducts)
      events.on('fee_changed', handleUpdateFeesProducts)
      events.on('tax_deleted', handleUpdateTaxesProducts)
      events.on('fee_deleted', handleUpdateFeesProducts)
      return () => {
        events.off('tax_changed', handleUpdateTaxesProducts)
        events.off('fee_changed', handleUpdateFeesProducts)
        events.off('tax_deleted', handleUpdateFeesProducts)
        events.off('fee_deleted', handleUpdateFeesProducts)
      }
    }
  }, [businessState?.business])

  /**
   * Cancel business request
   */
  useEffect(() => {
    const request = requestsState.business
    return () => {
      request && request.cancel && request.cancel()
    }
  }, [requestsState.business])

  /** Cancel the active products request and invalidate late handlers on unmount. */
  useEffect(() => {
    return () => {
      productsRequestRef.current.source?.cancel?.()
      productsRequestRef.current = {
        id: productsRequestRef.current.id + 1,
        source: null
      }
    }
  }, [])

  useEffect(() => {
    getTaxes()
    getFees()
    getBusinessTypes()
    getSites()
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          errors={errors}
          categorySelected={categorySelected}
          searchValue={searchValue}
          categoryState={categoryState}
          businessState={businessState}
          productModal={productModal}
          errorQuantityProducts={errorQuantityProducts}
          handleChangeCategory={handleChangeCategory}
          handleChangeSearch={handleChangeSearch}
          getPageProducts={getProducts}
          getBusiness={getBusiness}
          setCategorySelected={setCategorySelected}
          setBusinessState={setBusinessState}
          handleUpdateBusinessState={handleUpdateBusinessState}
          updateProductModal={(val) => setProductModal({ ...productModal, product: val })}
          openCategories={openCategories.values}
          setOpenCategories={setOpenCategories}
          setBusinessSlug={setBusinessSlug}
          handleUpdateCategoryState={handleUpdateCategoryState}
          setFormTaxState={setFormTaxState}
          formTaxState={formTaxState}
          taxes={taxes}
          setTaxes={setTaxes}
          fees={fees}
          setFees={setFees}
          businessTypes={businessTypes}
          setBusinessTypes={setBusinessTypes}
          siteState={siteState}
        />
      )}
    </>
  )
}

BusinessProductsListing.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Array of product props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string),
  /**
   * true, flag to decide search parmeter
   */
  isSearchByName: PropTypes.bool,
  /**
   * true, flag to decide search parmeter
   */
  isSearchByDescription: PropTypes.bool,
  /**
   * Slug from Store
   */
  slug: PropTypes.string,
  /**
   * Business id used when only a lightweight business record is available.
   */
  businessId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  /**
   * Page size used by the controller-owned initial product request.
   */
  initialProductPageSize: PropTypes.number,
  /**
   * Wait for the business request before issuing the initial product request.
   */
  deferProductsUntilBusinessLoaded: PropTypes.bool,
  /**
   * Restore the cached unfiltered product state instead of refetching it after search.
   */
  restoreProductListOnSearchClear: PropTypes.bool,
  /**
   * Tell the assistant this is the store the page shows (the products page only, not the pickers).
   */
  shareWithAssistant: PropTypes.bool,
  /**
   * True, flag to make initial API call
   */
  isInitialRender: PropTypes.bool

}

const defaultProps = {
  deferProductsUntilBusinessLoaded: false,
  restoreProductListOnSearchClear: false,
  shareWithAssistant: false,
  propsToFetch: ['id', 'vertical', 'categories', 'name', 'email', 'slug', 'schedule', 'description', 'about', 'logo', 'header', 'phone', 'cellphone', 'owner_id', 'city_id', 'address', 'address_notes', 'zipcode', 'location', 'featured', 'timezone', 'currency', 'food', 'alcohol', 'groceries', 'laundry', 'use_printer', 'printer_id', 'minimum', 'delivery_price', 'always_deliver', 'tax_type', 'tax', 'delivery_time', 'pickup_time', 'service_fee', 'fixed_usage_fee', 'percentage_usage_fee', 'order_default_priority', 'cancel_order_after_minutes', 'enabled', 'preorder_time', 'maximum', 'schedule_ranges', 'franchise_id', 'external_id', 'front_layout', 'seo_image', 'seo_title', 'seo_description', 'eta_status_times', 'eta_variation_time', 'price_level', 'facebook_profile', 'instagram_profile', 'tiktok_profile', 'snapchat_profile', 'pinterest_profile', 'whatsapp_number', 'delivery_tax_rate', 'delivery_tax_type', 'disabled_reason', 'menus_count', 'available_menus_count', 'menus_shared_count', 'available_menus_shared_count', 'professionals', 'configs', 'checkoutfields', 'reviews', 'open', 'today', 'lazy_load_products_recommended', 'available_products_count', 'valid_service', 'num_zones', 'types', 'metafields', 'owners', 'gallery', 'city', 'webhooks', 'maximums', 'paymethods', 'ribbon', 'offers', 'tax_id', 'custom_tax']
}
