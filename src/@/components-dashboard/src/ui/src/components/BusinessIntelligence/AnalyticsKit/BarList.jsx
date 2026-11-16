import React from 'react'

import './analytics-kit.css'

// redesign bi FC (BI-13): the share of the largest value, as a number between 0 and 100. A negative or non-numeric value draws nothing.
const share = (value, max) => {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0 || !(max > 0)) return 0
  return Math.min(100, Number(((amount / max) * 100).toFixed(2)))
}

/**
 * A ranking for products, categories and statuses (redesign bi FC, D8, BI-13, BI-14, auditor 11): a real table, not a canvas.
 * The name sits on a bar as long as its share of the largest value (`--od-action-soft`, one neutral color: no red or green by
 * threshold) and the figure is on its own at the end. The consumer sorts: the order is the one that arrives.
 *
 * - `items`: `[{ id, name, value, hint }]`; `hint` is secondary text under the name (for example the store).
 * - `label` names the table (a hidden caption); `nameHeader` and `valueHeader` are the hidden column headers.
 * - `formatValue(value)` writes the figure; without it the value is painted as it comes.
 */
export const BarList = ({ label, items, formatValue, valueHeader, nameHeader }) => {
  if (!Array.isArray(items) || items.length === 0) return null
  const max = Math.max(0, ...items.map(item => Number(item.value)).filter(Number.isFinite))

  return (
    <table className='odc-bi-barlist'>
      <caption className='odc-sr-only'>{label}</caption>
      <thead>
        <tr>
          <th scope='col'><span className='odc-sr-only'>{nameHeader}</span></th>
          <th scope='col'><span className='odc-sr-only'>{valueHeader}</span></th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, index) => (
          <tr key={item.id ?? index} className='odc-bi-bar-row'>
            <th scope='row' className='odc-bi-bar-name'>
              <span className='odc-bi-bar-cell'>
                <span className='odc-bi-bar-fill' style={{ inlineSize: `${share(item.value, max)}%` }} aria-hidden='true' />
                <span className='odc-bi-bar-text'>
                  <span className='odc-bi-bar-label'>{item.name}</span>
                  {item.hint && <span className='odc-bi-bar-hint'>{item.hint}</span>}
                </span>
              </span>
            </th>
            <td className='odc-bi-bar-value'>
              <span className='odc-figure'><bdi>{typeof formatValue === 'function' ? formatValue(item.value) : item.value}</bdi></span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
