import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ArrowsAngleContract, ArrowsAngleExpand } from 'react-bootstrap-icons'
import {
  useLanguage,
  DeliveryServiceDetails as DeliveryServiceDetailsController
} from '../../../../../index'
import { IconButton, Switch, Button } from '../../../styles'
import { Alert, Confirm, DragScroll, LearnDropDown, Modal, Schedule } from '../../Shared'
import { DeliveryServiceGeneralForm } from '../DeliveryServiceGeneralForm'
import { DeliveryServicePaymethods } from '../DeliveryServicePaymethods'
import { DeliveryServiceZones } from '../DeliveryServiceZones'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { addQueryToUrl, learnOptionsValues } from '../../../utils'

import {
  DetailsContainer,
  Header,
  MenusContainer,
  Tab,
  RightHeader,
  ScheduleSection,
  ActionsForm
} from './styles'
import { DeliveryServiceBusinesses } from '../DeliveryServicesBusinesses'
import { DoordashContent } from './DoordashContent'

const DeliveryServiceDetailsUI = (props) => {
  const {
    deliveryServiceState,
    actionState,
    scheduleState,
    handleParentSidebarMove,
    handleScheduleState,
    handleNextTour,
    handleUpdateDeliveryService,
    setIsExtendExtraOpen,
    actionDisabled,
    deliveryServiceId,
    availableModifyData
  } = props
  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()
  const { width } = useWindowSize()
  const deliveryPluginKey = deliveryServiceState?.deliveryService?.plugin?.key
  const learnOptions = learnOptionsValues([], t)

  const [showMenu, setShowMenu] = useState('general')
  const [driversGroupMenus, setDriversGroupMenus] = useState([])
  const [confirm, setConfirm] = useState({ open: false, content: null, handleOnAccept: null })
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [isOpenDetails, setIsOpenDetails] = useState(false)
  const [isExpand, setIsExpand] = useState(false)
  const [openSetupModal, setOpenSetupModal] = useState({
    open: false,
    title: t('WEB_APPNAME', 'Ordering'),
    content: null
  })

  useEffect(() => {
    const _driversGroupMenusBase = [
      { key: 'general', value: t('GENERAL', 'General') }
    ]
    if (availableModifyData) {
      _driversGroupMenusBase.push(
        { key: 'businesses', value: t('BUSINESSES', 'Businesses') },
        { key: 'schedule', value: t('SCHEDULE', 'Schedule') })
    }
    const _additionalMenus = []

    if (
      deliveryServiceState?.deliveryService?.id &&
      availableModifyData
    ) {
      _additionalMenus.push(
        { key: 'paymethods', value: t('PAYMENT_METHODS', 'Payment methods') },
        { key: 'delivery_zones', value: t('DELIVERY_ZONES', 'Delivery Zones') }
      )
    }

    const _driversGroupMenus = [..._driversGroupMenusBase, ..._additionalMenus]
    setDriversGroupMenus(_driversGroupMenus)
  }, [deliveryServiceState?.deliveryService, availableModifyData])

  useEffect(() => {
    if (width > 1000) setIsExtendExtraOpen(false)
  }, [width])

  const handleNextClick = () => {
    setShowMenu('schedule')
    handleNextTour()
  }

  const expandSidebar = () => {
    const element = document.getElementById('delivery_service_details')
    if (!element) return
    if (isExpand) element.style.width = '540px'
    else element.style.width = 'var(--app-width, 100vw)'
    setIsExpand(prev => !prev)
  }

  const getButtonTitle = (pluginKey) => {
    if (pluginKey === 'doordash_drive_integration') {
      return t('SETTING_UP_ON_DOORDASH', 'Setting up on Doordash')
    }
    return t('SETTING_UP', 'Setting up')
  }

  const handleOpenSetupModal = (pluginKey) => {
    setOpenSetupModal({
      open: true,
      title: pluginKey === 'doordash_drive_integration'
        ? t('SETTING_UP_ON_DOORDASH', 'Setting up on Doordash')
        : pluginKey === 'uber_direct_integration'
          ? t('SETTING_UP_ON_UBER_DIRECT', 'Setting up on Uber Direct')
          : t('SETTING_UP', 'Setting up'),
      content: <DoordashContent pluginKey={pluginKey} plugin={deliveryServiceState?.deliveryService?.plugin} />
    })
  }

  useEffect(() => {
    handleParentSidebarMove(0)
    setIsOpenDetails(false)
    setIsExtendExtraOpen(false)
  }, [showMenu, deliveryServiceState.deliveryService?.id])

  useEffect(() => {
    if (!actionState?.error) return
    setAlertState({
      open: true,
      content: actionState?.error
    })
  }, [actionState?.error])

  const handleTabClick = (tab, isInitialRender) => {
    setShowMenu(tab)
    if (!isInitialRender) {
      addQueryToUrl({ tab })
    }
  }

  useEffect(() => {
    if (deliveryServiceState.loading) return
    const tab = query.get('tab')
    if (tab && availableModifyData) {
      handleTabClick(tab, true)
    } else {
      handleTabClick(showMenu)
    }
  }, [deliveryServiceState.loading, availableModifyData])

  useEffect(() => {
    setShowMenu('general')
  }, [deliveryServiceId])

  return (
    <>
      <DetailsContainer>
        <Header>
          {deliveryServiceState.deliveryService
            ? (
              <>
                <div>
                  <h1>{deliveryServiceState.deliveryService?.name}</h1>
                  <LearnDropDown
                    learnOptions={learnOptions}
                  />
                  <Switch
                    defaultChecked={deliveryServiceState.deliveryService?.enabled}
                    onChange={enabled => handleUpdateDeliveryService(deliveryServiceId, { enabled })}
                    disabled={actionDisabled}
                  />
                </div>
                <RightHeader>
                  {width > 576 && (
                    <IconButton
                      color='black'
                      onClick={expandSidebar}
                    >
                      {isExpand ? <ArrowsAngleContract /> : <ArrowsAngleExpand />}
                    </IconButton>
                  )}
                </RightHeader>
              </>
              )
            : (
              <>
                {width > 576 && (
                  <IconButton
                    color='black'
                    onClick={expandSidebar}
                  >
                    {isExpand ? <ArrowsAngleContract /> : <ArrowsAngleExpand />}
                  </IconButton>
                )}
              </>
              )}
        </Header>
        <MenusContainer>
          <DragScroll>
            {driversGroupMenus.map(menu => (
              <Tab
                key={menu.key}
                active={menu.key === showMenu}
                onClick={() => handleTabClick(menu.key)}
              >
                {menu.value}
              </Tab>
            ))}
          </DragScroll>
        </MenusContainer>
        {(showMenu === 'general') && (
          <>
            <Button
              color='primary'
              borderRadius='5px'
              style={{ marginBottom: 20 }}
              onClick={() => handleOpenSetupModal(deliveryPluginKey)}
            >
              {getButtonTitle(deliveryPluginKey)}
            </Button>
            <DeliveryServiceGeneralForm
              {...props}
              curDeliveryService={deliveryServiceState.deliveryService}
              handleNextClick={handleNextClick}
            />
          </>
        )}
        {showMenu === 'businesses' && (
          <DeliveryServiceBusinesses
            {...props}
            curDeliveryService={deliveryServiceState.deliveryService}
          />
        )}
        {showMenu === 'schedule' && (
          <ScheduleSection>
            <Schedule
              scheduleList={deliveryServiceState?.deliveryService?.schedule}
              handleChangeScheduleState={handleScheduleState}
            />
            <ActionsForm>
              <Button
                id='form-btn'
                color='primary'
                borderRadius='5px'
                disabled={scheduleState.loading || scheduleState?.change?.length === 0}
                style={{ marginTop: 20 }}
                onClick={() => handleUpdateDeliveryService(deliveryServiceId, { schedule: JSON.stringify(scheduleState?.change) })}
              >
                {scheduleState.loading ? t('UPDATING', 'Updating...') : t('UPDATE', 'Update')}
              </Button>
            </ActionsForm>
          </ScheduleSection>
        )}
        {showMenu === 'paymethods' && (
          <DeliveryServicePaymethods
            {...props}
            curDeliveryService={deliveryServiceState.deliveryService}
          />
        )}
        {showMenu === 'delivery_zones' && (
          <DeliveryServiceZones
            {...props}
            curDeliveryService={deliveryServiceState.deliveryService}
            handleParentSidebarMove={handleParentSidebarMove}
            drivergroup={deliveryServiceState.deliveryService}
            setIsExtendExtraOpen={setIsExtendExtraOpen}
            setIsOpenDetails={setIsOpenDetails}
            isOpenDetails={isOpenDetails}
          />
        )}
      </DetailsContainer>
      <Modal
        title={openSetupModal.title}
        open={openSetupModal.open}
        onClose={() => setOpenSetupModal({ ...openSetupModal, open: false })}
        width='70%'
        height='80%'
      >
        {openSetupModal.content}
      </Modal>
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

export const DeliveryServiceDetails = (props) => {
  const deliveryServiceDetailsProps = {
    ...props,
    UIComponent: DeliveryServiceDetailsUI,
    projectCode: window.localStorage.getItem('project')
  }
  return <DeliveryServiceDetailsController {...deliveryServiceDetailsProps} />
}
