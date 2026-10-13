import React, { useState, useEffect, useContext } from 'react'
import { useLanguage } from '../../../../../index'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'
import { MultiSelect } from '../../../styles/MultiSelect'

import { PlaceholderTitle, Option } from './styles'

export const DriversGroupTypeSelector = (props) => {
  const {
    driverGroupList,
    filterValues,
    handleChangeGroup,
    title
  } = props

  const [{ dictionary }] = useLanguage()
  const [searchValue, setSearchValue] = useState('')
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 5,
    totalItems: null,
    totalPages: null
  })
  const [configFile] = useContext(ConfigFileContext)
  const prefixForVariable = configFile.app_internal_name.toUpperCase()
  const placeholder = (
    <PlaceholderTitle>
      {title}
    </PlaceholderTitle>
  )
  const [groupTypes, setGroupTypes] = useState([])
  const groupTypesLoading = [{ value: 'default', content: <Option>{dictionary?.[`${prefixForVariable}_GROUP_LOADING` ?? 'GROUP_LOADING'] ?? 'Group loading'}...</Option> }]

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
      totalPages: Math.ceil(groupTypes?.length / pageSize)
    })
  }

  useEffect(() => {
    const _groupList = []
    if (!driverGroupList.loading) {
      const _groupsOption = driverGroupList.groups
        .filter(option => option?.name.toLocaleLowerCase().includes(searchValue.toLocaleLowerCase()))
        .map((group) => {
          return {
            value: group.id,
            content: (
              <Option>{group.id}. {group.name}</Option>
            )
          }
        })

      for (const option of _groupsOption) {
        _groupList.push(option)
      }
    }
    setGroupTypes(_groupList)
    setPagination({
      ...pagination,
      totalItems: _groupList?.length,
      totalPages: Math.ceil(_groupList?.length / pagination.pageSize)
    })
  }, [driverGroupList, searchValue])

  return (
    <>
      {!driverGroupList.loading
        ? (
        <MultiSelect
          placeholder={placeholder}
          defaultValue={filterValues}
          options={groupTypes}
          onChange={(groupType) => handleChangeGroup(groupType)}
          isShowSearchBar
          searchBarIsCustomLayout
          searchBarIsNotLazyLoad
          searchValue={searchValue}
          handleChangeSearch={(val) => setSearchValue(val)}
          isHidePagecontrol
          pagination={pagination}
          handleChangePage={handleChangePage}
          handleChangePageSize={handleChangePageSize}
        />
          )
        : (
        <MultiSelect
          defaultValue='default'
          options={groupTypesLoading}
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
