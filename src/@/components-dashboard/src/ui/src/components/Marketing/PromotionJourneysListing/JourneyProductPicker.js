import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronRight } from 'react-bootstrap-icons'

import {
  BusinessProductsListing as BusinessProductsListingController,
  useApi,
  useLanguage
} from '../../../../../index'
import {
  ProductCategory,
  ProductCategoryChildren,
  ProductCategoryHeader,
  ProductCategoryMeta,
  ProductCategorySelection,
  ProductCategoryToggle,
  ProductList,
  ProductOption,
  ProductPickerEmpty,
  ProductPickerHeader,
  ProductPickerLoadMore,
  ProductPickerSearch,
  ProductSelectionCount
} from './styles'

const isEnabled = item => item?.enabled !== false && Number(item?.enabled ?? 1) !== 0
const SNAPSHOT_PAGE_SIZE = 100
const AUTO_PAGE_BATCH_SIZE = 10

export const attachProductsToCategories = (categories = [], products = []) => {
  const productsByCategory = (products || []).reduce((groupedProducts, product) => {
    const categoryId = Number(product?.category_id ?? product?.category?.id)
    if (!Number.isFinite(categoryId)) return groupedProducts
    const categoryProducts = groupedProducts.get(categoryId) || []
    categoryProducts.push(product)
    groupedProducts.set(categoryId, categoryProducts)
    return groupedProducts
  }, new Map())

  const attachProducts = category => {
    const categoryProducts = [
      ...(category?.products || []),
      ...(productsByCategory.get(Number(category.id)) || [])
    ]
    return {
      ...category,
      products: [...new Map(categoryProducts.map(product => [Number(product.id), product])).values()],
      subcategories: (category?.subcategories || []).map(attachProducts)
    }
  }

  return (categories || []).map(attachProducts)
}

export const getCategoryProducts = category => {
  const products = new Map()
  const visit = node => {
    ;(node?.products || []).filter(isEnabled).forEach(product => products.set(Number(product.id), product))
    ;(node?.subcategories || []).filter(isEnabled).forEach(visit)
  }
  visit(category)
  return [...products.values()]
}

const matchesSearch = (value, query) => `${value?.name || ''} ${value?.description || ''}`.toLowerCase().includes(query)

export const filterCategoryTree = (categories = [], search = '') => {
  const query = search.trim().toLowerCase()
  return categories
    .filter(isEnabled)
    .sort((a, b) => Number(a.rank || 0) - Number(b.rank || 0))
    .map(category => {
      const sourceCategory = category.sourceCategory || category
      const categoryMatches = query && matchesSearch(category, query)
      const products = (category.products || [])
        .filter(isEnabled)
        .filter(product => !query || categoryMatches || matchesSearch(product, query))
      const subcategories = filterCategoryTree(category.subcategories || [], categoryMatches ? '' : query)
      return { ...category, products, subcategories, sourceCategory }
    })
    .filter(category => getCategoryProducts(category.sourceCategory).length > 0 &&
      (!query || category.products.length > 0 || category.subcategories.length > 0 || matchesSearch(category, query)))
}

const getCategorySelectionState = (category, selectedProductsIds = {}) => {
  const products = getCategoryProducts(category)
  const selected = products.filter(product => !!selectedProductsIds[product.id]).length
  if (!selected) return 'none'
  return selected === products.length ? 'all' : 'partial'
}

const getCatalogProductsById = (categories = [], products = []) => {
  const productsById = new Map()
  const addCategoryProducts = nodes => {
    ;(nodes || []).forEach(category => {
      ;(category.products || []).forEach(product => productsById.set(Number(product.id), product))
      addCategoryProducts(category.subcategories)
    })
  }
  addCategoryProducts(categories)
  ;(products || []).forEach(product => productsById.set(Number(product.id), product))
  return productsById
}

