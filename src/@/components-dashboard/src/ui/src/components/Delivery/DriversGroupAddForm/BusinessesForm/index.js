import React from 'react'
import { useLanguage } from '../../../../../../index'

import { Checkbox, Button } from '../../../../styles'
import { Pagination, SearchBar } from '../../../Shared'

import {
  Container,
  SearchBarWrapper,
  ButtonGroup,
  BusinessesContainer,
  BusinessWrapper,
  WrapperImage,
  Image,
  SkeletonContainer,
  SkeletonWrapper
} from './styles'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { PaginationWrapper } from '../../../../styles/MultiSelect/styles'

export const BusinessesForm = (props) => {
  const {
    businesses,
    handleSelectBusiness,
    actionState,
    handleSelectAllBusiness,
    selectedBusinessIds,
    businessesLoading,
    searchBusinesses,
    handleChangeBusinessPage,
    handleChangeBusinessPageSize,
    businessesPaginationProps
  } = props

  const [, t] = useLanguage()

  return (
    <Container>
      <h2>{t('BUSINESSES', 'Businesses')}</h2>
      <SearchBarWrapper>
        <SearchBar
          placeholder={t('SEARCH', 'Search')}
          isCustomLayout
          lazyLoad
          onSearch={val => searchBusinesses?.(val ?? '')}
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
            {businesses?.map(business => (
              <BusinessWrapper
                key={business.id}
                isDisabed={actionState.loading}
              >
                <Checkbox
                  checked={selectedBusinessIds.includes(business.id)}
                  onChange={e => handleSelectBusiness(business.id, e.target.checked)}
                />
                <WrapperImage>
                  <Image bgimage={business?.logo} alt='logo' />
                </WrapperImage>
                <p>{business?.name}</p>
              </BusinessWrapper>
            ))}
          </>
            )}
      </BusinessesContainer>
      {businessesPaginationProps && businessesPaginationProps?.totalPages > 1 && (
        <PaginationWrapper>
          <Pagination
            currentPage={businessesPaginationProps?.currentPage}
            totalPages={businessesPaginationProps?.totalPages}
            handleChangePage={handleChangeBusinessPage}
            handleChangePageSize={handleChangeBusinessPageSize}
            defaultPageSize={businessesPaginationProps?.pageSize}
          />
        </PaginationWrapper>
      )}
    </Container>
  )
}
