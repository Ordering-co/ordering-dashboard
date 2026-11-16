import React from 'react'

import {
  BusinessDetail,
  BusinessSchedule,
  BusinessMenu,
  BusinessDeliveryPickupMore,
  BusinessPaymentMethods,
  BusinessPreorderDetails,
  BusinessTaxAndFees,
  BusinessPromotionList,
  BusinessCustomFields,
  BusinessWebhooks,
  BusinessNotifications,
  BusinessOrderingChannels,
  BusinessFrontLayout,
  BusinessPlaceGroupList,
  SpoonityApiKey,
  BusinessLogs,
  BusinessSalesChannel,
  BusinessQRCodeOptions,
  BusinessReservations,
  BusinessConfigs,
  BusinessMarkups,
  BusinessFees,
  BusinessPaymentAccount,
  BusinessWhiteLabel,
  BusinessOrderWithGoogle
} from '../index'
import { canAccessBusinessSection } from '../../../../../utils/businessDetailSections'

// redesign SL-F2 (B1)
// Body of one section of the store editor. Same component and same props, per
// `section` key, as the branches of `BusinessDetailsUI` in BusinessDetails
// (:251-474). The branch is chosen by the key alone. redesign stores 4.A (decision 11): a key this person's
// level or role may not open renders nothing, by the same rules as the menu (`canAccessBusinessSection`); before, only
// `publishing`, `configs` and `white_label` were checked, so `?section=markups` or `business_fees` drew for a store owner.
// The shell does not get here for those keys (it shows the Overview with a notice); this is the second lock. Config rules
// (the project has the section off) are the menu's alone, as in main.
// No layout around it (the old MoreSidebarLayout is the shell's job).
//
// Props are the ones BusinessDetailsUI receives from its controller, plus
// `isAdmin`, `sectionAccess` (`getSectionAccess`; without it only `isAdmin` is known), `spoonityConfig`,
// `isExtendExtraOpen` and `setIsExtendExtraOpen`, which BusinessDetailsUI keeps in its own state.

