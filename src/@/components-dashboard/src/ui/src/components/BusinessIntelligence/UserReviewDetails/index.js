import React from 'react'
import { useLanguage, useUtils, UserReviewDetails as UserReviewDetailsController } from '../../../../../index'
import { ReviewItem } from '../ReviewsDirectory/ReviewItem'
import { ReviewPanel } from '../ReviewsDirectory/ReviewPanel'
import { ratingOf } from '../ReviewsDirectory/reviewsData'

/**
 * The panel of the reviews of one user: a driver, a customer or a professional (redesign reviews FC, D4, D5; RV-02, RV-08, RV-09).
 * The page mounts it inside the SplitView and gives it `userId`, `user` (the row of the list), `onClose`, `expanded` and
 * `onExpandedChange`; the controller (`UserReviewDetails`) brings `userState`, `userReviewState` and `reloadReviews`.
 * The note of a review is its `qualification`, on the same scale as the businesses (RV-02). The author (name, lastname, photo)
 * comes as `review.reviewer` (`params=reviewer`, ); `null` or no key paints no author.
 */
export const UserReviewDetailsUI = (props) => {
  const {
    user,
    userState,
    userReviewState,
    reloadReviews,
    onClose,
    expanded,
    onExpandedChange
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()

  const person = userState?.user ?? user ?? null
  const name = [person?.name, person?.lastname].filter(Boolean).join(' ')
  const isHeaderLoading = !name && userState?.loading
  const reviews = Array.isArray(userReviewState?.reviews) ? userReviewState.reviews : []
  // no average when the row of the list does not bring one (a user opened by `?id=`): the count alone
  const average = ratingOf(person?.qualification)

  return (
    <ReviewPanel
      title={name || t('USER', 'User')}
      titleLoading={Boolean(isHeaderLoading)}
      avatar={{
        kind: 'person',
        name,
        src: person?.photo ? optimizeImage(person.photo, 'w_120,c_limit') : undefined
      }}
      rating={average ?? undefined}
      // redesign reviews R1 (Q1-8): two decimals in the head, as the average of the list (5.00, not 5.0)
      ratingDecimals={2}
      count={reviews.length}
      expanded={expanded}
      onExpandedChange={onExpandedChange}
      onClose={onClose}
      loading={Boolean(userReviewState?.loading)}
      error={Boolean(userReviewState?.error)}
      empty={reviews.length === 0}
      onRetry={reloadReviews}
    >
      {reviews.map(review => (
        <ReviewItem key={review?.id} review={review} rating={ratingOf(review?.qualification)} author={review?.reviewer || undefined} />
      ))}
    </ReviewPanel>
  )
}

export const UserReviewDetails = (props) => {
  const userReivewDetailsProps = {
    ...props,
    UIComponent: UserReviewDetailsUI
  }
  return <UserReviewDetailsController {...userReivewDetailsProps} />
}
