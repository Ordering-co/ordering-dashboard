import React from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { Star } from '../../Shared/Icon'
import './analytics-kit.css'

const STARS = 5

/**
 * The satisfaction notes of a period (redesign bi FC, D8, BI-02, auditor 7): one row per note that is present and not 0 (as main),
 * in the order General, Quality, Delivery, Service, Package. Each row has the name, the note with one decimal and five stars
 * rounded to the nearest whole (main rounded up: 4.01 painted 5). The stars are decoration; the note is named for assistive
 * technology as «4.0 out of 5».
 *
 * `scores` is the object of the API: `{ general, quality, delivery, service, package }`, as text («5.00») or number.
 */
export const SatisfactionScores = ({ scores }) => {
  const [, t] = useLanguage()
  const [{ parseNumber }] = useUtils()

  // one literal t() per name, so the i18n scanner sees every key
  const rows = [
    { id: 'general', name: t('GENERAL', 'General') },
    { id: 'quality', name: t('QUALITY', 'Quality') },
    { id: 'delivery', name: t('DELIVERY', 'Delivery') },
    { id: 'service', name: t('SERVICE', 'Service') },
    { id: 'package', name: t('PACKAGE', 'Package') }
  ]
    .map(row => ({ ...row, score: scores?.[row.id] }))
    .filter(row => row.score != null && row.score !== '' && Number(row.score) > 0 && Number.isFinite(Number(row.score)))

  if (rows.length === 0) return null

  return (
    <ul className='odc-bi-scores'>
      {rows.map(({ id, name, score }) => {
        const value = Number(score)
        const filled = Math.min(STARS, Math.round(value))
        const text = parseNumber(value, { decimal: 1 })
        return (
          <li key={id} className='odc-bi-score'>
            <span className='odc-bi-score-name'>{name}</span>
            <span className='odc-bi-score-value' role='img' aria-label={t('BUSINESS_REPORTS_SCORE_OF_FIVE', '_score_ out of 5').replace('_score_', text)}>
              <span className='odc-figure odc-bi-score-note'><bdi>{text}</bdi></span>
              <span className='odc-bi-score-stars' aria-hidden='true'>
                {Array.from({ length: STARS }, (_, index) => (
                  <Star key={index} className='odc-bi-star' data-filled={index < filled ? 'true' : 'false'} />
                ))}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