const CategoryNode = ({
  category,
  depth = 0,
  expandedCategories,
  forceExpanded,
  isFiltering,
  categorySelectionDisabled,
  selectedProductsIds,
  setExpandedCategories,
  setSelectedProductsIds,
  t
}) => {
  const sourceCategory = category.sourceCategory || category
  const selectionCategory = isFiltering ? category : sourceCategory
  const categoryProducts = getCategoryProducts(selectionCategory)
  const selectionState = getCategorySelectionState(selectionCategory, selectedProductsIds)
  const expanded = forceExpanded || expandedCategories.has(category.id)

  const toggleCategory = () => {
    const next = { ...selectedProductsIds }
    if (selectionState === 'all') {
      categoryProducts.forEach(product => delete next[product.id])
    } else {
      categoryProducts.forEach(product => {
        next[product.id] = { id: product.id, include: true, name: product.name }
      })
    }
    setSelectedProductsIds(next)
  }

  const toggleExpanded = () => {
    const next = new Set(expandedCategories)
    if (next.has(category.id)) next.delete(category.id)
    else next.add(category.id)
    setExpandedCategories(next)
  }

  const toggleProduct = product => {
    const next = { ...selectedProductsIds }
    if (next[product.id]) delete next[product.id]
    else next[product.id] = { id: product.id, include: true, name: product.name }
    setSelectedProductsIds(next)
  }

  return (
    <ProductCategory role='treeitem' aria-expanded={expanded} $depth={depth}>
      <ProductCategoryHeader selected={selectionState !== 'none'}>
        <ProductCategoryToggle
          type='button'
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-label={`${expanded ? t('COLLAPSE', 'Collapse') : t('EXPAND', 'Expand')} ${category.name}`}
        >
          <ChevronRight aria-hidden='true' />
        </ProductCategoryToggle>
        <ProductCategorySelection $disabled={categorySelectionDisabled}>
          <input
            type='checkbox'
            disabled={categorySelectionDisabled}
            checked={selectionState === 'all'}
            aria-checked={selectionState === 'partial' ? 'mixed' : selectionState === 'all'}
            aria-label={`${selectionState === 'all' ? t('REMOVE_ALL_PRODUCTS_IN', 'Remove all products in') : t('SELECT_ALL_PRODUCTS_IN', 'Select all products in')} ${category.name}`}
            ref={element => {
              if (element) element.indeterminate = selectionState === 'partial'
            }}
            onChange={toggleCategory}
          />
        </ProductCategorySelection>
        <span>{category.name}</span>
        <ProductCategoryMeta>{categoryProducts.length}</ProductCategoryMeta>
      </ProductCategoryHeader>
      {expanded && (
        <ProductCategoryChildren role='group'>
          {category.products.map(product => {
            const selected = !!selectedProductsIds[product.id]
            return (
              <ProductOption key={product.id} role='treeitem' selected={selected} $depth={depth + 1}>
                <input
                  type='checkbox'
                  checked={selected}
                  onChange={() => toggleProduct(product)}
                  aria-label={`${selected ? t('REMOVE', 'Remove') : t('SELECT', 'Select')} ${product.name}`}
                />
                <span>{product.name}</span>
                {selected && <Check aria-hidden='true' />}
              </ProductOption>
            )
          })}
          {category.subcategories.map(subcategory => (
            <CategoryNode
              key={subcategory.id}
              category={subcategory}
              depth={depth + 1}
              expandedCategories={expandedCategories}
              forceExpanded={forceExpanded}
              isFiltering={isFiltering}
              categorySelectionDisabled={categorySelectionDisabled}
              selectedProductsIds={selectedProductsIds}
              setExpandedCategories={setExpandedCategories}
              setSelectedProductsIds={setSelectedProductsIds}
              t={t}
            />
          ))}
        </ProductCategoryChildren>
      )}
    </ProductCategory>
  )
}

