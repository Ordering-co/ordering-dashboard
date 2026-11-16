import React from 'react'
import { useLanguage, useUtils, BusinessReviews as BusinessReviewsController } from '../../../../../index'
import { AsyncSwitch, Button } from '../../Shared/Product'
import { SatisfactionScores } from '../AnalyticsKit/SatisfactionScores'
import { ReviewItem, authorFullName } from '../ReviewsDirectory/ReviewItem'
import { ReviewPanel } from '../ReviewsDirectory/ReviewPanel'
import { businessScores, ratingOf } from '../ReviewsDirectory/reviewsData'

// redesign reviews FC (D1, D5, D8, RV-04, RV-08, RV-09): the text of a translation with its markers replaced (a function, so a `$` in a name stays a `$`)
const fill = (text, values) => Object.entries(values)
  .reduce((result, [marker, value]) => result.replace(`_${marker}_`, () => String(value)), String(text))

/**
 * The panel of the reviews of one business (redesign reviews FC, D1, D5, D8; RV-04, RV-08, RV-09). The page mounts it inside the
 * SplitView and gives it `business` (the row of the list), `businessId`, `onClose`, `expanded`, `onExpandedChange` and
 * `onOpenProducts(business)`; the controller (`BusinessReviews`) brings `businessState`, `reviewsList`, `reloadReviews` and
 * `handleChangeReviewEnabled`, which answers `{ ok, error }`: each review has a switch that saves at once and says when it could not.
 */
export const BusinessReviewDetailsUI = (props) => {
  const {
    business,
    businessId,
    businessState,
    reviewsList,
    handleChangeReviewEnabled,
    reloadReviews,
    onClose,
    expanded,
    onExpandedChange,
    onOpenProducts
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage, parseDate }] = useUtils()

  const displayedBusiness = business?.id === businessId ? business : businessState?.business
  const isHeaderLoading = !displayedBusiness?.name && businessState?.loading
  const reviews = Array.isArray(reviewsList?.reviews) ? reviewsList.reviews : []

  const headerActions = (
    <Button
      disabled={Boolean(isHeaderLoading) || !displayedBusiness}
      onClick={() => onOpenProducts?.(displayedBusiness)}
    >
      {t('REVIEWS_PRODUCT_REVIEWS', 'Product reviews')}
    </Button>
  )

  // redesign reviews (live check): the business reviews of the API carry no author (`review.user` is absent), so the name of the
  // switch says the order and the author only when they are there, and the date when neither is (it starts with «Visible», the
  // visible text: WCAG 2.5.3)
  const nameOfSwitch = (review) => {
    const name = authorFullName(review?.user)
    const order = review?.order_id != null && review.order_id !== '' ? review.order_id : null
    if (order != null && name) return fill(t('REVIEWS_VISIBLE_LABEL', 'Visible: review of order _order_ by _name_'), { order, name })
    if (order != null) return fill(t('REVIEWS_VISIBLE_LABEL_ORDER', 'Visible: review of order _order_'), { order })
    if (name) return fill(t('REVIEWS_VISIBLE_LABEL_NO_ORDER', 'Visible: review by _name_'), { name })
    const date = review?.created_at ? parseDate(review.created_at, { utc: false }) : ''
    return fill(t('REVIEWS_VISIBLE_LABEL_DATE', 'Visible: review of _date_'), { date })
  }

  return (
    <ReviewPanel
      title={displayedBusiness?.name || t('BUSINESS', 'Business')}
      titleLoading={Boolean(isHeaderLoading)}
      headerActions={headerActions}
      avatar={{
        kind: 'business',
        name: displayedBusiness?.name,
        src: displayedBusiness?.logo ? optimizeImage(displayedBusiness.logo, 'h_120,c_limit') : undefined
      }}
      rating={displayedBusiness ? ratingOf(displayedBusiness.reviews?.total) : undefined}
      ratingDecimals={2}
      count={reviews.length}
      // redesign reviews R1 (Q1-8): the average (`general` = `total`) is already in the head with two decimals; the «General» row
      // repeated it with one (4.94 and 4.9, a few pixels apart), so the scores go without it
      summary={<SatisfactionScores scores={{ ...businessScores(displayedBusiness?.reviews), general: undefined }} />}
      expanded={expanded}
      onExpandedChange={onExpandedChange}
      onClose={onClose}
      loading={Boolean(reviewsList?.loading)}
      error={Boolean(reviewsList?.error)}
      empty={reviews.length === 0}
      onRetry={reloadReviews}
    >
      {reviews.map(review => (
        <ReviewItem
          key={review?.id}
          review={review}
          rating={ratingOf(review?.total)}
          author={review?.user || undefined}
          showBreakdown
          action={(
            <AsyncSwitch
              checked={review?.enabled}
              onToggle={(next) => handleChangeReviewEnabled(review?.id, next)}
              failureText={t('REVIEWS_VISIBILITY_ERROR', "The review wasn't updated.")}
              aria-label={nameOfSwitch(review)}
            >
              {t('REVIEWS_VISIBLE', 'Visible')}
            </AsyncSwitch>
          )}
        />
      ))}
    </ReviewPanel>
  )
}

export const BusinessReviewDetails = (props) => {
  const businessReviewDetailsProps = {
    ...props,
    fetchReviewsFromApi: true,
    UIComponent: BusinessReviewDetailsUI
  }
  return <BusinessReviewsController {...businessReviewDetailsProps} />
}
