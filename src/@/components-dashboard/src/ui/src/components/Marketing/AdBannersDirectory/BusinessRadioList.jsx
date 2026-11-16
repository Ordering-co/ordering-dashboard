import React, { useEffect, useRef, useState } from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Avatar, Pagination, RadioGroup, SearchField, Skeleton } from '../../Shared/Product'
import './banner-image.css'

// redesign AB-B4 (decision 3 → 3A; M-AB01, M-AB15, M-AB20): the business picker of the image dialog, for the business link AND for the
// product link (main listed the first 10 businesses of the product link, with no search and no pages). The search is the controller's
// (it searches by name): this list only debounces what is typed and hands it over as typed (the encoding of `&`, `#` and `%` belongs to the
// request, in K/BannerImageDetails). The options are a Product RadioGroup whose option label is a node (logo + name), so the radiogroup,
// the arrows and the 44px rows are the wrapper's own. Props: `businessList` ({ loading, businesses, pagination, error }), `onSearch(text)`,
// `onPageChange(page)`, `value` (the chosen business id, or null), `onChange(id, business)`, `label` (names the radiogroup) and the optional
// `initialSearch` (the text the controller already holds, so a list that remounts keeps showing what it filtered).

const SEARCH_DEBOUNCE_MS = 300
const SKELETON_ROWS = 6

// «Showing _from_–_to_ of _total_»: the numbers become .odc-figure nodes (decision 11)
const fillTemplate = (template, values, figure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figure(values[name])}</React.Fragment> : part
})

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

const errorText = (t, error, fallback) => {
  const first = (Array.isArray(error) ? error.flat(Infinity) : [error])
    .map(item => (typeof item === 'string' ? item : item?.message))
    .find(Boolean)
  return translateApiMessage(t, first, fallback)
}

export const BusinessRadioList = ({ businessList, onSearch, onPageChange, value, onChange, label, initialSearch, linkedText }) => {
  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const [text, setText] = useState(initialSearch ?? '')
  const sent = useRef(initialSearch ?? '')
  const onSearchRef = useRef(onSearch)
  onSearchRef.current = onSearch

  // One call, 300 ms after the last key; never on mount, and typing back to what was last sent asks for nothing
  useEffect(() => {
    if (text === sent.current) return undefined
    const timer = setTimeout(() => {
      sent.current = text
      onSearchRef.current?.(text)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text])

  const businesses = businessList?.businesses ?? []
  const loading = !!businessList?.loading
  const failed = !loading && hasError(businessList?.error)
  const pagination = businessList?.pagination
  const hasValue = value != null && value !== ''
  const visible = businesses.some(business => String(business.id) === String(value))
  const total = pagination?.total
  const currentPage = Number(pagination?.current_page) || 1
  const totalPages = Number(pagination?.total_pages) || 1
  const searchLabel = t('SEARCH_BUSINESSES', 'Search businesses')

  const options = businesses.map(business => ({
    value: String(business.id),
    label: (
      <span className='odc-banners-pick-label'>
        <Avatar
          kind='business'
          name={business.name}
          src={business.logo ? optimizeImage(business.logo, 'h_50,c_limit') : undefined}
        />
        <span className='odc-banners-pick-name'>{business.name}</span>
      </span>
    )
  }))

  return (
    <div className='odc-root odc-banners-pick'>
      <SearchField
        value={text}
        onChange={setText}
        label={searchLabel}
        placeholder={searchLabel}
        clearLabel={t('CLEAR_SEARCH', 'Clear search')}
        className='odc-banners-pick-search'
      />

      {hasValue && !loading && !visible && (
        <p className='odc-banners-pick-note'>
          {/* redesign AB-R1 (review r1 #6): the host names the stored link (its path) when it knows it */}
          {linkedText || t('AD_BANNERS_LINKED_NOW', 'Linked now: business #_id_').replace('_id_', () => String(value))}
        </p>
      )}

      {loading && (
        <div className='odc-banners-pick-skeleton' aria-busy='true'>
          <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <span key={index} className='odc-banners-pick-skeleton-row'>
              <Skeleton shape='round' size='var(--od-x-icon-md)' block='var(--od-x-icon-md)' />
              <Skeleton size='40%' />
            </span>
          ))}
        </div>
      )}

      {failed && (
        <p className='odc-banners-pick-error' role='alert'>
          {errorText(t, businessList.error, t('AD_BANNERS_BUSINESSES_ERROR', "We couldn't load the businesses."))}
        </p>
      )}

      {!loading && !failed && businesses.length === 0 && (
        <p className='odc-banners-pick-empty'>{t('AD_BANNERS_NO_BUSINESSES', 'No businesses found.')}</p>
      )}

      {!loading && businesses.length > 0 && (
        <RadioGroup
          hideLabel
          label={label}
          value={hasValue ? String(value) : ''}
          onValueChange={next => {
            const business = businesses.find(item => String(item.id) === next)
            if (business) onChange?.(business.id, business)
          }}
          options={options}
          className='odc-banners-pick-group'
        />
      )}

      {totalPages > 1 && (
        <Pagination
          page={currentPage}
          pageSize={Number(pagination?.page_size) || businesses.length || 1}
          total={Number.isFinite(Number(total)) && total != null ? Number(total) : undefined}
          hasMore={total == null && currentPage < totalPages}
          itemCount={businesses.length}
          onPageChange={page => onPageChange?.(page)}
          busy={loading}
          label={t('PAGINATION', 'Pagination')}
          previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
          nextLabel={t('NEXT_PAGE', 'Next page')}
          rangeLabel={(from, to, count, figure) => fillTemplate(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to, total: count }, figure)}
          pageStatusLabel={(current, pages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(pages))}
        />
      )}
    </div>
  )
}
