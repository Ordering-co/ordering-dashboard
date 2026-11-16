import React, { useEffect, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { useTheme } from 'styled-components'
import { MultiSelect } from '../../../styles/MultiSelect'
import { SelectOptionContent } from '../../Shared/UI/SelectOption'
import { useSelectSurface } from '../../Shared/UI/selectPlacement'

import {
  Option,
  OptionContent,
  DriverNameContainer,
  WrapperDriverImage,
  DriverImage,
  DriverName,
  PlaceholderTitle
} from './styles'

export const AdminsSelector = (props) => {
  const {
    adminsList,
    defaultValue,
    small,
    padding,
    handleChangeAdmin,
    filterValues
  } = props

  const [, t] = useLanguage()
  const theme = useTheme()
  const [adminsMultiOptionList, setAdminsMultiOptionList] = useState([])
  const [searchValue, setSearchValue] = useState(null)
  // redesign F2 (C18): inside the orders surfaces an administrator is a round picture of 20px and the name, in a
  // list that scrolls instead of paging; outside them the legacy rows.
  const c18 = !!useSelectSurface().fitTrigger
  const adminsLoading = [{ value: 'default', content: c18 ? <span>{t('LOADING', 'loading')}...</span> : <Option small={small}>{t('LOADING', 'loading')}...</Option> }]
  const Placeholder = c18 ? t('SELECT_ADMINISTRATOR', 'Select the administrator') : <PlaceholderTitle>{t('SELECT_ADMINISTRATOR', 'Select the administrator')}</PlaceholderTitle>
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
      totalPages: Math.ceil(adminsMultiOptionList?.length / pageSize)
    })
  }

  useEffect(() => {
    if (!adminsList?.loading && adminsList?.admins?.length > 0) {
      let _adminList
      if (searchValue) {
        _adminList = adminsList?.admins?.filter(admin => (admin.name + admin.lastname).toLocaleLowerCase().includes(searchValue.toLocaleLowerCase()))
      } else {
        _adminList = adminsList?.admins
      }
      const _adminsOptionListTemp = _adminList?.map((admin, i) => {
        if (c18) {
          const name = `${admin?.name ?? ''} ${admin?.lastname ?? ''}`.trim()
          const media = { kind: 'person', name, src: admin.photo }
          return {
            value: admin.id,
            showDisable: true,
            content: <SelectOptionContent label={name} media={media} />
          }
        }
        return {
          value: admin.id,
          showDisable: true,
          content: (
            <Option small={small} padding={padding}>
              <WrapperDriverImage small={small} className='driver-photo'>
                <DriverImage bgimage={admin.photo || theme.images.icons?.noDriver} small={small} />
              </WrapperDriverImage>
              <OptionContent>
                <DriverNameContainer className='driver-info'>
                  <DriverName small={small}>{admin?.name} {admin?.lastname}</DriverName>
                </DriverNameContainer>
              </OptionContent>
            </Option>
          )
        }
      })

      setAdminsMultiOptionList(_adminsOptionListTemp)
    }
  }, [adminsList, defaultValue, searchValue, c18])

  useEffect(() => {
    if (adminsMultiOptionList?.length) {
      setPagination(prevPagination => ({
        ...prevPagination,
        totalItems: adminsMultiOptionList?.length,
        totalPages: Math.ceil(adminsMultiOptionList?.length / prevPagination.pageSize)
      }))
    }
  }, [adminsMultiOptionList])

  return (
    <>
      {!adminsList?.loading
        ? (
        <MultiSelect
          defaultValue={filterValues.administratorIds}
          placeholder={Placeholder}
          options={adminsMultiOptionList}
          optionInnerMargin='10px'
          optionInnerMaxHeight='150px'
          onChange={(admin) => handleChangeAdmin(admin)}
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
          defaultValue='default'
          options={adminsLoading}
          optionInnerMargin='10px'
          optionInnerMaxHeight='150px'
          className='driver-select'
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
