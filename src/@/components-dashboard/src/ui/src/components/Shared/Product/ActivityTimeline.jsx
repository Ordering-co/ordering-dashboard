import React from 'react'

import { ChevronDown } from '../Icon'
import { cx } from './classNames'
import './product.css'
import './timeline.css'

const assertProps = (label, items, detailsLabel) => {
  // redesign W0-2 r2 (W0-Q1-01): empty translation paints empty, only a missing label throws
  if (label == null) throw new Error('ActivityTimeline needs a label')
  if (detailsLabel == null && items.some(item => item.details != null)) {
    throw new Error('ActivityTimeline needs detailsLabel when an item has details')
  }
}

/**
 * Activity timeline (C9): a start-aligned list on a 1px axis with an 8px node
 * per event. Each event reads: absolute time (mono caption), what happened
 * (body, bold parts semibold), and who (muted). Technical details (app, user
 * agent, IP) are folded into a native `<details>` and never open by default.
 *
 * `items` is `[{ id, at, datetime?, title, by?, key?, details? }]`; `at` arrives already
 * formatted (the consumer owns locale and time zone). `datetime` is the machine value of the
 * same instant (ISO 8601), the `dateTime` of the `<time>` (redesign tramo A r3, W0-QA1-09). `key` fills the node for
 * the events that matter (placed, completed). `label` names the list and
 * `detailsLabel` the fold ("Technical details"); both come from the consumer,
 * which translates them. `filter` takes a `SegmentedControl` above the list;
 * `empty` replaces the list when there are no items. No text of its own.
 */
export const ActivityTimeline = ({ label, items, detailsLabel, filter, empty, className, ...props }) => {
  assertProps(label, items, detailsLabel)
  return (
    <div className={cx('odc-root', 'odc-timeline', className)} {...props}>
      {filter && <div className='odc-timeline-filter'>{filter}</div>}
      {items.length === 0
        ? empty
        : (
          <ol className='odc-feed' aria-label={label}>
            {items.map(item => (
              <li key={item.id} className='odc-feed-item' data-key={item.key ? '' : undefined}>
                <div className='odc-feed-when'>
                  <time className='odc-figure' dateTime={item.datetime}>{item.at}</time>
                </div>
                <div className='odc-feed-what'>{item.title}</div>
                {item.by != null && <div className='odc-feed-by'>{item.by}</div>}
                {item.details != null && (
                  <details className='odc-feed-details'>
                    <summary className='odc-feed-summary'>
                      <ChevronDown className='odc-icon odc-feed-chevron' aria-hidden='true' />
                      {detailsLabel}
                    </summary>
                    <div className='odc-feed-detail-body'>{item.details}</div>
                  </details>
                )}
              </li>
            ))}
          </ol>
          )}
    </div>
  )
}
