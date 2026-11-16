import React from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import {
  Avatar,
  Button,
  DataTable,
  EmptyState,
  Pagination,
  RecordCardList,
  Status
} from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { Search, Star, TriangleAlert } from '../../Shared/Icon'
import { businessRating, productRating, reviewCount, userRating } from './reviewsData'
import './reviews-table.css'

// redesign reviews FD1 (D1, D3, D9; RV-03, RV-05, RV-06, RV-08): the lists of /intelligence/reviews (businesses, drivers, customers,
// professionals, products) as a Product DataTable (and RecordCards under 768px). It draws what the controller of main gives
// (`rows`) and what the page decides (`activeId`, `onOpen`); it fetches nothing and owns no panel, no dialog.

const DEFAULT_PAGE_SIZE = 10
export const REVIEWS_PAGE_SIZES = [10, 25, 50]

// redesign reviews FD1 (RV-06, as CustomersTable): width priorities. The Reviews column steps aside when the table is narrower
// than the columns that outrank it plus its own (the panel is open and the list is narrow). The name and the Rating never do.
// What each asks for, in px, padding included.
const COLUMN_WIDTH = { name: 240, rating: 110, reviews: 110 }

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

const fullName = (user) => [user?.name, user?.lastname].filter(Boolean).join(' ')

// What a row is made of, by kind: its note, its name, its photo (as main sized it), its second line and the link of its card
const KINDS = {
  business: {
    avatar: 'business',
    skeleton: { lines: 2, lead: 'business' },
    rating: businessRating,
    name: (row) => row?.name,
    image: (row, optimizeImage) => optimizeImage(row?.logo, 'h_50,c_limit'),
    secondLine: (row) => row?.address,
    params: (row) => ({ id: row.id })
  },
  user: {
    avatar: 'person',
    skeleton: { lines: 2, lead: 'avatar' },
    rating: userRating,
    name: fullName,
    image: (row, optimizeImage) => optimizeImage(row?.photo, 'w_50,c_limit'),
    secondLine: (row) => row?.email,
    // redesign (row 8, reviews P1): the lists include disabled users, and their row says so
    inactive: (row) => row?.enabled === false,
    params: (row) => ({ id: row.id })
  },
  product: {
    avatar: 'business',
    skeleton: { lines: 1, lead: 'business' },
    rating: productRating,
    name: (row) => row?.name,
    image: (row, optimizeImage) => optimizeImage(row?.images, 'h_50,c_limit'),
    secondLine: () => null,
    params: (row) => (row?.category?.id != null ? { category: row.category.id, product: row.id } : { product: row.id })
  }
}

// The card is a link to the row (`?id=`, or `?category=&product=` for a product), as the order cards are: a middle click works;
// a plain click goes through `onOpen`. The rest of the address (the tab, the page) stays.
const hrefFor = (params) => {
  const search = typeof window === 'undefined' ? '' : window.location.search
  const query = new URLSearchParams(search)
  Object.entries(params).forEach(([key, value]) => query.set(key, value))
  const pathname = typeof window === 'undefined' ? '' : window.location.pathname
  return `${pathname}?${query}`
}

