import React, { useState, useEffect } from 'react'
import { useLanguage, CityList as CityListController } from '../../../../../index'
import { Select } from '../../../styles/Select/FirstSelect'
import { MultiSelect } from '../../../styles/MultiSelect'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import {
  PlaceholderTitle,
  Option
} from './styles'

const PAGE_SIZE = 5

const CitySelectorUI = (props) => {
  const {
    citiesList,
    isDefault,
    filterValues,
    defaultValue,
    handleChangeCity
  } = props

  const [cityOptions, setCityOptions] = useState([])
  const [searchValue, setSearchValue] = useState(null)
  const [paginationProps, setPaginationProps] = useState({ currentPage: 1, pageSize: PAGE_SIZE })
  const [, t] = useLanguage()
  const placeholder = <PlaceholderTitle isDefault={isDefault}>{t('SELECT_CITY', 'Select City')}</PlaceholderTitle>

  useEffect(() => {
    if (citiesList?.loading) return

    const _cities = searchValue
      ? citiesList?.cities.filter(city => (`${city?.name ?? ''}`).toLowerCase().includes(searchValue.toLowerCase()))
      : citiesList?.cities

    const _cityOptions = _cities.map(city => {
      return {
        value: city.id,
        content: <Option noPadding>{city?.name}</Option>,
        showOnSelected: <Option isDefault={isDefault}>{city?.name}</Option>
      }
    })
    setCityOptions(_cityOptions)
  }, [citiesList, isDefault, searchValue])

  const totalPages = Math.max(1, Math.ceil(cityOptions.length / paginationProps.pageSize))

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
      {citiesList?.loading
        ? (
        <div>
          <Skeleton height={44} style={{ lineHeight: 'normal' }} />
        </div>
          )
        : (
        <>
          {isDefault
            ? (
            <Select
              placeholder={placeholder}
              defaultValue={defaultValue}
              options={cityOptions}
              onChange={(city) => handleChangeCity(city)}
            />
              )
            : (
            <MultiSelect
              isShowSearchBar
              searchBarIsCustomLayout
              searchBarIsNotLazyLoad
              searchBarPlaceholder={t('SEARCH', 'Search')}
              searchValue={searchValue}
              handleChangeSearch={handleChangeSearch}
              placeholder={placeholder}
              defaultValue={filterValues?.cityIds}
              options={cityOptions}
              pagination={pagination}
              handleChangePage={handleChangePage}
              handleChangePageSize={handleChangePageSize}
              isHidePagecontrol
              onChange={(city) => handleChangeCity(city)}
            />
              )}
        </>
          )}
    </>
  )
}

export const CitySelector = (props) => {
  const cityListProps = {
    ...props,
    UIComponent: CitySelectorUI
  }
  return <CityListController {...cityListProps} />
}
