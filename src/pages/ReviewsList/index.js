import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { ReviewsListing as ReviewsListingController } from '~ui'

export const ReviewsList = (props) => {
  const reviewsProps = {
    ...props,
    isUseQuery: true
  }
  return (
    <>
      <HelmetTags page='reviews' />
      <ReviewsListingController {...reviewsProps} />
    </>
  )
}
