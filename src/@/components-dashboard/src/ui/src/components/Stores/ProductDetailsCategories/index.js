import React, { useState, useEffect } from 'react'
import { InfoCircle } from 'react-bootstrap-icons'
import { BusinessProductsCategories } from '../BusinessProductsCategories'
import { useLanguage } from '~components'
import { InlineNotice } from '../../Shared/Product'
import { TriangleAlert } from '../../Shared/Icon'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'

import {
  Container,
  HeaderTitleContainer,
  InfoWrapper,
  CategoriesWrapper,
  MoveFailure
} from './styles'

// The first text of an API error (a string or a list of them); null without one.
const firstMessage = (error) => {
  const message = Array.isArray(error) ? error[0] : error
  return typeof message === 'string' && message.trim() ? message : null
}

export const ProductDetailsCategories = (props) => {
  const {
    product,
    business,
    handleUpdateClick,
    changeCategoriesPositionById,
    getPageProducts,
    productState,
    handleCloseExtraOpen
  } = props

  const [, t] = useLanguage()
  const [productCategorySelected, setProductCategorySelected] = useState(productState?.product?.category)
  // (D-9 c): a refused move stays in this section (ProductLayout does not close it) and says why here
  const [moveFailure, setMoveFailure] = useState(null)

  const handleMoveProduct = async (params, options) => {
    setMoveFailure(null)
    const response = await handleUpdateClick(params, options)
    if (response?.ok === false) setMoveFailure({ error: response.error })
    return response
  }
  const failureDetail = moveFailure ? translateApiMessage(t, firstMessage(moveFailure.error), '') : ''

  useEffect(() => {
    setProductCategorySelected(productState?.product?.category)
  }, [productState?.product?.id])

  return (
    <Container>
      <HeaderTitleContainer>
        <InfoWrapper>
          <InfoCircle />
          <span>{t('PRODUCT_CATEGORIES_INFO', 'Search and move your products between categories or subcategories')}</span>
        </InfoWrapper>
      </HeaderTitleContainer>
      {moveFailure && (
        <MoveFailure>
          <InlineNotice tone='danger' icon={TriangleAlert} role='alert'>
            {`${t('PRODUCT_MOVE_FAILED', 'The product was not moved.')} ${failureDetail}`.trim()}
          </InlineNotice>
        </MoveFailure>
      )}
      <CategoriesWrapper>
        <BusinessProductsCategories
          productLayout
          product={product}
          businessState={{ business }}
          productCategorySelected={productCategorySelected}
          setProductCategorySelected={setProductCategorySelected}
          handleOpenCategoryDetails={() => { }}
          categoryListRef={null}
          handleUpdateClickProduct={handleMoveProduct}
          changeCategoriesPositionById={changeCategoriesPositionById}
          getPageProducts={getPageProducts}
          handleCloseExtraOpen={handleCloseExtraOpen}
        />
      </CategoriesWrapper>
    </Container>
  )
}
