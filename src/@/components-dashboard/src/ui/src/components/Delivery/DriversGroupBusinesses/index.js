import React from 'react'
import { useLanguage } from '../../../../../index'
import { useForm } from 'react-hook-form'

import { Checkbox, Button } from '../../../styles'
import { Pagination, SearchBar } from '../../Shared'

import {
  Container,
  SearchBarWrapper,
  ButtonGroup,
  BusinessesContainer,
  BusinessWrapper,
  WrapperImage,
  Image,
  SkeletonWrapper,
  SkeletonContainer
} from './styles'
import Skeleton from 'react-loading-skeleton'
import { PaginationWrapper } from '../../../styles/MultiSelect/styles'

export const DriversGroupBusinesses = (props) => {
  const {
    driversGroupState,
    businesses,
    handleSelectBusiness,
    actionState,
    changesState,
    handleUpdateDriversGroup,
    handleAddDriversGroup,
    handleSelectAllBusiness,
    selectedBusinessIds,
    actionDisabled,
    businessesLoading,
    searchBusinesses,
    handleChangeBusinessPage,
    handleChangeBusinessPageSize,
    businessesPaginationProps
  } = props

  const [, t] = useLanguage()
  const { handleSubmit } = useForm()

  const onSubmit = () => {
    if (driversGroupState.driversGroup) {
      handleUpdateDriversGroup(changesState)
    } else {
      handleAddDriversGroup()
    }
  }

  return (
    <Container
      data-tour='tour_select_business'
      onSubmit={handleSubmit(onSubmit)}
      disabled={actionDisabled}
    >
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
      </BusinessesContainer>
      <Button
        borderRadius='8px'
        color='primary'
        disabled={Object.keys(changesState).length === 0}
      >
        {driversGroupState.driversGroup ? t('SAVE', 'Save') : t('ADD', 'Add')}
      </Button>
    </Container>
  )
}
