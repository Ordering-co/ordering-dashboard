import React, { useEffect, useState } from 'react'
import {
  useLanguage
} from '../../../../../index'
import { MultiSelect } from '../../../styles'
import { SelectOptionContent } from '../../Shared/UI/SelectOption'
import { useSelectSurface } from '../../Shared/UI/selectPlacement'
import {
  Option,
  PlaceholderTitle,
  OptionContent,
  OptionName,
  OptionCategory,
  WrapperBusinessImage,
  BusinessImage
} from './styles'

export const BusinessesSelector = (props) => {
  const {
    filterValues,
    businessesList,
    handleChangeBusinesses,
    ariaLabel
  } = props

  const [, t] = useLanguage()
  // redesign F2 (C18): inside the orders surfaces a business is a rounded-square logo of 20px, its name and its
  // categories as a muted second column, in a list that scrolls instead of paging; outside them the legacy rows.
  const c18 = !!useSelectSurface().fitTrigger
  const [businessTypes, setBusinessTypes] = useState([])
  const [searchValue, setSearchValue] = useState('')
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 5,
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
      totalPages: Math.ceil(businessTypes?.length / pageSize)
    })
  }

  const Placeholder = c18 ? t('SELECT_BUSINESS', 'Select business') : <PlaceholderTitle>{t('SELECT_BUSINESS', 'Select business')}</PlaceholderTitle>
  const businessesLoading = [{ value: 'default', content: c18 ? <span>{t('BUSINESSES_LOADING', 'Businesses loading')}...</span> : <Option>{t('BUSINESSES_LOADING', 'Businesses loading')}...</Option> }]

  useEffect(() => {
    const _businessesOptionList = []
    if (!businessesList.loading) {
      const _businessesOption = businessesList.businesses
        .filter(option => option?.name.toLocaleLowerCase().includes(searchValue.toLocaleLowerCase()))
        .map((business) => {
          if (c18) {
            const media = { kind: 'business', name: business.name, src: business.logo }
            const categories = [
              business?.alcohol && t('ALCOHOL', 'Alcohol'),
              business?.food && t('FOOD', 'Food'),
              business?.groceries && t('GROCERIES', 'Groceries'),
              business?.laundry && t('LAUNDRY', 'Laundry')
            ].filter(Boolean).join(', ')
            return {
              value: business.id,
              content: <SelectOptionContent label={business.name} media={media} meta={categories} />,
              showOnSelected: <SelectOptionContent label={business.name} media={media} />
            }
          }
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

      for (const option of _businessesOption) {
        _businessesOptionList.push(option)
      }
    }

    setBusinessTypes(_businessesOptionList)
  }, [businessesList, searchValue, c18])

  useEffect(() => {
    if (businessTypes?.length) {
      setPagination(prevPagination => ({
        ...prevPagination,
        totalItems: businessTypes?.length,
        totalPages: Math.ceil(businessTypes?.length / prevPagination.pageSize)
      }))
    }
  }, [businessTypes])

  return (
    <>
      {!businessesList.loading
        ? (
        <MultiSelect
          ariaLabel={ariaLabel ?? t('BUSINESS', 'Business')}
          defaultValue={filterValues.businessIds}
          placeholder={Placeholder}
          options={businessTypes}
          optionInnerMargin='10px'
          optionInnerMaxHeight='150px'
          optionBottomBorder
          onChange={(business) => handleChangeBusinesses(business)}
          isShowSearchBar
          searchBarIsCustomLayout
          searchBarIsNotLazyLoad
          searchValue={searchValue}
          handleChangeSearch={(val) => setSearchValue(val)}
          isHidePagecontrol
          pagination={c18 ? undefined : pagination}
          handleChangePage={c18 ? undefined : handleChangePage}
          handleChangePageSize={c18 ? undefined : handleChangePageSize}
        />
          )
        : (
        <MultiSelect
          ariaLabel={ariaLabel ?? t('BUSINESS', 'Business')}
          defaultValue='default'
          options={businessesLoading}
          optionInnerMargin='10px'
          optionInnerMaxHeight='150px'
          optionBottomBorder
          isShowSearchBar
          searchBarIsCustomLayout
          searchBarIsNotLazyLoad
          searchValue={searchValue}
          handleChangeSearch={(val) => setSearchValue(val)}
        />
          )}
    </>
  )
}
