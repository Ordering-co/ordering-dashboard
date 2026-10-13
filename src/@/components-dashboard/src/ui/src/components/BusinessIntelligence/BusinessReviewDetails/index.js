import React from 'react'
import { useLanguage, useUtils, BusinessReviews as BusinessReviewsController } from '../../../../../index'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { useTheme } from 'styled-components'
import { PersonFill } from 'react-bootstrap-icons'
import { Button, Switch } from '../../../styles'

import {
  ReviewDetailsContainer,
  Header,
  BusinessLogoContainer,
  WrapperImage,
  Image,
  ReviewItemContatiner,
  InfoBlock,
  ReviewItemHeader,
  UserInfoContainer,
  ReviewQualityContainer,
  ReviewBarContainer,
  ReviewBar,
  ReviewQualityTextContainer,
  Comment,
  NotReviewed
} from './styles'

const BusinessReviewDetailsUI = (props) => {
  const {
    business,
    businessId,
    businessState,
    reviewsList,
    handleOpenProducts,
    handleChangeReviewEnabled
  } = props

  const [, t] = useLanguage()
  const theme = useTheme()
  const [{ optimizeImage, parseDate }] = useUtils()

  const getReviewPercent = (quality) => {
    return quality / 5 * 100
  }

  const displayedBusiness = business?.id === businessId ? business : businessState?.business
  const isHeaderLoading = !displayedBusiness?.name && businessState?.loading

  return (
    <>
      <ReviewDetailsContainer>
        <Header>
          <h1>
            {isHeaderLoading
              ? <Skeleton width={200} height={24} />
              : displayedBusiness?.name}
          </h1>
          <Button
            color='lightPrimary'
            borderRadius='8px'
            disabled={isHeaderLoading || !displayedBusiness}
            onClick={() => handleOpenProducts(displayedBusiness)}
          >
            {t('PRODUCT_REVIEW', 'Product review')}
          </Button>
        </Header>
        <BusinessLogoContainer>
          <WrapperImage isSkeleton={isHeaderLoading}>
            {isHeaderLoading
              ? <Skeleton width={120} height={120} />
              : (
                <Image bgimage={optimizeImage(displayedBusiness?.logo || theme.images?.dummies?.businessLogo, 'h_120,c_limit')} />
                )}
          </WrapperImage>
        </BusinessLogoContainer>
        {reviewsList?.loading
          ? (
              [...Array(10).keys()].map(i => (
            <ReviewItemContatiner key={i}>
              <ReviewItemHeader>
                <UserInfoContainer>
                  <WrapperImage isSmall isSkeleton>
                    <Skeleton width={40} height={40} />
                  </WrapperImage>
                  <InfoBlock>
                    <p><Skeleton width={80} /></p>
                    <p><Skeleton width={100} /></p>
                  </InfoBlock>
                </UserInfoContainer>
                <Skeleton width={20} />
              </ReviewItemHeader>
              <ReviewQualityContainer>
                <ReviewBarContainer>
                  <Skeleton height={10} />
                </ReviewBarContainer>
              </ReviewQualityContainer>
              <ReviewQualityTextContainer>
                <p><Skeleton width={40} /></p>
                <p><Skeleton width={40} /></p>
                <p><Skeleton width={40} /></p>
                <p><Skeleton width={40} /></p>
                <p><Skeleton width={40} /></p>
              </ReviewQualityTextContainer>
              <Comment>
                <div><Skeleton width={300} /></div>
                <div><Skeleton width={200} /></div>
              </Comment>
            </ReviewItemContatiner>
              ))
            )
          : (
              reviewsList?.reviews.map(review => (
            <ReviewItemContatiner key={review?.id}>
              <ReviewItemHeader>
                <UserInfoContainer>
                  <WrapperImage isSmall>
                    {review?.user?.photo
                      ? (
                      <Image bgimage={optimizeImage(review?.user?.photo)} />
                        )
                      : (
                      <PersonFill />
                        )}
                  </WrapperImage>
                  <InfoBlock>
                    <p className='bold'>{review?.user?.name} {review?.user?.lastname}</p>
                    {review?.created_at && (
                      <p>{parseDate(review?.created_at, { utc: false })}</p>
                    )}
                    {review?.order_id && (
                      <p>
                        <span>{t('INVOICE_ORDER_NO', 'Order No.')}{' '}</span>
                        <span>{review?.order_id}</span>
                      </p>
                    )}
                  </InfoBlock>
                </UserInfoContainer>
                <Switch
                  defaultChecked={review?.enabled}
                  onChange={val => handleChangeReviewEnabled(review?.id, val)}
                />
              </ReviewItemHeader>
              <ReviewQualityContainer>
                <ReviewBarContainer>
                  <ReviewBar
                    percentage={getReviewPercent(review?.quality)}
                  />
                </ReviewBarContainer>
                <ReviewQualityTextContainer>
                  <p>{t('TERRIBLE', 'Terrible')}</p>
                  <p>{t('BAD', 'Bad')}</p>
                  <p>{t('OKAY', 'Okay')}</p>
                  <p>{t('GOOD', 'Good')}</p>
                  <p>{t('GREAT', 'Great')}</p>
                </ReviewQualityTextContainer>
              </ReviewQualityContainer>
              <Comment isEmpty={!review?.comment?.trim()}>
                {review?.comment?.trim() || t('NO_COMMENT', 'No comment')}
              </Comment>
            </ReviewItemContatiner>
              ))
            )}

        {!reviewsList?.loading && reviewsList?.reviews.length === 0 && (
          <NotReviewed>
            {t('ERROR_REVIEW_FIND', 'The review does not exist.')}
          </NotReviewed>
        )}
      </ReviewDetailsContainer>
    </>
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
