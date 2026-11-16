import React from 'react'

import { useLanguage } from '../../../../../index'
import { Status } from '../../Shared/Product'
import { formatClock, storeOpenNow } from './storeOpenNow'

// redesign stores 3.B, P-2: «Open · closes 23:59» / «Open 24 hours» / «Closed · opens 09:00» / «Open» / «Closed», or
// nothing when the row has no `open` or the store is disabled (the cell stays empty, nothing is guessed). The times are the store's own (its `timezone`), written in the project's
// 12 or 24 hours (`format_time`).
/**
 * @param {object}  props
 * @param {object}  props.business   A row of the list (`open`, `today`, `timezone`).
 * @param {boolean} [props.is12Hours] The project writes times in 12 hours (`format_time` = 12).
 * @param {Date}    [props.now]       For tests.
 */
export const OpenNow = ({ business, is12Hours, now }) => {
  const [languageState, t] = useLanguage()
  const locale = languageState?.language?.code
  const state = storeOpenNow(business, now)
  if (!state) return null
  if (state.open) {
    const label = state.allDay
      ? t('STORES_OPEN_ALL_DAY', 'Open 24 hours')
      : state.closes
        ? t('STORES_OPEN_CLOSES_AT', 'Open · closes _time_').replace('_time_', formatClock(state.closes, is12Hours, locale))
        : t('STORES_OPEN_NOW', 'Open')
    return <Status family='done' label={label} className='odc-sl-hours' />
  }
  const label = state.opens
    ? t('STORES_CLOSED_OPENS_AT', 'Closed · opens _time_').replace('_time_', formatClock(state.opens, is12Hours, locale))
    : t('CLOSED', 'Closed')
  return <span className='odc-sl-hours' data-closed=''>{label}</span>
}