export const ReviewsTable = ({
  kind = 'business',
  label,
  nameHeader,
  rows = [],
  loading = false,
  error = null,
  onRetry,
  pageSize,
  activeId,
  onOpen
}) => {
  const [, t] = useLanguage()
  const [{ optimizeImage, parseNumber }] = useUtils()
  const isPhone = useIsPhone()
  const config = KINDS[kind] ?? KINDS.business
  const skeletonCount = Number(pageSize) || DEFAULT_PAGE_SIZE
  const hasActive = activeId != null && activeId !== '' && Number.isFinite(Number(activeId))
  const loadingLabel = t('LOADING', 'Loading')

  // ---- the cells (the table and the cards draw the same ones) ----
  const dash = () => (
    <span className='odc-rv-dash'>
      <span aria-hidden='true'>—</span>
      <span className='odc-sr-only'>{t('NO_DATA', 'No data')}</span>
    </span>
  )

  // RV-03: a note of 0 (or none) is a dash with words for a screen reader, never a «0»
  const ratingCell = (row) => {
    const value = config.rating(row)
    if (value === null) return dash()
    return (
      <span className='odc-rv-rating'>
        <Star className='odc-icon odc-rv-star' aria-hidden='true' />
        <bdi dir='ltr' className='odc-figure'>{parseNumber(value, { decimal: 2 })}</bdi>
      </span>
    )
  }

  const countCell = (row) => {
    const count = reviewCount(row)
    return count === null ? dash() : <bdi dir='ltr' className='odc-figure'>{count}</bdi>
  }

  // A row with no name keeps a name for the row header and the link: its number
  const nameOf = (row) => config.name(row) || `#${row.id}`

  const inactiveMark = (row) => (config.inactive?.(row)
    ? <Status family='cancel' label={t('INACTIVE', 'Inactive')} />
    : null)

  const nameCell = (row) => {
    const name = nameOf(row)
    const second = config.secondLine(row)
    return (
      <span className='odc-rv-who'>
        <Avatar kind={config.avatar} name={config.name(row)} src={config.image(row, optimizeImage) || undefined} />
        <span className='odc-rv-who-text'>
          <span className='odc-rv-name' dir='auto' title={name}>{name}</span>
          {second && <span className='odc-rv-sub' dir='auto'>{second}</span>}
          {inactiveMark(row)}
        </span>
      </span>
    )
  }

  // ---- the states that are not rows ----
  const emptyState = (
    <EmptyState
      icon={Search}
      title={t('NO_RESULTS_FOUND', 'No results found')}
    />
  )

  // A failure takes the place of the list (RV-08), with the way to try again
  if (!loading && hasError(error)) {
    return (
      <EmptyState
        tone='error'
        icon={TriangleAlert}
        title={t('REVIEWS_LIST_ERROR', "We couldn't load the list.")}
        action={<Button onClick={() => onRetry?.()}>{t('TRY_AGAIN', 'Try again')}</Button>}
      />
    )
  }

  // ---- phone: the same data as cards ----
  if (isPhone) {
    const toCard = (row) => {
      const name = nameOf(row)
      const second = config.secondLine(row)
      const count = kind === 'business' ? reviewCount(row) : null
      return {
        id: row.id,
        href: hrefFor(config.params(row)),
        label: name,
        title: <span className='odc-rv-card-name' dir='auto'>{name}</span>,
        from: second || config.inactive?.(row)
          ? (
            <>
              {second && <span className='odc-rv-card-sub' dir='auto'>{second}</span>}
              {inactiveMark(row)}
            </>
            )
          : undefined,
        indicator: count === null
          ? undefined
          : (
            // redesign reviews R1 (Q1-9): «1 review» / «63 reviews», the panel's words (not «63 Reviews», «1 Reviews»)
            <span className='odc-rv-card-count'>
              {(count === 1 ? t('REVIEWS_COUNT_ONE', '_count_ review') : t('REVIEWS_COUNT_OTHER', '_count_ reviews'))
                .split(/(_count_)/)
                .map((part, index) => (part === '_count_'
                  ? <bdi key={index} dir='ltr' className='odc-figure'>{count}</bdi>
                  : <React.Fragment key={index}>{part}</React.Fragment>))}
            </span>
            ),
        figure: ratingCell(row),
        active: hasActive && String(activeId) === String(row.id),
        onOpen: () => onOpen?.(row)
      }
    }
    return (
      <div className='odc-rv-cards'>
        <RecordCardList
          label={label}
          items={loading ? [] : rows.map(toCard)}
          loading={loading}
          loadingLabel={loadingLabel}
          skeletonCount={skeletonCount}
          empty={emptyState}
        />
      </div>
    )
  }

  // ---- desktop: one table, one tab stop; arrows move between rows, Enter opens (RV-05) ----
  const DEFINITIONS = {
    name: { header: nameHeader, rowHeader: true, wrap: true, locked: true, skeleton: config.skeleton, cell: nameCell },
    rating: { header: t('REVIEWS_RATING', 'Rating'), align: 'end', locked: true, skeleton: { lines: 1 }, cell: ratingCell },
    reviews: { header: t('REVIEWS', 'Reviews'), align: 'end', skeleton: { lines: 1 }, cell: countCell }
  }
  const shown = ['name', 'rating', ...(kind === 'business' ? ['reviews'] : [])]
  const hideBelow = shown.includes('reviews') ? shown.reduce((sum, id) => sum + COLUMN_WIDTH[id], 0) : undefined
  const columns = shown.map(id => ({ id, ...DEFINITIONS[id], hideBelow: id === 'reviews' ? hideBelow : undefined }))

  return (
    <DataTable
      label={label}
      columns={columns}
      rows={rows}
      getRowId={row => row.id}
      activeRowId={hasActive ? Number(activeId) : undefined}
      onOpenRow={row => onOpen?.(row)}
      loading={loading}
      loadingLabel={loadingLabel}
      skeletonRows={skeletonCount}
      empty={emptyState}
    />
  )
}

// «Showing _from_–_to_ of _total_» → the numbers become .odc-figure nodes (decision 11) and keep their direction in RTL
const fill = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})

/**
 * The foot of the three lists: the same one the directories have (10, 25, 50 per page, a page field, the range). `onPageSizeChange`
 * gets the page that keeps the first row of the current page in view. It paints nothing without a total or with no results.
 */
export const ReviewsPagination = ({ page, pageSize, total, busy = false, onPageChange, onPageSizeChange }) => {
  const [, t] = useLanguage()
  if (total == null || !(Number(total) > 0)) return null
  return (
    <div className='odc-rv-foot'>
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        pageSizeOptions={REVIEWS_PAGE_SIZES}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        busy={busy}
        showPageInput
        label={t('PAGINATION', 'Pagination')}
        previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
        nextLabel={t('NEXT_PAGE', 'Next page')}
        pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
        pageLabel={t('PAGE', 'Page')}
        pageOfLabel={(totalPages, figureOf) => fill(t('PAGE_OF_TOTAL', 'of _total_'), { total: figureOf(totalPages) })}
        rangeLabel={(from, to, count, figureOf) => fill(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from: figureOf(from), to: figureOf(to), total: figureOf(count) })}
        pageStatusLabel={(current, totalPages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(totalPages))}
      />
    </div>
  )
}
