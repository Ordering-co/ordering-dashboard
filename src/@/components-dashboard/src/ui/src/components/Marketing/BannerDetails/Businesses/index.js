import React from 'react'
import { useLanguage } from '../../../../../../index'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

import { Checkbox, Button } from '../../../../styles'
import { SearchBar, Pagination } from '../../../Shared'

import {
  Container,
  SearchBarWrapper,
  ButtonGroup,
  BusinessesContainer,
  BusinessWrapper,
  WrapperImage,
  Image
} from './styles'

export const Businesses = (props) => {
  const {
    isAddMode,
    businessList,
    handleSelectBusiness,
    actionState,
    handleSelectAllBusiness,
    selectedBusinessIds,
    handleUpdateClick,
    searchBusinesses,
    handleChangeBusinessPage
  } = props

  const [, t] = useLanguage()
  const pagination = businessList?.pagination

  const onSaveBusinesses = () => {
    handleUpdateClick && handleUpdateClick({
      businesses: selectedBusinessIds
    })
  }

  return (
    <Container>
      <SearchBarWrapper>
        <SearchBar
          placeholder={t('SEARCH', 'Search')}
          isCustomLayout
          lazyLoad
          onSearch={val => searchBusinesses?.(val)}
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
        {businessList.loading
          ? (
              [...Array(10).keys()].map(index => (
            <BusinessWrapper key={index}>
              <Skeleton width={20} height={20} />
              <WrapperImage>
                <Skeleton width={40} height={40} />
              </WrapperImage>
              <p><Skeleton width={80} /></p>
            </BusinessWrapper>
              ))
            )
          : (
              businessList?.businesses?.map(business => (
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
              ))
            )}
      </BusinessesContainer>
      {pagination?.total_pages > 1 && (
        <Pagination
          currentPage={pagination?.current_page}
          totalPages={pagination?.total_pages}
          handleChangePage={handleChangeBusinessPage}
          isHidePagecontrol
        />
      )}
      {!isAddMode && (
        <Button
          type='button'
          color='primary'
          disabled={actionState.loading || selectedBusinessIds.length === 0}
          onClick={() => onSaveBusinesses()}
        >
          {t('SAVE', 'Save')}
        </Button>
      )}
    </Container>
  )
}
