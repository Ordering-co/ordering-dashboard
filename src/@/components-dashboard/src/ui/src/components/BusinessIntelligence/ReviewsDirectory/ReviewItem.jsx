import React from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { Avatar } from '../../Shared/Product'
import { ReviewRating } from './ReviewRating'
import { reviewBreakdown } from './reviewsData'
import './reviews-panel.css'

// redesign reviews FC (D1, RV-14): the name of the author as the API gives it (name and lastname, either may be empty)
export const authorFullName = (author) => [author?.name, author?.lastname]
  .map(part => (typeof part === 'string' ? part.trim() : ''))
  .filter(Boolean)
  .join(' ')

/** The name shown for an author; the word «Customer» when the API gives none. */
export const reviewAuthorName = (author, t) => authorFullName(author) || t('CUSTOMER', 'Customer')

/**
 * One review (redesign reviews FC, D1, D4, D5, D9; RV-13, RV-14, RV-16): an `<article>` with the author (optional), the date by
 * `parseDate` in local time (decision 13), the order number in a figure, the note (or a `verdict` node in its place), the breakdown
 * (optional) and the comment, or «No comment» dimmed when there is none or only spaces.
 *
 *  - `review`: `{ created_at, order_id, comment, quality, delivery, service, package }`;
 *  - `author`: `{ name, lastname, photo }`; without it there is no author block;
 *  - `rating`: the note (number or `null`); `undefined` paints none; `verdict` wins over it;
 *  - `showBreakdown`: the notes of quality, delivery, service and package that are there;
 *  - `action`: a node at the end of the header (the visibility switch of a business review).
 */
export const ReviewItem = ({ review, author, rating, verdict, showBreakdown = false, action }) => {
  const [, t] = useLanguage()
  const [{ optimizeImage, parseDate, parseNumber }] = useUtils()

  const comment = typeof review?.comment === 'string' ? review.comment.trim() : ''
  const dateText = review?.created_at ? parseDate(review.created_at, { utc: false }) : null
  const hasOrder = review?.order_id != null && review.order_id !== ''
  const realName = author ? authorFullName(author) : ''

  // one literal t() per name, so the i18n scanner sees every key
  const names = {
    quality: t('QUALITY', 'Quality'),
    delivery: t('DELIVERY', 'Delivery'),
    service: t('SERVICE', 'Service'),
    package: t('PACKAGE', 'Package')
  }
  const breakdown = showBreakdown ? reviewBreakdown(review) : []

  return (
    <article className='odc-rv-item'>
      <header className='odc-rv-item-head'>
        <div className='odc-rv-item-who'>
          {author && (
            <Avatar
              kind='person'
              size='lg'
              name={realName}
              src={author.photo ? optimizeImage(author.photo, 'w_64,c_limit') : undefined}
            />
          )}
          <div className='odc-rv-item-meta'>
            {author && <span className='odc-rv-item-name'>{reviewAuthorName(author, t)}</span>}
            {(dateText || hasOrder) && (
              <span className='odc-rv-item-sub'>
                {dateText && <span>{dateText}</span>}
                {hasOrder && (
                  <span className='odc-rv-order'>
                    <span>{t('INVOICE_ORDER_NO', 'Order number')}</span>{' '}
                    <span className='odc-figure'>{review.order_id}</span>
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
        {action && <div className='odc-rv-item-action'>{action}</div>}
      </header>

      {verdict != null
        ? verdict
        : rating !== undefined && <ReviewRating value={rating} />}

      {breakdown.length > 0 && (
        <ul className='odc-rv-breakdown'>
          {breakdown.map(({ id, value }) => (
            <li key={id}>
              {names[id]}{' '}
              <span className='odc-figure'>{Number.isInteger(value) ? value : parseNumber(value, { decimal: 1 })}</span>
            </li>
          ))}
        </ul>
      )}

      <p className='odc-rv-comment' data-empty={comment ? undefined : 'true'}>
        {comment || t('NO_COMMENT', 'No comment')}
      </p>
    </article>
  )
}
