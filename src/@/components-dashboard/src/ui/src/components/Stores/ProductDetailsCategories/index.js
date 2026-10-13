import React, { useState, useEffect } from 'react'
import { InfoCircle } from 'react-bootstrap-icons'
import { BusinessProductsCategories } from '../BusinessProductsCategories'
import { useLanguage } from '~components'

import {
  Container,
  HeaderTitleContainer,
  InfoWrapper,
  CategoriesWrapper
} from './styles'

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
      <CategoriesWrapper>
        <BusinessProductsCategories
          productLayout
          product={product}
          businessState={{ business }}
          productCategorySelected={productCategorySelected}
          setProductCategorySelected={setProductCategorySelected}
          handleOpenCategoryDetails={() => { }}
          categoryListRef={null}
          handleUpdateClickProduct={handleUpdateClick}
          changeCategoriesPositionById={changeCategoriesPositionById}
          getPageProducts={getPageProducts}
          handleCloseExtraOpen={handleCloseExtraOpen}
        />
      </CategoriesWrapper>
    </Container>
  )
}
