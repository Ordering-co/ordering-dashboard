import React, { useEffect, useRef, useState } from 'react'

import { BuilderProductsList as BuilderProductsListController, useEvent, useLanguage, useUtils } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { useOpenFromQuery } from '../../../hooks/useOneShotQuery'
import { CircleAlert, ExternalLink, Globe, Info, LockKeyhole, Menu as MenuIcon, Phone, Plus, Search } from '../../Shared/Icon'
import {
  Button,
  DataTable,
  EmptyState,
  FilterBar,
  IconButton,
  InlineNotice,
  PageHeader,
  Pagination,
  SearchField,
  SegmentedControl,
  Status
} from '../../Shared/Product'
import { BuilderCreatePanel } from '../BuilderCreatePanel'
import {
  BUILDER_STATUS_OPTIONS,
  getDomainUrl,
  getPlatformBuilds,
  getProductApp,
  getProductDomains,
  getProductKind,
  getStatusLabel,
  getTypeLabel
} from '../utils'
import { PlatformBuildIcon } from './PlatformBuildIcon'
import { TypeFilterMenu } from './TypeFilterMenu'
import './builder-list.css'

// redesign B1: /builder on Product pieces (PageHeader, FilterBar + SearchField, SegmentedControl, DataTable, Pagination,
// EmptyState, InlineNotice). Same controller, states, texts and actions as main; the search still waits 750 ms after the last key
// and clearing it searches at once, as main's SearchBar.

// The Builder only lists Marketplace websites for now (api-core), so the
// type filter has nothing to choose: hidden until it offers more types
const SHOW_TYPE_FILTER = false

const SEARCH_DELAY_MS = 750 // main's SearchBar (lazyLoad)
const SKELETON_ROWS = 5 // main drew 5 loading rows
const PAGE_SIZES = [10, 25, 50] // main's page sizes
const STATUS_FAMILIES = { draft: 'pending', active: 'done', archived: 'cancel' }

// «Showing _from_–_to_ of _total_» with each number in its own node
const fill = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})

