import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

import { useLanguage, useUtils } from '../../../../../index'
import { LIVE_MINUTES } from '../../../../../utils/openCarts'
import { Button, IconButton, PageHeader, Skeleton, Tabs } from '../../Shared/Product'
import { Menu as MenuIcon, RotateCw } from '../../Shared/Icon'
import './open-carts.css'

dayjs.extend(relativeTime)

// redesign OC-B (OC-1): the page header of the open carts queue: title and count, the state of the automatic recovery, the
// figures of the day, the four views and, in Live now, when the list was updated and a way to refresh it.

const RECOVERY_PATH = '/cart-recovery/recovery-actions'
const TICK_MS = 10000 // the «ago» text moves every 10 seconds
const COUNT_ROOM = 'calc(var(--od-x-count-height) + var(--od-x-space-1-5))' // the room of a two-digit count, so the tabs do not slide when the counts arrive

// the controller's mark for a count that could not be read (utils/openCarts is not ours to extend: the literal is its contract)
const COUNT_UNAVAILABLE = 'unavailable'

const figure = (value) => <bdi className='odc-figure'>{value}</bdi>

// «_on_ of _total_»: the placeholders of a translated template become nodes (a figure, a link, a skeleton)
const fill = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})

// Re-renders every `ms` while `active`, and when `reset` changes, so a time «ago» never reads older than it is
const useNow = (active, ms, reset) => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return undefined
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(timer)
  }, [active, ms, reset])
  return now
}

