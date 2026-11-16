import React, { useId, useState, useRef } from 'react'
import TiPencil from '@meronex/icons/ti/TiPencil'
import IosArrowUp from '@meronex/icons/ios/IosArrowUp'
import VscTrash from '@meronex/icons/vsc/VscTrash'
import { useUtils, useLanguage, useOrder, useConfig } from '../../../../../index'
import { useWindowSize } from '../../../hooks/useWindowSize'
import '../OrderDetails/details-tab.css'

import {
  AccordionSection,
  Accordion,
  AccordionContent,
  WrapperProductImage,
  ProductImage,
  ContentInfo,
  ProductComment,
  ProductInfo,
  ProductError,
  ProductActions,
  ProductActionsEdit,
  ProductActionsDelete,
  ProductAccordionToggle,
  ProductPriceSection,
  ProductPrice,
  ProductNotAvailable,
  ProductSelect,
  ProductOptionsList,
  ProductQuantity,
  ScheduleInfoWrapper,
  ScheduleInfo
} from './styles'

export const ProductItemAccordion = (props) => {
  const {
    isCartProduct,
    product,
    changeQuantity,
    getProductMax,
    offsetDisabled,
    onDeleteProduct,
    onEditProduct,
    currency,
    toppingsRemoved,
    returnSuboptions,
    // 'compact' is the line of the order detail panel (quantity, name, options folded in one
    // secondary line, price). The default keeps the accordion every other consumer uses.
    variant = 'default'
  } = props
  const [, t] = useLanguage()
  const [orderState] = useOrder()
  const [{ parsePrice, optimizeImage, parseDate }] = useUtils()
  const [{ configs }] = useConfig()
  const windowSize = useWindowSize()

  const [isExpanded, setIsExpanded] = useState(false)
  const accordionContentId = useId()

  const content = useRef(null)

  const productInfo = () => {
    let options = JSON.parse(JSON.stringify(Object.values(product.options ?? {})))
    const extraGroups = options.reduce((acc, option) => {
      const extraRank = option?.extra?.rank ?? option?.rank
      acc[extraRank] = acc[extraRank] || []
      acc[extraRank].push(option)
      return acc
    }, {})

    const sortedExtraGroups = Object.entries(extraGroups).sort(([rankA], [rankB]) => rankA - rankB)

    sortedExtraGroups.forEach(([_, group]) => {
      group.sort((a, b) => a.rank - b.rank)
    })

    options = sortedExtraGroups.flatMap(([, group]) => group)

    if (isCartProduct || returnSuboptions) {
      const ingredients = JSON.parse(JSON.stringify(Object.values(product.ingredients ?? {})))
      options = options.map(option => {
        option.suboptions = Object.values(option.suboptions ?? {})
        return option
      })
      return {
        ...product,
        ingredients,
        options
      }
    }
    return { ...product, options }
  }

  const toggleAccordion = () => {
    if (!product?.valid_menu && isCartProduct) return
    setIsExpanded(expanded => !expanded)
  }

  const handleChangeQuantity = (value) => {
    if (parseInt(value) === 0) {
      onDeleteProduct(product)
    } else {
      changeQuantity(product, parseInt(value))
    }
  }

  const getFormattedSubOptionName = ({ quantity, name, position, price }) => {
    if (name !== 'No') {
      const pos = position ? `(${position})` : ''
      return price > 0 ? `${quantity} x ${name} ${pos} +${parsePrice(price, { currency })}` : `${quantity} x ${name} ${pos}`
    } else {
      return 'No'
    }
  }

  const getProductPrice = (product) => {
    let subOptionPrice = 0
    if (Array.isArray(product?.options)) {
      if (product.options?.length > 0) {
        for (const option of product.options) {
          for (const suboption of option.suboptions) {
            subOptionPrice += suboption.quantity * ((['left', 'right'].includes(suboption.position)) ? (suboption.half_price ?? suboption.price) : suboption.price)
          }
        }
      }
    }

    const price = product.quantity * (product.price + subOptionPrice)
    return parseFloat(price.toFixed(2))
  }

  const productDetails = productInfo()
  const hasProductDetails = productDetails?.ingredients?.some(ingredient => !ingredient.selected) || productDetails?.options?.length > 0 || product.comment
  const canExpand = Boolean(hasProductDetails && (product?.valid_menu || !isCartProduct))
  const toggleLabel = `${isExpanded ? t('COLLAPSE', 'Collapse') : t('EXPAND', 'Expand')} ${product?.name ?? ''}`.trim()
  if (variant === 'compact') {
    const timeFormat = (configs?.format_time?.value === '12') ? 'hh:mm a' : 'HH:mm'
    const suboptionsOf = option => Object.values(option?.suboptions ?? {})
    const removedIngredients = Object.values(product?.ingredients ?? {}).filter(ingredient => !ingredient.selected)
    const details = [
      product?.calendar_event && `${parseDate(product.calendar_event.start, { outputFormat: timeFormat })} - ${parseDate(product.calendar_event.end, { outputFormat: timeFormat })}`,
      removedIngredients.length > 0 && removedIngredients.map(ingredient => `${t('NO', 'No')} ${ingredient.name}`).join(', '),
      ...(productDetails?.options ?? []).map(option => `${option.name}: ${suboptionsOf(option).map(suboption => getFormattedSubOptionName({
        quantity: suboption.quantity,
        name: suboption.name,
        position: (suboption?.position && suboption.position !== 'whole') ? t(suboption.position.toUpperCase(), suboption.position) : '',
        price: (['left', 'right'].includes(suboption.position)) ? (suboption.half_price ?? suboption.price) : suboption.price
      })).join(', ')}`),
      toppingsRemoved?.removed?.length > 0 && `${t('TOPPINGS_REMOVED', 'Toppings removed')}: ${toppingsRemoved.removed.map(topping => topping.name).join(', ')}`,
      // redesign fix-qa E6: main labelled it (ProductItemAccordion: t('COMMENT', 'Comment')); mixed in it read as one more option
      product.comment && `${t('COMMENT', 'Comment')}: ${product.comment}`
    ].filter(Boolean)
    return (
      <li className='odt-item'>
        <span className='odt-item-q odc-figure'>{`${product?.quantity}×`}</span>
        {/* redesign fix-qa E6: main showed the product image; the name next to it already names it */}
        {product?.images && (
          <img className='odt-item-img' src={optimizeImage(product.images, 'h_100,c_limit')} alt='' loading='lazy' />
        )}
        <span className='odt-item-name'>
          <span className='odt-item-title'>{product?.name}</span>
          {details.length > 0 && <span className='odt-item-opt'>{details.join(' · ')}</span>}
        </span>
        <span className='odt-item-price odc-figure'>{parsePrice(getProductPrice(product), { currency })}</span>
      </li>
    )
  }

  const handleAccordionClick = event => {
    if (!canExpand || event.target.closest('button, select, input, a')) return
    toggleAccordion()
  }

  return (
    <AccordionSection>
      <Accordion
        isValid={product?.valid ?? true}
        className={`product accordion ${isExpanded ? 'active' : ''}`}
        onClick={handleAccordionClick}
      >
        <ProductInfo>
          {product?.images && (
            <WrapperProductImage>
              <ProductImage role='img' aria-label={product?.name} bgimage={optimizeImage(product?.images, 'h_100,c_limit')} />
            </WrapperProductImage>
          )}
          {product?.calendar_event
            ? (
            <ScheduleInfoWrapper>
              <h3>{product.name}</h3>
              <ScheduleInfo>
                <span className='odc-figure'>
                  {parseDate(product?.calendar_event?.start, { outputFormat: (configs?.format_time?.value === '12') ? 'hh:mm a' : 'HH:mm' })}
                  {' '}-{' '}
                  {parseDate(product?.calendar_event?.end, { outputFormat: (configs?.format_time?.value === '12') ? 'hh:mm a' : 'HH:mm' })}
                </span>
              </ScheduleInfo>
            </ScheduleInfoWrapper>
              )
            : (
            <>
              {isCartProduct
                ? (
                <ProductSelect
                  aria-label={`${t('QTY', 'Qty')} ${product?.name ?? ''}`.trim()}
                  value={product.quantity}
                  onChange={(e) => handleChangeQuantity(Number(e.target.value))}
                >
                  {[...Array(getProductMax(product) + 1)].map((v, i) => (
                    <option
                      key={i}
                      value={i}
                      disabled={offsetDisabled(product) < i && i !== 0}
                    >
                      {i === 0 ? t('REMOVE', 'Remove') : i}
                    </option>
                  ))}
                </ProductSelect>
                  )
                : (
                <ProductQuantity>
                  {product?.quantity}
                </ProductQuantity>
                  )}
              <ContentInfo>
                <h3>{product.name}</h3>
                {windowSize.width <= 410 && (
                  <div className='mobile-product-summary'>
                    <p className='odc-figure'>{parsePrice(getProductPrice(product), { currency })}</p>
                    <div>
                      {isCartProduct && (
                        <>
                        {onEditProduct && (
                          <ProductActionsEdit
                            type='button'
                            aria-label={`${t('EDIT', 'Edit')} ${product?.name ?? ''}`.trim()}
                            onClick={() => onEditProduct(product)}
                            disabled={orderState.loading}
                          >
                            <TiPencil />
                          </ProductActionsEdit>
                        )}
                        {onDeleteProduct && (
                          <ProductActionsDelete
                            type='button'
                            aria-label={`${t('DELETE', 'Delete')} ${product?.name ?? ''}`.trim()}
                            onClick={() => onDeleteProduct(product)}
                            disabled={orderState.loading}
                          >
                            <VscTrash />
                          </ProductActionsDelete>
                        )}
                        </>
                      )}
                      {canExpand && (
                        <ProductAccordionToggle
                          type='button'
                          aria-label={toggleLabel}
                          aria-expanded={isExpanded}
                          aria-controls={accordionContentId}
                          onClick={toggleAccordion}
                        >
                          <IosArrowUp className={`accordion__icon ${isExpanded ? '' : 'rotate'}`} />
                        </ProductAccordionToggle>
                      )}
                    </div>
                  </div>
                )}
              </ContentInfo>
            </>
              )}
        </ProductInfo>
        {product?.calendar_event && windowSize.width <= 410 && canExpand && (
          <ProductAccordionToggle
            type='button'
            aria-label={toggleLabel}
            aria-expanded={isExpanded}
            aria-controls={accordionContentId}
            onClick={toggleAccordion}
          >
            <IosArrowUp className={`accordion__icon ${isExpanded ? '' : 'rotate'}`} />
          </ProductAccordionToggle>
        )}
        {(product?.valid || !isCartProduct) && windowSize.width > 410 && (
          <ProductPriceSection>
            <ProductPrice>
              <span className='odc-figure'>
                {parsePrice(getProductPrice(product), { currency })}
              </span>
              {canExpand && (
                <ProductAccordionToggle
                  type='button'
                  aria-label={toggleLabel}
                  aria-expanded={isExpanded}
                  aria-controls={accordionContentId}
                  onClick={toggleAccordion}
                >
                  <IosArrowUp className={`accordion__icon ${isExpanded ? '' : 'rotate'}`} />
                </ProductAccordionToggle>
              )}
            </ProductPrice>
            {isCartProduct && (
              <ProductActions>
                {onEditProduct && (
                <ProductActionsEdit
                  type='button'
                  aria-label={`${t('EDIT', 'Edit')} ${product?.name ?? ''}`.trim()}
                  onClick={() => onEditProduct(product)}
                  disabled={orderState.loading}
                >
                  <TiPencil />
                </ProductActionsEdit>
                )}
                {onDeleteProduct && (
                <ProductActionsDelete
                  type='button'
                  aria-label={`${t('DELETE', 'Delete')} ${product?.name ?? ''}`.trim()}
                  onClick={() => onDeleteProduct(product)}
                  disabled={orderState.loading}
                >
                  <VscTrash />
                </ProductActionsDelete>
                )}
              </ProductActions>
            )}
          </ProductPriceSection>
        )}

        {isCartProduct && product?.valid_menu && !product?.valid_quantity && (
          <ProductError>
            <ProductActions>
              {onEditProduct && (
              <ProductActionsEdit
                type='button'
                aria-label={`${t('EDIT', 'Edit')} ${product?.name ?? ''}`.trim()}
                onClick={() => onEditProduct(product)}
                disabled={orderState.loading}
              >
                <TiPencil />
              </ProductActionsEdit>
              )}
              {onDeleteProduct && (
              <ProductActionsDelete
                type='button'
                aria-label={`${t('DELETE', 'Delete')} ${product?.name ?? ''}`.trim()}
                onClick={() => onDeleteProduct(product)}
                disabled={orderState.loading}
              >
                <VscTrash />
              </ProductActionsDelete>
              )}
            </ProductActions>
            <ProductNotAvailable>
              {t('PRODUCT_QUANTITY_ERROR', 'Not available')}
            </ProductNotAvailable>
          </ProductError>
        )}

        {!product?.valid_menu && isCartProduct && (
          <ProductError>
            <ProductActions>
              {onDeleteProduct && (
              <ProductActionsDelete
                type='button'
                aria-label={`${t('DELETE', 'Delete')} ${product?.name ?? ''}`.trim()}
                onClick={() => onDeleteProduct(product)}
                disabled={orderState.loading}
              >
                <VscTrash />
              </ProductActionsDelete>
              )}
            </ProductActions>
            <ProductNotAvailable>
              {t('PRODUCT_QUANTITY_ERROR', 'Not available')}
            </ProductNotAvailable>
          </ProductError>
        )}
      </Accordion>

      <AccordionContent
        id={accordionContentId}
        ref={content}
        aria-hidden={!isExpanded}
        style={{ maxHeight: isExpanded ? `${content.current?.scrollHeight ?? 0}px` : '0px' }}
      >
        {productDetails?.ingredients?.length > 0 && productDetails.ingredients.some(ingredient => !ingredient.selected) && (
          <ProductOptionsList>
            <li className='options-heading'><p>{t('INGREDIENTS', 'Ingredients')}</p></li>
            {productDetails.ingredients.map((ingredient) => !ingredient.selected && (
              <li className='ingredient' key={ingredient.id}>
                <span>{t('NO', 'No')} {ingredient.name}</span>
              </li>
            ))}
          </ProductOptionsList>
        )}
        {Array.isArray(productDetails?.options) && productDetails.options.length > 0 && (
          <ProductOptionsList>
            {productDetails.options.map((option, i) => (
              <li key={i}>
                <p>{option.name}</p>
                <ProductOptionsList className='suboption'>
                  {Array.isArray(option?.suboptions) && option?.suboptions?.map(suboption => (
                    <React.Fragment key={suboption.id}>
                      <li>
                        <span>
                          {getFormattedSubOptionName({
                            quantity: suboption.quantity,
                            name: suboption.name,
                            position: (suboption?.position !== 'whole') ? t(suboption.position.toUpperCase(), suboption.position) : '',
                            price: (['left', 'right'].includes(suboption.position)) ? (suboption.half_price ?? suboption.price) : suboption.price
                          })}
                        </span>
                      </li>
                    </React.Fragment>
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
            <p>{t('COMMENT', 'Comment')}</p>
            <h3>{product.comment}</h3>
          </ProductComment>
        )}
      </AccordionContent>
    </AccordionSection>
  )
}
