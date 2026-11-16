import React, { useState, useEffect } from 'react'
import { useLanguage, ReviewProductList as ReviewProductListController } from '../../../../../index'
import { addQueryToUrl } from '../../../utils'
import { ReviewsPagination, ReviewsTable } from '../ReviewsDirectory/ReviewsTable'

// redesign reviews FD1 (D9, RV-03, RV-05, RV-08): the products list is a Product table with a Product foot. It no longer mounts
// the panel: the page opens it in its SplitView, so this list tells which product was chosen (`onOpenRow`) and draws which one
// is open (`activeId`). The products still come all at once from the controller of main; the pages are cut here, as before.
export const ReviewProductsListingUI = (props) => {
  const {
    productState,
    handleChangeSearch,
    searchValue,
    parentSearchValue,
    isUseQuery,
    defaultPage,
    defaultPageSize,
    firstRender,
    onRetry,
    activeId,
    onOpenRow
  } = props

  const [, t] = useLanguage()

  const [currentPage, setCurrentPage] = useState(defaultPage || 1)
  const [productsPerPage, setProductsPerPage] = useState(defaultPageSize || 10)

  const products = productState?.products ?? []
  const totalPages = products.length > 0 ? Math.ceil(products.length / productsPerPage) : undefined
  const indexOfLastPost = currentPage * productsPerPage
  const currentProducts = products.slice(indexOfLastPost - productsPerPage, indexOfLastPost)

  useEffect(() => {
    if (firstRender) return
    setCurrentPage(1)
  }, [searchValue])

  useEffect(() => {
    handleChangeSearch(parentSearchValue)
  }, [parentSearchValue])

  useEffect(() => {
    if (!isUseQuery || !currentPage || !productsPerPage || !totalPages) return
    addQueryToUrl({
      page: currentPage,
      pageSize: productsPerPage
    })
  }, [currentPage, productsPerPage, totalPages])

  return (
    <>
      <ReviewsTable
        kind='product'
        label={t('PRODUCTS', 'Products')}
        nameHeader={t('PRODUCT', 'Product')}
        rows={currentProducts}
        loading={productState?.loading}
        error={productState?.error}
        onRetry={onRetry}
        pageSize={productsPerPage}
        activeId={activeId}
        onOpen={onOpenRow}
      />
      {!productState?.loading && !productState?.error && (
        <ReviewsPagination
          page={currentPage}
          pageSize={productsPerPage}
          total={products.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size, page) => {
            setProductsPerPage(size)
            setCurrentPage(page)
          }}
        />
      )}
    </>
  )
}

export const ReviewProductsListing = (props) => {
  // The controller of main keeps its fetch behind a search value and exposes no reload, and asking it for the value it already
  // holds changes nothing. «Try again» mounts it again with a new key, which loads the products once more (the search is handed
  // back by the list's own effect).
  const [attempt, setAttempt] = useState(0)
  const businessProductslistingProps = {
    ...props,
    UIComponent: ReviewProductsListingUI,
    isSearchByName: true,
    isSearchByDescription: true,
    onRetry: () => setAttempt(current => current + 1)
  }
  return (
    <ReviewProductListController key={attempt} {...businessProductslistingProps} />
  )
}
