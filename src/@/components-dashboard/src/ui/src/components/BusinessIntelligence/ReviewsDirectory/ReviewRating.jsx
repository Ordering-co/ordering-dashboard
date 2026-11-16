import React from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { Star } from '../../Shared/Icon'
import { ratingOf } from './reviewsData'
import './reviews-panel.css'

const STARS = 5

/**
 * The note of a review or of a record (redesign reviews FC, D1, D4, RV-03): the figure with one decimal (`decimals={2}` for the
 * header of a business, as its list) in a `.odc-figure` and five stars rounded to the nearest whole (4.2 paints 4; main rounded up).
 * The stars are decoration; the whole is one image named «4.9 out of 5». With no note (`null`, 0, text, NaN) it paints a dash and a
 * text for assistive technology: a 0 is «no notes yet», never a note.
 *
 * `size` is `sm` (in a review) or `lg` (in the head of a panel).
 */
export const ReviewRating = ({ value, size = 'sm', decimals = 1 }) => {
  const [, t] = useLanguage()
  const [{ parseNumber }] = useUtils()
  const rating = ratingOf(value)

  if (rating === null) {
    return (
      <span className='odc-rv-rating' data-size={size} data-empty=''>
        <span aria-hidden='true'>—</span>
        <span className='odc-sr-only'>{t('NO_DATA', 'No data')}</span>
      </span>
    )
  }

  const filled = Math.min(STARS, Math.round(rating))
  const text = parseNumber(rating, { decimal: decimals })
  return (
    <span
      className='odc-rv-rating'
      data-size={size}
      role='img'
      aria-label={t('BUSINESS_REPORTS_SCORE_OF_FIVE', '_score_ out of 5').replace('_score_', () => text)}
    >
      <span className='odc-figure odc-rv-note'><bdi>{text}</bdi></span>
      <span className='odc-rv-stars' aria-hidden='true'>
        {Array.from({ length: STARS }, (_, index) => (
          <Star key={index} className='odc-rv-star' data-filled={index < filled ? 'true' : 'false'} />
        ))}
      </span>
    </span>
  )
}
