import React from 'react'
import { useLanguage, useConfig } from '../../../../../index'
import { LearnDropDown, SearchBar } from '../../Shared'
import { OrdersFilterGroup } from '../OrdersFilterGroup'
import { List as MenuIcon, InfoCircle } from 'react-bootstrap-icons'
import { OrdersDashboardSLAControls } from '../OrdersDashboardSLAControls'
import { IconButton } from '../../../styles'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { OverlayTrigger, Tooltip } from 'react-bootstrap'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { GoogleMapsApiKeySettingButton } from '../GoogleMapsApiKeySettingButton'
import { WebsocketStatus } from '../WebsocketStatus'
import { OrdersHeaderFilterGroup } from '../OrdersHeaderFilterGroup'

import {
  OrderContentHeaderContainer,
  HeaderSection,
  HeaderTitle,
  TopRightSection,
  SLAControlsWrapper,
  WrapperSearchAndFilter,
  WrapperHeaderFilterGroup,
  WrapperConnectionStatus
} from './styles'

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
    handleChangeFilterValues,
    handleOpenTour,
    filterModalOpen,
    setFilterModalOpen,
    setTimeStatus,
    setSlaSettingTime,
    isShowMapsKeySettingButton,
    adminsList,
    learnOptions,
    disableSocketRoomDriver
  } = props

  const { width } = useWindowSize()
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()

  const [configState] = useConfig()

  const isShowSearchFilters = !configState?.configs?.search_box_enabled || configState?.configs?.search_box_enabled?.value === '1'

  return (
    <>
      <OrderContentHeaderContainer
        isDisableControl={isSelectedOrders}
      >
        {!isDisableTitle && (
          <HeaderSection $isCollapse={isCollapse}>
            {isCollapse && (
              <IconButton
                color='black'
                onClick={() => handleMenuCollapse(false)}
              >
                <MenuIcon />
              </IconButton>
            )}
            <HeaderTitle>
              {title}
            </HeaderTitle>
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
            <LearnDropDown
              learnOptions={learnOptions}
            />

          </HeaderSection>
        )}
        <TopRightSection isCustomLayout={isSelectedOrders} isCollapse={isCollapse}>
          <WrapperHeaderFilterGroup>
            <OrdersHeaderFilterGroup
              isSelectedOrders={isSelectedOrders}
              driverGroupList={driverGroupList}
              assignableDriverGroupList={assignableDriverGroupList}
              driversList={driversList}
              searchValue={searchValue}
              handleChangeFilterValues={handleChangeFilterValues}
              handleChangeSearch={handleChangeSearch}
              disableSocketRoomDriver={disableSocketRoomDriver}
            />
          </WrapperHeaderFilterGroup>
          <WrapperConnectionStatus>
            <WebsocketStatus position='RB' />
            <SLAControlsWrapper>
              <OrdersDashboardSLAControls
                setTimeStatus={setTimeStatus}
                setSlaSettingTime={setSlaSettingTime}
              />
            </SLAControlsWrapper>
          </WrapperConnectionStatus>
          {isShowMapsKeySettingButton && (
            <GoogleMapsApiKeySettingButton />
          )}
          <WrapperSearchAndFilter
            fullWidth={isDisableTitle}
          >
            {isShowSearchFilters && (
              <SearchBar
                isCustomLayout
                lazyLoad
                onSearch={handleChangeSearch}
                search={searchValue}
                placeholder={t('SEARCH', 'Search')}
              />
            )}
            <OrdersFilterGroup
              isLateralBar={isLateralBar}
              filterModalOpen={filterModalOpen}
              setFilterModalOpen={setFilterModalOpen}
              driverGroupList={driverGroupList}
              driversList={driversList}
              paymethodsList={paymethodsList}
              businessesList={businessesList}
              citiesList={citiesList}
              adminsList={adminsList}
              handleChangeFilterValues={handleChangeFilterValues}
              searchValue={searchValue}
              handleChangeSearch={handleChangeSearch}
            />
          </WrapperSearchAndFilter>
        </TopRightSection>
      </OrderContentHeaderContainer>
    </>
  )
}
