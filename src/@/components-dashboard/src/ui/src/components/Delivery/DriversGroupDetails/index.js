import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Dropdown, DropdownButton } from 'react-bootstrap'
import { ArrowsAngleContract, ArrowsAngleExpand, ThreeDots } from 'react-bootstrap-icons'
import { useTheme } from 'styled-components'
import {
  useLanguage,
  useConfig,
  DriversGroupDetails as DriversGroupDetailsController,
  useSession
} from '../../../../../index'
import { IconButton, Switch } from '../../../styles'
import { Alert, Confirm, DragScroll, LearnDropDown } from '../../Shared'
import { DriversGroupGeneralForm } from '../DriversGroupGeneralForm'
import { DriversGroupBusinesses } from '../DriversGroupBusinesses'
import { DriversGroupPaymethods } from '../DriversGroupPaymethods'
import { DriversGroupLogistics } from '../DriversGroupLogistics'
import { DriversGroupLogs } from '../DriversGroupLogs'
import { DriversGroupSchedule } from '../DriversGroupSchedule'
import { DriverGroupDeliveryDetails } from '../DriversGroupDeliveryDetails'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { addQueryToUrl, learnOptionsValues } from '../../../utils'

import {
  DetailsContainer,
  Header,
  MenusContainer,
  Tab,
  TabPanel,
  ActionSelectorWrapper,
  RightHeader
} from './styles'

