import React, { useId } from 'react'

import { useLanguage } from '../../../../../index'
import { HOME_ATTENTION_KEYS, HOME_ATTENTION_PATHS } from '../../../../../utils/homeMetrics'
import { Button, EmptyState, Skeleton } from '../../Shared/Product'
import { ChevronRight, CircleAlert, CircleCheck, Clock, Store, Truck, Wallet } from '../../Shared/Icon'
import './blocks.css'

// redesign home C2 (D4, auditor 3): a plain click navigates inside the dashboard, a modified or middle click stays the browser's
const isPlainClick = (event) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey

// redesign home C2 (D4: tone by urgency, never by color alone; the title and the count always say it)
const ROW_ICONS = { pending: Clock, late: CircleAlert, waitingDriver: Truck, failedCarts: Wallet, googleNotShown: Store }
const ROW_TONES = { pending: 'warning', late: 'danger', waitingDriver: 'warning', failedCarts: 'neutral', googleNotShown: 'warning' }

const AttentionRow = ({ attentionKey, title, scope, count, onNavigate }) => {
  const scopeId = useId()
  const path = HOME_ATTENTION_PATHS[attentionKey]
  const Icon = ROW_ICONS[attentionKey]
  const handleClick = (event) => {
    if (event.defaultPrevented || !isPlainClick(event) || !onNavigate) return
    event.preventDefault()
    onNavigate(path)
  }
  return (
    <li>
      <a
        className='odc-attention-row'
        href={path}
        aria-label={`${count} ${title}`}
        aria-describedby={scopeId}
        data-key={attentionKey}
        onClick={handleClick}
      >
        <span className='odc-attention-icon' data-tone={ROW_TONES[attentionKey]}>
          <Icon className='odc-icon' />
        </span>
        <span className='odc-attention-text'>
          <span className='odc-attention-title'>{title}</span>
          <span className='odc-attention-scope' id={scopeId}>{scope}</span>
        </span>
        <span className='odc-attention-count odc-figure'><bdi>{count}</bdi></span>
        <ChevronRight className='odc-icon odc-icon-flip odc-attention-chevron' />
      </a>
    </li>
  )
}

/**
 * «Needs attention» (redesign home C2, D4, D7): one row per count above zero for the keys this user sees,
 * each one a link to the page that solves it. All clear is a line, never an absent card.
 */
export const NeedsAttention = ({ attention, keys, onRetry, onNavigate, headingRef }) => {
  const [, t] = useLanguage()
  const headingId = useId()
  const visibleKeys = HOME_ATTENTION_KEYS.filter(key => Array.isArray(keys) && keys.includes(key))
  if (!visibleKeys.length) return null

  const { loading = false, error = null, counts = {} } = attention || {}
  const rows = {
    pending: { title: t('HOME_ATTENTION_PENDING', 'Orders waiting for acceptance'), scope: t('HOME_ATTENTION_PENDING_SCOPE', 'Pending and preorders · all dates') },
    late: { title: t('HOME_ATTENTION_LATE', 'Late orders'), scope: t('HOME_ATTENTION_LATE_SCOPE', 'Open orders past their time · all dates') },
    // redesign home R1 (Q-01): a short scope fits one line at 390, so the row keeps the height of its skeleton; the title already says «waiting for a driver»
    waitingDriver: { title: t('HOME_ATTENTION_WAITING_DRIVER', 'Deliveries waiting for a driver'), scope: t('HOME_ATTENTION_WAITING_DRIVER_SCOPE', 'Accepted or ready · all dates') },
    failedCarts: { title: t('HOME_ATTENTION_FAILED_CARTS', 'Carts with a failed payment'), scope: t('HOME_ATTENTION_FAILED_CARTS_SCOPE', 'Open carts') },
    googleNotShown: { title: t('HOME_ATTENTION_GOOGLE_NOT_SHOWN', 'Stores Google is not showing'), scope: t('HOME_ATTENTION_GOOGLE_NOT_SHOWN_SCOPE', 'Activated for Order with Google, missing data') }
  }
  const pendingKeys = visibleKeys.filter(key => Number(counts[key]) > 0)

  let body
  if (loading) {
    body = (
      <ul className='odc-attention-list' aria-hidden='true'>
        {visibleKeys.map(key => (
          <li key={key}>
            {/* redesign home R1 (Q-01): the real row's parts (icon, two lines, figure, chevron) in the same class, so the minimum height is the same */}
            <div className='odc-attention-row' data-slot='home-attention-skeleton'>
              <Skeleton size='var(--od-x-avatar-lg)' block='var(--od-x-avatar-lg)' shape='round' />
              <span className='odc-attention-text'>
                <Skeleton size='60%' />
                <Skeleton size='40%' />
              </span>
              <Skeleton size='var(--od-x-icon-lg)' />
              <Skeleton size='var(--od-x-icon-md)' block='var(--od-x-icon-md)' shape='box' />
            </div>
          </li>
        ))}
      </ul>
    )
  } else if (error) {
    body = (
      <EmptyState
        tone='error'
        icon={CircleAlert}
        title={t('HOME_ATTENTION_ERROR', "We couldn't load what needs your attention.")}
        action={<Button onClick={onRetry}>{t('TRY_AGAIN', 'Try again')}</Button>}
      />
    )
  } else if (!pendingKeys.length) {
    body = (
      <p className='odc-attention-clear'>
        <CircleCheck className='odc-icon' />
        <span>{t('HOME_ATTENTION_ALL_CLEAR', 'All clear: nothing is waiting for you.')}</span>
      </p>
    )
  } else {
    body = (
      <ul className='odc-attention-list'>
        {pendingKeys.map(key => (
          <AttentionRow
            key={key}
            attentionKey={key}
            title={rows[key].title}
            scope={rows[key].scope}
            count={Number(counts[key])}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    )
  }

  return (
    <section className='odc-home-block odc-attention' data-slot='home-attention' aria-labelledby={headingId} aria-busy={loading ? 'true' : undefined}>
      {/* redesign home R1 (Q-04): F2 moves the focus here after «Try again» */}
      <h2 className='odc-home-block-title' id={headingId} ref={headingRef} tabIndex={-1}>{t('HOME_NEEDS_ATTENTION', 'Needs attention')}</h2>
      {body}
    </section>
  )
}
