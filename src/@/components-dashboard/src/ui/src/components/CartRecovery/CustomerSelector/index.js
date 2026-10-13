import React, { useMemo } from 'react'
import {
  useLanguage,
  UsersList as UsersListController
} from '../../../../../index'
import { MultiSelect } from '../../../styles'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import {
  Option,
  PlaceholderTitle,
  OptionContent,
  OptionName,
  WrapperBusinessImage,
  BusinessImage
} from './styles'

const CustomerSelectorUI = (props) => {
  const {
    cartFilterValues,
    handleChangeCustomers,
    usersList,
    paginationProps,
    getUsers,
    searchValue,
    onSearch
  } = props

  const [, t] = useLanguage()

  const Placeholder = <PlaceholderTitle>{t('SELECT_A_CUSTOMER', 'Select a customer')}</PlaceholderTitle>
  const customersLoading = [...Array(5).keys()].map((i) => ({
    value: 'default',
    content: (
      <Option>
        <WrapperBusinessImage>
          <Skeleton width={30} height={30} borderRadius={6} style={{ display: 'block' }} />
        </WrapperBusinessImage>
        <OptionContent>
          <OptionName>
            <Skeleton width={120} height={14} />
          </OptionName>
        </OptionContent>
      </Option>
    )
  }))

  // Build options synchronously so there is no empty-options frame when the
  // users finish loading (that frame made the filter modal jump its scroll).
  const customerTypes = useMemo(() => {
    if (usersList.loading) return []

    return usersList.users.map((user) => {
      return {
        value: user.id,
        content: (
          <Option>
            <WrapperBusinessImage>
              {user.photo && <BusinessImage bgimage={user.photo} />}
            </WrapperBusinessImage>
            <OptionContent>
              <OptionName>
                {user.name} {user.lastname}
              </OptionName>
            </OptionContent>
          </Option>
        )
      }
    })
  }, [usersList])

  const pagination = {
    currentPage: paginationProps?.currentPage,
    pageSize: paginationProps?.pageSize,
    totalPages: paginationProps?.totalPages
  }

  const handleChangePage = (page) => {
    getUsers(page, paginationProps?.pageSize)
  }

  const handleChangePageSize = (pageSize) => {
    getUsers(1, pageSize)
  }

  return (
    <MultiSelect
      isShowSearchBar
      searchBarIsCustomLayout
      searchBarPlaceholder={t('SEARCH', 'Search')}
      defaultValue={cartFilterValues.customerIds}
      placeholder={Placeholder}
      options={usersList.loading ? customersLoading : customerTypes}
      optionInnerMargin='10px'
      optionInnerMaxHeight='150px'
      optionBottomBorder
      isLoading={usersList.loading}
      useLazyPagination
      pagination={pagination}
      handleChangePage={handleChangePage}
      handleChangePageSize={handleChangePageSize}
      searchValue={searchValue}
      handleChangeSearch={onSearch}
      onChange={(customer) => handleChangeCustomers(customer)}
    />
  )
}

export const CustomerSelector = (props) => {
  const customerSelectorProps = {
    ...props,
    UIComponent: CustomerSelectorUI,
    defaultUserTypesSelected: [3],
    propsToFetch: ['name', 'lastname', 'photo'],
    isSearchByUserId: true,
    isSearchByUserName: true,
    paginationSettings: {
      initialPage: 1,
      pageSize: 10,
      controlType: 'pages'
    }
  }
  return <UsersListController {...customerSelectorProps} />
}
