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
    // redesign SP-F2 (D2): `tab` makes the tab controlled (the editor shell owns ?tab=);
    // `hideTabs` drops this component's own heading and tab bar (opt-in).
    tab,
    hideTabs,
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
  const isControlled = typeof tab === 'string' && tab !== ''
  const currentOption = isControlled ? tab : selectedOption

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
    // Controlled: the shell already decided the tab and wrote the URL.
    if (isControlled) return
    const tab = query.get('tab')
    if (tab) {
      handleSelectOption(tab, true)
    } else {
      handleSelectOption(selectedOption)
    }
  }, [])

  // Controlled: going to another tab still collapses the extended panel, as a click does.
  useEffect(() => {
    if (isControlled) setIsExtendExtraOpen?.(false)
  }, [isControlled, tab])

  return (
    <Container maxLimit={isExtendExtraOpen}>
      {!hideTabs && <h1>{t('PRODUCT_DETAILS', 'Product details')}</h1>}
      {!hideTabs && (
        <TabsConatiner>
          <DragScroll>
            {listOptions.filter((option) => (option.enabled)).map(option => (
              <Tab
                as='button'
                type='button'
                key={option.key}
                active={currentOption === option.key}
                aria-pressed={currentOption === option.key}
                onClick={() => handleSelectOption(option.key)}
              >
                {option.content}
              </Tab>
            ))}
          </DragScroll>
        </TabsConatiner>
      )}
      {currentOption === 'information' && (
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
      {currentOption === 'advanced' && (
        <ProductDetailsAdvanced
          product={product}
          business={business}
          handleSuccessUpdate={handleSuccessUpdate}
          setFormTaxState={setFormTaxState}
          formTaxState={formTaxState}
          catalogState={props.catalogState}
          retryCatalogs={props.retryCatalogs}
          taxes={taxes}
          setTaxes={setTaxes}
          fees={fees}
          setFees={setFees}
        />
      )}
      {currentOption === 'labels' && (
        <ProductTagsList
          tags={product?.tags || []}
          businessId={business.id}
          product={product}
          setIsExtendExtraOpen={setIsExtendExtraOpen}
          handleSuccessProductUpdate={handleSuccessUpdate}
        />
      )}
      {currentOption === 'categories' && (
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
      {currentOption === 'seo_options' && (
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
