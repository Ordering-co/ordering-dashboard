import React from 'react'
import {
  useLanguage,
  useUtils,
  BusinessBrandBUSIDetail as BusinessBrandBUSIDetailController
} from '../../../../../index'
import { NotFoundSource, Pagination, SearchBar } from '../../Shared'
import { Button, Checkbox } from '../../../styles'
import { useTheme } from 'styled-components'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import {
  BrandBUSIDetailContainer,
  SearchWrapper,
  BusinessListWrapper,
  BusinessItemContainer,
  WrapperImage,
  Image,
  BusinessName,
  NoSelectedBrand,
  SelectButtonGroup
} from './styles'

const BusinessBrandBUSIDetailUI = (props) => {
  const {
    searchValue,
    onSearch,
    businessList,
    brand,
    handleChangeCheckBox,
    handleSelectAllBusinesses,
    handleChangeBusinessPage,
    handleChangeBusinessPageSize
  } = props
  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const theme = useTheme()

  const pagination = businessList?.pagination

  return (
    <BrandBUSIDetailContainer>
      <SearchWrapper>
        <SearchBar
          search={searchValue}
          isCustomLayout
          lazyLoad
          onSearch={(value) => onSearch(value)}
          placeholder={t('SEARCH', 'Search')}
        />
      </SearchWrapper>
      {
        brand
          ? (
              businessList?.loading
                ? (
            <BusinessListWrapper>
              {
                [...Array(5).keys()].map(i => (
                  <BusinessItemContainer key={i}>
                    <Skeleton width={16} height={16} />
                    <label>
                      <WrapperImage>
                        <Skeleton className='d-flex h-100' />
                      </WrapperImage>
                      <BusinessName>
                        <Skeleton width={100} />
                      </BusinessName>
                    </label>
                  </BusinessItemContainer>
                ))
              }
            </BusinessListWrapper>
                  )
                : (
            <BusinessListWrapper>
              <SelectButtonGroup>
                <Button
                  color='secundaryDark'
                  onClick={() => handleSelectAllBusinesses(true, brand?.id)}
                >
                  {t('SELECT_ALL', 'Select all')}
                </Button>
                <Button
                  color='secundaryDark'
                  onClick={() => handleSelectAllBusinesses(false, brand?.id)}
                >
                  {t('SELECT_NONE', 'Select none')}
                </Button>
              </SelectButtonGroup>
              {
                businessList?.businesses?.length > 0
                  ? businessList.businesses.map((business, i) => (
                  <BusinessItemContainer key={i}>
                    <Checkbox
                      id={business?.id}
                      checked={business?.franchise_id === brand?.id}
                      onChange={(e) => handleChangeCheckBox(e, business.id, brand?.id)}
                    />
                    <label htmlFor={business?.id}>
                      <WrapperImage>
                        <Image bgimage={optimizeImage(business?.logo || theme.images?.dummies?.businessLogo)} />
                      </WrapperImage>
                      <BusinessName>{business?.name}</BusinessName>
                    </label>
                  </BusinessItemContainer>
                  ))
                  : (
                  <NotFoundSource />
                    )
              }
              {pagination?.total_pages > 1 && (
                <Pagination
                  currentPage={pagination?.current_page}
                  totalPages={pagination?.total_pages}
                  handleChangePage={handleChangeBusinessPage}
                  defaultPageSize={pagination?.page_size}
                  handleChangePageSize={handleChangeBusinessPageSize}
                />
              )}
            </BusinessListWrapper>
                  )
            )
          : (
          <NoSelectedBrand>{t('NO_SELECTED_BRAND', 'There is no selected brand')}</NoSelectedBrand>
            )
      }
    </BrandBUSIDetailContainer>
  )
}

export const BusinessBrandBUSIDetail = (props) => {
  const businessBrandBUSIDetailProps = {
    ...props,
    UIComponent: BusinessBrandBUSIDetailUI,
    propsToFetch: ['id', 'name', 'logo', 'franchise_id'],
    isSearchByName: true
  }
  return <BusinessBrandBUSIDetailController {...businessBrandBUSIDetailProps} />
}
