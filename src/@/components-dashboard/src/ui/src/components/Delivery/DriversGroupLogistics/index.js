import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage } from '../../../../../index'
import { Circle, RecordCircleFill, ChevronRight } from 'react-bootstrap-icons'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { Button } from '../../../styles'
import { SideBar, Modal } from '../../Shared'
import { ArrowLeft } from '../../Shared/Icon'
import { Button as ProductButton } from '../../Shared/Product/Button'
import { DriversGroupOrders } from '../DriversGroupOrders'
import { DriversGroupAutoassign } from '../DriversGroupAutoassign'
import { DriversMarkAsBusy } from '../DriversMarkAsBusy'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'

import {
  LogisticsContainer,
  OrderStatusGroup,
  OrderStatusWrapper,
  RadioButton,
  LogisticsConfigsContainer,
  LogisticsConfigItem
} from './styles'

// redesign DG-B4 (decision 1): the sub-panels `?config=` can open
const CONFIG_PANELS = ['GROUP_ORDERS', 'AUTOASSIGN_SETTINGS', 'MARK_DRIVER_BUSY']

/**
 * `inline` (opt-in, redesign DG-B4): the group panel draws the three sub-panels (Group orders, Autoassign settings, Mark drivers
 * as busy) inside this section, in place of the list of entries, with «← Advanced logistics» to go back; there is no SideBar and no
 * Modal and `handleParentSidebarMove` is never called. `?config=` still opens them (and going back takes it out of the URL).
 * Save stays under the sub-panel, so what is changed there can be saved there. Without `inline` this is the component of main.
 */
