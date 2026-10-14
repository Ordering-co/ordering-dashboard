import React, { useState, useEffect } from 'react'
import { useLanguage, useUtils } from '../../../../../index'
import { useTheme } from 'styled-components'
import { DefaultSelect as Select } from '../../../styles'
import { SelectBusinessProducts } from './SelectBusinessProducts'
import {
  ProductLinkContainer,
  FormController,
  SelectWrapper,
  Option
} from './styles'

export const ProductLink = (props) => {
  const {
    businessList,
    searchValue,
    onSearch,
    handleChangeBusinessPage,
    selectedBusiness,
    selectedBusinessId,
    setSelectedBusinessId,
    selectedProductId,
    setSelectedProductId,
    selectedCategoryId,
    setSelectedCategoryId
  } = props

  const theme = useTheme()
  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()

  const [businessOptions, setBusinessOptions] = useState([])

  const pagination = businessList?.pagination && {
    currentPage: businessList.pagination.current_page,
    pageSize: businessList.pagination.page_size,
    totalPages: businessList.pagination.total_pages
  }

  useEffect(() => {
    if (businessList.loading) return
    const businesses = [...businessList.businesses]
    const isSelectedMissing = selectedBusiness && !businesses.some(business => business.id === selectedBusiness.id)
    if (isSelectedMissing && !searchValue) businesses.unshift(selectedBusiness)
    const _businessOptions = businesses.map(business => {
      return {
        value: business.id,
        content: (
          <Option>
            <img src={optimizeImage(business?.logo || theme.images?.dummies?.businessLogo, 'h_50,c_limit')} alt='' />
            <span><b>{business?.name}</b>{business?.city?.name}</span>
          </Option>
        )
      }
    })
    setBusinessOptions(_businessOptions)
  }, [businessList, selectedBusiness])

  return (
    <ProductLinkContainer>
      <FormController>
        <label>{t('MOBILE_BUSINESS_LIST_SELECT_RESTAURANT', 'Select Business')}</label>
        <SelectWrapper>
          <Select
            defaultValue={selectedBusinessId}
            placeholder={t('MOBILE_BUSINESS_LIST_SELECT_RESTAURANT', 'Select Business')}
            options={businessOptions}
            onChange={val => setSelectedBusinessId(val)}
            optionInnerMaxHeight='300px'
            isShowSearchBar
            searchBarPlaceholder={t('SEARCH', 'Search')}
            searchValue={searchValue}
            handleChangeSearch={onSearch}
            pagination={pagination}
            handleChangePage={handleChangeBusinessPage}
            isLoading={businessList.loading}
            optionSkeletonHeight={25}
          />
        </SelectWrapper>
      </FormController>

      {selectedBusiness?.slug && selectedBusiness?.id === selectedBusinessId && (
        <>
          <SelectBusinessProducts
            slug={selectedBusiness.slug}
            selectedProductId={selectedProductId}
            setSelectedProductId={setSelectedProductId}
            selectedCategoryId={selectedCategoryId}
            setSelectedCategoryId={setSelectedCategoryId}
          />
        </>
      )}
    </ProductLinkContainer>
  )
}
