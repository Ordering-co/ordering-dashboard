import React, { useEffect, useState } from 'react'
import { useLanguage, useUtils } from '../../../../../index'
import { useTheme } from 'styled-components'
import { Button } from '../../../styles/Buttons'
import { SearchBar } from '../SearchBar'
import { Pagination } from '../Pagination'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { PaginationWrapper } from '../../../styles/MultiSelect/styles'

import {
  Container,
  SearchBarWrapper,
  ButtonGroup,
  BusinessesContainer,
  BusinessWrapper,
  WrapperImage,
  Image
} from './select-businesses-styles'
import { Checkbox } from '../../../styles/Checkbox'

export const SelectBusinesses = (props) => {
  const {
    isSkeleton,
    isAddMode,
    isDisabled,
    isLocked, // redesign bugs F opt-in, freezes checkboxes and bulk buttons (isDisabled only rules Save)
    allBusinesses,
    handleSelectBusiness,
    selectedBusinessIds,
    handleSelectAllBusinesses,
    handleSelectNoneBusinesses,
    handleUpdateClick,
    handleAddClick,
    searchBusinesses,
    handleChangeBusinessPage,
    handleChangeBusinessPageSize,
    businessesPaginationProps
  } = props

  const isServerSide = !!searchBusinesses
  const theme = useTheme()
  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()

  const [searchValue, setSearchValue] = useState(null)
  const [filteredBusinesses, setFilteredBusinesses] = useState([])

  useEffect(() => {
    if (isServerSide) return
    let _filteredBusinesses = []
    if (searchValue) {
      _filteredBusinesses = allBusinesses.filter(business => business?.name?.toLowerCase().includes(searchValue?.toLowerCase()))
    } else {
      _filteredBusinesses = [...(allBusinesses || [])]
    }
    setFilteredBusinesses(_filteredBusinesses)
  }, [searchValue, allBusinesses, isServerSide])

  const displayBusinesses = isServerSide ? allBusinesses : filteredBusinesses

  return (
    <Container>
      <SearchBarWrapper>
        <SearchBar
          placeholder={t('SEARCH', 'Search')}
          isCustomLayout
          lazyLoad={isServerSide}
          search={isServerSide ? undefined : searchValue}
          onSearch={val => {
            if (isServerSide) {
              searchBusinesses(val ?? '')
            } else {
              setSearchValue(val)
            }
          }}
        />
      </SearchBarWrapper>
      <ButtonGroup>
        <Button
          color='secundaryDark'
          disabled={isLocked}
          onClick={() => handleSelectAllBusinesses()}
        >
          {t('SELECT_ALL', 'Select all')}
        </Button>
        <Button
          color='secundaryDark'
          disabled={isLocked}
          onClick={() => handleSelectNoneBusinesses()}
        >
          {t('SELECT_NONE', 'Select none')}
        </Button>
      </ButtonGroup>
      <BusinessesContainer>
        {isSkeleton
          ? (
              [...Array(10).keys()].map(i => (
            <BusinessWrapper key={i}>
              <Skeleton width={20} height={20} />
              <WrapperImage isSkeleton>
                <Skeleton width={40} height={40} />
              </WrapperImage>
              <p><Skeleton width={100} /></p>
            </BusinessWrapper>
              ))
            )
          : (
              displayBusinesses?.map(business => (
            <BusinessWrapper
              key={business.id}
            >
              <Checkbox
                aria-label={business?.name}
                checked={selectedBusinessIds.includes(business.id)}
                disabled={isLocked}
                onChange={e => handleSelectBusiness(business.id, e.target.checked)}
              />
              <WrapperImage>
                <Image bgimage={optimizeImage(business?.logo || theme.images?.dummies?.businessLogo, 'h_50,c_limit')} />
              </WrapperImage>
              <p>{business?.name}</p>
            </BusinessWrapper>
              ))
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
      <Button
        borderRadius='8px'
        color='primary'
        disabled={isDisabled}
        onClick={() => {
          isAddMode ? handleAddClick() : handleUpdateClick()
        }}
      >
        {isAddMode ? t('ADD', 'Add') : t('SAVE', 'Save')}
      </Button>
    </Container>
  )
}
