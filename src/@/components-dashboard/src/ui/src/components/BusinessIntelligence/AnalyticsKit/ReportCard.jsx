import React, { useId, useRef } from 'react'

import { useLanguage } from '../../../../../index'
import { Button, EmptyState, IconButton, Skeleton, cx } from '../../Shared/Product'
import { CircleAlert } from '../../Shared/Icon'
import './analytics-kit.css'

/**
 * The card of a report block (redesign bi FC, D8, D10, BI-07, BI-08, BI-09, BI-14, auditor 11).
 * A `section` named by its title, a row of actions on the right and one body: the skeleton while it loads, an error with
 * «Try again» for that block only, the empty text, or the children. Surface, border and radius are those of the Home cards.
 *
 * - `skeleton`: the node of the consumer with the final box; without it, a Skeleton at the chart height.
 * - `loading` wins over `error`, and `error` over `empty`.
 * - After «Try again» the focus goes to the title (tabIndex -1): the button leaves with the error.
 */
export const ReportCard = ({
  title,
  headingLevel = 3,
  actions,
  loading = false,
  error,
  onRetry,
  empty = false,
  emptyText,
  children,
  skeleton,
  className,
  id
}) => {
  const [, t] = useLanguage()
  const headingId = useId()
  const headingRef = useRef(null)
  const Heading = `h${headingLevel}`

  // redesign bi FC (BI-07): the retry is for this block; the focus does not get lost when the error state unmounts its own button
  const handleRetry = () => {
    if (typeof onRetry === 'function') onRetry()
    headingRef.current?.focus()
  }

  let body
  if (loading) {
    body = skeleton ?? <Skeleton size='100%' block='var(--od-x-chart-height)' />
  } else if (error) {
    body = (
      <EmptyState
        tone='error'
        icon={CircleAlert}
        title={t('BUSINESS_REPORTS_BLOCK_ERROR', '_title_ could not be loaded.').replace('_title_', title)}
        action={<Button onClick={handleRetry}>{t('TRY_AGAIN', 'Try again')}</Button>}
      />
    )
  } else if (empty) {
    body = <p className='odc-bi-card-empty'>{emptyText ?? t('NO_DATA', 'No data')}</p>
  } else {
    body = children
  }

  return (
    <section id={id} className={cx('odc-bi-card', className)} aria-labelledby={headingId} aria-busy={loading ? 'true' : undefined}>
      <div className='odc-bi-card-head'>
        <Heading className='odc-bi-card-title' id={headingId} ref={headingRef} tabIndex={-1}>{title}</Heading>
        {actions && <div className='odc-bi-card-actions'>{actions}</div>}
      </div>
      <div className='odc-bi-card-body'>{body}</div>
    </section>
  )
}

/**
 * The icon action of a block, 32px (44px of area on a phone), named by `label` which is also its title (redesign bi FC, BI-09, BI-15).
 * `disabled` is the real attribute: a block without data or still loading has no action to run (main left them grey but active).
 */
export const CardAction = ({ icon, label, onClick, disabled = false }) => (
  <IconButton icon={icon} label={label} onClick={onClick} disabled={disabled} />
)
