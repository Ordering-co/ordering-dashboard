import React from 'react'

import { Personalization } from '../../Shared'
import { ProductIngredient } from '../ProductIngredient'
import { ProductMetaFields } from '../ProductMetaFields'
import { ProductExtras } from '../ProductExtras'
import { ProductGallery } from '../ProductGallery'
import { ProductVideos } from '../ProductVideos'
import { ProductMainDetails } from '../ProductMainDetails'
import { BusinessServiceProfessionals } from '../BusinessServiceProfessionals'
import { ServiceDetail } from '../ServiceDetail'

// redesign SP-F1 (D1)
// Body of one section of the product editor. Same component and same props, per `section` key, as the branches of
// `ProductDetailsUI` in main (S/ProductDetails/index.js:148-248). The branch is chosen by the key alone, as there: any
// `?section=` renders its branch (a deep link is not checked against the list; `custom_fields` and `personalization` are
// not in it and still paint). No layout around it: the old MoreSidebarLayout is the shell's job.
//
// `section` is the first half of the entry and `tab` the second one for Product details. ProductMainDetails is told which
// tab to paint (`tab`, controlled) and drops its own heading and tab bar (`hideTabs`): the list of sections is the tabs.
// It is the same element for the five tabs, so it stays mounted while the shell goes from one of them to another.
//
// Props are the ones ProductDetailsUI receives from its controller, plus `isExtendExtraOpen`, `setIsExtendExtraOpen` and
// `handleCloseExtraOpen`, which the shell keeps in its own state.

export const ProductSectionBody = ({ section, tab, ...props }) => {
  const {
    business,
    productState,
    formState,
    handlechangeImage,
    handleChangeFormState,
    handleChangeRibbon,
    handleChangeInput,
    handleUpdateClick,
    isExtendExtraOpen,
    setIsExtendExtraOpen,
    handleSuccessUpdate,
    setFormTaxState,
    formTaxState,
    taxes,
    setTaxes,
    fees,
    setFees,
    cleanFormState,
    handleUpdateBusinessState,
    handleCloseExtraOpen
  } = props

  switch (section) {
    case 'product_details':
      return (
        <ProductMainDetails
          tab={tab}
          hideTabs
          product={productState?.product}
          formState={formState}
          handlechangeImage={handlechangeImage}
          handleChangeFormState={handleChangeFormState}
          handleChangeRibbon={handleChangeRibbon}
          handleChangeInput={handleChangeInput}
          handleUpdateClick={handleUpdateClick}
          isExtendExtraOpen={isExtendExtraOpen}
          setIsExtendExtraOpen={setIsExtendExtraOpen}
          business={business}
          handleSuccessUpdate={handleSuccessUpdate}
          setFormTaxState={setFormTaxState}
          formTaxState={formTaxState}
          // main: the taxes and fees catalogs say when they failed and can be asked again
          catalogState={props.catalogState}
          retryCatalogs={props.retryCatalogs}
          taxes={taxes}
          setTaxes={setTaxes}
          fees={fees}
          setFees={setFees}
          cleanFormState={cleanFormState}
          changeCategoriesPositionById={props.changeCategoriesPositionById}
          getPageProducts={props.getPageProducts}
          productState={productState}
          handleCloseExtraOpen={handleCloseExtraOpen}
        />
      )
    case 'service_details':
      return (
        <ServiceDetail
          product={productState?.product}
          formState={formState}
          handlechangeImage={handlechangeImage}
          handleChangeFormState={handleChangeFormState}
          handleChangeRibbon={handleChangeRibbon}
          handleChangeInput={handleChangeInput}
          handleUpdateClick={handleUpdateClick}
          isExtendExtraOpen={isExtendExtraOpen}
          setIsExtendExtraOpen={setIsExtendExtraOpen}
          business={business}
          handleSuccessUpdate={handleSuccessUpdate}
          setFormTaxState={setFormTaxState}
          formTaxState={formTaxState}
          taxes={taxes}
          setTaxes={setTaxes}
          fees={fees}
          setFees={setFees}
        />
      )
    case 'professionals':
      return (
        <BusinessServiceProfessionals
          product={productState?.product}
          formState={formState}
          isExtendExtraOpen={isExtendExtraOpen}
          setIsExtendExtraOpen={setIsExtendExtraOpen}
          handleUpdateClick={handleUpdateClick}
        />
      )
    case 'ingredients':
      return (
        <ProductIngredient
          business={business}
          product={productState.product}
          setIsExtendExtraOpen={setIsExtendExtraOpen}
          handleSuccessUpdate={handleSuccessUpdate}
        />
      )
    case 'product_options':
      return (
        <ProductExtras
          business={business}
          product={productState.product}
          setIsExtendExtraOpen={setIsExtendExtraOpen}
          handleSuccessUpdate={handleSuccessUpdate}
          handleUpdateBusinessState={handleUpdateBusinessState}
        />
      )
    case 'product_images':
      return (
        <ProductGallery
          business={business}
          categoryId={productState.product.category_id}
          product={productState.product}
          handleSuccessUpdate={handleSuccessUpdate}
        />
      )
    case 'product_video':
      return (
        <ProductVideos
          business={business}
          categoryId={productState.product.category_id}
          product={productState.product}
          handleSuccessUpdate={handleSuccessUpdate}
        />
      )
    case 'custom_fields':
      return (
        <ProductMetaFields
          businessId={business?.id}
          categoryId={productState.product.category_id}
          productId={productState.product?.id}
        />
      )
    case 'personalization':
      return <Personalization isShowTitle />
    default:
      return null
  }
}
