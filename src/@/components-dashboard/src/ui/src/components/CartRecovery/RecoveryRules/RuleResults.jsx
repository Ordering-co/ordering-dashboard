import React from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { Skeleton } from '../../Shared/Product'

// The three results of a rule (messages sent, carts recovered, revenue recovered), drawn by the table, its phone cards and the rule panel.
// They come from a request of their own that can fail without the rules failing, so every figure has four states: loading, failed,
// unknown (nobody asked, or the API sent null) and a number. Zero is a number.
//
// `stats` is one entry of the controller's `statsByRule`: `{ loading, error, sent_count, recovered_count, recovered_total }`, or undefined.

export const RESULT_KEYS = ['sent', 'recovered', 'revenue']
const FIELD = { sent: 'sent_count', recovered: 'recovered_count', revenue: 'recovered_total' }

export const resultLabels = (t) => ({
  sent: t('SENT', 'Sent'),
  recovered: t('RECOVERY_RULES_COL_RECOVERED', 'Recovered'),
  revenue: t('RECOVERY_RULES_COL_REVENUE_RECOVERED', 'Revenue recovered')
})

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

// 'loading' | 'error' | 'ready' | 'unknown'
export const resultsStatus = (stats) => {
  if (!stats) return 'unknown'
  if (stats.loading) return 'loading'
  if (hasError(stats.error)) return 'error'
  return 'ready'
}

const toNumber = (value) => (value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value))

// Numbers in the language of the dashboard, money in the project's currency (parsePrice reads its configs)
export const useResultFormatters = () => {
  const [languageState] = useLanguage()
  const [{ parsePrice }] = useUtils()
  const locale = languageState?.language?.code
  let numberFormat
  try {
    numberFormat = new Intl.NumberFormat(locale)
  } catch (e) {
    numberFormat = new Intl.NumberFormat()
  }
  return (key, stats) => {
    const value = toNumber(stats?.[FIELD[key]])
    if (value == null) return null
    return key === 'revenue' ? parsePrice(value) : numberFormat.format(value)
  }
}

const figureOf = (value) => <bdi dir='ltr' className='odc-figure'>{value}</bdi>

// One figure, or the reason there is none. `skeletonSize` is the width the figure will take.
export const ResultFigure = ({ kind, stats, format, t, skeletonSize = 'calc(var(--od-x-type-title-size) * 3)' }) => {
  const status = resultsStatus(stats)
  if (status === 'loading') {
    return (
      <span aria-busy='true'>
        <Skeleton size={skeletonSize} />
        <span className='odc-sr-only'>{t('RECOVERY_RULES_RESULTS_LOADING', 'Loading results')}</span>
      </span>
    )
  }
  const text = status === 'ready' ? format(kind, stats) : null
  if (text != null) return figureOf(text)
  if (status === 'error') {
    const message = t('RECOVERY_RULES_RESULTS_UNAVAILABLE', "Results couldn't be loaded")
    return (
      <span className='odc-ra-none' title={message}>
        <span aria-hidden='true'>—</span>
        <span className='odc-sr-only'>{message}</span>
      </span>
    )
  }
  return <span className='odc-ra-none'>—</span>
}
