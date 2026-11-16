import React from 'react'

import { Skeleton } from './Feedback'
import { cx } from './classNames'
import './product.css'
import './metric.css'

// redesign bi FA0 (promoción, auditor 10): the card of a figure with its references, promoted from Home's TodaySummary
// (`.odc-today-card`) so the Business Intelligence page reuses it instead of copying it (decision D3).

/**
 * Metric: one figure with its label and, below, the references it is compared with («Friday last week, by now $10.00»).
 *
 * `label` names the figure (required; `''` paints empty). `value` is a node: the consumer wraps a number in `.odc-figure`
 * (decision 11). `refs` is a list of `{ text, value, secondary, lead }`; each is a line of caption: `secondary` dims it
 * (the full day under «by now») and `lead` marks the line that wraps on a phone, so the card reserves two lines for it
 * while it loads. While `loading` the figure and every reference become skeletons of the height of their own line (same
 * boxes as the loaded card; `aria-hidden`, the region that holds the grid announces the wait). Any `data-*` attribute goes
 * to the root. The root is an `li` by default, to sit in a `MetricGrid`; pass `as` for another element.
 */
export const Metric = ({ label, value, refs = [], loading = false, as: Root = 'li', className, ...dataProps }) => {
  if (label == null) throw new Error('Metric needs a label: the name of the figure')
  const attributes = {}
  Object.keys(dataProps).forEach(key => {
    if (key.startsWith('data-')) attributes[key] = dataProps[key]
  })

  return (
    <Root className={cx('odc-metric', className)} {...attributes}>
      <p className='odc-metric-label'>{label}</p>
      {loading
        ? (
          <>
            <p className='odc-metric-value' aria-hidden='true'>
              <Skeleton size='60%' block='calc(var(--od-x-type-display-size) * var(--od-x-leading-title))' />
            </p>
            {refs.map((ref, index) => (
              <p
                key={index}
                className='odc-metric-ref'
                data-secondary={ref.secondary ? '' : undefined}
                data-lead={(ref.lead ?? index === 0) ? '' : undefined}
                aria-hidden='true'
              >
                <Skeleton size='80%' block='calc(var(--od-x-type-caption-size) * var(--od-x-leading-ui))' />
              </p>
            ))}
          </>
          )
        : (
          <>
            <p className='odc-metric-value'>{value}</p>
            {refs.map((ref, index) => (
              <p
                key={index}
                className='odc-metric-ref'
                data-secondary={ref.secondary ? '' : undefined}
                data-lead={ref.lead ? '' : undefined}
              >
                {ref.text} {ref.value}
              </p>
            ))}
          </>
          )}
    </Root>
  )
}

/**
 * MetricGrid: the list that holds the `Metric` cards. Two columns below 1024 px and `columns` from 1024 (4 by default).
 * `columns={6}` is three from 1024 and six from 1280.
 */
export const MetricGrid = ({ children, columns = 4, className }) => (
  <ul className={cx('odc-metric-grid', className)} data-columns={columns}>
    {children}
  </ul>
)
