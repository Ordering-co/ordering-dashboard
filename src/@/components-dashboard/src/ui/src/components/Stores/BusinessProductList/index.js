import React, { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useLanguage } from '../../../../../index'
import { SideBar } from '../../Shared'
import { Button, ColumnManager, EmptyState, Pagination } from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { useOverflowEdges } from '../../Shared/Product/useOverflowEdges'
import { Package } from '../../Shared/Icon'
import { SingleBusinessProduct } from '../SingleBusinessProduct'
import { BusinessSpreadSheet } from '../BusinessSpreadSheet'
import { BusinessProductAddForm } from '../BusinessProductAddForm'

import { BusinessProductListTable } from './styles'
import './catalog-products.css'

// redesign SP-F3 (C): the products of the category on /stores/products. A table with one <tbody> per product (the controller of each
// product wraps its row, so it is not Product's DataTable: decisions.md 2), the cards of a phone, the column manager, the states of
// today and the pages of Product's Pagination. The spreadsheet view (BusinessSpreadSheet) stays as it was.

const PAGE_SIZES = [10, 25, 50]
const SKELETON_ROWS = 10
const SHEET_SKELETON_ROWS = 15
// J2 row 11 (stores-products P-13, D-46 b): Price before Description, so the price is in view at 1024 without scrolling
const COLUMN_IDS = ['products', 'price', 'description', 'cost_price', 'tax', 'fee']

const defaultColumns = () => COLUMN_IDS.map(id => ({ id, visible: true }))

// «Showing _from_–_to_ of _total_»: the numbers become .odc-figure nodes and keep their direction in RTL
const fillTemplate = (template, values, figure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figure(values[name])}</React.Fragment> : part
})

