import React, { useState } from 'react'
import { useTheme } from 'styled-components'

import { useLanguage, useUtils } from '../../../../../index'
import { dayOf, formatVisibleDay, todayDay } from '../../../../../utils/dateRange'
import { AsyncSwitch, DataTable, RecordCardList, useSectionSplit } from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import './business-promotions.css'

// redesign stores 5.14 (E4; S-1, S-2, S-3): the promotions of a store as a Product DataTable (RecordCards under 768px, as
// the markups). It draws what the controller gives and fetches nothing. Columns: Promotion (thumbnail + name, a native button that
// opens it), Type («Coupon · CODE» or «Discount», «· Automatic»), Discount (a percentage or an amount, the minimum purchase under it),
// Date range (in the format of the project, never ISO; «Expired» or «Scheduled» under it when the dates say so) and Status, a switch
// that saves at once (P/AsyncSwitch: it goes back and says why when the save fails).
// A click on the switch is its own: it never opens the row.

const SKELETON_ROWS = 5
const PERCENTAGE = 1
const DISCOUNT = 1
const NBSP = ' '

const nameLabel = (template, promotion) => template.replace('_name_', () => promotion?.name ?? '')

// «Min. _amount_» with the amount as a figure (decision 11: figures keep their direction, the words stay prose)
const fillAmount = (template, amount) => template.split(/(_amount_)/).map((part, index) => (
  part === '_amount_' ? <span key={index} className='odc-figure'>{amount}</span> : part
))

// A promotion with no image, or whose image fails to load (A-1), shows the placeholder of the theme. The failure is remembered by the
// address that failed, so a promotion that gets another image tries it. No alt: the name is beside it.
const PromotionThumb = ({ src, fallback }) => {
  const [failed, setFailed] = useState(null)
  const shown = src && failed !== src ? src : fallback
  if (!shown) return <span className='odc-bpl-thumb' aria-hidden='true' />
  return <img className='odc-bpl-thumb' src={shown} alt='' onError={() => { if (shown === src) setFailed(src) }} />
}

/**
 * @param {object}   props
 * @param {Array<object>} props.promotions
 * @param {boolean}  [props.loading]           Skeleton rows (only with no rows to keep on screen).
 * @param {*}        [props.activeId]          The promotion open in the detail.
 * @param {Function} props.onOpen              `(promotion)`.
 * @param {Function} props.onToggleEnabled     `(promotion, next) => Promise<{ ok, error? }>`: the switch.
 */