export const JourneyProductPickerUI = ({
  businessId,
  businessState,
  categoryState,
  errors,
  getPageProducts,
  searchValue,
  selectedProductsIds,
  setSelectedProductsIds,
  setSearchValue
}) => {
  const [, t] = useLanguage()
  const [search, setSearch] = useState('')
  const [expandedCategories, setExpandedCategories] = useState(new Set())
  const resolvedBusinessId = businessState.business?.id || businessId
  const searchScope = `${searchValue || ''}`.trim().toLowerCase()
  const localSearchScope = search.trim().toLowerCase()
  const isSearchReplacementPending = !!localSearchScope && !!searchScope && localSearchScope !== searchScope
  const pagingRef = useRef({
    businessId: resolvedBusinessId,
    searchScope,
    page: 0,
    autoPageLimit: AUTO_PAGE_BATCH_SIZE
  })
  const currentPage = Number(categoryState?.pagination?.currentPage || 0)
  const pageSize = Number(categoryState?.pagination?.pageSize || 0)
  const totalPages = Number(categoryState?.pagination?.totalPages || 0)
  const hasPagination = currentPage > 0 && totalPages > 0
  const hasProductError = !!errors?.length
  const catalogIncomplete = !!resolvedBusinessId && (
    isSearchReplacementPending ||
    !!categoryState?.loading ||
    (hasProductError && currentPage <= 0) ||
    (hasPagination && currentPage < totalPages)
  )
  const categoryTree = useMemo(() => attachProductsToCategories(
    businessState.business?.categories,
    categoryState?.products
  ), [businessState.business?.categories, categoryState?.products])
  const fullCategories = useMemo(() => filterCategoryTree(categoryTree), [categoryTree])
  const effectiveSearch = search.trim() || searchScope
  const categories = useMemo(() => filterCategoryTree(categoryTree, effectiveSearch), [categoryTree, effectiveSearch])
  const isFiltering = !!effectiveSearch
  const hasActiveSearch = isFiltering
  const selectedCount = Object.keys(selectedProductsIds || {}).length
  const businessError = businessState.error
  const hasCurrentPagingScope = pagingRef.current.businessId === resolvedBusinessId &&
    pagingRef.current.searchScope === searchScope
  const autoPageLimit = hasCurrentPagingScope
    ? pagingRef.current.autoPageLimit
    : AUTO_PAGE_BATCH_SIZE
  const stalledNextPage = hasCurrentPagingScope &&
    !categoryState?.loading &&
    pagingRef.current.page === currentPage + 1
  const autoPagingPaused = !isSearchReplacementPending && hasPagination && currentPage < totalPages &&
    (currentPage >= autoPageLimit || stalledNextPage)
  const enabledProductIds = useMemo(() => new Set(
    fullCategories.flatMap(getCategoryProducts).map(product => Number(product.id))
  ), [fullCategories])
  const catalogProducts = useMemo(() => getCatalogProductsById(
    categoryTree,
    categoryState?.products
  ), [categoryState?.products, categoryTree])
  const unavailableSelections = useMemo(() => businessState.loading || catalogIncomplete || hasActiveSearch
    ? []
    : Object.entries(selectedProductsIds || {}).reduce((selections, [key, selection]) => {
      const id = Number(selection?.id ?? key)
      if (!Number.isFinite(id) || enabledProductIds.has(id)) return selections
      const catalogProduct = catalogProducts.get(id)
      selections.push({
        ...selection,
        id,
        name: selection?.name || catalogProduct?.name || `${t('PRODUCT', 'Product')} #${id}`
      })
      return selections
    }, []), [
    businessState.loading,
    catalogIncomplete,
    hasActiveSearch,
    catalogProducts,
    enabledProductIds,
    selectedProductsIds,
    t
  ])
  const visibleUnavailableSelections = unavailableSelections
  const hasVisibleRows = categories.length > 0 || visibleUnavailableSelections.length > 0

  useEffect(() => {
    const nextSearchValue = search.trim()
    if (nextSearchValue === `${searchValue || ''}`.trim()) return
    const timeout = setTimeout(() => setSearchValue?.(nextSearchValue), 250)
    return () => clearTimeout(timeout)
  }, [search, searchValue])

  useEffect(() => {
    if (isSearchReplacementPending || !resolvedBusinessId || businessState.loading || businessError?.length || hasProductError || !getPageProducts) return

    if (!hasCurrentPagingScope) {
      pagingRef.current = {
        businessId: resolvedBusinessId,
        searchScope,
        page: 0,
        autoPageLimit: AUTO_PAGE_BATCH_SIZE
      }
      return
    }

    if (categoryState?.loading) return

    if (currentPage > 0 && currentPage < totalPages && currentPage < pagingRef.current.autoPageLimit) {
      const nextPage = currentPage + 1
      if (pagingRef.current.page === nextPage) return
      pagingRef.current.page = nextPage
      getPageProducts(false, undefined, pageSize || SNAPSHOT_PAGE_SIZE)
    }
  }, [
    businessState.loading,
    categoryState?.loading,
    currentPage,
    getPageProducts,
    pageSize,
    resolvedBusinessId,
    totalPages,
    businessError,
    hasProductError,
    hasCurrentPagingScope,
    isSearchReplacementPending,
    searchScope
  ])

  const retryProducts = () => {
    const isInitialPage = currentPage <= 0
    getPageProducts(isInitialPage, isInitialPage ? 1 : undefined, pageSize || SNAPSHOT_PAGE_SIZE)
  }

  const loadMoreProducts = () => {
    if (currentPage <= 0 || currentPage >= totalPages) return
    if (!hasCurrentPagingScope) {
      pagingRef.current = {
        businessId: resolvedBusinessId,
        searchScope,
        page: 0,
        autoPageLimit: AUTO_PAGE_BATCH_SIZE
      }
    }
    const nextPage = currentPage + 1
    if (pagingRef.current.page === nextPage && categoryState?.loading) return
    pagingRef.current.autoPageLimit = Math.min(totalPages, currentPage + AUTO_PAGE_BATCH_SIZE)
    pagingRef.current.page = nextPage
    getPageProducts(false, undefined, pageSize || SNAPSHOT_PAGE_SIZE)
  }

  return (
    <div>
      <ProductPickerHeader>
        <div>
          <h4>{t('QUICK_OFFER_ELIGIBLE_PRODUCTS', 'Eligible products')}</h4>
          <p>{t('QUICK_OFFER_ELIGIBLE_PRODUCTS_HINT', 'Choose a whole category or expand it to select individual products.')}</p>
          <p>{t('QUICK_OFFER_CATEGORY_SNAPSHOT_HINT', 'Selecting a category includes its currently enabled products. Products added later are not included automatically.')}</p>
        </div>
        <ProductSelectionCount>{selectedCount} {t('SELECTED', 'selected')}</ProductSelectionCount>
      </ProductPickerHeader>
      <ProductPickerSearch
        type='search'
        value={search}
        onChange={event => setSearch(event.target.value)}
        placeholder={t('SEARCH_PRODUCTS', 'Search products')}
        aria-label={t('SEARCH_PRODUCTS', 'Search products')}
      />
      {businessError?.length
        ? <ProductPickerEmpty role='alert'>{Array.isArray(businessError) ? businessError.join(', ') : String(businessError)}</ProductPickerEmpty>
        : businessState.loading || (!fullCategories.length && catalogIncomplete && !hasProductError && !autoPagingPaused)
          ? <ProductPickerEmpty>{t('LOADING', 'Loading')}...</ProductPickerEmpty>
          : (
            <>
              {hasVisibleRows
                ? (
              <ProductList role='tree'>
                {categories.map(category => (
                  <CategoryNode
                    key={category.id}
                    category={category}
                    expandedCategories={expandedCategories}
                    forceExpanded={!!search.trim()}
                    isFiltering={isFiltering}
                    categorySelectionDisabled={catalogIncomplete}
                    selectedProductsIds={selectedProductsIds}
                    setExpandedCategories={setExpandedCategories}
                    setSelectedProductsIds={setSelectedProductsIds}
                    t={t}
                  />
                ))}
                {visibleUnavailableSelections.length > 0 && (
                  <ProductCategory role='treeitem' aria-expanded='true'>
                    <ProductCategoryHeader selected>
                      <span>{t('UNAVAILABLE', 'Unavailable')}</span>
                      <ProductCategoryMeta>{visibleUnavailableSelections.length}</ProductCategoryMeta>
                    </ProductCategoryHeader>
                    <ProductCategoryChildren role='group'>
                      {visibleUnavailableSelections.map(product => (
                        <ProductOption key={product.id} role='treeitem' selected $depth={1}>
                          <input
                            type='checkbox'
                            checked
                            onChange={() => {
                              const next = { ...selectedProductsIds }
                              delete next[product.id]
                              setSelectedProductsIds(next)
                            }}
                            aria-label={`${t('REMOVE', 'Remove')} ${product.name}`}
                          />
                          <span>{product.name}</span>
                          <Check aria-hidden='true' />
                        </ProductOption>
                      ))}
                    </ProductCategoryChildren>
                  </ProductCategory>
                )}
              </ProductList>
                  )
                : !catalogIncomplete && !hasProductError
                    ? <ProductPickerEmpty>{t('NO_PRODUCTS_FOUND', 'No products found.')}</ProductPickerEmpty>
                    : null}
              {hasProductError && (
                <ProductPickerEmpty role='alert'>
                  <div>{Array.isArray(errors) ? errors.join(', ') : String(errors)}</div>
                  <ProductPickerLoadMore type='button' onClick={retryProducts}>
                    {t('RETRY', 'Retry')}
                  </ProductPickerLoadMore>
                </ProductPickerEmpty>
              )}
              {autoPagingPaused && !hasProductError
                ? (
                  <ProductPickerEmpty>
                    <p>{t('QUICK_OFFER_CATEGORY_SELECTION_LOAD_MORE_HINT', 'Load the remaining products to enable whole-category selection.')}</p>
                    <ProductPickerLoadMore type='button' onClick={loadMoreProducts}>
                      {t('LOAD_MORE', 'Load more')}
                    </ProductPickerLoadMore>
                  </ProductPickerEmpty>
                  )
                : catalogIncomplete && !hasProductError && <ProductPickerEmpty aria-live='polite'>{t('LOADING', 'Loading')}...</ProductPickerEmpty>}
            </>
            )}
    </div>
  )
}

const JourneyProductPickerControllerUI = props => (
  <JourneyProductPickerUI
    {...props}
    setSearchValue={props.handleChangeSearch}
  />
)

export const JourneyProductPicker = ({ businessId, businessSlug, ...props }) => {
  const [ordering] = useApi()
  const [isInitialRender, setIsInitialRender] = useState(false)

  return (
    <BusinessProductsListingController
      {...props}
      ordering={ordering}
      slug={businessSlug || String(businessId)}
      businessId={businessId}
      UIComponent={JourneyProductPickerControllerUI}
      isInitialRender={isInitialRender}
      handleUpdateInitialRender={setIsInitialRender}
      propsToFetch={['id', 'categories']}
      initialProductPageSize={SNAPSHOT_PAGE_SIZE}
      deferProductsUntilBusinessLoaded
      restoreProductListOnSearchClear
      isSearchByName
      isSearchByDescription
      version='v2'
    />
  )
}
