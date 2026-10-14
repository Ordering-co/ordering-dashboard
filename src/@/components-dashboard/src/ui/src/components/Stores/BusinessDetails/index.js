import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useWindowSize } from '../../../hooks/useWindowSize'

import { useSession, useLanguage, BusinessDetails as BusinessDetailsController } from '../../../../../index'

import {
  BusinessSummary,
  BusinessSupport,
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
  BusinessWhiteLabel
} from '../index'

import { MoreSidebarLayout, Personalization, Alert, NotFoundSource } from '../../Shared'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'

import {
  BarContainer
} from './styles'

export const BusinessDetailsUI = (props) => {
  const {
    open,
    businessId,
    businessState,
    handleChangeActiveBusiness,
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
    handleDuplicateBusiness,
    handleDeleteBusiness,
    actionStatus,
    handleUpdateBusinessConfigs,
    handleUpdateSpoonityKey,
    spoonityKeyState,
    siteState,
    setShowBillingPayment,
    createCustomTax,
    getCustomTaxes,
    setCustomTaxes,
    taxes,
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
    streamConnectionState
  } = props

  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()
  const { width } = useWindowSize()
  const [{ user }] = useSession()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [extraOpen, setExtraOpen] = useState(false)
  const [isExtendExtraOpen, setIsExtendExtraOpen] = useState(false)
  const [isExpand, setIsExpand] = useState(false)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const spoonityConfig = businessState?.business?.configs?.find(config => config.key === 'spoonity_integration_api_key')
  const isAdmin = user?.level === 0

  const storeBusinessId = businessState?.business?.id
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

  const [selectedItem, setSelectedItem] = useState(null)
  const actionSidebar = (value) => {
    setIsMenuOpen(value)

    if (!value) {
      props.onClose()
    }
  }

  const toggleMainContent = () => {
    if (isMenuOpen) {
      if (width <= 500) {
        document.getElementById('business_details_bar').style.width = 'var(--app-width, 100vw)'
      } else {
        if (isExpand) {
          document.getElementById('business_details_bar').style.width = 'var(--app-width, 100vw)'
        } else {
          if (extraOpen && width >= 1000) {
            document.getElementById('business_details_bar').style.width = '1000px'
          } else {
            document.getElementById('business_details_bar').style.width = '500px'
          }
        }
      }
    }
  }

  const handleSelectedItem = (item, isInitialRender) => {
    setIsExtendExtraOpen(false)
    setSelectedItem(item)
    setExtraOpen(true)
    if (!isInitialRender) {
      addQueryToUrl({ section: item })
    }
  }

  const handleCloseExtraOpen = () => {
    setIsExtendExtraOpen(false)
    setExtraOpen(false)
    setSelectedItem(null)
    removeQueryToUrl(['section', 'tab', 'business_type', 'paymethod', 'paymethod_tab', 'setting_tab', 'menu', 'zone', 'zone_tab', 'wallet'])
  }

  useEffect(() => {
    if (!open) return
    actionSidebar(true)
  }, [open])

  useEffect(() => {
    toggleMainContent()
  }, [extraOpen, isExpand, width])

  useEffect(() => {
    setExtraOpen(false)
    setIsExtendExtraOpen(false)
  }, [businessId])

  const onCloseSidebar = (e) => {
    if (e.code === 'Escape' && width >= 1000) {
      props.onClose() && props.onClose()
    }
  }

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', onCloseSidebar)
    return () => document.removeEventListener('keydown', onCloseSidebar)
  }, [open])

  useEffect(() => {
    if (!actionStatus?.error) return
    setAlertState({
      open: true,
      content: actionStatus?.error
    })
  }, [actionStatus?.error])

  useEffect(() => {
    if (!businessState?.error) return
    setAlertState({
      open: true,
      content: businessState?.error
    })
  }, [businessState?.error])

  useEffect(() => {
    if (businessState?.loading || !businessState.business) return
    const detailKey = query.get('section')
    if (detailKey) {
      handleSelectedItem(detailKey, true)
    }
  }, [businessState?.loading])

  return (
    <BarContainer id='business_details_bar'>
      {(!isExtendExtraOpen || width < 1000) && !businessState?.loading && businessState.business && (
        <BusinessSummary
          isAdmin={isAdmin}
          businessState={businessState}
          handleChangeActiveBusiness={handleChangeActiveBusiness}
          actionSidebar={actionSidebar}
          selectedItem={selectedItem}
          handleSelectedItem={handleSelectedItem}
          handleSucessUpdateBusiness={handleSucessUpdateBusiness}
          handleDuplicateBusiness={handleDuplicateBusiness}
          handleDeleteBusiness={handleDeleteBusiness}
          handleUpdateBusinessClick={handleUpdateBusinessClick}
          extraOpen={extraOpen}
          spoonityConfig={spoonityConfig}
          siteState={siteState}
          isExpand={isExpand}
          setIsExpand={setIsExpand}
          formState={formState}
          setFormState={setFormState}
          streamConnectionState={streamConnectionState}
        />
      )}
      {extraOpen && (
        <MoreSidebarLayout
          isExtendExtraOpen={isExtendExtraOpen}
          closeButtonAlignToEdge={selectedItem === 'white_label'}
          onClose={handleCloseExtraOpen}
        >
          {selectedItem === 'support' && (
            <BusinessSupport
              businessState={businessState}
            />
          )}
          {selectedItem === 'store_details' && (
            <BusinessDetail
              business={businessState?.business}
              handleDeleteBusinessOwner={handleDeleteBusinessOwner}
              handleAddBusinessOwner={handleAddBusinessOwner}
              formState={formState}
              setFormState={setFormState}
              businessTypes={businessTypes || businessState?.business?.types}
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
          )}
          {selectedItem === 'schedule' && (
            <BusinessSchedule
              business={businessState?.business}
              handleSuccessUpdate={handleUpdateBusinessState}
            />
          )}
          {selectedItem === 'menu' && (
            <BusinessMenu
              business={businessState?.business}
              handleSuccessBusinessMenu={handleUpdateBusinessState}
              setIsExtendExtraOpen={setIsExtendExtraOpen}
            />
          )}
          {selectedItem === 'delivery_pickup_more' && (
            <BusinessDeliveryPickupMore
              business={businessState?.business}
              setIsExtendExtraOpen={setIsExtendExtraOpen}
              handleUpdateBusinessState={handleUpdateBusinessState}
            />
          )}
          {selectedItem === 'notifications' && (
            <BusinessNotifications
              business={businessState?.business}
              handleSuccessUpdate={handleUpdateBusinessState}
              handleUpdateBusinessClick={handleUpdateBusinessClick}
              formState={formState}
              setFormState={setFormState}
            />
          )}
          {selectedItem === 'payment_methods' && (
            <BusinessPaymentMethods
              business={businessState?.business}
              setIsExtendExtraOpen={setIsExtendExtraOpen}
              handleSuccessUpdate={handleUpdateBusinessState}
              setShowBillingPayment={setShowBillingPayment}
            />
          )}
          {selectedItem === 'tax_fees' && (
            <BusinessTaxAndFees
              formState={formState}
              setFormState={setFormState}
              business={businessState?.business}
              handleUpdateBusinessClick={handleUpdateBusinessClick}
              createCustomTax={createCustomTax}
              getCustomTaxes={getCustomTaxes}
              setCustomTaxes={setCustomTaxes}
              taxes={taxes}
              fees={fees}
              formTaxState={formTaxState}
              formTaxChanges={formTaxChanges}
              taxToEdit={taxToEdit}
              handleChangeTax={handleChangeTax}
              setTaxToEdit={setTaxToEdit}
              handleSaveTax={handleSaveTax}
              handleDeleteTax={handleDeleteTax}
              setFormTaxChanges={setFormTaxChanges}
            />
          )}
          {selectedItem === 'promotions' && (
            <BusinessPromotionList
              promotions={businessState?.business?.offers}
              businessId={businessState?.business?.id}
              business={businessState?.business}
              setIsExtendExtraOpen={setIsExtendExtraOpen}
              handleSuccessUpdate={handleUpdateBusinessState}
            />
          )}
          {selectedItem === 'preorder' && (
            <BusinessPreorderDetails
              formState={formState}
              setFormState={setFormState}
              business={businessState?.business}
              actionStatus={actionStatus}
              handleUpdateBusinessClick={handleUpdateBusinessClick}
              handleUpdatePreorderConfigs={handleUpdateBusinessConfigs}
            />
          )}
          {selectedItem === 'custom_fields' && (
            <BusinessCustomFields
              businessId={businessState?.business?.id}
              metafields={businessState?.business?.metafields}
              handleSuccessAddMetaFields={(result) => handleSuccessAddBusinessItem('metafields', result)}
              handleSuccessDeleteBusinessMetaFields={(id) => handleSuccessDeleteBusinessItem('metafields', id)}
            />
          )}
          {selectedItem === 'personalization' && (
            <Personalization
              isShowTitle
            />
          )}
          {selectedItem === 'ordering_channels' && (
            <BusinessOrderingChannels
              business={businessState?.business}
              handleSuccessUpdate={handleUpdateBusinessState}
              handleUpdateBusinessClick={handleUpdateBusinessClick}
              formState={formState}
              setFormState={setFormState}
            />
          )}
          {/* {selectedItem === 'publishing' && isAdmin && (
            <BusinessPublishing
              business={businessState?.business}
              setIsExtendExtraOpen={setIsExtendExtraOpen}
            />
          )} */}
          {selectedItem === 'publishing' && isAdmin && (
            <BusinessQRCodeOptions
              business={businessState?.business}
              setIsExtendExtraOpen={setIsExtendExtraOpen}
            />
          )}
          {selectedItem === 'sales_channels' && (
            <BusinessSalesChannel
              business={businessState?.business}
              setIsExtendExtraOpen={setIsExtendExtraOpen}
              siteState={siteState}
            />
          )}
          {selectedItem === 'layout' && (
            <BusinessFrontLayout
              business={businessState?.business}
              handleSuccessUpdate={handleUpdateBusinessState}
              handleUpdateBusinessClick={handleUpdateBusinessClick}
              formState={formState}
              setFormState={setFormState}
            />
          )}
          {selectedItem === 'webhooks' && (
            <BusinessWebhooks
              business={businessState?.business}
              handleSuccessUpdate={handleUpdateBusinessState}
            />
          )}
          {selectedItem === 'places' && (
            <BusinessPlaceGroupList
              business={businessState?.business}
              handleSuccessUpdate={handleUpdateBusinessState}
              setIsExtendExtraOpen={setIsExtendExtraOpen}
            />
          )}
          {selectedItem === 'spoonity_key' && (
            <SpoonityApiKey
              business={businessState?.business}
              handleSuccessUpdate={handleUpdateBusinessState}
              handleUpdateBusinessClick={handleUpdateBusinessClick}
              spoonityConfig={spoonityConfig}
              handleUpdateSpoonityKey={handleUpdateSpoonityKey}
              spoonityKeyState={spoonityKeyState}
            />
          )}
          {selectedItem === 'logs' && (
            <BusinessLogs
              businessId={businessState?.business?.id}
            />
          )}
          {selectedItem === 'reservations' && (
            <BusinessReservations
              business={businessState?.business}
              businessId={businessState?.business?.id}
              handleUpdateBusinessConfigs={handleUpdateBusinessConfigs}
              actionStatus={actionStatus}
            />
          )}
          {selectedItem === 'configs' && isAdmin && (
            <BusinessConfigs
              business={businessState?.business}
              handleSuccessUpdate={handleUpdateBusinessState}
            />
          )}
          {selectedItem === 'markups' && (
            <BusinessMarkups
              businessId={businessState?.business?.id}
            />
          )}
          {selectedItem === 'business_fees' && (
            <BusinessFees
              businessId={businessState?.business?.id}
            />
          )}
          {selectedItem === 'business_payment_account' && (
            <BusinessPaymentAccount
              businessId={businessState?.business?.id}
            />
          )}
          {selectedItem === 'white_label' && isAdmin && (
            <BusinessWhiteLabel
              business={businessState?.business}
              handleUpdateBusinessState={handleUpdateBusinessState}
              setIsExtendExtraOpen={setIsExtendExtraOpen}
            />
          )}
        </MoreSidebarLayout>
      )}

      {!businessState?.loading && !businessState.business && (
        <NotFoundSource
          content={t('NOT_FOUND_BUSINESS', 'Sorry, we couldn\'t find the requested business.')}
          btnTitle={t('STORE_REDIRECT', 'Go to Stores')}
          onClickButton={props?.onClose}
        />
      )}
      <Alert
        title={t('WEB_APPNAME', 'Ordering')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />
    </BarContainer>
  )
}

export const BusinessDetails = (props) => {
  const businessDetailsProps = {
    ...props,
    asDashboard: true,
    UIComponent: BusinessDetailsUI
  }

  return <BusinessDetailsController {...businessDetailsProps} />
}
