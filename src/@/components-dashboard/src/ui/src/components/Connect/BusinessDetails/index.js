import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useWindowSize } from '../../../hooks/useWindowSize'

import { useLanguage, PosMenuBusinessDetails as BusinessDetailsController } from '../../../../../index'

import {
  BusinessSchedule,
  BusinessCustomFields
} from '../../Stores/index'

import { BusinessSummary } from '../BusinessSummary'
import { BusinessIntegration } from '../BusinessIntegration'
import { MoreSidebarLayout, Alert, NotFoundSource } from '../../Shared'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'

import {
  BarContainer
} from './styles'

export const BusinessDetailsUI = (props) => {
  const {
    open,
    businessId,
    businessState,
    selectedIntegration,
    handleChangeActiveBusiness,
    handleSucessUpdateBusiness,
    formState,
    setFormState,
    handleUpdateBusinessClick,
    handleSuccessAddBusinessItem,
    handleSuccessDeleteBusinessItem,
    handleUpdateBusinessState,
    handleDeleteBusiness,
    actionStatus,
    handleSync,
    handleConnectBusiness,
    handleDisconnectBusiness,
    handlePushAction,
    getIntegrations
  } = props

  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()
  const { width } = useWindowSize()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [extraOpen, setExtraOpen] = useState(false)
  const [isExtendExtraOpen, setIsExtendExtraOpen] = useState(false)
  const [isExpand, setIsExpand] = useState(false)
  const [alertState, setAlertState] = useState({ open: false, content: [] })

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
          {...props}
          businessState={businessState}
          handleChangeActiveBusiness={handleChangeActiveBusiness}
          actionSidebar={actionSidebar}
          selectedItem={selectedItem}
          handleSelectedItem={handleSelectedItem}
          handleSucessUpdateBusiness={handleSucessUpdateBusiness}
          handleDeleteBusiness={handleDeleteBusiness}
          handleUpdateBusinessClick={handleUpdateBusinessClick}
          getIntegrations={getIntegrations}
          updateBusiness={props.updateBusiness}
          extraOpen={extraOpen}
          isExpand={isExpand}
          setIsExpand={setIsExpand}
          formState={formState}
          setFormState={setFormState}
          handleSync={handleSync}
          fromSalesChannels={props.fromSalesChannels}
        />
      )}
      {extraOpen && (
        <MoreSidebarLayout
          isExtendExtraOpen={isExtendExtraOpen}
          onClose={handleCloseExtraOpen}
        >
          {selectedItem === 'schedule' && (
            <BusinessSchedule
              business={businessState?.business}
              handleSuccessUpdate={handleUpdateBusinessState}
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
          {selectedItem === 'integration' && (
            <BusinessIntegration
              fromSalesChannels={props.fromSalesChannels}
              onClose={handleCloseExtraOpen}
              business={businessState?.business}
              handleSuccessUpdate={handleUpdateBusinessState}
              handleUpdateBusinessClick={handleUpdateBusinessClick}
              handleSucessUpdateBusiness={handleUpdateBusinessState}
              getIntegrations={getIntegrations}
              updateBusiness={props.updateBusiness}
              formState={formState}
              setFormState={setFormState}
              selectedIntegration={selectedIntegration}
              handleConnectBusiness={handleConnectBusiness}
              handleDisconnectBusiness={handleDisconnectBusiness}
              handlePushAction={handlePushAction}
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