export const QueueHeader = ({ counts = {}, view, onViewChange, rules, dayFigures, live, learn, onOpenMenu }) => {
  const [, t] = useLanguage()
  const [{ parsePrice } = {}] = useUtils() || []
  const isLive = view === 'live'
  const now = useNow(isLive && live?.lastUpdatedAt != null, TICK_MS, live?.lastUpdatedAt)

  const countLabel = (amount) => (Number(amount) === 1
    ? t('OPEN_CARTS_COUNT_ONE', '1 cart')
    : t('OPEN_CARTS_COUNT', '_count_ carts').replace('_count_', amount))
  // redesign three states of a count. A number is known; null is on its way (a skeleton); COUNT_UNAVAILABLE could not be
  // read (a dash with an accessible name, never a skeleton that waits for ever). The controller says which with the value.
  const isKnown = (value) => typeof value === 'number'
  const tabCount = (value, extra = {}) => {
    if (value === COUNT_UNAVAILABLE) {
      return { count: '—', countLabel: t('OPEN_CARTS_COUNT_UNAVAILABLE', 'Count unavailable') }
    }
    return {
      count: isKnown(value) ? value : <Skeleton size={COUNT_ROOM} />,
      countLabel: isKnown(value) ? countLabel(value) : undefined,
      ...extra
    }
  }

  const items = [
    { value: 'followUp', label: t('OPEN_CARTS_VIEW_FOLLOW_UP', 'Follow up'), ...tabCount(counts.followUp) },
    { value: 'paymentFailed', label: t('OPEN_CARTS_PAYMENT_FAILED', 'Payment failed'), ...tabCount(counts.paymentFailed, { attention: isKnown(counts.paymentFailed) && counts.paymentFailed > 0 }) },
    {
      value: 'live',
      label: <><span className='odc-oc-live-dot' aria-hidden='true' />{t('OPEN_CARTS_VIEW_LIVE', 'Live now')}</>,
      ...tabCount(counts.live)
    },
    { value: 'all', label: t('ALL', 'All'), ...tabCount(counts.all) }
  ]

  // ---- the line under the title ----
  const rulesKnown = rules && !rules.loading && rules.total != null && rules.enabled != null
  const manageRules = (
    <Link className='odc-btn' data-variant='link' to={RECOVERY_PATH}>
      {t('OPEN_CARTS_MANAGE_RULES', 'Manage rules')}
    </Link>
  )
  // redesign OC-F1 (OC-Q1-01, OC-Q1-05): the status area is two fixed rows at every width and in every state (row 1 the
  // recovery line, row 2 the figures of the day). Each is one line that clips with an ellipsis and carries its full text in
  // `title`; a row that has nothing yet still holds its line, so the header never changes height.
  const plain = (template, values) => template.replace(/_([a-z]+)_/g, (match, name) => (values[name] !== undefined ? values[name] : match))
  const manageText = t('OPEN_CARTS_MANAGE_RULES', 'Manage rules')
  const recoveryTitle = rules?.loading
    ? undefined
    : [
        rulesKnown ? plain(t('OPEN_CARTS_RECOVERY_STATUS', 'Automatic recovery: _on_ of _total_ rules on'), { on: rules.enabled, total: rules.total }) : null,
        manageText
      ].filter(Boolean).join(' · ')
  const recovery = (
    <span className='odc-oc-statusrow odc-oc-recovery' data-oc-row='recovery' data-oc-recovery='' data-state={rulesKnown && rules.enabled > 0 ? 'on' : 'off'} title={recoveryTitle}>
      {rules?.loading && <Skeleton size='calc(var(--od-x-type-title-size) * 12)' />}
      {rulesKnown && (
        <>
          <span className='odc-dot' aria-hidden='true' />
          <span className='odc-oc-clip'>
            {fill(t('OPEN_CARTS_RECOVERY_STATUS', 'Automatic recovery: _on_ of _total_ rules on'), { on: figure(rules.enabled), total: figure(rules.total) })}
          </span>
          <span aria-hidden='true'>·</span>
        </>
      )}
      {!rules?.loading && manageRules}
    </span>
  )

  const money = (value) => (parsePrice ? parsePrice(value) : String(value))
  const figureTexts = []
  const dayFigure = (key, label, value, format, plus = false) => {
    if (!dayFigures?.loading && value == null) return null // a figure the API did not give is not drawn
    const text = `${format(value)}${plus ? '+' : ''}`
    if (!dayFigures?.loading) figureTexts.push(`${label} ${text}`)
    return (
      <span key={key} className='odc-oc-figure' data-oc-figure=''>
        <span className='odc-oc-clip'>{label}</span>
        {dayFigures?.loading ? <Skeleton size='calc(var(--od-x-type-title-size) * 2)' /> : figure(text)}
      </span>
    )
  }
  const activeToday = dayFigure('active', t('OPEN_CARTS_ACTIVE_TODAY', 'Active today'), dayFigures?.activeToday, String)
  // the sum comes from at most DAY_FIGURES_CAP details: capped, it is a lower bound
  const atStake = dayFigure('stake', t('OPEN_CARTS_AT_STAKE_TODAY', 'At stake today'), dayFigures?.atStakeToday, money, Boolean(dayFigures?.capped))
  const figures = (
    <span className='odc-oc-statusrow odc-oc-figures' data-oc-row='figures' title={figureTexts.length > 0 ? figureTexts.join(' · ') : undefined}>
      {activeToday}
      {atStake}
    </span>
  )

  // ---- Live now: «Updated 20 s ago» ----
  const elapsed = () => {
    const since = live?.lastUpdatedAt
    if (since == null) return null
    const seconds = Math.floor(Math.max(0, now - since) / 1000)
    if (seconds < 10) return t('OPEN_CARTS_UPDATED_NOW', 'Updated just now')
    const time = seconds < 60
      ? fill(t('OPEN_CARTS_SECONDS', '_count_ s'), { count: figure(Math.floor(seconds / 10) * 10) })
      : dayjs(since).from(now, true)
    return fill(t('OPEN_CARTS_UPDATED_AGO', 'Updated _time_ ago'), { time })
  }

  return (
    <div className='odc-root odc-oc-head'>
      <PageHeader
        leading={onOpenMenu && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={onOpenMenu} />}
        title={t('OPEN_CARTS', 'Open carts')}
        count={isKnown(counts.all) ? counts.all : undefined}
        countLabel={isKnown(counts.all) ? countLabel(counts.all) : undefined}
        learn={learn}
        description={(
          <span className='odc-oc-statusline'>
            {recovery}
            {figures}
          </span>
        )}
      />
      <Tabs
        label={t('OPEN_CARTS_VIEWS', 'Views')}
        value={view}
        onValueChange={onViewChange}
        items={items}
      />
      {isLive && (
        <div className='odc-oc-live' data-oc-live=''>
          <span>{fill(t('OPEN_CARTS_LIVE_WINDOW', 'Carts with activity in the last _minutes_ min'), { minutes: figure(LIVE_MINUTES) })}</span>
          {live?.lastUpdatedAt != null && (
            <>
              <span aria-hidden='true'> · </span>
              <span>{elapsed()}</span>
            </>
          )}
          <Button size='sm' icon={RotateCw} busy={Boolean(live?.refreshing)} onClick={() => live?.refresh?.()}>
            {t('REFRESH', 'Refresh')}
          </Button>
        </div>
      )}
    </div>
  )
}
