import React from 'react'

import { useLanguage, useUtils } from '~components'
import { ProgressRing } from '../../Shared'
import { Skeleton } from '../../Shared/Product'
import { Image } from '../../Shared/Icon'
import './product-editor.css'

// redesign SP-F1 (D1)
// What the product editor shows with no section open: the image, the ROI ring and the prices (ProductSummary:216-285).
// A product shows its selling price, the regular price (when it is in offer), the cost and the cost of the regular price;
// a service shows price • duration and its description. The list of sections is not here: it is the SectionNav of the shell.
//
// @param {object}   props
// @param {boolean}  props.loading
// @param {object}   [props.product]   `productState.product`

// ROI of main (ProductSummary:134-144): how much of the price is not cost; 100 with no price.
export const getPercentage = (product) => {
  if (!product) return 0
  if (product.price) return (product.price - product.cost_price) * 100 / product.price
  return 100
}

// The ring is the legacy ProgressRing (main's), painted with the tokens.
const RING_SIZE = 70
const RING_LINE = 8
const RING_TRANSITION_MS = 200

export const ProductOverview = ({ loading, product }) => {
  const [, t] = useLanguage()
  const [{ optimizeImage, parsePrice }] = useUtils()

  if (loading || !product) {
    return (
      <div className='odc-pe-overview' aria-busy='true'>
        <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
        <div className='odc-pe-overview-top'>
          <div className='odc-pe-image'>
            <Skeleton block='100%' />
          </div>
        </div>
        <div className='odc-pe-skeletons'>
          <Skeleton size='var(--od-x-cell-person)' block='var(--od-x-control-height)' />
          <Skeleton />
          <Skeleton size='60%' />
        </div>
      </div>
    )
  }

  const isService = product.type === 'service'
  const image = product.images ? optimizeImage(product.images, 'h_200,c_limit') : null

  return (
    <div className='odc-pe-overview'>
      <div className='odc-pe-overview-top'>
        <div className='odc-pe-image'>
          {image
            ? <img src={image} alt='' onError={event => { event.currentTarget.hidden = true }} />
            : <Image className='odc-icon odc-pe-image-empty' aria-hidden='true' />}
        </div>
        {!isService && (
          <div className='odc-pe-roi'>
            <ProgressRing
              isShowPercent
              percent={getPercentage(product)}
              size={RING_SIZE}
              lineWidth={RING_LINE}
              progressColor='var(--od-action)'
              trackColor='var(--od-border)'
              caps='round'
              spin={false}
              transitionDuration={RING_TRANSITION_MS}
            />
            <div className='odc-pe-roi-text'>
              <p className='odc-pe-roi-value odc-figure'>{parsePrice(product.price - product.cost_price)}</p>
              <p className='odc-pe-label'>{t('PRODUCT_SALES_ROI', 'Product sales ROI')}</p>
            </div>
          </div>
        )}
      </div>
      {isService
        ? (
          <>
            <p className='odc-pe-service-line'>
              <span className='odc-figure'>{parsePrice(product.price)}</span>
              <span aria-hidden='true'>•</span>
              <span className='odc-figure'>{t('PRODUCT_EDITOR_DURATION', '_minutes_ min').replace('_minutes_', product.duration)}</span>
            </p>
            {product.description && <p className='odc-pe-description'>{product.description}</p>}
          </>
          )
        : (
          <dl className='odc-pe-prices'>
            <div className='odc-pe-price'>
              <dt>{t('PRODUCT_SELLING_PRICE', 'Selling price')}</dt>
              <dd className='odc-figure'>{parsePrice(product.price)}</dd>
            </div>
            {!!product.in_offer && (
              <div className='odc-pe-price'>
                <dt>{t('REGULAR_PRICE', 'Regular Price')}</dt>
                <dd className='odc-figure'>{parsePrice(product.offer_price)}</dd>
              </div>
            )}
            {!!product.cost_price && (
              <div className='odc-pe-price'>
                <dt>{t('PRODUCT_COST', 'Product cost')}</dt>
                <dd className='odc-figure'>{parsePrice(product.cost_price)}</dd>
              </div>
            )}
            {!!product.cost_offer_price && (
              <div className='odc-pe-price'>
                <dt>{t('PRODUCT_REGULAR_COST', 'Product cost - regular price')}</dt>
                <dd className='odc-figure'>{parsePrice(product.cost_offer_price)}</dd>
              </div>
            )}
          </dl>
          )}
    </div>
  )
}