const BuilderProductsListUI = (props) => {
  const {
    productsState,
    pagination,
    filters,
    catalogState,
    createState,
    reloadProducts,
    reloadCatalog,
    handleChangeSearch,
    handleChangeType,
    handleChangeStatus,
    handleClearFilters,
    handleChangePage,
    handleChangePageSize,
    createProduct,
    resetCreateState
  } = props

  const [, t] = useLanguage()
  const [events] = useEvent()
  const [{ parseDate }] = useUtils()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [query, setQuery] = useState(filters.search)
  const searchRef = useRef(null)
  const searchTimer = useRef(null)

  const canCreate = !catalogState.loading && catalogState.canCreate
  const blockedKind = ['disabled', 'no_access'].includes(productsState.errorKind) ? productsState.errorKind : null
  const hasFilters = !!filters.search.trim() || filters.productTypes.length > 0 || filters.productStatus !== 'all'

  // A search set from outside (Clear search and filters) shows, never while typing
  useEffect(() => {
    if (typeof document !== 'undefined' && document.activeElement === searchRef.current) return
    clearTimeout(searchTimer.current)
    setQuery(filters.search)
  }, [filters.search])
  useEffect(() => () => clearTimeout(searchTimer.current), [])

  const changeQuery = (value) => {
    setQuery(value)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => handleChangeSearch(value), SEARCH_DELAY_MS)
  }

  const clearQuery = () => {
    clearTimeout(searchTimer.current)
    handleChangeSearch('')
  }

  const openCreate = () => {
    resetCreateState()
    setIsCreateOpen(true)
  }

  // ⌘K "Create app" (`/builder?add=1`) opens the panel only when Create is offered
  useOpenFromQuery('add', openCreate, { ready: !catalogState.loading, accept: () => catalogState.canCreate })

  const goToProduct = (productId) => {
    events.emit('go_to_page', { page: 'builder_app', params: { productId } })
  }

  const handleProductLink = (e, productId) => {
    e.preventDefault()
    e.stopPropagation()
    goToProduct(productId)
  }

  const handleCreated = (product) => {
    setIsCreateOpen(false)
    goToProduct(product.id)
  }

  const formatDate = (value) => value ? parseDate(value, { outputFormat: 'MMM D, YYYY' }) : ''

  const platformsCell = (product) => {
    if (getProductKind(product) === 'web') {
      const domain = getProductDomains(product)[0]
      return (
        <span className='odc-builder-web'>
          <Globe className='odc-icon' />
          {t('BUILDER_WEB', 'Web')}
          {domain && (
            <>
              {' · '}
              <a
                className='odc-builder-domain'
                href={getDomainUrl(domain.domain)}
                target='_blank'
                rel='noopener noreferrer'
                onClick={(e) => e.stopPropagation()}
              >
                {domain.domain}
                <ExternalLink className='odc-icon' />
                <span className='odc-sr-only'>{t('BUILDER_OPENS_NEW_TAB', '(opens in a new tab)')}</span>
              </a>
            </>
          )}
        </span>
      )
    }
    return (
      <span className='odc-builder-platforms'>
        {getPlatformBuilds(getProductApp(product)).map(item => (
          <PlatformBuildIcon key={item.platform} platform={item.platform} status={item.status} />
        ))}
      </span>
    )
  }

  const columns = [
    {
      id: 'name',
      header: t('NAME', 'Name'),
      rowHeader: true,
      wrap: true,
      skeleton: { lines: 2 },
      cell: product => (
        <span className='odc-builder-name'>
          <a href={`/builder/${product.id}`} dir='auto' onClick={(e) => handleProductLink(e, product.id)}>{product.name}</a>
          <span className='odc-builder-code'>{product.code}</span>
        </span>
      )
    },
    { id: 'type', header: t('TYPE', 'Type'), cell: product => getTypeLabel(product.product_type, t) },
    { id: 'platforms', header: t('BUILDER_PLATFORMS', 'Platforms'), wrap: true, cell: platformsCell },
    {
      id: 'status',
      header: t('STATUS', 'Status'),
      cell: product => (
        <Status family={STATUS_FAMILIES[product.product_status] || 'cancel'} label={getStatusLabel(product.product_status, t)} />
      )
    },
    { id: 'created', header: t('CREATED', 'Created'), cell: product => <span className='odc-builder-muted'>{formatDate(product.created_at)}</span> }
  ]

  const renderBody = () => {
    if (productsState.errorKind && !productsState.loading) {
      return (
        <EmptyState
          tone='error'
          icon={CircleAlert}
          titleAs='h2'
          title={t('BUILDER_LOAD_ERROR', 'We couldn’t load your apps')}
          description={t('BUILDER_LOAD_ERROR_HELP', 'Check your connection and try again.')}
          action={<Button variant='primary' onClick={reloadProducts}>{t('BUILDER_RETRY', 'Try again')}</Button>}
        />
      )
    }
    if (!productsState.loading && !productsState.products.length) {
      return hasFilters
        ? (
          <EmptyState
            icon={Search}
            titleAs='h2'
            title={t('BUILDER_NO_MATCHES', 'Nothing matches your search')}
            action={<Button onClick={handleClearFilters}>{t('BUILDER_CLEAR_FILTERS', 'Clear search and filters')}</Button>}
          />
          )
        : (
          <EmptyState
            icon={Phone}
            titleAs='h2'
            title={t('BUILDER_NO_PRODUCTS', 'Nothing here yet')}
            description={canCreate ? t('BUILDER_NO_PRODUCTS_HELP', 'Create an app or a website. It starts as a free draft.') : null}
            action={canCreate ? <Button variant='primary' onClick={openCreate}>{t('BUILDER_CREATE', 'Create')}</Button> : null}
          />
          )
    }
    return (
      <>
        <DataTable
          label={t('BUILDER', 'Builder')}
          columns={columns}
          rows={productsState.loading ? [] : productsState.products}
          getRowId={product => product.id}
          onOpenRow={product => goToProduct(product.id)}
          loading={productsState.loading}
          loadingLabel={t('LOADING', 'Loading')}
          skeletonRows={SKELETON_ROWS}
        />
        {!productsState.loading && pagination.totalPages > 0 && (
          <Pagination
            page={pagination.currentPage}
            pageSize={pagination.pageSize}
            // a total that can't fill the pages the API counts (the controller falls back to the rows when the API sends none):
            // page by the pages instead, never by a made-up total
            {...(pagination.total > (pagination.totalPages - 1) * pagination.pageSize
              ? { total: pagination.total }
              : { hasMore: pagination.currentPage < pagination.totalPages, itemCount: productsState.products.length })}
            pageSizeOptions={PAGE_SIZES}
            onPageChange={handleChangePage}
            onPageSizeChange={(size) => handleChangePageSize(size)}
            label={t('PAGINATION', 'Pagination')}
            previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
            nextLabel={t('NEXT_PAGE', 'Next page')}
            pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
            // main's numbered pages let you jump to any page: the page field keeps that
            showPageInput
            pageLabel={t('PAGE', 'Page')}
            pageOfLabel={(totalPages, figureOf) => fill(t('PAGE_OF_TOTAL', 'of _total_'), { total: figureOf(totalPages) })}
            rangeLabel={(from, to, total, figureOf) => fill(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from: figureOf(from), to: figureOf(to), total: figureOf(total) })}
            pageStatusLabel={(current, totalPages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(totalPages))}
          />
        )}
      </>
    )
  }

  const createLabel = t('BUILDER_CREATE', 'Create')

  return (
    <div className='odc-root odc-builder-list'>
      <PageHeader
        leading={isCollapse && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />}
        title={t('BUILDER', 'Builder')}
        description={t('BUILDER_SUBTITLE_WEBSITES', 'Create your apps and websites, edit them and follow their builds.')}
        primaryAction={canCreate && !blockedKind
          ? (
            <Button variant='primary' icon={Plus} title={createLabel} onClick={openCreate}>
              <span data-collapse-label=''>{createLabel}</span>
            </Button>
            )
          : undefined}
      />

      {blockedKind
        ? (
          <EmptyState
            icon={LockKeyhole}
            titleAs='h2'
            title={blockedKind === 'disabled'
              ? t('BUILDER_DISABLED', 'Builder isn’t available here')
              : t('BUILDER_NO_ACCESS', 'You don’t have access to Builder')}
            description={blockedKind === 'disabled'
              ? t('BUILDER_DISABLED_HELP', 'Builder is turned off for this installation.')
              : t('BUILDER_NO_ACCESS_HELP', 'Only admins with edit permissions can create and manage apps. Ask a project owner for access.')}
          />
          )
        : (
          <>
            {!catalogState.loading && catalogState.unavailableReason === 'not_enabled' && (
              <InlineNotice tone='info' icon={Info} live={false}>
                {t('BUILDER_CREATE_UNAVAILABLE', 'Creating apps from the dashboard isn’t turned on for this project yet. Contact Ordering support to turn it on.')}
              </InlineNotice>
            )}
            {!catalogState.loading && catalogState.unavailableReason === 'empty' && (
              <InlineNotice tone='info' icon={Info} live={false}>
                {t('BUILDER_CATALOG_EMPTY', 'There’s nothing to create right now. New app types will appear here when they’re available.')}
              </InlineNotice>
            )}
            {!catalogState.loading && catalogState.unavailableReason === 'error' && (
              <InlineNotice
                tone='danger'
                icon={CircleAlert}
                role='alert'
                action={<Button size='sm' variant='ghost' onClick={reloadCatalog}>{t('BUILDER_RETRY', 'Try again')}</Button>}
              >
                {t('BUILDER_CATALOG_ERROR', 'We couldn’t check what you can create.')}
              </InlineNotice>
            )}

            <FilterBar
              flush
              label={t('FILTERS', 'Filters')}
              search={(
                <SearchField
                  value={query}
                  onChange={changeQuery}
                  onClear={clearQuery}
                  inputRef={searchRef}
                  label={t('BUILDER_SEARCH', 'Search by name')}
                  placeholder={t('BUILDER_SEARCH', 'Search by name')}
                  clearLabel={t('CLEAR_SEARCH', 'Clear search')}
                />
              )}
              filters={(
                <>
                  {SHOW_TYPE_FILTER && <TypeFilterMenu value={filters.productTypes} onChange={handleChangeType} />}
                  <SegmentedControl
                    label={t('STATUS', 'Status')}
                    value={filters.productStatus}
                    onValueChange={handleChangeStatus}
                    options={[
                      { value: 'all', label: t('ALL', 'All') },
                      ...BUILDER_STATUS_OPTIONS.map(option => ({ value: option.value, label: option.label(t) }))
                    ]}
                  />
                </>
              )}
            />

            {renderBody()}
          </>
          )}

      {isCreateOpen && (
        <BuilderCreatePanel
          catalogState={catalogState}
          createState={createState}
          createProduct={createProduct}
          onCreated={handleCreated}
          onClose={() => setIsCreateOpen(false)}
        />
      )}
    </div>
  )
}

export const BuilderProducts = (props) => {
  const listProps = {
    ...props,
    UIComponent: BuilderProductsListUI
  }
  return <BuilderProductsListController {...listProps} />
}