const DriversGroupDetailsUI = (props) => {
  const {
    driversGroupState,
    actionState,
    handleParentSidebarMove,
    handleDeleteDriversGroup,
    handleNextTour,
    handleUpdateDriversGroup,
    setIsExtendExtraOpen,
    actionDisabled,
    driversGroupId
  } = props

  const query = new URLSearchParams(useLocation().search)
  const theme = useTheme()
  const [, t] = useLanguage()
  const { width } = useWindowSize()
  const [{ user }] = useSession()
  const [configState] = useConfig()

  const autoAssignType = configState?.configs?.autoassign_type?.value
  const learnOptions = learnOptionsValues(['advance_logistics'], t)

  const [showMenu, setShowMenu] = useState('general')
  const [driversGroupMenus, setDriversGroupMenus] = useState([])
  const [confirm, setConfirm] = useState({ open: false, content: null, handleOnAccept: null })
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [isOpenDetails, setIsOpenDetails] = useState(false)
  const [isExpand, setIsExpand] = useState(false)
  const tabRefs = useRef([])

  useEffect(() => {
    const _driversGroupMenusBase = [
      { key: 'general', value: t('GENERAL', 'General'), sort: 1 },
      { key: 'businesses', value: t('BUSINESSES', 'Businesses'), sort: 2 }
    ]

    const _additionalMenus = []

    if (driversGroupState?.driversGroup) {
      _additionalMenus.push(
        { key: 'schedule', value: t('SCHEDULE', 'Schedule'), sort: 4.5 }
      )
      if (user?.level !== 5) {
        _additionalMenus.push(
          { key: 'paymethods', value: t('PAYMENT_METHODS', 'Payment methods'), sort: 3 },
          { key: 'delivery_zones', value: t('DELIVERY_ZONES_TITLE', 'Delivery zones'), sort: 4 },
          { key: 'logs', value: t('LOGS', 'Logs'), sort: 6 }
        )
      }
      const hideAdvancedLogistic = driversGroupState?.driversGroup?.autoassign_amount_drivers === 0 &&
        driversGroupState?.driversGroup?.orders_group_max_orders === 0

      if (autoAssignType !== 'basic' && !hideAdvancedLogistic) {
        _additionalMenus.push(
          { key: 'advanced_logistics', value: t('ADVANCED_LOGISTICS', 'Advanced logistics'), sort: 5 }
        )
      }
    }
    const _driversGroupMenus = [..._driversGroupMenusBase, ..._additionalMenus]
    _driversGroupMenus.sort((a, b) => a.sort - b.sort)
    setDriversGroupMenus(_driversGroupMenus)
  }, [driversGroupState?.driversGroup])

  const onDeleteGroup = () => {
    setConfirm({
      open: true,
      content: t('QUESTION_DELETE_DRIVER_GROUP', 'Are you sure to remove this driver group?'),
      handleOnAccept: () => {
        setConfirm({ ...confirm, open: false })
        handleDeleteDriversGroup()
      }
    })
  }

  useEffect(() => {
    if (width > 1000) setIsExtendExtraOpen(false)
  }, [width])

  const handleNextClick = () => {
    setShowMenu('businesses')
    handleNextTour()
  }

  const expandSidebar = () => {
    const element = document.getElementById('driver_group_details')
    if (!element) return
    if (isExpand) element.style.width = '540px'
    else element.style.width = 'var(--app-width, 100vw)'
    setIsExpand(prev => !prev)
  }

  useEffect(() => {
    handleParentSidebarMove(0)
    setIsOpenDetails(false)
    setIsExtendExtraOpen(false)
  }, [showMenu, driversGroupState.driversGroup?.id])

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

  const handleTabKeyDown = (event, index) => {
    let nextIndex = index
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % driversGroupMenus.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + driversGroupMenus.length) % driversGroupMenus.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = driversGroupMenus.length - 1
    else return
    event.preventDefault()
    const nextTab = driversGroupMenus[nextIndex]
    handleTabClick(nextTab.key)
    tabRefs.current[nextIndex]?.focus()
  }

  useEffect(() => {
    if (driversGroupState.loading) return
    const tab = query.get('tab')
    if (tab) {
      handleTabClick(tab, true)
    } else {
      handleTabClick(showMenu)
    }
  }, [driversGroupState.loading])

  useEffect(() => {
    setShowMenu('general')
  }, [driversGroupId])

  return (
    <>
      <DetailsContainer>
        <Header>
          {driversGroupState.driversGroup
            ? (
              <>
                <div>
                  <h1>{driversGroupState.driversGroup?.name}</h1>
                  <LearnDropDown
                    learnOptions={learnOptions}
                  />
                  <Switch
                    defaultChecked={driversGroupState.driversGroup?.enabled}
                    onChange={enabled => handleUpdateDriversGroup({ enabled })}
                    disabled={actionDisabled}
                  />
                </div>
                <RightHeader>
                  {width > 576 && (
                    <IconButton
                      type='button'
                      color='black'
                      aria-label={isExpand ? t('COLLAPSE', 'Collapse') : t('EXPAND', 'Expand')}
                      aria-expanded={isExpand}
                      onClick={expandSidebar}
                    >
                      {isExpand ? <ArrowsAngleContract /> : <ArrowsAngleExpand />}
                    </IconButton>
                  )}
                  <ActionSelectorWrapper>
                    <DropdownButton
                      menuAlign={theme?.rtl ? 'left' : 'right'}
                      title={
                        <>
                          <ThreeDots aria-hidden='true' />
                          <span className='visually-hidden'>{t('ACTIONS', 'Actions')}</span>
                        </>
                      }
                      id={theme?.rtl ? 'dropdown-menu-align-left' : 'dropdown-menu-align-right'}
                    >
                      <Dropdown.Item
                        onClick={() => onDeleteGroup()}
                        disabled={actionDisabled}
                      >
                        {t('DELETE', 'Delete')}
                      </Dropdown.Item>
                    </DropdownButton>
                  </ActionSelectorWrapper>
                </RightHeader>
              </>
              )
            : (
              <>
                <div>
                  <h1>{t('ADD_NEW_DRIVER_GROUP', 'Add new driver group')}</h1>
                </div>
                {width > 576 && (
                  <IconButton
                    type='button'
                    color='black'
                    aria-label={isExpand ? t('COLLAPSE', 'Collapse') : t('EXPAND', 'Expand')}
                    aria-expanded={isExpand}
                    onClick={expandSidebar}
                  >
                    {isExpand ? <ArrowsAngleContract /> : <ArrowsAngleExpand />}
                  </IconButton>
                )}
              </>
              )}
        </Header>
        <MenusContainer role='tablist' aria-label={t('DRIVER_GROUP_SETTINGS', 'Driver group settings')}>
          <DragScroll>
            {driversGroupMenus.map((menu, index) => (
              <Tab
                type='button'
                key={menu.key}
                id={`drivers-group-${menu.key}-tab`}
                role='tab'
                aria-selected={menu.key === showMenu}
                aria-controls={`drivers-group-${menu.key}-panel`}
                tabIndex={menu.key === showMenu ? 0 : -1}
                active={menu.key === showMenu}
                onClick={() => handleTabClick(menu.key)}
                onKeyDown={event => handleTabKeyDown(event, index)}
                ref={element => { tabRefs.current[index] = element }}
              >
                {menu.value}
              </Tab>
            ))}
          </DragScroll>
        </MenusContainer>
        {(showMenu === 'general') && (
          <TabPanel id='drivers-group-general-panel' role='tabpanel' aria-labelledby='drivers-group-general-tab'>
            <DriversGroupGeneralForm
              {...props}
              curDriversGroup={driversGroupState.driversGroup}
              handleNextClick={handleNextClick}
            />
          </TabPanel>
        )}
        {showMenu === 'businesses' && (
          <TabPanel id='drivers-group-businesses-panel' role='tabpanel' aria-labelledby='drivers-group-businesses-tab'>
            <DriversGroupBusinesses
              {...props}
              curDriversGroup={driversGroupState.driversGroup}
            />
          </TabPanel>
        )}
        {showMenu === 'paymethods' && (
          <TabPanel id='drivers-group-paymethods-panel' role='tabpanel' aria-labelledby='drivers-group-paymethods-tab'>
            <DriversGroupPaymethods
              {...props}
              curDriversGroup={driversGroupState.driversGroup}
            />
          </TabPanel>
        )}
        {showMenu === 'advanced_logistics' && (
          <TabPanel id='drivers-group-advanced_logistics-panel' role='tabpanel' aria-labelledby='drivers-group-advanced_logistics-tab'>
            <DriversGroupLogistics
              {...props}
              curDriversGroup={driversGroupState.driversGroup}
            />
          </TabPanel>
        )}
        {showMenu === 'schedule' && (
          <DriversGroupSchedule
            {...props}
          />
        )}
        {showMenu === 'logs' && (
          <TabPanel id='drivers-group-logs-panel' role='tabpanel' aria-labelledby='drivers-group-logs-tab'>
            <DriversGroupLogs driversGroupId={driversGroupState.driversGroup?.id} formatDates />
          </TabPanel>
        )}
        {showMenu === 'delivery_zones' && (
          <TabPanel id='drivers-group-delivery_zones-panel' role='tabpanel' aria-labelledby='drivers-group-delivery_zones-tab'>
            <DriverGroupDeliveryDetails
              {...props}
              curDriversGroup={driversGroupState.driversGroup}
              handleParentSidebarMove={handleParentSidebarMove}
              drivergroup={driversGroupState.driversGroup}
              setIsExtendExtraOpen={setIsExtendExtraOpen}
              setIsOpenDetails={setIsOpenDetails}
              isOpenDetails={isOpenDetails}
            />
          </TabPanel>
        )}
      </DetailsContainer>
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

export { DriversGroupDetailsUI }

export const DriversGroupDetails = (props) => {
  const driversGroupDetailsProps = {
    ...props,
    UIComponent: DriversGroupDetailsUI
  }
  return <DriversGroupDetailsController {...driversGroupDetailsProps} />
}
