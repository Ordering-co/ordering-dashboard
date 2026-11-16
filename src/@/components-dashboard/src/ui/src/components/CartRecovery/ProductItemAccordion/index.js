import React, { useState, useRef, useEffect } from 'react'
import { useTheme } from 'styled-components'
import IosArrowDown from '@meronex/icons/ios/IosArrowDown'

import {
  AccordionSection,
  Accordion,
  AccordionContent,
  WrapperProductImage,
  ProductImage,
  ContentInfo,
  ProductComment,
  ProductInfo,
  ProductPriceSection,
  ProductPrice,
  ProductUnavailableNote,
  ProductOptionsList,
  ProductQuantity,
  ScheduleInfoWrapper,
  ScheduleInfo
} from './styles'

import {
  ProductItemAccordion as ProductItemAccordionController,
  useUtils,
  useLanguage,
  useConfig
} from '~components'

import { useWindowSize } from '~ui'

const ProductItemAccordionUI = (props) => {
  const {
    isCartProduct,
    product,
    toppingsRemoved,
    productInfo
  } = props

  const theme = useTheme()
  const [, t] = useLanguage()
  const [{ parsePrice, parseDate }] = useUtils()
  const windowSize = useWindowSize()
  const [{ configs }] = useConfig()
  const [setActive, setActiveState] = useState('')
  const [setHeight, setHeightState] = useState('0px')
  const [setRotate, setRotateState] = useState('accordion__icon')

  const content = useRef(null)
  const productSelect = useRef(null)
  const productActionsEdit = useRef(null)
  const productActionsDelete = useRef(null)

  // redesign (row 77): the Orders accordion words both menu and quantity failures with PRODUCT_QUANTITY_ERROR
  const isUnavailable = product?.valid === false || product?.valid_menu === false || product?.valid_quantity === false

  const showArrowIcon = props.showArrowIcon && (productInfo?.ingredients?.length > 0 || productInfo?.options?.length > 0 || product?.comment)

  const toggleAccordion = (e) => {
    const isActionsClick = productSelect.current?.contains(e.target) || productActionsEdit.current?.contains(e.target) || productActionsDelete.current?.contains(e.target)
    if ((!product?.valid_menu && isCartProduct) || isActionsClick) return
    setActiveState(setActive === '' ? 'active' : '')
    setHeightState(
      setActive === 'active' ? '0px' : `${content.current.scrollHeight}px`
    )
    setRotateState(
      setActive === 'active' ? 'accordion__icon' : 'accordion__icon rotate'
    )
  }

  const getFormattedSubOptionName = ({ quantity, name, position, price }) => {
    const pos = position ? `(${position})` : ''
    return `${quantity} x ${name} ${pos} +${price}`
  }

  useEffect(() => {
    if (setActive === 'active') {
      setHeightState(
        `${content.current.scrollHeight}px`
      )
    }
  }, [product, setActive])

  return (
    <>
      <AccordionSection>
        <Accordion
          isValid={product?.valid ?? true}
          className={`product accordion ${setActive}`}
          onClick={(e) => toggleAccordion(e)}
        >
          <ProductInfo className='info' isValid={product?.valid ?? true}>
            {(product?.images || (theme?.images?.dummies?.product)) && (
              <WrapperProductImage>
                <ProductImage bgimage={product?.images || theme?.images?.dummies?.product} />
              </WrapperProductImage>
            )}
            {product?.calendar_event
              ? (
              <ScheduleInfoWrapper>
                <h3><bdi>{product.name}</bdi></h3>
                <ScheduleInfo>
                  <span>
                    {parseDate(product?.calendar_event?.start, { outputFormat: (configs?.format_time?.value === '12') ? 'hh:mm a' : 'HH:mm' })}
                    {' '}-{' '}
                    {parseDate(product?.calendar_event?.end, { outputFormat: (configs?.format_time?.value === '12') ? 'hh:mm a' : 'HH:mm' })}
                  </span>
                </ScheduleInfo>
              </ScheduleInfoWrapper>
                )
              : (
              <>
                <ProductQuantity>
                  {product?.quantity}
                </ProductQuantity>

                <ContentInfo>
                  <div>
                    <h3><bdi>{product.name}</bdi></h3>
                    {/* redesign (row 15): at <= 410px the price column is gone, so the price sits under the name, with the
                        same ProductPrice styles as the column (the figure isolated left-to-right) */}
                    {windowSize.width <= 410 && (
                      <ProductPrice className='mobile-product-price'>
                        <span dir='ltr'>{parsePrice(product.total || product.price)}</span>
                      </ProductPrice>
                    )}
                    {
                      product?.comment && (
                        <p>{product?.comment}</p>
                      )
                    }
                  </div>
                </ContentInfo>
              </>
                )}
          </ProductInfo>

          {showArrowIcon && <IosArrowDown className={`${setRotate}`} />}

          {/* redesign (row 77, M-15): the price no longer waits on `product.valid`; an unavailable line keeps it
              (muted by the row's own dimming) and says why below. Valid products keep the >410px rule (<= 410px: price under the name, row 15). */}
          {windowSize.width > 410 && (
            <ProductPriceSection>
              <ProductPrice className='prod-price'>
                <span>
                  {parsePrice(product.total || product.price)}
                </span>
                {(productInfo.ingredients.length > 0 || productInfo.options.length > 0 || product.comment) && (
                  <p>
                    <IosArrowDown className={`${setRotate}`} />
                  </p>
                )}
              </ProductPrice>
            </ProductPriceSection>
          )}
        </Accordion>
        {isUnavailable && (
          // outside <Accordion>: that row is dimmed to 50% and the reason has to stay legible
          <ProductUnavailableNote className='product-unavailable'>
            {t('PRODUCT_QUANTITY_ERROR', 'Not available')}
          </ProductUnavailableNote>
        )}

        <AccordionContent
          ref={content}
          style={{ maxHeight: `${setHeight}` }}
        >
          {productInfo.ingredients.length > 0 && productInfo.ingredients.some(ingredient => !ingredient.selected) && (
            <ProductOptionsList>
              <p>{t('INGREDIENTS', 'Ingredients')}</p>
              {productInfo.ingredients.map(ingredient => !ingredient.selected && (
                <li className='ingredient' key={ingredient.id}>
                  <span>{t('NO', 'No')} {ingredient.name}</span>
                </li>
              ))}
            </ProductOptionsList>
          )}
          {productInfo.options.length > 0 && (
            <ProductOptionsList>
              {productInfo.options.map(option => (
                <li key={option.id}>
                  <p>{option.name}</p>
                  <ProductOptionsList className='suboption'>
                    {option?.suboptions?.sort((a, b) => a.rank - b.rank).map(suboption => (
                      <li key={suboption.id}>
                        <span>
                          {getFormattedSubOptionName({
                            quantity: suboption.quantity,
                            name: suboption.name,
                            position: (suboption?.position !== 'whole') ? t(suboption.position.toUpperCase(), suboption.position) : '',
                            price: (['left', 'right'].includes(suboption.position)) ? parsePrice(suboption.half_price ?? suboption.price) : parsePrice(suboption.price)
                          })}
                        </span>
                      </li>
                    ))}
                  </ProductOptionsList>
                </li>
              ))}
            </ProductOptionsList>
          )}
          {toppingsRemoved?.removed?.length > 0 && (
            <ProductOptionsList>
              <li>
                <p>{t('TOPPINGS_REMOVED', 'Toppings removed')}</p>
                <ProductOptionsList className='suboption'>
                  {toppingsRemoved?.removed.map(topping => (
                    <li key={topping.code}>
                      <span>{topping.name}</span>
                    </li>
                  ))}
                </ProductOptionsList>
              </li>
            </ProductOptionsList>
          )}
          {product.comment && (
            <ProductComment>
              <p>{t('SPECIAL_COMMENT', 'Special Comment')}</p>
              <h3><bdi>{product.comment}</bdi></h3>
            </ProductComment>
          )}
        </AccordionContent>
      </AccordionSection>
    </>
  )
}

export const ProductItemAccordion = (props) => {
  const productItemAccordion = {
    ...props,
    UIComponent: ProductItemAccordionUI
  }
  return (
    <ProductItemAccordionController {...productItemAccordion} />
  )
}