export const DriversGroupLogistics = (props) => {
  const {
    inline = false,
    driversGroupState,
    changesState,
    handleChangesState,
    handleParentSidebarMove,
    handleUpdateDriversGroup,
    actionDisabled
  } = props

  const routerSearch = useLocation().search
  const [, t] = useLanguage()
  const { width } = useWindowSize()

  const isStartInStatus = (status) => (
    (changesState?.orders_group_start_in_status && changesState?.orders_group_start_in_status === status) ||
    (typeof changesState?.orders_group_start_in_status === 'undefined' && driversGroupState.driversGroup?.orders_group_start_in_status === status)
  )

  const startInStatusOptions = [
    { status: 7, label: t('ACCEPT_BY_BUSINESS', 'Accepted by the business') },
    { status: 4, label: t('PREPARATION_COMPLETED', 'Preparation completed') }
  ]

  const startInStatusRefs = useRef([])

  const handleStartInStatusKeyDown = (event, index) => {
    let nextIndex = index
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % startInStatusOptions.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + startInStatusOptions.length) % startInStatusOptions.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = startInStatusOptions.length - 1
    else return
    event.preventDefault()
    handleChangesState({ orders_group_start_in_status: startInStatusOptions[nextIndex].status })
    startInStatusRefs.current[nextIndex]?.focus()
  }

  const [showConfig, setShowConfig] = useState(null)
  const [openConfig, setOpenConfig] = useState(false)

  // redesign DG-R1 (R1-04): inline, the focus follows the view that opens. A click on an entry sends it to «← Advanced logistics»;
  // going back sends it to the entry that was open. A sub-panel the address opens when the section mounts takes no focus.
  const backRef = useRef(null)
  const entryRefs = useRef({})
  const focusPending = useRef(null)
  const lastConfig = useRef(null)

  const handleOpenConfig = (option, isInitialRender) => {
    if (inline && !isInitialRender) focusPending.current = 'sub'
    lastConfig.current = option
    setShowConfig(option)
    setOpenConfig(true)
    if (!inline && width >= 1200) {
      handleParentSidebarMove(700)
    }

    if (!isInitialRender) {
      addQueryToUrl({ config: option })
    }
  }

  const handleCloseSidebar = () => {
    if (!inline) handleParentSidebarMove(0)
    setShowConfig(null)
    setOpenConfig(false)
  }

  const handleBack = () => {
    if (inline) focusPending.current = 'entry'
    handleCloseSidebar()
    removeQueryToUrl(['config'])
  }

  const subPanelOpen = inline && openConfig && CONFIG_PANELS.includes(showConfig)
  useEffect(() => {
    if (!inline) return
    if (focusPending.current === 'sub' && subPanelOpen) backRef.current?.focus()
    else if (focusPending.current === 'entry' && !subPanelOpen) entryRefs.current[lastConfig.current]?.focus()
    focusPending.current = null
  }, [subPanelOpen])

  useEffect(() => {
    if (inline) return
    if (width < 1200) {
      handleParentSidebarMove(0)
    } else {
      if (openConfig) handleParentSidebarMove(700)
    }
  }, [width, openConfig, inline])

  useEffect(() => {
    setOpenConfig(false)
  }, [driversGroupState.driversGroup?.id])

  // redesign DG-R1 (R1-03): the router's location is the one of the page load (`replaceState`, which addQueryToUrl and
  // removeQueryToUrl use, does not move it), so a `?config=` of that first load reopened the sub-panel in any other group. Inline
  // reads the address bar itself, when the section mounts and for each group; without `inline` it is the router's, as in main.
  useEffect(() => {
    const config = new URLSearchParams(inline ? window.location.search : routerSearch).get('config')
    if (config) {
      handleOpenConfig(config, true)
    }
  }, [inline ? driversGroupState.driversGroup?.id : null])

  // redesign DG-R1 (R1-03): inline, leaving the section with a sub-panel open takes `?config=` out, or coming back would reopen it
  const configOpenRef = useRef(false)
  configOpenRef.current = openConfig && CONFIG_PANELS.includes(showConfig)
  useEffect(() => () => {
    if (inline && configOpenRef.current) removeQueryToUrl(['config'])
  }, [])

  const saveButton = (
    <Button
      borderRadius='8px'
      color='primary'
      disabled={Object.keys(changesState).length === 0}
      onClick={() => handleUpdateDriversGroup(changesState)}
    >
      {t('SAVE', 'Save')}
    </Button>
  )

  const configPanel = (
    <>
      {showConfig === 'GROUP_ORDERS' && (
        <DriversGroupOrders {...props} />
      )}
      {showConfig === 'AUTOASSIGN_SETTINGS' && (
        <DriversGroupAutoassign {...props} />
      )}
      {showConfig === 'MARK_DRIVER_BUSY' && (
        <DriversMarkAsBusy {...props} />
      )}
    </>
  )

  const sideBar = openConfig && (
    <SideBar
      isBorderShow
      sidebarId='logistic-details'
      defaultSideBarWidth={700}
      open={openConfig}
      onClose={() => handleCloseSidebar()}
    >
      {configPanel}
    </SideBar>
  )
  const modal = (
    <Modal
      width='70%'
      height='70vh'
      open={openConfig}
      onClose={() => handleCloseSidebar()}
    >
      {configPanel}
    </Modal>
  )

  // redesign DG-B4: inline, an open sub-panel takes the place of the list of entries (an unknown `?config=` leaves the list)
  if (subPanelOpen) {
    return (
      <LogisticsContainer
        disabled={actionDisabled}
      >
        <div>
          <ProductButton ref={backRef} variant='ghost' icon={ArrowLeft} onClick={handleBack}>
            {t('ADVANCED_LOGISTICS', 'Advanced logistics')}
          </ProductButton>
        </div>
        {configPanel}
        {saveButton}
      </LogisticsContainer>
    )
  }

  return (
    <LogisticsContainer
      disabled={actionDisabled}
    >
      <OrderStatusGroup role='radiogroup' aria-label={t('ORDERS_GROUP_START_IN_STATUS', 'Start group in status')}>
        {startInStatusOptions.map((option, index) => (
          <OrderStatusWrapper
            key={option.status}
            as='button'
            type='button'
            role='radio'
            aria-checked={Boolean(isStartInStatus(option.status))}
            tabIndex={isStartInStatus(option.status) || (index === 0 && !startInStatusOptions.some(item => isStartInStatus(item.status))) ? 0 : -1}
            onClick={() => handleChangesState({ orders_group_start_in_status: option.status })}
            onKeyDown={event => handleStartInStatusKeyDown(event, index)}
            ref={element => { startInStatusRefs.current[index] = element }}
          >
            <RadioButton active={isStartInStatus(option.status)}>
              {isStartInStatus(option.status)
                ? (
                  <RecordCircleFill />
                  )
                : (
                  <Circle />
                  )}
            </RadioButton>
            <span>{option.label}</span>
          </OrderStatusWrapper>
        ))}
      </OrderStatusGroup>

      <LogisticsConfigsContainer>
        {(changesState?.type === 0 || (typeof changesState?.type === 'undefined' && driversGroupState.driversGroup?.type === 0)) && (
          <LogisticsConfigItem
            as='button'
            type='button'
            aria-expanded={openConfig && showConfig === 'GROUP_ORDERS'}
            active={showConfig === 'GROUP_ORDERS'}
            ref={element => { entryRefs.current.GROUP_ORDERS = element }}
            onClick={() => handleOpenConfig('GROUP_ORDERS')}
          >
            <span>{t('GROUP_ORDERS', 'Group Orders')}</span>
            <ChevronRight aria-hidden='true' />
          </LogisticsConfigItem>
        )}
        <LogisticsConfigItem
          as='button'
          type='button'
          aria-expanded={openConfig && showConfig === 'AUTOASSIGN_SETTINGS'}
          active={showConfig === 'AUTOASSIGN_SETTINGS'}
          ref={element => { entryRefs.current.AUTOASSIGN_SETTINGS = element }}
          onClick={() => handleOpenConfig('AUTOASSIGN_SETTINGS')}
        >
          <span>{t('AUTOASSIGN_SETTINGS', 'Autoassign settings')}</span>
          <ChevronRight aria-hidden='true' />
        </LogisticsConfigItem>
        {(changesState?.type === 0 || (typeof changesState?.type === 'undefined' && driversGroupState.driversGroup?.type === 0)) && (
          <LogisticsConfigItem
            as='button'
            type='button'
            aria-expanded={openConfig && showConfig === 'MARK_DRIVER_BUSY'}
            active={showConfig === 'MARK_DRIVER_BUSY'}
            ref={element => { entryRefs.current.MARK_DRIVER_BUSY = element }}
            onClick={() => handleOpenConfig('MARK_DRIVER_BUSY')}
          >
            <span>{t('MARK_DRIVER_BUSY', 'Mark drivers as busy')}</span>
            <ChevronRight aria-hidden='true' />
          </LogisticsConfigItem>
        )}
      </LogisticsConfigsContainer>
      {saveButton}

      {/* redesign DG-B4: inline never draws a SideBar or a Modal, whatever `?config=` says */}
      {!inline && (width >= 1200 ? sideBar : modal)}
    </LogisticsContainer>
  )
}
