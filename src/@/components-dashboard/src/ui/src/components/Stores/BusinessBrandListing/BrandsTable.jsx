import React from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { useTheme } from 'styled-components'
import { Search, Store, TriangleAlert } from '../../Shared/Icon'
import { AsyncSwitch, Avatar, Button, DataTable, EmptyState, RecordCardList } from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'

// redesign SB-B2 (; decision 2; G5-47, M-SB3, M-SB4, M-SB6): the brand list as a Product DataTable, and RecordCards under 768px.
// It draws what the controller gives (`brands`) and what the host decides (the open brand, what the switch does); it fetches nothing and
// owns no dialog. The columns are Brand (logo, name and `slug · #id`, the id as a figure) and Enabled (the AsyncSwitch of the brand: it
// waits for the API and goes back if the save fails, named with the brand). The old «Actions» column only held that switch.

const DEFAULT_PAGE_SIZE = 10

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

// The card is a link to `?id=`, as the order cards are: a middle click works; a plain click goes through `onOpenBrand`.
const hrefFor = (id) => {
  if (typeof window === 'undefined') return `?id=${id}`
  const params = new URLSearchParams(window.location.search)
  params.set('id', id)
  return `${window.location.pathname}?${params}`
}

export const BrandsTable = ({
  brands = [],
  loading = false,
  error = null,
  pageSize,
  activeBrandId,
  onOpenBrand,
  hasSearch = false,
  onRetry,
  onAddBrand,
  onToggleEnabled
}) => {
  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const theme = useTheme()
  const isPhone = useIsPhone()
  const skeletonCount = Number(pageSize) || DEFAULT_PAGE_SIZE
  const listLabel = t('BRANDS', 'Brands')
  const loadingLabel = t('BRANDS_LOADING', 'Loading brands')

  // «slug · #id»: the slug may be missing on an old brand; the id is a figure, isolated for any direction of text
  const subline = (brand) => (
    <span className='odc-brand-sub'>
      {brand.slug && <><bdi dir='ltr'>{brand.slug}</bdi>{' · '}</>}
      <bdi dir='ltr' className='odc-figure'>{`#${brand.id}`}</bdi>
    </span>
  )

  const logoOf = (brand) => optimizeImage(brand?.logo || theme?.images?.dummies?.businessLogo, 'h_50,c_limit') || undefined

  const brandCell = (brand) => (
    <span className='odc-brand-who'>
      <Avatar kind='business' name={brand.name} src={logoOf(brand)} />
      <span className='odc-brand-who-text'>
        <span className='odc-brand-name' dir='auto' title={brand.name}>{brand.name}</span>
        {subline(brand)}
      </span>
    </span>
  )

  const switchOf = (brand) => (
    <AsyncSwitch
      className='odc-brand-row-switch'
      checked={!!brand.enabled}
      label={t('ENABLE_BRAND_NAME', 'Enable _name_').replace('_name_', () => brand.name ?? '')}
      failureText={t('BRAND_UPDATE_FAILED', "The brand couldn't be changed. Try again.")}
      onToggle={next => onToggleEnabled?.(brand, next)}
    />
  )

  // ---- the states that are not rows ----
  const emptyState = () => (hasSearch
    ? <EmptyState icon={Search} title={t('BRANDS_NO_MATCH', 'No brands match your search')} />
    : (
      <EmptyState
        icon={Store}
        title={t('BRANDS_EMPTY', 'No brands yet')}
        action={<Button onClick={() => onAddBrand?.()}>{t('ADD_BRAND', 'Add brand')}</Button>}
      />
      ))

  // A failure takes the place of the list (M-SB6), with the way to try again
  if (!loading && hasError(error)) {
    return (
      <EmptyState
        tone='error'
        icon={TriangleAlert}
        title={t('BRANDS_LOAD_ERROR', "We couldn't load the brands.")}
        action={<Button onClick={() => onRetry?.()}>{t('RETRY', 'Retry')}</Button>}
      />
    )
  }

  // ---- phone: the same data as cards, the switch inside the card (M-SB3) ----
  if (isPhone) {
    const toCard = (brand) => ({
      id: brand.id,
      href: hrefFor(brand.id),
      label: brand.name ?? `#${brand.id}`,
      title: <span className='odc-brand-card-name' dir='auto'>{brand.name}</span>,
      from: (
        <span className='odc-brand-card-who'>
          <Avatar kind='business' name={brand.name} src={logoOf(brand)} />
          {subline(brand)}
        </span>
      ),
      active: activeBrandId != null && String(activeBrandId) === String(brand.id),
      actions: (
        <div className='odc-brand-card-actions' data-card-actions='' onClick={event => event.stopPropagation()}>
          <span className='odc-brand-card-caption' aria-hidden='true'>{t('ENABLED', 'Enabled')}</span>
          {switchOf(brand)}
        </div>
      ),
      onOpen: () => onOpenBrand?.(brand)
    })
    return (
      <div className='odc-brand-cards'>
        <RecordCardList
          label={listLabel}
          items={loading ? [] : brands.map(toCard)}
          loading={loading}
          loadingLabel={loadingLabel}
          skeletonCount={skeletonCount}
          empty={emptyState()}
        />
      </div>
    )
  }

  // ---- desktop: one table, one tab stop; arrows move between rows, Enter opens ----
  const columns = [
    { id: 'brand', header: t('BRAND', 'Brand'), rowHeader: true, wrap: true, locked: true, skeleton: { lines: 2, lead: 'business' }, cell: brandCell },
    { id: 'enabled', header: t('ENABLED', 'Enabled'), align: 'end', skeleton: { lines: 1 }, cell: switchOf }
  ]

  return (
    <DataTable
      label={listLabel}
      columns={columns}
      rows={brands}
      getRowId={brand => brand.id}
      activeRowId={activeBrandId != null && activeBrandId !== '' ? Number(activeBrandId) : undefined}
      onOpenRow={brand => onOpenBrand?.(brand)}
      loading={loading}
      loadingLabel={loadingLabel}
      skeletonRows={skeletonCount}
      empty={emptyState()}
    />
  )
}
