import React from 'react'
import { useLanguage, AnalyticsBusinessFilter as AnalyticsBusinessFilterController } from '../../../../../index'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { CheckSquareFill as Checked, Square as UnChecked } from 'react-bootstrap-icons'
import { SearchBar, Pagination } from '../../Shared'
import { Button } from '../../../styles'
import {
  AnalyticsBusinessFilterContainer,
  BusinessFilterOption,
  BusinessName,
  FilterBtnWrapper,
  SearchWrapper
} from './styles'

const AnalyticsBusinessFilterUI = (props) => {
  const {
    businessList,
    businessIds,
    handleChangeBusinessId,
    handleClickFilterButton,
    isAllCheck,
    handleChangeAllCheck,
    handleChangeBusinessPage,
    handleChangeBusinessPageSize,
    searchValue,
    onSearch
  } = props

  const [, t] = useLanguage()

  const pagination = businessList?.pagination

  return (
    <>
      <AnalyticsBusinessFilterContainer>
        <SearchWrapper>
          <SearchBar
            search={searchValue}
            isCustomLayout
            lazyLoad
            onSearch={(value) => onSearch(value)}
            placeholder={t('SEARCH', 'Search')}
          />
        </SearchWrapper>
        {businessList.loading
          ? (
              [...Array(10).keys()].map(i => (
            <BusinessFilterOption key={i}>
              <Skeleton width={18} height={18} />
              <BusinessName>
                <Skeleton width={120} height={24} />
              </BusinessName>
            </BusinessFilterOption>
              ))
            )
          : (
          <div>
            {businessList?.businesses?.length > 0 && (
              <BusinessFilterOption
                onClick={handleChangeAllCheck}
              >
                {isAllCheck
                  ? (
                  <Checked className='fill' />
                    )
                  : (
                  <UnChecked />
                    )}
                <BusinessName>{t('ALL', 'All')}</BusinessName>
              </BusinessFilterOption>
            )}
            {businessList?.businesses?.map((business, i) => (
              <BusinessFilterOption
                key={i}
                onClick={() => handleChangeBusinessId(business?.id)}
              >
                {businessIds?.includes(business.id)
                  ? (
                  <Checked className='fill' />
                    )
                  : (
                  <UnChecked />
                    )}
                <BusinessName>{business?.name}</BusinessName>
              </BusinessFilterOption>
            ))}
            {pagination?.total_pages > 1 && (
              <Pagination
                currentPage={pagination?.current_page}
                totalPages={pagination?.total_pages}
                handleChangePage={handleChangeBusinessPage}
                defaultPageSize={pagination?.page_size}
                handleChangePageSize={handleChangeBusinessPageSize}
              />
            )}
          </div>
            )}
      </AnalyticsBusinessFilterContainer>
      <FilterBtnWrapper>
        <Button
          borderRadius='7.6px'
          color='primary'
          disabled={businessList.loading}
          onClick={handleClickFilterButton}
        >
          {t('FILTER', 'Filter')}
        </Button>
      </FilterBtnWrapper>
    </>
  )
}

export const AnalyticsBusinessFilter = (props) => {
  const AnalyticsBusinessFilterProps = {
    ...props,
    propsToFetch: ['id', 'name', 'slug', 'franchise_id'],
    isSearchByName: true,
    UIComponent: AnalyticsBusinessFilterUI
  }
  return <AnalyticsBusinessFilterController {...AnalyticsBusinessFilterProps} />
}
