import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { List as MenuIcon } from 'react-bootstrap-icons'
import { useLanguage, DeliveryServices as DeliveryServicesController } from '../../../../../index'
import { addQueryToUrl, removeQueryToUrl, learnOptionsValues } from '../../../utils'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { IconButton } from '../../../styles'
import { Alert, Confirm, SearchBar, SideBar, LearnDropDown } from '../../Shared'
import { DeliveryServicesList } from '../DeliveryServicesList'
import { DeliveryServiceDetails } from '../DeliveryServiceDetails'
import { getDeliveryServiceSetupError } from '../deliveryServiceSetupError'

import {
  DeliveryServicesContainer,
  HeaderContainer,
  HeaderLeftContainer,
  HeaderRightContainer
} from './styles'

const DeliveryServicesUI = (props) => {
  const {
    deliveryServicesState,
    setDeliveryServicesState,
    businessesList,
    paymethodsList,
    selectedGroupList,
    handleSelectGroup,
    actionState,
    scheduleState,
    handleUpdateDeliveryService,
    handleDeleteDeliveryService,
    handleScheduleState,
    actionDisabled,
    isUseQuery,
    getDeliveryGroups,
    deliveryGroups,
    setDeliveryGroups,
    setAvailableModifyData,
    handleInstallSysPlugin
  } = props

  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [searchValue, setSearchValue] = useState(null)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [confirm, setConfirm] = useState({ open: false, content: null, handleOnAccept: null })
  const [moveDistance, setMoveDistance] = useState(0)
  const [openDetails, setOpenDetails] = useState(false)
  const [curDriversGroup, setCurDriversGroup] = useState(null)
  const [curDeliveryServiceId, setCurDeliveryServiceId] = useState(null)
  const [isExtendExtraOpen, setIsExtendExtraOpen] = useState(false)

  const learnOptions = learnOptionsValues([], t)

  const showSetupAlert = (scenario, deliveryCompany) => {
    setAlertState({
      open: true,
      content: getDeliveryServiceSetupError(deliveryCompany, scenario, t)
    })
  }

  const handleOpenDetails = async (deliveryCompany) => {
    if (!deliveryCompany) return
    const deliveryGroupId = deliveryCompany?.driver_groups?.[0]?.id
    if (!deliveryCompany?.plugin_id) {
      showSetupAlert('plugin_not_installed', deliveryCompany)
      return
    }
    if (!deliveryGroupId) {
      showSetupAlert('driver_group_missing', deliveryCompany)
      return
    }
    const deliveryGroup = await getDeliveryGroups(deliveryGroupId)
    if (!deliveryGroup?.id) {
      showSetupAlert('driver_group_load_failed', deliveryCompany)
      return
    }
    setMoveDistance(0)
    setCurDriversGroup({
      ...deliveryGroup,
      plugin: deliveryCompany.plugin,
      schedule: deliveryCompany.schedule
    })
    setCurDeliveryServiceId(deliveryCompany?.id)
    setOpenDetails(true)
    if (!deliveryCompany) {
      removeQueryToUrl(['id'])
    } else {
      addQueryToUrl({ id: deliveryCompany.id })
    }
  }

  useEffect(() => {
    if (!actionState?.error) return
    setAlertState({
      open: true,
      content: actionState?.error
    })
  }, [actionState?.error])

  const handleCloseDetail = () => {
    setCurDriversGroup(null)
    setOpenDetails(false)
    removeQueryToUrl(['id'])
  }

  useEffect(() => {
    const id = query.get('id')
    if (id && deliveryServicesState?.companies?.length > 0) {
      handleOpenDetails(deliveryServicesState?.companies?.find(company => company?.id === Number(id)))
    }
  }, [deliveryServicesState?.companies])

  return (
    <>
      <DeliveryServicesContainer>
        <HeaderContainer>
          <HeaderLeftContainer>
            {isCollapse && (
              <IconButton
                color='black'
                onClick={() => handleMenuCollapse()}
              >
                <MenuIcon />
              </IconButton>
            )}
            <h1>{t('DELIVERY_SERVICES', 'Delivery Services')}</h1>
            <LearnDropDown
              learnOptions={learnOptions}
            />
          </HeaderLeftContainer>
          <HeaderRightContainer>
            <SearchBar
              lazyLoad
              onSearch={val => setSearchValue(val)}
              search={searchValue}
              placeholder={t('SEARCH', 'Search')}
            />
          </HeaderRightContainer>
        </HeaderContainer>
        <DeliveryServicesList
          curDriversGroup={curDriversGroup}
          deliveryServiceId={curDeliveryServiceId}
          deliveryServicesState={deliveryServicesState}
          searchValue={searchValue}
          handleOpenDetails={handleOpenDetails}
          handleUpdateDeliveryService={handleUpdateDeliveryService}
          handleDeleteDeliveryService={handleDeleteDeliveryService}
          selectedGroupList={selectedGroupList}
          handleSelectGroup={handleSelectGroup}
          actionDisabled={actionDisabled}
          isUseQuery={isUseQuery}
          handleInstallSysPlugin={handleInstallSysPlugin}
        />
      </DeliveryServicesContainer>
      {openDetails && (
        <SideBar
          sidebarId='delivery_service_details'
          defaultSideBarWidth={!isExtendExtraOpen ? 540 + moveDistance : 1040}
          open={openDetails}
          moveDistance={moveDistance}
          onClose={() => handleCloseDetail()}
        >
          <DeliveryServiceDetails
            deliveryServicesState={deliveryServicesState}
            scheduleState={scheduleState}
            setDeliveryServicesState={setDeliveryServicesState}
            curDriversGroup={curDriversGroup}
            deliveryServiceId={curDeliveryServiceId}
            driverGroupId={curDriversGroup?.id}
            businesses={businessesList?.businesses}
            businessesLoading={businessesList?.loading}
            paymethods={paymethodsList?.paymethods}
            handleUpdateDeliveryService={handleUpdateDeliveryService}
            handleScheduleState={handleScheduleState}
            handleParentSidebarMove={val => setMoveDistance(val)}
            setIsExtendExtraOpen={setIsExtendExtraOpen}
            isExtendExtraOpen={isExtendExtraOpen}
            onClose={() => {
              setOpenDetails(false)
            }}
            actionDisabled={actionDisabled}
            deliveryGroups={deliveryGroups}
            setDeliveryGroups={setDeliveryGroups}
            setAvailableModifyData={setAvailableModifyData}
          />
        </SideBar>
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
      <Confirm
        title={t('WEB_APPNAME', 'Ordering')}
        content={confirm.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={confirm.open}
        onClose={() => setConfirm({ ...confirm, open: false })}
        onCancel={() => setConfirm({ ...confirm, open: false })}
        onAccept={confirm.handleOnAccept}
        closeOnBackdrop={false}
      />
    </>
  )
}

export const DeliveryServices = (props) => {
  const query = new URLSearchParams(useLocation().search)
  const defaultPage = query.get('page') || 1
  const defaultPageSize = query.get('pageSize') || 10

  const deliveryServicesProps = {
    ...props,
    UIComponent: DeliveryServicesUI,
    paginationSettings: {
      initialPage: props.isUseQuery && !isNaN(defaultPage) ? Number(defaultPage) : 1,
      pageSize: props.isUseQuery && !isNaN(defaultPage) ? Number(defaultPageSize) : 10,
      controlType: 'pages'
    }
  }
  return (
    <DeliveryServicesController {...deliveryServicesProps} />
  )
}
