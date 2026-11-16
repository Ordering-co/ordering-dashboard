import React from 'react'

import { useLanguage } from '../../../../../index'
import { Plus } from '../../Shared/Icon'
import { Button, DataTable, RecordCardList } from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import './ordering-products.css'

// redesign (lot B, decision 2): the list of the sites of /ordering-products as a Product DataTable (RecordCards under 768px,
// as the markups). It draws what the controller gives and fetches nothing. Columns: Product (a native button that opens the site, its
// description under it), Code (mono, left to right: two sites called alike are told apart, OP-05) and URL (the site's url, or a dash).
// A row opens with a click, with Enter on the focused row (OP-04) or with the name button.

const NONE = '—'

/**
 * @param {object}   props
 * @param {Array<object>} props.sites
 * @param {boolean}  props.loading         Skeleton rows (`skeletonRows` of them).
 * @param {number}   [props.skeletonRows]  The page size.
 * @param {*}        [props.activeId]      The site open in the detail.
 * @param {Function} props.onOpen          `(site)`.
 * @param {boolean}  [props.searching]     The list is a search: an empty list says «No results found».
 * @param {Function} [props.onAdd]         `()`: «Add product» in the empty list that is not a search.
 */
export const SitesTable = ({ sites, loading, skeletonRows = 10, activeId, onOpen, searching = false, onAdd }) => {
  const [, t] = useLanguage()
  const isPhone = useIsPhone()

  const listLabel = t('ORDERING_PRODUCTS', 'Ordering products')
  const loadingLabel = t('LOADING', 'Loading')
  const openLabel = (site) => `${site?.name ?? ''}, ${t('VIEW_DETAILS', 'View details')}`

  const empty = searching
    ? <p className='odc-op-empty-text'>{t('NO_RESULTS_FOUND', 'No results found')}</p>
    : (
      <div className='odc-op-empty'>
        <p className='odc-op-empty-text'>{t('NO_PRODUCTS_FOUND', 'No products found.')}</p>
        {onAdd && <Button variant='primary' icon={Plus} onClick={onAdd}>{t('ADD_PRODUCT', 'Add product')}</Button>}
      </div>
      )

  // ---- the cells (the table and the cards draw the same ones) ----
  const codeOf = (site) => (site?.code ? <span className='odc-op-code' dir='ltr'>{site.code}</span> : <span className='odc-op-none'>{NONE}</span>)
  const urlOf = (site) => (site?.url ? <span className='odc-op-url' dir='ltr'>{site.url}</span> : <span className='odc-op-none'>{NONE}</span>)

  const productCell = (site) => (
    <span className='odc-op-namecell'>
      <button type='button' className='odc-op-name' aria-label={openLabel(site)} onClick={() => onOpen(site)}>
        <span className='odc-op-name-text' dir='auto' title={site.name}>{site.name}</span>
      </button>
      {site.description ? <span className='odc-op-desc' dir='auto'>{site.description}</span> : null}
    </span>
  )

  // ---- phone: the same data as cards ----
  if (isPhone) {
    const toCard = (site) => ({
      id: site.id,
      // the card is a link for the keyboard and the screen reader; a plain click opens the detail
      href: '#',
      label: openLabel(site),
      title: <span className='odc-op-name-text' dir='auto'>{site.name}</span>,
      from: (
        <span className='odc-op-sub'>
          {site.code ? <bdi className='odc-op-code' dir='ltr'>{site.code}</bdi> : NONE}
          {site.url ? <> · <bdi dir='ltr'>{site.url}</bdi></> : null}
        </span>
      ),
      indicator: site.description ? <span className='odc-op-desc' dir='auto'>{site.description}</span> : null,
      active: activeId != null && String(activeId) === String(site.id),
      onOpen: () => onOpen(site)
    })
    return (
      <RecordCardList
        label={listLabel}
        items={loading ? [] : sites.map(toCard)}
        loading={loading}
        loadingLabel={loadingLabel}
        skeletonCount={skeletonRows}
        empty={empty}
      />
    )
  }

  const columns = [
    { id: 'product', header: t('PRODUCT', 'Product'), rowHeader: true, wrap: true, skeleton: { lines: 2 }, cell: productCell },
    { id: 'code', header: t('CODE', 'Code'), skeleton: { lines: 1 }, cell: codeOf },
    { id: 'url', header: t('URL', 'Url'), wrap: true, skeleton: { lines: 1 }, cell: urlOf }
  ]

  return (
    <DataTable
      label={listLabel}
      columns={columns}
      rows={sites}
      getRowId={site => site.id}
      activeRowId={activeId != null ? sites.find(site => String(site.id) === String(activeId))?.id : undefined}
      onOpenRow={onOpen}
      loading={loading}
      loadingLabel={loadingLabel}
      skeletonRows={skeletonRows}
      empty={empty}
    />
  )
}
