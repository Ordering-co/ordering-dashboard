import React, { useState } from 'react'
import { useUtils, useLanguage, UsersList as UsersListController } from '../../../../../index'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { ChevronLeft as Prev, ChevronRight as Next } from '../Icon'
import { useTheme } from 'styled-components'
import { ContactOrdersSheet } from '../../Orders' // redesign W1-1 (T1-2)

import {
  Container,
  CustomersListConatainer,
  Card,
  WrapperImage,
  Image,
  InfoContainer,
  AssignedOrdersCount,
  WrapperPagination,
  WrapperPageState,
  PageButton
} from './chat-contact-styles'

export const ChatContactListUI = (props) => {
  const {
    isDriver,
    isCustomer,
    usersList,
    paginationProps,
    paginationDetail,
    getUsers
  } = props

  const theme = useTheme()
  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()

  const [isOpenOrders, setIsOpenOrders] = useState(false)
  const [openUser, setOpenUser] = useState(null)

  const handleOpenOrders = (user) => {
    setOpenUser(user)
    setIsOpenOrders(true)
  }

  const prevNextPage = (isNextPage) => {
    getUsers && getUsers(false, isNextPage)
  }

  return (
    <Container>
      <CustomersListConatainer>
        {usersList.loading
          ? (
            <>
              {[...Array(10).keys()].map(i => (
                <Card
                  key={i}
                >
                  <WrapperImage isSkeleton>
                    <Skeleton width={45} height={45} />
                  </WrapperImage>
                  <InfoContainer>
                    <div>
                      <Skeleton width={100} />
                    </div>
                    <Skeleton width={100} />
                  </InfoContainer>
                </Card>
              ))}
            </>)
          : (
          <>
            {usersList.users.map(user => (
              <Card
                key={user.id}
                // onClick={(e) => handleClickUser(e, user)}
                active={user?.id === openUser?.id}
              >
                <WrapperImage>
                  <Image bgimage={optimizeImage(user?.photo || theme.images?.icons?.noDriver, 'h_200,c_limit')} />
                </WrapperImage>
                <InfoContainer>
                  <div>
                    <p>{user?.name} {user?.lastname}</p>
                    <span className='od-chat-dot' aria-hidden='true'>·</span>
                    <AssignedOrdersCount
                      className='driver_orders'
                      disabled={isDriver && (!user?.assigned_orders_count || user?.assigned_orders_count === 0)}
                      onClick={() => handleOpenOrders(user)}
                    >
                      {isDriver && <>{user?.assigned_orders_count}</>} {t('ORDERS', 'Orders')}
                    </AssignedOrdersCount>
                  </div>
                </InfoContainer>
              </Card>
            ))}
          </>)}
      </CustomersListConatainer>
      {usersList?.users.length > 0 && (
        <WrapperPagination>
          <WrapperPageState>
            {`${paginationDetail?.from} - ${paginationDetail?.to} of ${paginationDetail?.total}`}
          </WrapperPageState>
          <PageButton
            aria-label={t('PREVIOUS_PAGE', 'Previous page')}
            disabled={paginationProps?.currentPage === 1 || usersList.loading}
            onClick={() => prevNextPage(false)}
          >
            <Prev />
          </PageButton>
          <PageButton
            aria-label={t('NEXT_PAGE', 'Next page')}
            disabled={usersList.loading || paginationProps?.totalPages === paginationProps?.currentPage || paginationProps?.totalPages === 1}
            onClick={() => prevNextPage(true)}
          >
            <Next />
          </PageButton>
        </WrapperPagination>
      )}

      {openUser && (
        <ContactOrdersSheet
          open={isOpenOrders}
          isDriver={isDriver}
          isCustomer={isCustomer}
          user={openUser}
          onClose={() => setIsOpenOrders(false)}
        />
      )}
    </Container>
  )
}

export const ChatContactList = (props) => {
  const customersControlProps = {
    ...props,
    UIComponent: ChatContactListUI,
    isSearchByUserEmail: true,
    isSearchByUserPhone: true,
    isSearchByUserName: true,
    defaultUserTypesSelected: props.isDriver ? [4] : [3],
    propsToFetch: ['name', 'lastname', 'photo', 'assigned_orders_count']
  }
  return (
    <UsersListController {...customersControlProps} />
  )
}
