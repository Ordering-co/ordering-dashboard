import React from 'react'

import { cx } from './classNames'
import './product.css'
import './order-route.css'

const NBSP = ' '

/**
 * The route of an order (C5): its real milestones with their real times. It
 * lives only in the detail view. The next milestone is highlighted, not the
 * last one completed; a cancelled order ends in a stop step.
 *
 * `steps` is the output of `buildOrderRoute` (utils/orderRoute). The component
 * has no copy: `label` names the list and `describeStep` writes what a screen
 * reader hears for each step (the visible text is decorative: aria-hidden).
 * `note` is the line under the route: `{ tone: 'late' | 'ok' | 'stop', icon, children }`.
 */
export const OrderRoute = ({ steps, label, describeStep, note, className, ...props }) => {
  // redesign W0-2 r2 (W0-Q1-01): missing, not empty
  if (label == null) throw new Error('OrderRoute needs a label')
  if (typeof describeStep !== 'function') throw new Error('OrderRoute needs describeStep')
  const NoteIcon = note?.icon
  return (
    <div className={cx('odc-route', className)} {...props}>
      <ol aria-label={label} style={{ '--steps': steps.length }}>
        {steps.map(step => (
          <li
            key={step.key}
            data-state={step.state}
            aria-current={step.state === 'next' ? 'step' : undefined}
          >
            <span className='odc-route-node' aria-hidden='true' />
            <span className='odc-route-label' aria-hidden='true'>{step.label}</span>
            {/* redesign W0-3a (T0-9, decisión 11a): the time is a figure (mono with tabular digits), not plain mono */}
            <span className='odc-route-time' aria-hidden='true'>
              {step.at ? <span className='odc-figure'>{step.at}</span> : NBSP}
            </span>
            <span className='odc-sr-only'>{describeStep(step)}</span>
          </li>
        ))}
      </ol>
      {note && (
        <div className='odc-route-note' data-tone={note.tone}>
          {NoteIcon && <NoteIcon className='odc-icon' aria-hidden='true' />}
          <span>{note.children}</span>
        </div>
      )}
    </div>
  )
}
