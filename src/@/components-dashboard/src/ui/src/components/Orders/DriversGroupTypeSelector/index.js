import React, { useState, useEffect, useContext } from 'react'
import { useLanguage } from '../../../../../index'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'
import { MultiSelect } from '../../../styles/MultiSelect'

import { PlaceholderTitle, Option, GroupId } from './styles'

export const DriversGroupTypeSelector = (props) => {
  const {
    driverGroupList,
    filterValues,
    handleChangeGroup,
    title,
    ariaLabel
  } = props

  const [{ dictionary }, t] = useLanguage()
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
        // redesign F6d-1 (P4-04): a group is found by its name or by its id number (the label «ID» is not searched).
        .filter(option => option?.name.toLocaleLowerCase().includes(searchValue.toLocaleLowerCase()) ||
          String(option?.id).includes(searchValue.trim()))
        .map((group) => {
          return {
            value: group.id,
            name: group.name,
            // redesign F6d-1 (P4-04): `main` wrote «34. Name»; Q2-04 dropped the id because a bare «34» read like a
            // count. It comes back as a labelled, muted «ID 34» after the name.
            content: (
              <Option>
                <span>{group.name}</span>
                <GroupId data-group-id=''>{t('ID', 'ID')} {group.id}</GroupId>
              </Option>
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
          ariaLabel={ariaLabel ?? t('DRIVER_GROUP', 'Driver group')}
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
          ariaLabel={ariaLabel ?? t('DRIVER_GROUP', 'Driver group')}
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