export const StoreSectionBody = ({ section, ...props }) => {
  const {
    isAdmin,
    sectionAccess,
    businessState,
    handleSucessUpdateBusiness,
    handleDeleteBusinessOwner,
    handleAddBusinessOwner,
    businessTypes,
    formState,
    setFormState,
    handleUpdateBusinessClick,
    setBusinessTypes,
    handleSuccessAddBusinessItem,
    handleSuccessDeleteBusinessItem,
    handleUpdateBusinessState,
    actionStatus,
    handleUpdateBusinessConfigs,
    handleUpdateSpoonityKey,
    spoonityKeyState,
    spoonityConfig,
    siteState,
    createCustomTax,
    getCustomTaxes,
    setCustomTaxes,
    taxes,
    taxCatalogState,
    getTaxes,
    fees,
    formTaxState,
    taxToEdit,
    handleChangeTax,
    setTaxToEdit,
    handleSaveTax,
    handleDeleteTax,
    formTaxChanges,
    setFormTaxChanges,
    isGoogleRedirectPluginActive,
    googleRedirectPluginRoot,
    googleRedirectPluginLoading,
    googleFeedSecondaryIncludedIds,
    googleFeedInclusionListLoading,
    googleFeedSavingBusinessId,
    googleFeedSavingChannel,
    handleGoogleFeedToggle,
    googleFeedExcludedBusinessIds,
    isExtendExtraOpen,
    setIsExtendExtraOpen
  } = props

  const business = businessState?.business

  // Google feed state of this store (BusinessDetails:106-125)
  const storeBusinessId = business?.id
  const isGoogleFeedSecondaryIncluded = Array.isArray(googleFeedSecondaryIncludedIds) && storeBusinessId != null &&
    googleFeedSecondaryIncludedIds.some(id => Number(id) === Number(storeBusinessId))
  const isGoogleFeedSecondarySaving = storeBusinessId != null &&
    googleFeedSavingBusinessId != null &&
    googleFeedSavingChannel === 'secondary' &&
    Number(googleFeedSavingBusinessId) === Number(storeBusinessId)
  const onGoogleFeedSecondaryToggleForStore = handleGoogleFeedToggle && storeBusinessId != null
    ? (enabled) => handleGoogleFeedToggle(storeBusinessId, 'secondary', enabled)
    : undefined
  const isGoogleFeedExcluded = Array.isArray(googleFeedExcludedBusinessIds) && storeBusinessId != null &&
    googleFeedExcludedBusinessIds.some(id => Number(id) === Number(storeBusinessId))
  const isPrimaryIncluded = !isGoogleFeedExcluded
  const isGoogleFeedPrimarySaving = storeBusinessId != null &&
    googleFeedSavingBusinessId != null &&
    googleFeedSavingChannel === 'primary' &&
    Number(googleFeedSavingBusinessId) === Number(storeBusinessId)
  const onGoogleFeedPrimaryToggleForStore = handleGoogleFeedToggle && storeBusinessId != null
    ? (enabled) => handleGoogleFeedToggle(storeBusinessId, 'primary', enabled)
    : undefined

  if (!canAccessBusinessSection(section, sectionAccess ?? { isAdmin })) return null

  switch (section) {
    case 'store_details':
      return (
        <BusinessDetail
          business={business}
          handleDeleteBusinessOwner={handleDeleteBusinessOwner}
          handleAddBusinessOwner={handleAddBusinessOwner}
          formState={formState}
          setFormState={setFormState}
          businessTypes={businessTypes || business?.types}
          handleUpdateBusinessClick={handleUpdateBusinessClick}
          setBusinessTypes={setBusinessTypes}
          handleSuccessAddBusinessItem={handleSuccessAddBusinessItem}
          handleSuccessDeleteBusinessItem={handleSuccessDeleteBusinessItem}
          handleSucessUpdateBusiness={handleSucessUpdateBusiness}
          setIsExtendExtraOpen={setIsExtendExtraOpen}
          isExtendExtraOpen={isExtendExtraOpen}
          handleUpdateBusinessState={handleUpdateBusinessState}
          isGoogleRedirectPluginActive={isGoogleRedirectPluginActive}
          googleRedirectPluginRoot={googleRedirectPluginRoot}
          googleRedirectPluginLoading={googleRedirectPluginLoading}
          feedInclusionLoading={googleFeedInclusionListLoading}
          feedInclusionSaving={isGoogleFeedSecondarySaving}
          isSecondaryIncluded={isGoogleFeedSecondaryIncluded}
          onGoogleFeedToggle={onGoogleFeedSecondaryToggleForStore}
          feedPrimarySaving={isGoogleFeedPrimarySaving}
          isPrimaryIncluded={isPrimaryIncluded}
          onGoogleFeedPrimaryToggle={onGoogleFeedPrimaryToggleForStore}
        />
      )
    case 'schedule':
      return (
        <BusinessSchedule
          business={business}
          handleSuccessUpdate={handleUpdateBusinessState}
        />
      )
    case 'menu':
      return (
        <BusinessMenu
          business={business}
          handleSuccessBusinessMenu={handleUpdateBusinessState}
          setIsExtendExtraOpen={setIsExtendExtraOpen}
        />
      )
    case 'delivery_pickup_more':
      return (
        <BusinessDeliveryPickupMore
          business={business}
          setIsExtendExtraOpen={setIsExtendExtraOpen}
          handleUpdateBusinessState={handleUpdateBusinessState}
        />
      )
    case 'notifications':
      return (
        <BusinessNotifications
          business={business}
          handleSuccessUpdate={handleUpdateBusinessState}
          handleUpdateBusinessClick={handleUpdateBusinessClick}
          formState={formState}
          setFormState={setFormState}
        />
      )
    case 'payment_methods':
      return (
        <BusinessPaymentMethods
          business={business}
          setIsExtendExtraOpen={setIsExtendExtraOpen}
          handleSuccessUpdate={handleUpdateBusinessState}
        />
      )
    case 'tax_fees':
      return (
        <BusinessTaxAndFees
          formState={formState}
          setFormState={setFormState}
          business={business}
          handleUpdateBusinessClick={handleUpdateBusinessClick}
          createCustomTax={createCustomTax}
          getCustomTaxes={getCustomTaxes}
          setCustomTaxes={setCustomTaxes}
          taxes={taxes}
          taxCatalogState={taxCatalogState}
          getTaxes={getTaxes}
          fees={fees}
          formTaxState={formTaxState}
          formTaxChanges={formTaxChanges}
          taxToEdit={taxToEdit}
          handleChangeTax={handleChangeTax}
          setTaxToEdit={setTaxToEdit}
          handleSaveTax={handleSaveTax}
          handleDeleteTax={handleDeleteTax}
          setFormTaxChanges={setFormTaxChanges}
          // redesign stores 5.12: a tax or a customer fee open in its editor takes the full width, as BusinessTypes
          setIsExtendExtraOpen={setIsExtendExtraOpen}
          isExtendExtraOpen={isExtendExtraOpen}
        />
      )
    case 'promotions':
      return (
        <BusinessPromotionList
          promotions={business?.offers}
          businessId={business?.id}
          business={business}
          setIsExtendExtraOpen={setIsExtendExtraOpen}
          handleSuccessUpdate={handleUpdateBusinessState}
        />
      )
    case 'preorder':
      return (
        <BusinessPreorderDetails
          formState={formState}
          setFormState={setFormState}
          business={business}
          actionStatus={actionStatus}
          handleUpdateBusinessClick={handleUpdateBusinessClick}
          handleUpdatePreorderConfigs={handleUpdateBusinessConfigs}
        />
      )
    case 'custom_fields':
      return (
        <BusinessCustomFields
          businessId={business?.id}
          metafields={business?.metafields}
          handleSuccessAddMetaFields={(result) => handleSuccessAddBusinessItem('metafields', result)}
          handleSuccessDeleteBusinessMetaFields={(id) => handleSuccessDeleteBusinessItem('metafields', id)}
        />
      )
    case 'ordering_channels':
      return (
        <BusinessOrderingChannels
          business={business}
          handleSuccessUpdate={handleUpdateBusinessState}
          handleUpdateBusinessClick={handleUpdateBusinessClick}
          formState={formState}
          setFormState={setFormState}
        />
      )
    case 'publishing':
      return (
        <BusinessQRCodeOptions
          business={business}
          setIsExtendExtraOpen={setIsExtendExtraOpen}
        />
      )
    case 'sales_channels':
      return (
        <BusinessSalesChannel
          business={business}
          setIsExtendExtraOpen={setIsExtendExtraOpen}
          siteState={siteState}
        />
      )
    case 'google_actions':
      return (
        <BusinessOrderWithGoogle
          business={business}
          onOpenSection={props.onOpenSection}
          canOpenSection={props.canOpenSection}
        />
      )
    case 'layout':
      return (
        <BusinessFrontLayout
          business={business}
          handleSuccessUpdate={handleUpdateBusinessState}
          handleUpdateBusinessClick={handleUpdateBusinessClick}
        />
      )
    case 'webhooks':
      return (
        <BusinessWebhooks
          business={business}
          handleSuccessUpdate={handleUpdateBusinessState}
        />
      )
    case 'places':
      return (
        <BusinessPlaceGroupList
          business={business}
          handleSuccessUpdate={handleUpdateBusinessState}
          setIsExtendExtraOpen={setIsExtendExtraOpen}
        />
      )
    case 'spoonity_key':
      return (
        <SpoonityApiKey
          business={business}
          handleSuccessUpdate={handleUpdateBusinessState}
          handleUpdateBusinessClick={handleUpdateBusinessClick}
          spoonityConfig={spoonityConfig}
          handleUpdateSpoonityKey={handleUpdateSpoonityKey}
          spoonityKeyState={spoonityKeyState}
        />
      )
    case 'logs':
      return (
        <BusinessLogs
          businessId={business?.id}
        />
      )
    case 'reservations':
      return (
        <BusinessReservations
          business={business}
          businessId={business?.id}
          handleUpdateBusinessConfigs={handleUpdateBusinessConfigs}
          actionStatus={actionStatus}
        />
      )
    case 'configs':
      return (
        <BusinessConfigs
          business={business}
          handleSuccessUpdate={handleUpdateBusinessState}
        />
      )
    case 'markups':
      return (
        <BusinessMarkups
          businessId={business?.id}
          // redesign stores 5.13: a markup open in its detail takes the full width, as tax_fees
          setIsExtendExtraOpen={setIsExtendExtraOpen}
          isExtendExtraOpen={isExtendExtraOpen}
        />
      )
    case 'business_fees':
      return (
        <BusinessFees
          businessId={business?.id}
          businessName={business?.name} // redesign stores 5.13: a manual charge names the store it confirms
          // redesign stores 5.13: a fee open in its detail takes the full width, as tax_fees
          setIsExtendExtraOpen={setIsExtendExtraOpen}
          isExtendExtraOpen={isExtendExtraOpen}
        />
      )
    case 'business_payment_account':
      return (
        <BusinessPaymentAccount
          businessId={business?.id}
          businessName={business?.name} // redesign stores 5.18 (F5 of 5.11): the dissociate confirmation names the store
        />
      )
    case 'white_label':
      return (
        <BusinessWhiteLabel
          business={business}
          handleUpdateBusinessState={handleUpdateBusinessState}
          setIsExtendExtraOpen={setIsExtendExtraOpen}
        />
      )
    default:
      return null
  }
}
