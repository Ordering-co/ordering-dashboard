import React, { useEffect, useRef, useState } from 'react'
import { DashboardBusinessList, useLanguage, useUtils } from '~components'
import { Button, SelectableList } from '../../Shared/Product'
import { fillTemplate } from './fillTemplate'
import './importer-dialog.css'

/*
 * the stores an import goes to. The dialog opens on its store, as before; «Import into more stores» shows the project's
 * stores (P/SelectableList on DashboardBusinessList, mounted only then, so one store asks for nothing new) and the import is sent to
 * every store ticked. The menu-import service sends the menu store by store in one request, so the choice is capped
 * (MAX_IMPORT_STORES, said under the list): a long synchronous request would hit the platform timeout.
 */

// shortcut: a fixed cap for the synchronous import; raise it (or move to the service's async jobs) once timings are measured
export const MAX_IMPORT_STORES = 10

const fill = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})

/** The stores chosen for the import of `business`: its id first, and the name of every store seen in the list. */
export const useImportStores = (business, open) => {
  const [ids, setIds] = useState(() => (business?.id != null ? [business.id] : []))
  const names = useRef(new Map())
  useEffect(() => {
    names.current = new Map(business?.id != null ? [[business.id, business.name]] : [])
    setIds(business?.id != null ? [business.id] : [])
  }, [open, business?.id, business?.name])
  const nameOf = (id) => names.current.get(id) || `#${id}`
  // one store that is not the dialog's (the dialog's unticked, or «Retry 1 store») is the one the import goes to
  const chosenName = (fallback) => (ids.length === 1 && ids[0] !== business?.id ? nameOf(ids[0]) : fallback)
  return { ids, setIds, names, nameOf, chosenName }
}

/** «The menu is imported into …»: the store's name, as before, or how many stores. */
export const importConsequence = (t, storeName, count) => count > 1
  ? fillTemplate(t('IMPORTERS_IMPORT_CONSEQUENCE_STORES', 'The menu is imported into {{count}} stores. This can take a few minutes.'), { count })
  : t('IMPORTERS_IMPORT_CONSEQUENCE', 'The menu is imported into _name_. This can take a few minutes.').replace('_name_', () => storeName)

const StoreListBridge = ({ businessList, pagination, onSearch, getPageBusinesses, stores }) => {
  const [, t] = useLanguage()
  const [{ optimizeImage } = {}] = useUtils() || []
  const { ids, setIds, names, locked } = stores
  const businesses = Array.isArray(businessList?.businesses) ? businessList.businesses : []
  businesses.forEach((business) => names.current.set(business.id, business.name))
  const pageSize = pagination?.pageSize || MAX_IMPORT_STORES
  const toggle = (id, next) => setIds((current) => {
    if (!next) return current.filter((value) => value !== id)
    return current.length >= MAX_IMPORT_STORES || current.includes(id) ? current : [...current, id]
  })
  const selectPage = () => setIds((current) => [
    ...current,
    ...businesses.map(({ id }) => id).filter((id) => !current.includes(id))
  ].slice(0, MAX_IMPORT_STORES))

  return (
    <SelectableList
      label={t('STORES', 'Stores')}
      items={businesses.map((business) => ({
        id: business.id,
        name: business.name,
        photo: business.logo && optimizeImage ? optimizeImage(business.logo, 'h_50,c_limit') : undefined
      }))}
      avatars='business'
      selectedIds={ids}
      onToggle={toggle}
      locked={locked}
      loading={Boolean(businessList?.loading)}
      loadingLabel={t('LOADING', 'Loading')}
      emptyTitle={t('STAFF_STORES_NO_MATCH', 'No stores match this search')}
      error={Boolean(businessList?.error)}
      errorTitle={t('STORES_LOAD_FAILED', 'We couldn\'t load the stores.')}
      retryLabel={t('RETRY', 'Retry')}
      onRetry={() => getPageBusinesses(pageSize, pagination?.currentPage || 1)}
      onSearch={onSearch}
      searchLabel={t('STAFF_STORES_SEARCH', 'Search stores')}
      clearSearchLabel={t('CLEAR_SEARCH', 'Clear search')}
      onSelectAll={selectPage}
      selectAllLabel={t('SELECT_ALL', 'Select all')}
      onSelectNone={() => setIds([])}
      selectNoneLabel={t('SELECT_NONE', 'Select none')}
      pagination={pagination?.totalItems == null
        ? undefined
        : {
            page: pagination.currentPage,
            pageSize,
            total: pagination.totalItems,
            onPageChange: (page) => getPageBusinesses(pageSize, page),
            label: t('PAGINATION', 'Pagination'),
            previousLabel: t('PREVIOUS_PAGE', 'Previous page'),
            nextLabel: t('NEXT_PAGE', 'Next page'),
            rangeLabel: (from, to, count, figureOf) => fill(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from: figureOf(from), to: figureOf(to), total: figureOf(count) }),
            pageStatusLabel: (current, totalPages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(totalPages))
          }}
    />
  )
}

/** «Store · name», and the list of the project's stores once the user asks for more stores. `stores` is `useImportStores`. */
export const ImportStores = ({ storeName, stores, disabled }) => {
  const [, t] = useLanguage()
  const [expanded, setExpanded] = useState(false)
  const listRef = useRef(null)
  // the button that opened the list is gone: the search of the list takes the focus
  useEffect(() => {
    if (expanded) listRef.current?.querySelector('input')?.focus()
  }, [expanded])
  const atCap = stores.ids.length >= MAX_IMPORT_STORES
  return (
    <>
      <p className='odc-imp-store'>
        <span className='odc-imp-store-label'>{t('IMPORTER_MODAL_BUSINESS_LABEL', 'Store')}</span>
        <span aria-hidden='true'>·</span>
        <span className='odc-imp-store-name'>{storeName}</span>
        {!expanded && (
          <Button variant='link' size='sm' onClick={() => setExpanded(true)} disabled={disabled}>
            {t('IMPORTER_MORE_STORES', 'Import into more stores')}
          </Button>
        )}
      </p>
      {expanded && (
        <div className='odc-imp-stores' ref={listRef}>
          <DashboardBusinessList
            asDashboard
            loadMorePageSize={MAX_IMPORT_STORES}
            paginationSettings={{ pageSize: MAX_IMPORT_STORES }}
            isSearchByBusinessName
            propsToFetch={['name', 'logo']}
            UIComponent={StoreListBridge}
            stores={{ ...stores, locked: disabled }}
          />
          <p className='odc-imp-hint' aria-live='polite'>
            {fillTemplate(
              atCap
                ? t('IMPORTER_STORES_LIMIT', '{{count}} of {{max}} stores selected. That is the most one import can take.')
                : t('IMPORTER_STORES_SELECTED', '{{count}} of {{max}} stores selected'),
              { count: stores.ids.length, max: MAX_IMPORT_STORES }
            )}
          </p>
        </div>
      )}
    </>
  )
}
