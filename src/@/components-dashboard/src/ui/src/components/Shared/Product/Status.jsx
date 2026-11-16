import React from 'react'

import { CircleAlert, RotateCcw, Timer } from '../Icon'
import { cx } from './classNames'
import './product.css'
import './status.css'

export const STATUS_FAMILIES = ['pending', 'progress', 'done', 'cancel', 'review']
export const SLA_LEVELS = ['ok', 'risk', 'late']

const assertFamily = family => {
  if (!STATUS_FAMILIES.includes(family)) throw new Error(`Unknown status family: ${family}`)
}

/**
 * Quiet status for tables and lists (C5): a 6px indicator + the exact status
 * name. The color groups (family), the text precises. Never truncated: pass
 * `wrap` where the column is narrow instead.
 */
export const Status = ({ family, label, wrap = false, className, ...props }) => {
  assertFamily(family)
  return (
    <span className={cx('odc-status', className)} data-family={family} data-wrap={wrap ? '' : undefined} {...props}>
      <span className='odc-dot' aria-hidden='true' />
      <span>{label}</span>
    </span>
  )
}

/**
 * Filled status, for the subject of a view (the detail header). The review
 * family (status regressions) adds an icon so it never reads as plain pending.
 */
export const StatusBadge = ({ family, label, className, ...props }) => {
  assertFamily(family)
  return (
    <span className={cx('odc-badge', className)} data-family={family} {...props}>
      {family === 'review'
        ? <RotateCcw className='odc-icon' />
        : <span className='odc-dot' aria-hidden='true' />}
      <span>{label}</span>
    </span>
  )
}

/**
 * SLA (C5), always with text. `ok` stays quiet; `risk` and `late` are the only
 * filled badges in a table row, because they ask for action.
 */
export const SlaBadge = ({ level, label, className, ...props }) => {
  if (!SLA_LEVELS.includes(level)) throw new Error(`Unknown SLA level: ${level}`)
  if (level === 'ok') {
    return (
      <span className={cx('odc-sla', className)} data-level='ok' {...props}>
        <span className='odc-dot' aria-hidden='true' />
        <span>{label}</span>
      </span>
    )
  }
  const Icon = level === 'late' ? CircleAlert : Timer
  return (
    <span className={cx('odc-badge', className)} data-level={level} {...props}>
      <Icon className='odc-icon' />
      <span>{label}</span>
    </span>
  )
}

/**
 * Counter as a badge (C14). `attention` marks a count that needs action
 * (pending orders). `srLabel` reads the meaning to screen readers ("3 pending").
 */
export const Count = ({ value, attention = false, srLabel, className }) => (
  <span className={cx('odc-count', className)} data-attention={attention ? '' : undefined}>
    <span aria-hidden={srLabel ? 'true' : undefined}>{value}</span>
    {srLabel && <span className='odc-sr-only'>{srLabel}</span>}
  </span>
)
