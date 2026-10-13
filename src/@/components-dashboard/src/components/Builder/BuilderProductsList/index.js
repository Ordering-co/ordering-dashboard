import React, { useEffect, useRef, useState } from 'react'

import { useApi } from '../../../contexts/ApiContext'
import { useSession } from '../../../contexts/SessionContext'
import {
  BUILDER_PRODUCT_TYPES,
  BUILDER_ERROR_CODES,
  createBuilderProduct,
  getBuilderCatalog,
  getBuilderErrorKind,
  listBuilderProducts
} from '../builderApi'

/**
 * Builder section list: apps and websites of the project, filters,
 * pagination, the create catalog and the create action. Filters run on the
 * server; `productTypes` empty means every type.
 */
export const BuilderProductsList = (props) => {
  const { UIComponent, initialPageSize = 10 } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()

  const [productsState, setProductsState] = useState({ loading: true, products: [], errorKind: null })
  const [pagination, setPagination] = useState({ currentPage: 1, pageSize: initialPageSize, totalPages: 0, total: 0 })
  const [filters, setFilters] = useState({ search: '', productTypes: [], productStatus: 'all' })
  const [catalogState, setCatalogState] = useState({ loading: true, bases: [], canCreate: false, unavailableReason: null })
  const [createState, setCreateState] = useState({ loading: false, errorCodes: [], error: null })
  const requestId = useRef(0)

  const getProducts = async ({ page = pagination.currentPage, pageSize = pagination.pageSize, nextFilters = filters } = {}) => {
    const current = ++requestId.current
    setProductsState(prev => ({ ...prev, loading: true }))
    const response = await listBuilderProducts(ordering, token, {
      page,
      pageSize,
      search: nextFilters.search,
      productTypes: nextFilters.productTypes.length ? nextFilters.productTypes : BUILDER_PRODUCT_TYPES,
      productStatuses: nextFilters.productStatus === 'all' ? null : [nextFilters.productStatus]
    })
    // Drop answers to older requests (fast typing, quick filter changes)
    if (current !== requestId.current) return
    if (response.error) {
      setProductsState({ loading: false, products: [], errorKind: getBuilderErrorKind(response) })
      return
    }
    setProductsState({ loading: false, products: response.result || [], errorKind: null })
    setPagination({
      currentPage: response.pagination?.current_page ?? page,
      pageSize,
      totalPages: response.pagination?.total_pages ?? 0,
      total: response.pagination?.total ?? (response.result || []).length
    })
  }

  /**
   * Create is offered only with at least one app base or website type. Otherwise
   * `unavailableReason` says why: `not_enabled` (404, the project has no
   * self-service), `empty` (nothing offered right now) or `error`.
   */
  const getCatalog = async () => {
    setCatalogState(prev => ({ ...prev, loading: true }))
    const response = await getBuilderCatalog(ordering, token)
    const bases = !response.error && Array.isArray(response.result) ? response.result : []
    const unavailableReason = response.error
      ? (response.status === 404 ? 'not_enabled' : 'error')
      : (bases.length ? null : 'empty')
    setCatalogState({ loading: false, bases, canCreate: bases.length > 0, unavailableReason })
  }

  const changeFilters = (changes) => {
    const nextFilters = { ...filters, ...changes }
    setFilters(nextFilters)
    getProducts({ page: 1, nextFilters })
  }

  const handleChangeSearch = (search) => changeFilters({ search: search ?? '' })
  /** The types to show; an empty list shows every type. */
  const handleChangeType = (productTypes) => changeFilters({ productTypes })
  const handleChangeStatus = (productStatus) => changeFilters({ productStatus })
  const handleClearFilters = () => changeFilters({ search: '', productTypes: [], productStatus: 'all' })
  const handleChangePage = (page) => getProducts({ page })
  const handleChangePageSize = (pageSize) => getProducts({ page: 1, pageSize })

  /**
   * Creates a draft app (`builderBaseId`) or website (`productType`).
   * Returns `{ product, errorCodes }`; `product` is null on error. A base
   * withdrawn meanwhile reloads the catalog.
   */
  const createProduct = async ({ builderBaseId, productType, name }) => {
    setCreateState({ loading: true, errorCodes: [], error: null })
    const response = await createBuilderProduct(ordering, token, { builderBaseId, productType, name: String(name ?? '').trim() })
    if (response.error) {
      setCreateState({ loading: false, errorCodes: response.errorCodes, error: getBuilderErrorKind(response) })
      if (response.errorCodes.includes(BUILDER_ERROR_CODES.baseNotOffered)) getCatalog()
      return { product: null, errorCodes: response.errorCodes }
    }
    setCreateState({ loading: false, errorCodes: [], error: null })
    return { product: response.result, errorCodes: [] }
  }

  const resetCreateState = () => setCreateState({ loading: false, errorCodes: [], error: null })

  useEffect(() => {
    if (!token) return
    getProducts({ page: 1 })
    getCatalog()
  }, [token, ordering.root])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          productsState={productsState}
          pagination={pagination}
          filters={filters}
          catalogState={catalogState}
          createState={createState}
          reloadProducts={() => getProducts()}
          reloadCatalog={getCatalog}
          handleChangeSearch={handleChangeSearch}
          handleChangeType={handleChangeType}
          handleChangeStatus={handleChangeStatus}
          handleClearFilters={handleClearFilters}
          handleChangePage={handleChangePage}
          handleChangePageSize={handleChangePageSize}
          createProduct={createProduct}
          resetCreateState={resetCreateState}
        />
      )}
    </>
  )
}