export const PromotionsTable = ({ promotions, loading = false, activeId, onOpen, onToggleEnabled }) => {
  const [, t] = useLanguage()
  const [{ parsePrice, parseDate }] = useUtils()
  const theme = useTheme()
  const isPhone = useIsPhone()
  // beside an open detail the list is too narrow for five columns (words broke at 1000–1279): it shows the same cards as the phone
  const split = useSectionSplit()
  const compact = isPhone || (split.mode === 'split' && split.open)
  const placeholder = theme?.images?.dummies?.promotionDummy

  const openLabel = (promotion) => `${promotion?.name ?? ''}, ${t('VIEW_DETAILS', 'View details')}`
  const listLabel = t('PROMOTIONS', 'Promotions')
  const loadingLabel = t('PROMOTIONS_LOADING', 'Loading promotions')

  // ---- the cells (the table and the cards draw the same ones) ----
  const nameText = (promotion) => <span className='odc-bpl-name-text' dir='auto' title={promotion.name}>{promotion.name}</span>

  const nameCell = (promotion) => (
    <button type='button' className='odc-bpl-name' aria-label={openLabel(promotion)} onClick={() => onOpen(promotion)}>
      <PromotionThumb src={promotion.image} fallback={placeholder} />
      {nameText(promotion)}
    </button>
  )

  const typeCell = (promotion) => {
    const isDiscount = Number(promotion.type) === DISCOUNT
    return (
      <span className='odc-bpl-type' dir='auto'>
        {isDiscount ? t('DISCOUNT', 'Discount') : t('COUPON', 'Coupon')}
        {!isDiscount && promotion.coupon ? <>{' · '}<span className='odc-figure'>{promotion.coupon}</span></> : null}
        {promotion.auto ? ` · ${t('PROMOTION_AUTOMATIC', 'Automatic')}` : null}
      </span>
    )
  }

  const discountCell = (promotion) => {
    const rate = Number(promotion.rate)
    if (promotion.rate == null || promotion.rate === '' || !Number.isFinite(rate)) return <span className='odc-bpl-none'>-</span>
    const minimum = Number(promotion.minimum)
    return (
      <span className='odc-bpl-discount'>
        <span className='odc-figure'>{Number(promotion.rate_type) === PERCENTAGE ? `${rate}${NBSP}%` : parsePrice(rate)}</span>
        {minimum > 0 && <span className='odc-bpl-sub'>{fillAmount(t('PROMOTION_MINIMUM_SHORT', 'Min. _amount_'), parsePrice(minimum))}</span>}
      </span>
    )
  }

  // The dates of the promotion against today (S-2): past its end is Expired, before its start is Scheduled, in between says nothing.
  const datesCell = (promotion) => {
    const startDay = dayOf(promotion.start)
    const endDay = dayOf(promotion.end)
    const start = formatVisibleDay(startDay, parseDate)
    const end = formatVisibleDay(endDay, parseDate)
    const today = todayDay()
    let state = null
    if (endDay && endDay < today) state = t('EXPIRED', 'Expired')
    else if (startDay && startDay > today) state = t('PROMOTION_SCHEDULED', 'Scheduled')
    return (
      <span className='odc-bpl-dates'>
        <bdi className='odc-bpl-range'>{start && end ? `${start} – ${end}` : (start || end || '-')}</bdi>
        {state && <span className='odc-bpl-state'>{state}</span>}
      </span>
    )
  }

  // The switch of a row: a click on it is its own, never the row's.
  const statusCell = (promotion) => (
    <span className='odc-bpl-control' data-odc-no-open=''>
      <AsyncSwitch
        checked={Boolean(promotion.enabled)}
        label={nameLabel(t('PROMOTION_ENABLED_NAMED', 'Enabled: _name_'), promotion)}
        failureText={t('PROMOTION_TOGGLE_FAILED', "We couldn't change this promotion. Try again.")}
        onToggle={(next) => onToggleEnabled(promotion, next)}
      />
    </span>
  )

  const isActive = (promotion) => activeId != null && String(activeId) === String(promotion.id)

  // ---- phone, or beside an open detail: the same data as cards ----
  if (compact) {
    const toCard = (promotion) => ({
      id: promotion.id,
      href: '#', // the card is a link for the keyboard and the screen reader; a plain click opens the detail
      label: openLabel(promotion),
      title: (
        <span className='odc-bpl-card-title'>
          <PromotionThumb src={promotion.image} fallback={placeholder} />
          {nameText(promotion)}
        </span>
      ),
      from: typeCell(promotion),
      indicator: discountCell(promotion),
      schedule: [datesCell(promotion)],
      active: isActive(promotion),
      actions: (
        <div className='odc-bpl-card-actions' data-card-actions='' onClick={event => event.stopPropagation()}>
          {statusCell(promotion)}
        </div>
      ),
      onOpen: () => onOpen(promotion)
    })
    return (
      <RecordCardList
        label={listLabel}
        items={loading ? [] : promotions.map(toCard)}
        loading={loading}
        loadingLabel={loadingLabel}
        skeletonCount={SKELETON_ROWS}
      />
    )
  }

  const columns = [
    { id: 'promotion', header: t('PROMOTION', 'Promotion'), rowHeader: true, wrap: true, skeleton: { lines: 1, lead: 'business' }, cell: nameCell },
    { id: 'type', header: t('TYPE', 'Type'), wrap: true, skeleton: { lines: 1 }, cell: typeCell },
    { id: 'discount', header: t('DISCOUNT', 'Discount'), skeleton: { lines: 2 }, cell: discountCell },
    { id: 'dates', header: t('DATES_RANGE', 'Date range'), skeleton: { lines: 2 }, cell: datesCell },
    { id: 'status', header: t('STATUS', 'Status'), skeleton: { lines: 1 }, cell: statusCell }
  ]

  return (
    <DataTable
      label={listLabel}
      columns={columns}
      rows={promotions}
      getRowId={promotion => promotion.id}
      activeRowId={activeId != null ? promotions.find(isActive)?.id : undefined}
      onOpenRow={onOpen}
      getRowAttributes={promotion => ({ 'data-section-split-key': promotion.id })}
      loading={loading}
      loadingLabel={loadingLabel}
      skeletonRows={SKELETON_ROWS}
      scrollLabel={t('PROMOTIONS_TABLE_SCROLL_REGION', 'Promotions table, scrolls sideways')}
    />
  )
}
