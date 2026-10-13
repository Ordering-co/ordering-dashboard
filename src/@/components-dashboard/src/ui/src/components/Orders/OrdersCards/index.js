import React, { useState, useEffect, useContext } from 'react'
import moment from 'moment'
import { useLanguage, useUtils, useConfig } from '../../../../../index'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'
import { useTheme } from 'styled-components'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import FaUserAlt from '@meronex/icons/fa/FaUserAlt'
import { Pagination } from '../../Shared'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { addQueryToUrl, getOrderStatusPrefix as getOrderStatus } from '../../../utils'

import {
  OrdersListContainer,
  OrderCard,
  OrderHeader,
  ViewDetails,
  InfoItemContainer,
  WrapperImage,
  CardContent,
  WrapperPagination,
  UnreadMessageCounter,
  Timestatus,
  CardHeading,
  Timer
} from './styles'

export const OrdersCards = (props) => {
  const {
    isMessagesView,

    orderList,
    pagination,
    getPageOrders,
    handleOpenOrderDetail,
    selectedOrderCard,
    handleOrderCardClick,
    handleUpdateDriverLocation,
    isDelivery,
    isUseQuery,
    franchisesList
  } = props
  const [{ dictionary }, t] = useLanguage()
  const theme = useTheme()
  const { width } = useWindowSize()
  const [{ parseDate, optimizeImage }] = useUtils()
  const [configState] = useConfig()
  const [allowColumns, setAllowColumns] = useState({
    timer: true,
    slaBar: true
  })
  const [configFile] = useContext(ConfigFileContext)
  const prefixForVariable = configFile.app_internal_name.toUpperCase()
  const showExternalId = configState?.configs?.change_order_id?.value === '1'
  const cateringTypes = [7, 8]
  const franchiseImages = !franchisesList?.error && franchisesList?.franchises?.reduce((imageKeys, franchise) => {
    imageKeys[franchise.id] = franchise.logo
    return imageKeys
  }, {})

  const handleChangePage = (page) => {
    getPageOrders(pagination.pageSize, page)
  }

  const handleChangePageSize = (pageSize) => {
    const expectedPage = Math.ceil(((pagination.currentPage - 1) * pagination.pageSize + 1) / pageSize)
    getPageOrders(pageSize, expectedPage)
  }

  const handleOrderClick = (e, order) => {
    const isInvalid = e.target.closest('.view-details') || e.target.closest('.driver-selector')
    if (isInvalid) return
    handleOrderCardClick(order)
    const element = document.getElementById('deliveryDashboard')
    if ((isDelivery || isMessagesView) && width < 993 && element) element.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  }

  const getDelayMinutes = (order) => {
    // targetMin = delivery_datetime  + eta_time - now()
    const offset = 300
    const cdtToutc = moment(order?.delivery_datetime).add(offset, 'minutes').format('YYYY-MM-DD HH:mm:ss')
    const _delivery = order?.delivery_datetime_utc
      ? parseDate(order?.delivery_datetime_utc)
      : parseDate(cdtToutc)
    const _eta = order?.eta_time
    const diffTimeAsSeconds = moment(_delivery).add(_eta, 'minutes').diff(moment().utc(), 'seconds')
    return Math.ceil(diffTimeAsSeconds / 60)
  }

  const displayDelayedTime = (order) => {
    let tagetedMin = getDelayMinutes(order)
    // get day, hour and minutes
    const sign = tagetedMin >= 0 ? '' : '- '
    tagetedMin = Math.abs(tagetedMin)
    let day = Math.floor(tagetedMin / 1440)
    const restMinOfTargetedMin = tagetedMin - 1440 * day
    let restHours = Math.floor(restMinOfTargetedMin / 60)
    let restMins = restMinOfTargetedMin - 60 * restHours
    // make standard time format
    day = day === 0 ? '' : day + 'day  '
    restHours = restHours < 10 ? '0' + restHours : restHours
    restMins = restMins < 10 ? '0' + restMins : restMins

    const finalTaget = sign + day + restHours + ':' + restMins
    return finalTaget
  }

  // const getStatusClassName = (minutes) => {
  //   if (isNaN(Number(minutes))) return 'in_time'
  //   const delayTime = configState?.configs?.order_deadlines_delayed_time?.value
  //   return minutes > 0 ? 'in_time' : Math.abs(minutes) <= delayTime ? 'at_risk' : 'delayed'
  // }

  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     setCurrentTime(Date.now())
  //   }, slaSettingTime)

  //   return () => clearInterval(interval)
  // }, [])

  useEffect(() => {
    if (orderList.loading || !selectedOrderCard) return
    const updatedOrder = orderList?.orders.find(order => order.id === selectedOrderCard?.id)
    if (updatedOrder) {
      handleUpdateDriverLocation && handleUpdateDriverLocation(updatedOrder)
    }
  }, [orderList?.orders])

  useEffect(() => {
    setAllowColumns({
      ...allowColumns,
      timer: true,
      slaBar: true
    })
  }, [configState.loading])

  useEffect(() => {
    if (!isUseQuery || !pagination?.currentPage || !pagination?.pageSize || !pagination?.total) return
    addQueryToUrl({
      page: pagination.currentPage,
      pageSize: pagination.pageSize
    })
  }, [pagination?.currentPage, pagination?.pageSize, pagination?.total])

  return (
    <>
      <OrdersListContainer>
        {orderList.loading
          ? (
              [...Array(10).keys()].map(i => (
            <OrderCard key={i}>
              <OrderHeader>
                <Skeleton width={100} height={30} />
                <div>
                  <Skeleton width={150} />
                  <ViewDetails>
                    <Skeleton width={100} />
                  </ViewDetails>
                </div>
              </OrderHeader>
              <CardContent>
                <InfoItemContainer>
                  <WrapperImage isSkeleton>
                    <Skeleton width={45} height={45} />
                  </WrapperImage>
                  <div className='info'>
                    <p><Skeleton width={100} /></p>
                    <p><Skeleton width={100} /></p>
                  </div>
                </InfoItemContainer>
                <InfoItemContainer>
                  <WrapperImage isSkeleton>
                    <Skeleton width={45} height={45} />
                  </WrapperImage>
                  <div className='info'>
                    <p><Skeleton width={100} /></p>
                    <p><Skeleton width={100} /></p>
                  </div>
                </InfoItemContainer>
              </CardContent>
            </OrderCard>
              ))
            )
          : (
          <>
            {orderList.orders?.map(order => (
              <OrderCard
                key={order.id}
                active={selectedOrderCard?.id === order.id}
                onClick={(e) => handleOrderClick(e, order)}
              >
                <CardHeading>
                  <OrderHeader>
                    <h2>
                      <span>{t('INVOICE_ORDER_NO', 'Order No.')} {(showExternalId && !!order?.external_id) ? order.external_id : order.id}</span>
                    </h2>
                    <p>{(parseInt(order?.delivery_type, 10) === 9 && parseInt(order?.status, 10) === 13)
                      ? (dictionary?.RESERVATION ?? t('RESERVATION', 'Reservation'))
                      : getOrderStatus(order.status, dictionary, prefixForVariable)}</p>
                    <div>
                      {cateringTypes.includes(order?.delivery_type) && (
                        <p className='date'>
                          {
                            `${t('CREATED_AT', 'Created at')}: ${parseDate(order?.created_at)}`
                          }
                        </p>
                      )}
                      <p>
                        {
                          `${cateringTypes.includes(order?.delivery_type) ? `${t('PLACED_TO', 'Placed to')}:` : ''} ${order?.delivery_datetime_utc ? parseDate(order?.delivery_datetime_utc) : parseDate(order?.delivery_datetime, { utc: false })}`
                        }
                      </p>
                      <ViewDetails
                        className='view-details'
                        onClick={() => handleOpenOrderDetail(order)}
                      >
                        {t('VIEW_DETAILS', 'View details')}
                      </ViewDetails>
                    </div>
                  </OrderHeader>
                  {allowColumns?.timer && (
                    <Timer>
                      <p className='bold'>Timer</p>
                      <p className={order?.time_status}>{displayDelayedTime(order)}</p>
                    </Timer>
                  )}
                  {order?.codigoPod && (
                    <div style={{ paddingTop: 50 }}>
                      <p>
                        {
                          `${t('PODS', 'Pod')}: ${order?.codigoPod}`
                        }
                      </p>
                    </div>
                  )}
                </CardHeading>
                {isMessagesView && order?.unread_count > 0 && (
                  <UnreadMessageCounter>
                    {order?.unread_count}
                  </UnreadMessageCounter>
                )}
                <CardContent>
                  <InfoItemContainer>
                    <WrapperImage>
                      <img src={optimizeImage(franchiseImages[order?.business?.franchise_id] || order.business?.logo || theme.images?.dummies?.businessLogo, 'h_50,c_limit')} loading='lazy' alt='' />
                    </WrapperImage>
                    <div className='info'>
                      <p className='bold'>{order?.business?.name}</p>
                      <p>{order?.business?.city?.name}</p>
                    </div>
                  </InfoItemContainer>
                  <InfoItemContainer>
                    <WrapperImage>
                      {order?.driver?.photo || order?.external_driver?.photo
                        ? (
                        <img src={optimizeImage(order?.driver?.photo || order?.external_driver?.photo, 'h_50,c_limit')} loading='lazy' alt='' />
                          )
                        : (
                        <FaUserAlt />
                          )}
                    </WrapperImage>
                    <div className='info'>
                      {order?.driver || order?.external_driver
                        ? (
                        <>
                          <p className='bold'>{order?.driver?.name || order?.external_driver?.name}</p>
                          <p>{order?.driver?.cellphone || order?.driver_company?.name}</p>
                        </>
                          )
                        : (
                        <p className='bold'>{t('NO_DRIVER', 'No Driver')}</p>
                          )}
                    </div>
                  </InfoItemContainer>
                </CardContent>
                {allowColumns?.slaBar && (
                  <Timestatus timeState={order?.time_status} />
                )}
              </OrderCard>
            ))}
          </>
            )}
      </OrdersListContainer>
      {pagination && (
        <WrapperPagination>
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            handleChangePage={handleChangePage}
            defaultPageSize={pagination.pageSize}
            handleChangePageSize={handleChangePageSize}
          />
        </WrapperPagination>
      )}
    </>
  )
}