export const BusinessProductList = (props) => {
  const {
    productDetailsId,
    categoryState,
    viewMethod,
    businessState,
    searchValue,
    errorQuantityProducts,
    handleSearchRedirect,
    handleChangeSearch,
    handleOpenProductDetails,
    isParentProductAdd,
    handleParentProductAdd,
    allowSpreadColumns,
    getPageProducts,
    productsPerPage,
    setProductsPerPage,
    categorySelected
  } = props
  const [, t] = useLanguage()
  const isPhone = useIsPhone()
  // the region says on which side the table goes on (data-overflow-start / -end), so the pinned column can draw its edge
  const scrollRef = useRef(null)
  useOverflowEdges(scrollRef)
  // tanda AE (decision 37): Enabled is pinned right after Products, so it starts where Products ends. Products sizes by its
  // content, so its width is measured (the pinned header cell) and handed to the CSS as --odc-cp-pin.
  const tableRef = useRef(null)
  const [isAddProduct, setIsAddProduct] = useState(false)
  const [dataSelected, setDataSelected] = useState('')
  const [columns, setColumns] = useState(defaultColumns) // [{ id, visible }] in the order the person chose; local, not saved (as in main)

  const labels = {
    products: t('PRODUCTS', 'Products'),
    description: t('DESCRIPTION', 'Description'),
    price: t('PRICE', 'Price'),
    // offer_price: t('REGULAR_PRICE', 'Regular Price'), // commented out in main too
    cost_price: t('PRODUCT_COST', 'Product cost'),
    tax: t('TAX', 'Tax'),
    fee: t('FEE', 'Fee')
  }
  const columnOrder = columns.filter(column => column.visible).map(column => column.id)
  const allowColumns = Object.fromEntries(columns.map(column => [column.id, column.visible]))
  // n.º 12, D-46 (a): Products holds the button that opens a product and the drag grip, so it cannot be hidden
  const managerColumns = columns.map(({ id, visible }) => ({ id, label: labels[id], visible, locked: id === 'products' }))

  // Change page
  const [currentPage, setCurrentPage] = useState(1)

  const handleChangePage = (page) => {
    setCurrentPage(page)
    getPageProducts(true, page, productsPerPage)
  }

  const handleChangePageSize = (pageSize, expectedPage) => {
    setCurrentPage(expectedPage)
    setProductsPerPage(pageSize)
    getPageProducts(true, expectedPage, pageSize)
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [categorySelected?.id])

  const loading = Boolean(categoryState?.loading || businessState?.loading)
  const products = categoryState?.products || []
  const categories = businessState?.business?.categories
  const hasSubcategories = categorySelected?.subcategories?.some(subcategory => subcategory?.products?.length > 0)
  // `main` could drag with a category chosen or not; with «All products» the rank would be written among different categories
  const canReorder = Boolean(categorySelected) && !hasSubcategories
  const pagination = categoryState?.pagination

  const noCategories = Boolean(businessState?.business) && categories?.length === 0

  // J2 review H2 / H3 (row 9): Move up / Move down only know the loaded page. The first product of a later page and the last of a page
  // with more after it cannot cross the edge (their neighbour is not loaded), and say so; while searching there is no move at all,
  // because the results are not the whole order.
  const page = pagination?.currentPage ?? currentPage
  const rankedIds = [...products].sort((a, b) => a.rank - b.rank).map(product => product?.id)
  const hasLaterPage = Number(pagination?.totalItems) > page * productsPerPage
  const reorderEdgeOf = (product) => ({
    up: page > 1 && rankedIds[0] === product?.id,
    down: hasLaterPage && rankedIds[rankedIds.length - 1] === product?.id
  })

  const rowProps = (product) => ({
    ...props,
    productDetailsId,
    product,
    columnOrder,
    allowColumns,
    business: businessState?.business,
    handleOpenProductDetails,
    dataSelected,
    setDataSelected,
    category: categoryState,
    // as in main, never true: `currentProducts` was always empty in lazy mode, so the «at the end» drop zone does not answer (inventory 6)
    isLastProduct: false,
    hasSubcategories,
    canReorder,
    reorderEdge: reorderEdgeOf(product),
    isFiltered: Boolean(searchValue),
    variant: isPhone ? 'card' : 'row'
  })

  const loadingLabel = t('LOADING', 'Loading')

  const pinnedKey = columnOrder.join(',')
  useLayoutEffect(() => {
    const table = tableRef.current
    const region = scrollRef.current
    if (!table || !region) return
    const pinned = table.querySelector("thead th[data-sticky='start']")
    const frame = region.parentElement
    const measure = () => {
      if (pinned) table.style.setProperty('--odc-cp-pin', `${pinned.getBoundingClientRect().width}px`)
      // review finding 4: the end shadow of the frame stops at the region's scrollbars (classic scrollbars take room; overlay ones 0)
      frame.style.setProperty('--odc-cp-bar-inline', `${Math.max(0, region.offsetWidth - region.clientWidth)}px`)
      frame.style.setProperty('--odc-cp-bar-block', `${Math.max(0, region.offsetHeight - region.clientHeight)}px`)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    if (pinned) observer.observe(pinned)
    observer.observe(region)
    return () => observer.disconnect()
  }, [pinnedKey, loading, isPhone, viewMethod, products.length])

  const renderList = () => {
    // 0 categories: the message takes the place of the table
    if (!businessState?.loading && categories?.length === 0) {
      return (
        <EmptyState
          icon={Package}
          title={t('CREATE_CATEGORY_BEFORE_PRODUCT', 'Please create a category before adding your products.')}
        />
      )
    }

    if (!loading && products.length === 0) {
      return (
        <EmptyState
          icon={Package}
          title={searchValue
            ? t('ERROR_NOT_FOUND_PRODUCTS', 'No products found, please change filters.')
            : t('ERROR_NOT_FOUND_PRODUCTS_TIME', 'No products found at this time')}
          action={searchValue && handleChangeSearch
            ? <Button onClick={() => handleChangeSearch('')}>{t('CLEAR_FILTERS', 'Clear filters')}</Button>
            : undefined}
        />
      )
    }

    const sorted = [...products].sort((a, b) => a.rank - b.rank)

    if (isPhone) {
      return (
        <ul className='odc-cp-cards' role='list' aria-label={labels.products} aria-busy={loading || undefined}>
          {loading
            ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                <SingleBusinessProduct key={index} isSkeleton viewMethod={viewMethod} variant='card' />
            ))
            : sorted.map((product, index) => (
                <SingleBusinessProduct key={`${product?.id}_${index}`} {...rowProps(product)} />
            ))}
        </ul>
      )
    }

    const first = columnOrder[0]
    // tanda AE (owner decision 37): Enabled follows Products, pinned with it when Products is first (see SingleBusinessProduct)
    return (
      <div className='odc-cp-frame'>
        <div className='odc-cp-scroll' ref={scrollRef} role='region' aria-label={labels.products} tabIndex={0}>
          {loading && <span className='odc-sr-only' role='status'>{loadingLabel}</span>}
          <table ref={tableRef} className='odc-cp-table' aria-label={labels.products} aria-busy={loading || undefined}>
            <thead>
              <tr>
                {columnOrder.map(id => (
                  <React.Fragment key={id}>
                    <th
                      scope='col'
                      data-align={id === 'price' || id === 'cost_price' ? 'end' : undefined}
                      data-sticky={id === 'products' && first === 'products' ? 'start' : undefined}
                    >
                      {labels[id]}
                    </th>
                    {id === 'products' && (
                      <th scope='col' data-sticky={first === 'products' ? 'status' : undefined}>{t('ENABLED', 'Enabled')}</th>
                    )}
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            {loading
              ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                  <SingleBusinessProduct
                    key={index}
                    isSkeleton
                    viewMethod={viewMethod}
                    variant='row'
                    columnOrder={columnOrder}
                    allowColumns={allowColumns}
                  />
              ))
              : sorted.map((product, index) => (
                  <SingleBusinessProduct key={`${product?.id}_${index}`} {...rowProps(product)} />
              ))}
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className='odc-root odc-cp'>
      {viewMethod === 'list' && (
        <>
          {!isPhone && !noCategories && (
            <div className='odc-cp-tools'>
              <ColumnManager
                columns={managerColumns}
                onChange={next => setColumns(next.map(({ id, visible }) => ({ id, visible })))}
                onReset={() => setColumns(defaultColumns())}
                triggerLabel={t('MANAGE_COLUMNS', 'Manage columns')}
                title={t('MANAGE_COLUMNS', 'Manage columns')}
                resetLabel={t('COLUMNS_RESET', 'Reset')}
                lockedNote={t('COLUMN_ALWAYS_SHOWN', 'Always shown')}
                widthHiddenNote={t('COLUMN_HIDDEN_AT_WIDTH', 'Hidden at this width')}
                moveUpLabel={label => t('MOVE_COLUMN_UP', 'Move _column_ up').replace('_column_', label)}
                moveDownLabel={label => t('MOVE_COLUMN_DOWN', 'Move _column_ down').replace('_column_', label)}
              />
            </div>
          )}
          {renderList()}

          {
            !businessState?.loading && categories?.length > 0 && !categorySelected && (
              <p className='odc-cp-note'>
                {t('SELECT_CATEGORY_BEFORE_PRODUCT', 'Please select a category before adding your products.')}
              </p>
            )
          }

          <div className='odc-cp-foot'>
            {
              !businessState?.loading && categories?.length > 0 && categorySelected && (
                <Button variant='link' onClick={() => handleParentProductAdd?.(true)}>
                  {t('ADD_NEW_PRODUCT', 'Add new product')}
                </Button>
              )
            }

            {
              !businessState?.loading && products.length > 0 && (
                <Pagination
                  page={pagination?.currentPage ?? currentPage}
                  pageSize={productsPerPage}
                  total={pagination?.totalItems ?? products.length}
                  pageSizeOptions={PAGE_SIZES}
                  onPageChange={handleChangePage}
                  onPageSizeChange={handleChangePageSize}
                  busy={loading}
                  showPageInput
                  label={t('PAGINATION', 'Pagination')}
                  previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
                  nextLabel={t('NEXT_PAGE', 'Next page')}
                  pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
                  pageLabel={t('PAGE', 'Page')}
                  pageOfLabel={(total, figure) => fillTemplate(t('PAGE_OF_TOTAL', 'of _total_'), { total }, figure)}
                  rangeLabel={(from, to, total, figure) => fillTemplate(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to, total }, figure)}
                  pageStatusLabel={(current, total) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(total))}
                />
              )
            }
          </div>
        </>
      )}

      {
        viewMethod === 'spreedsheet' && (
          <>
            <div className='odc-cp-sheet'>
              {loading
                ? (
                <BusinessProductListTable>
                  {
                    Array.from({ length: SHEET_SKELETON_ROWS }, (_, index) => (
                      <SingleBusinessProduct
                        key={index}
                        isSkeleton
                        viewMethod={viewMethod}
                        allowColumns={allowColumns}
                      />
                    ))
                  }
                </BusinessProductListTable>
                  )
                : (
                <BusinessSpreadSheet
                  {...props}
                  business={businessState?.business}
                  allowSpreadColumns={allowSpreadColumns}
                />
                  )}
            </div>
            {
              !categoryState?.loading && !businessState?.loading && products.length === 0 && !((searchValue && errorQuantityProducts) || (!searchValue && !errorQuantityProducts)) && (
                <EmptyState
                  icon={Package}
                  title={!searchValue ? t('ERROR_NOT_FOUND_PRODUCTS_TIME', 'No products found at this time') : t('ERROR_NOT_FOUND_PRODUCTS', 'No products found, please change filters.')}
                  action={
                    // «Go to Businesses» does not start when the page gave no way to go (D14): then the button is not drawn
                    !searchValue
                      ? (handleSearchRedirect ? <Button onClick={() => handleSearchRedirect()}>{t('SEARCH_REDIRECT', 'Go to Businesses')}</Button> : undefined)
                      : (handleChangeSearch ? <Button onClick={() => handleChangeSearch('')}>{t('CLEAR_FILTERS', 'Clear filters')}</Button> : undefined)
                  }
                />
              )
            }
          </>
        )
      }
      {
        (isAddProduct || isParentProductAdd) && (
          <SideBar
            sidebarId='productAddForm'
            open={isAddProduct || isParentProductAdd}
            onClose={() => {
              setIsAddProduct(false)
              handleParentProductAdd && handleParentProductAdd(false)
            }}
            showExpandIcon
          >
            <BusinessProductAddForm
              {...props}
              business={businessState?.business}
              setIsAddProduct={setIsAddProduct}
            />
          </SideBar>
        )
      }
    </div>
  )
}
