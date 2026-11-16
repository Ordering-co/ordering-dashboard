import React from 'react'
import { useLanguage } from '../../../../../../index'

import { Checkbox, Button } from '../../../../styles'
import { Pagination, SearchBar } from '../../../Shared'
import { FieldError } from '../FieldError'

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
    businessesPaginationProps,
    fieldErrors
  } = props

  const [, t] = useLanguage()
  // (P-2 of batch R): the add form's «Select at least one business.» under the list, which it describes
  const businessError = fieldErrors?.business

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
        {/* redesign D-12 (owner, 2026-10-19): the total of the selection, all pages, announced politely */}
        <span role='status'>
          {selectedBusinessIds.length === 1
            ? t('STORES_N_SELECTED_ONE', '_count_ store selected').replace('_count_', '1')
            : t('STORES_N_SELECTED_OTHER', '_count_ stores selected').replace('_count_', String(selectedBusinessIds.length))}
        </span>
      </ButtonGroup>
      {/* (review): the message sits above the list it is about, not under its pages, so Save shows it */}
      {businessError && <FieldError id={businessError.id}>{businessError.message}</FieldError>}
      <BusinessesContainer
        role={businessError ? 'group' : undefined}
        aria-label={businessError ? t('BUSINESSES', 'Businesses') : undefined}
        aria-describedby={businessError?.id}
        tabIndex={businessError ? -1 : undefined}
      >
        {businessesLoading
          ? (
          <>
            {
              [...Array(9).keys()].map(i => (
                <SkeletonWrapper key={i}>
                  <SkeletonContainer>
                    <Skeleton width={18} height={18} />
                    <Skeleton width={35} height={35} style={{ margin: '0px 5px', borderRadius: '100%' }} />
                  </SkeletonContainer>
                  <Skeleton width={250} />
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
                  id={`new-drivers-group-business-${business.id}`}
                  checked={selectedBusinessIds.includes(business.id)}
                  onChange={e => handleSelectBusiness(business.id, e.target.checked)}
                />
                <WrapperImage>
                  <Image bgimage={business?.logo} alt='logo' />
                </WrapperImage>
                <label htmlFor={`new-drivers-group-business-${business.id}`}>{business?.name}</label>
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
