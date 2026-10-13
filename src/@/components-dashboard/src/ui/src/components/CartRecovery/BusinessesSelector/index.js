import React, { useEffect, useState } from 'react'
import {
  useLanguage
} from '../../../../../index'
import { MultiSelect } from '../../../styles'
import {
  Option,
  PlaceholderTitle,
  OptionContent,
  OptionName,
  OptionCategory,
  WrapperBusinessImage,
  BusinessImage
} from './styles'

const PAGE_SIZE = 10

export const BusinessesSelector = (props) => {
  const {
    filterValues,
    businessesList,
    handleChangeBusinesses
  } = props

  const [, t] = useLanguage()
  const [businessTypes, setBusinessTypes] = useState([])
  const [searchValue, setSearchValue] = useState(null)
  const [paginationProps, setPaginationProps] = useState({ currentPage: 1, pageSize: PAGE_SIZE })

  const Placeholder = <PlaceholderTitle>{t('SELECT_BUSINESS', 'Select business')}</PlaceholderTitle>
  const businessesLoading = [{ value: 'default', content: <Option>{t('BUSINESSES_LOADING', 'Businesses loading')}...</Option> }]

  useEffect(() => {
    if (businessesList.loading) return

    const _businesses = searchValue
      ? businessesList.businesses.filter((business) => (`${business?.id ?? ''}${business?.name ?? ''}`).toLowerCase().includes(searchValue.toLowerCase()))
      : businessesList.businesses

    const _businessesOption = _businesses.map((business) => {
      return {
        value: business.id,
        content: (
          <Option>
            <WrapperBusinessImage>
              {business.logo && <BusinessImage bgimage={business.logo} />}
            </WrapperBusinessImage>
            <OptionContent>
              <OptionName>
                {business.name}
              </OptionName>
              <OptionCategory>
                {business?.alcohol && t('ALCOHOL', 'Alcohol')}
                {business?.food && t('FOOD', 'Food')}
                {business?.groceries && t('GROCERIES', 'Groceries')}
                {business?.laundry && t('LAUNDRY', 'Laundry')}
              </OptionCategory>
            </OptionContent>
          </Option>
        )
      }
    })

    setBusinessTypes(_businessesOption)
  }, [businessesList, searchValue])

  const totalPages = Math.max(1, Math.ceil(businessTypes.length / paginationProps.pageSize))

  const pagination = {
    currentPage: paginationProps.currentPage,
    pageSize: paginationProps.pageSize,
    totalPages
  }

  const handleChangeSearch = (search) => {
    setSearchValue(search || null)
    setPaginationProps((prev) => ({ ...prev, currentPage: 1 }))
  }

  const handleChangePage = (page) => {
    setPaginationProps((prev) => ({ ...prev, currentPage: page }))
  }

  const handleChangePageSize = (pageSize) => {
    setPaginationProps({ currentPage: 1, pageSize })
  }

  return (
    <>
      {!businessesList.loading
        ? (
        <MultiSelect
          isShowSearchBar
          searchBarIsCustomLayout
          searchBarIsNotLazyLoad
          searchBarPlaceholder={t('SEARCH', 'Search')}
          searchValue={searchValue}
          handleChangeSearch={handleChangeSearch}
          defaultValue={filterValues.businessIds}
          placeholder={Placeholder}
          options={businessTypes}
          optionInnerMargin='10px'
          optionInnerMaxHeight='150px'
          optionBottomBorder
          pagination={pagination}
          handleChangePage={handleChangePage}
          handleChangePageSize={handleChangePageSize}
          onChange={(business) => handleChangeBusinesses(business)}
        />
          )
        : (
        <MultiSelect
          defaultValue='default'
          options={businessesLoading}
          optionInnerMargin='10px'
          optionInnerMaxHeight='150px'
          optionBottomBorder
        />
          )}
    </>
  )
}
