import React, { useEffect, useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import {
  Image,
  WrapperImage,
  ButtonGroup,
  SearchBarWrapper,
  BusinessesContainer,
  SkeletonWrapper,
  SkeletonContainer,
  BusinessWrapper,
  PaginationWrapper
} from './styles'
import { SearchBar, Pagination } from '../../Shared'
import { Button, Checkbox } from '../../../styles'
import { useLanguage } from '../../../../../index'

export const DeliveryServiceBusinesses = (props) => {
  const {
    deliveryServiceState,
    handleSelectBusiness,
    actionState,
    handleSelectAllBusiness,
    selectedBusinessIds = [],
    businessesLoading,
    businesses = [],
    changesState = {},
    handleUpdateDeliveryGroup,
    handleAddDeliveryService
  } = props

  const [, t] = useLanguage()
  const [searchValue, setSearchValue] = useState(null)
  const [filteredBusinesses, setFilteredBusinesses] = useState([])

  const onSubmit = () => {
    if (deliveryServiceState.deliveryService) {
      handleUpdateDeliveryGroup({ business: changesState.business })
    } else {
      handleAddDeliveryService()
    }
  }

  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 10,
    totalItems: null,
    totalPages: null
  })

  const handleChangePage = (page) => {
    setPagination({
      ...pagination,
      currentPage: page
    })
  }

  const handleChangePageSize = (pageSize) => {
    const expectedPage = Math.ceil(((pagination?.currentPage - 1) * pagination?.pageSize + 1) / pageSize)
    setPagination({
      ...pagination,
      currentPage: expectedPage,
      pageSize,
      totalPages: Math.ceil(filteredBusinesses?.length / pageSize)
    })
  }

  const filterFunction = (_, index) => {
    const validation = pagination?.currentPage === 1
      ? index < (pagination.pageSize * pagination.currentPage)
      : (index >= (pagination.pageSize * (pagination.currentPage - 1))) && (index < (pagination.pageSize * pagination.currentPage))
    return validation
  }

  useEffect(() => {
    let _filteredBusinesses = []
    if (searchValue) {
      _filteredBusinesses = businesses.filter(business => business?.name?.toLowerCase().includes(searchValue?.toLowerCase()))
    } else {
      _filteredBusinesses = [...businesses]
    }
    setFilteredBusinesses(_filteredBusinesses)
    setPagination({
      ...pagination,
      currentPage: 1,
      totalItems: _filteredBusinesses?.length,
      totalPages: Math.ceil(_filteredBusinesses?.length / pagination.pageSize)
    })
  }, [searchValue, businesses])

  return (
    <>
      <SearchBarWrapper>
        <SearchBar
          placeholder={t('SEARCH', 'Search')}
          isCustomLayout
          lazyLoad
          search={searchValue}
          onSearch={val => setSearchValue(val)}
        />
      </SearchBarWrapper>
      <ButtonGroup>
        <Button
          type='button'
          color='secundaryDark'
          onClick={() => handleSelectAllBusiness(true)}
        >
          {t('SELECT_ALL', 'Select all')}
        </Button>
        <Button
          type='button'
          color='secundaryDark'
          onClick={() => handleSelectAllBusiness(false)}
        >
          {t('SELECT_NONE', 'Select none')}
        </Button>
      </ButtonGroup>
      <BusinessesContainer>
        {businessesLoading
          ? (
            <>
              {
                [...Array(9).keys()].map(i => (
                  <SkeletonWrapper key={i}>
                    <tr>
                      <td>
                        <SkeletonContainer>
                          <Skeleton width={18} height={18} />
                          <Skeleton width={35} height={35} style={{ margin: '0px 5px', borderRadius: '100%' }} />
                        </SkeletonContainer>
                      </td>
                      <td>
                        <Skeleton width={250} />
                      </td>
                    </tr>
                  </SkeletonWrapper>
                ))
              }
            </>
            )
          : (
            <>
              {filteredBusinesses.filter(filterFunction).map(business => (
                <BusinessWrapper
                  key={business.id}
                  isDisabed={actionState.loading}
                >
                  <Checkbox
                    checked={selectedBusinessIds?.includes(business.id)}
                    onChange={e => handleSelectBusiness(business.id, e.target.checked)}
                  />
                  <WrapperImage>
                    <Image bgimage={business?.logo} alt='logo' />
                  </WrapperImage>
                  <p>{business?.name}</p>
                </BusinessWrapper>
              ))}
            </>
            )
        }
        {pagination && handleChangePageSize && handleChangePage && (
          <PaginationWrapper>
            <Pagination
              currentPage={pagination?.currentPage}
              totalPages={pagination?.totalPages}
              handleChangePage={handleChangePage}
              handleChangePageSize={handleChangePageSize}
              defaultPageSize={pagination?.pageSize}
            />
          </PaginationWrapper>
        )}
        <Button
          borderRadius='8px'
          color='primary'
          onClick={onSubmit}
          disabled={!changesState?.business || actionState?.loading}
        >
          {deliveryServiceState.deliveryService ? t('SAVE', 'Save') : t('ADD', 'Add')}
        </Button>
      </BusinessesContainer>
    </>
  )
}
