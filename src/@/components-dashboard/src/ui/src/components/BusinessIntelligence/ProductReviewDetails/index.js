import React from 'react'
import { ThumbsDown, ThumbsUp } from '../../Shared/Icon'
import { useLanguage, useUtils, ProductReviews as ProductReviewController } from '../../../../../index'
import { ReviewItem } from '../ReviewsDirectory/ReviewItem'
import { ReviewPanel } from '../ReviewsDirectory/ReviewPanel'
import { isLiked } from '../ReviewsDirectory/reviewsData'

// redesign reviews FC (D5, RV-13): a product review is liked or not, never a note. The thumb is decoration; the words say it.
const Verdict = ({ liked, t }) => {
  const Thumb = liked ? ThumbsUp : ThumbsDown
  return (
    <span className='odc-rv-verdict' data-liked={liked ? 'true' : 'false'}>
      <Thumb className='odc-icon' aria-hidden='true' focusable='false' />
      <span>{liked ? t('REVIEWS_LIKED', 'Liked') : t('REVIEWS_NOT_LIKED', 'Not liked')}</span>
    </span>
  )
}

/**
 * The panel of the reviews of one product (redesign reviews FC, D5, D9; RV-08, RV-09, RV-13). The page mounts it inside the SplitView
 * and gives it `businessId`, `product` (the row of the list), `productId`, `categoryId` and `onClose`; the controller (`ProductReviews`)
 * brings `productState`, `productReviewList` (its `error` is `true` when the API answers an error) and `reloadReviews`.
 * It has no «Open as page», as main.
 */
export const ProductReviewDetailsUI = (props) => {
  const {
    product,
    productState,
    productReviewList,
    reloadReviews,
    onClose
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()

  const displayedProduct = productState?.product ?? product ?? null
  const isHeaderLoading = !displayedProduct?.name && productState?.loading
  const reviews = Array.isArray(productReviewList?.reviews) ? productReviewList.reviews : []

  return (
    <ReviewPanel
      title={displayedProduct?.name || t('PRODUCT', 'Product')}
      titleLoading={Boolean(isHeaderLoading)}
      avatar={{
        kind: 'business',
        name: displayedProduct?.name,
        src: displayedProduct?.images ? optimizeImage(displayedProduct.images, 'h_120,c_limit') : undefined
      }}
      count={reviews.length}
      onClose={onClose}
      loading={Boolean(productReviewList?.loading)}
      error={Boolean(productReviewList?.error)}
      empty={reviews.length === 0}
      onRetry={reloadReviews}
    >
      {reviews.map(review => (
        <ReviewItem key={review?.id} review={review} verdict={<Verdict liked={isLiked(review)} t={t} />} />
      ))}
    </ReviewPanel>
  )
}

export const ProductReviewDetails = (props) => {
  const productReviewProps = {
    ...props,
    UIComponent: ProductReviewDetailsUI
  }
  return <ProductReviewController {...productReviewProps} />
}
