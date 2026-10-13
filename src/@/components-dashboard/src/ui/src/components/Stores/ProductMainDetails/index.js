import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage } from '../../../../../index'
import { DragScroll } from '../../Shared'
import { SeoOptions } from '../SeoOptions'
import { ProductDetatilsInformation } from '../ProductDetatilsInformation'
import { ProductDetailsAdvanced } from '../ProductDetailsAdvanced'
import { ProductTagsList } from '../ProductTagsList'
import { ProductDetailsCategories } from '../ProductDetailsCategories'
import { addQueryToUrl } from '../../../utils'

import {
  Container,
  TabsConatiner,
  Tab
} from './styles'

export const ProductMainDetails = (props) => {
  const {
    product,
    formState,
    handlechangeImage,
    handleChangeInput,
    handleChangeFormState,
    handleChangeRibbon,
    handleUpdateClick,
    isExtendExtraOpen,
    setIsExtendExtraOpen,
    business,
    handleSuccessUpdate,
    setFormTaxState,
    formTaxState,
    taxes,
    setTaxes,
    fees,
    setFees,
    cleanFormState
  } = props

  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()

  const [selectedOption, setSelectedOption] = useState('information')

  const listOptions = [
    { key: 'information', content: t('INFORMATION', 'Information'), enabled: true },
    { key: 'advanced', content: t('ADVANCED', 'Advanced'), enabled: true },
    { key: 'labels', content: t('LABELS', 'Labels'), enabled: true },
    { key: 'categories', content: t('CATEGORIES', 'Categories'), enabled: true },
    { key: 'seo_options', content: t('SEO_OPTIONS', 'SEO options'), enabled: true }
  ]

  const handleSelectOption = (tab, isInitialRender) => {
    setSelectedOption(tab)
    setIsExtendExtraOpen(false)
    if (!isInitialRender) {
      addQueryToUrl({ tab })
    }
  }

  useEffect(() => {
    const tab = query.get('tab')
    if (tab) {
      handleSelectOption(tab, true)
    } else {
      handleSelectOption(selectedOption)
    }
  }, [])

  return (
    <Container maxLimit={isExtendExtraOpen}>
      <h1>{t('PRODUCT_DETAILS', 'Product details')}</h1>
      <TabsConatiner>
        <DragScroll>
          {listOptions.filter((option) => (option.enabled)).map(option => (
            <Tab
              key={option.key}
              active={selectedOption === option.key}
              onClick={() => handleSelectOption(option.key)}
            >
              {option.content}
            </Tab>
          ))}
        </DragScroll>
      </TabsConatiner>
      {selectedOption === 'information' && (
        <ProductDetatilsInformation
          product={product}
          business={business}
          formState={formState}
          handlechangeImage={handlechangeImage}
          handleChangeRibbon={handleChangeRibbon}
          handleChangeInput={handleChangeInput}
          handleChangeFormState={handleChangeFormState}
          handleButtonUpdateClick={handleUpdateClick}
        />
      )}
      {selectedOption === 'advanced' && (
        <ProductDetailsAdvanced
          product={product}
          business={business}
          handleSuccessUpdate={handleSuccessUpdate}
          setFormTaxState={setFormTaxState}
          formTaxState={formTaxState}
          taxes={taxes}
          setTaxes={setTaxes}
          fees={fees}
          setFees={setFees}
        />
      )}
      {selectedOption === 'labels' && (
        <ProductTagsList
          tags={product?.tags || []}
          businessId={business.id}
          product={product}
          setIsExtendExtraOpen={setIsExtendExtraOpen}
          handleSuccessProductUpdate={handleSuccessUpdate}
        />
      )}
      {selectedOption === 'categories' && (
        <ProductDetailsCategories
          product={product}
          business={business}
          handleUpdateClick={handleUpdateClick}
          changeCategoriesPositionById={props.changeCategoriesPositionById}
          getPageProducts={props.getPageProducts}
          productState={props.productState}
          handleCloseExtraOpen={props.handleCloseExtraOpen}
        />
      )}
      {selectedOption === 'seo_options' && (
        <SeoOptions
          data={product}
          formState={formState}
          setFormState={handleChangeFormState}
          handleUpdateClick={handleUpdateClick}
          handlechangeImageProductCategory={handlechangeImage}
          handleProductCategoryChangeInput={handleChangeInput}
          isProductSeo
          cleanFormState={cleanFormState}
        />
      )}
    </Container>
  )
}
