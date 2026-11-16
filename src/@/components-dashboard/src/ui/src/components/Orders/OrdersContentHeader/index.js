import React from 'react'
import { useLanguage } from '../../../../../index'
import { LearnDropDown } from '../../Shared'
import { Menu as MenuIcon } from '../../Shared/Icon'
import { IconButton as MenuButton } from '../../Shared/Product'
import { InfoCircle } from 'react-bootstrap-icons'
import { IconButton } from '../../../styles'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { OverlayTrigger, Tooltip } from 'react-bootstrap'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { GoogleMapsApiKeySettingButton } from '../GoogleMapsApiKeySettingButton'
import { WebsocketStatus } from '../WebsocketStatus'
import { OrdersFilterBar } from '../OrdersFilterBar'
import { useIsPhone } from '../../Shared/Product/useIsPhone' // redesign W1-1 (T1-1): was useOrderCardsViewport (OrdersTable/OrderCard)
import './content-header.css'

/**
 * Redesign 5.2-A. Page head in one line, then the filter bar of 5.2-B.
 *
 * Shared by /orders, /deliveries, /messages and /all-in-one, so the props those
 * screens already pass keep working. New, all optional:
 * - `headerActions` (node): drawn last on the title line (New order, Export), in one group with
 *   Learn so the group wraps as a unit and stays aligned to the end. Under 768px of viewport the page's
 *   actions hold Learn themselves (a «More actions» menu), so the head does not draw it again.
 * - `renderConnectionNotice(node)`: where the "connection lost" notice goes
 *   (passed to the live status as `renderNotice`).
 * - `renderBelowTitle(filterBar)`: lets the page wrap the filter bar with its own
 *   composition (the status tabs go above it and the list below, inside one tabs
 *   root). Without it the filter bar is drawn directly under the title line.
 * - `ordersStatusGroup`, `selectedSubOrderStatus`, `handleSelectedSubOrderStatus`
 *   and `toolsSlot` go straight to the filter bar.
 */
export const OrdersContentHeader = (props) => {
  const {
    isLateralBar,
    isDisableTitle,
    isSelectedOrders,
    title,
    handleChangeSearch,
    searchValue,
    driverGroupList,
    assignableDriverGroupList,
    driversList,
    citiesList,
    paymethodsList,
    businessesList,
    selectedOrderIds,
    filterValues,
    handleChangeFilterValues,
    handleOpenTour,
    filterModalOpen,
    setFilterModalOpen,
    setTimeStatus,
    setSlaSettingTime,
    isShowMapsKeySettingButton,
    adminsList,
    learnOptions,
    disableSocketRoomDriver,
    ordersStatusGroup,
    selectedSubOrderStatus,
    handleSelectedSubOrderStatus,
    toolsSlot,
    headerActions,
    renderConnectionNotice,
    renderBelowTitle
  } = props

  const { width } = useWindowSize()
  // redesign 5.6-B: under 768px of viewport the head is one row (menu, title, live status, page actions).
  const isPhone = useIsPhone()
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()

  const filterBar = (
    <OrdersFilterBar
      isLateralBar={isLateralBar}
      isSelectedOrders={isSelectedOrders}
      isDisableTitle={isDisableTitle}
      searchValue={searchValue}
      driverGroupList={driverGroupList}
      assignableDriverGroupList={assignableDriverGroupList}
      driversList={driversList}
      citiesList={citiesList}
      paymethodsList={paymethodsList}
      businessesList={businessesList}
      adminsList={adminsList}
      filterValues={filterValues}
      handleChangeSearch={handleChangeSearch}
      handleChangeFilterValues={handleChangeFilterValues}
      filterModalOpen={filterModalOpen}
      setFilterModalOpen={setFilterModalOpen}
      setTimeStatus={setTimeStatus}
      setSlaSettingTime={setSlaSettingTime}
      disableSocketRoomDriver={disableSocketRoomDriver}
      ordersStatusGroup={ordersStatusGroup}
      selectedSubOrderStatus={selectedSubOrderStatus}
      handleSelectedSubOrderStatus={handleSelectedSubOrderStatus}
      toolsSlot={toolsSlot}
    />
  )

  return (
    <>
      {!isDisableTitle && (
        <div className='odc-root odc-page-head' data-phone={isPhone ? '' : undefined}>
          {isCollapse && (
            <MenuButton
              icon={MenuIcon}
              label={t('OPEN_MENU', 'Open menu')}
              onClick={() => handleMenuCollapse(false)}
            />
          )}
          {/* The row truncates the title when it is short (phones, the list beside the order panel), so it carries its full text. */}
          <h1 className='odc-page-title' title={title}>{title}</h1>
          {selectedOrderIds && width > 768 && !props.hideTour && (
            <OverlayTrigger
              placement='bottom'
              overlay={
                <Tooltip>
                  {t('START_TUTORIAL', 'Start tutorial')}
                </Tooltip>
              }
            >
              <IconButton
                color='dark'
                className='tour_btn'
                onClick={() => handleOpenTour()}
              >
                <InfoCircle />
              </IconButton>
            </OverlayTrigger>
          )}
          <WebsocketStatus position='RB' renderNotice={renderConnectionNotice} />
          <span className='odc-page-spacer' />
          {/* One group, so Learn and the page actions wrap together and stay at the end. */}
          <div className='odc-page-actions'>
            {/* On a phone, `headerActions` carry Learn in their own «More actions» menu (5.6-B). */}
            {!(isPhone && headerActions) && (
              <LearnDropDown
                learnOptions={learnOptions}
              />
            )}
            {isShowMapsKeySettingButton && (
              <GoogleMapsApiKeySettingButton />
            )}
            {headerActions}
          </div>
        </div>
      )}
      {/* redesign fix-qa E7 (main: OrdersContentHeader:116-124): the embedded lists have no title line but keep the connection indicator */}
      {isDisableTitle && (
        <div className='odc-root odc-page-live-row'>
          <WebsocketStatus position='RB' renderNotice={renderConnectionNotice} />
        </div>
      )}
      {renderBelowTitle ? renderBelowTitle(filterBar) : filterBar}
    </>
  )
}
