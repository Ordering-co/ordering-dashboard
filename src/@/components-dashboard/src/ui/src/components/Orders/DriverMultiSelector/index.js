import React, { useEffect, useState, useContext } from 'react'
import { useTheme } from 'styled-components'

import { useLanguage, DriversList as DriversController } from '../../../../../index'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'
import { MultiSelect } from '../../../styles/MultiSelect'

import {
  Option,
  OptionContent,
  DriverNameContainer,
  WrapperDriverImage,
  DriverImage,
  DriverName,
  DriverText,
  PlaceholderTitle
} from './styles'

const DriverMultiSelectorUI = (props) => {
  const {
    driversList,
    defaultValue,
    small,
    padding,
    handleChangeDriver,
    filterValues,
    useTextStyle,
    hideChevronIcon,
    andText,
    textClassnames,
    pagination,
    handleChangePage,
    handleChangePageSize,
    useDriversByProps,
    setSearchValue,
    searchValue,
    optionsPosition
  } = props

  const [{ dictionary }] = useLanguage()
  const theme = useTheme()
  const [driversMultiOptionList, setDriversMultiOptionList] = useState([])
  const [configFile] = useContext(ConfigFileContext)
  const prefixForVariable = configFile.app_internal_name.toUpperCase()
  const driversLoading = [{
    value: 'default',
    content: <Option small={small}>{dictionary?.[`${prefixForVariable}_LOADING` ?? 'LOADING'] ?? 'loading'}...</Option>,
    showOnSelected: useTextStyle ? dictionary?.[`${prefixForVariable}_LOADING` ?? 'LOADING'] ?? 'loading' : null
  }]

  useEffect(() => {
    const _driversOptionList = [
      {
        value: 'default',
        content: <Option padding='0px'><span>{dictionary?.[`${prefixForVariable}_SELECT_DRIVER` ?? 'SELECT_DRIVER'] ?? 'Select driver'}</span></Option>,
        color: 'primary',
        showDisable: true,
        showOnSelected: useTextStyle ? (dictionary?.[`${prefixForVariable}_SELECT_DRIVER` ?? 'SELECT_DRIVER'] ?? 'Select driver') : null
      }
    ]
    if (!driversList.loading) {
      const _driverList = searchValue
        ? driversList.drivers.filter(driver => (driver.name + driver.lastname).toLocaleLowerCase().includes(searchValue.toLocaleLowerCase()))
        : driversList.drivers

      const _driversOptionListTemp = _driverList.map(driver => {
        return {
          value: driver.id,
          showDisable: true,
          showOnSelected: (
            <Option small padding={padding}>
              <WrapperDriverImage small className='driver-photo'>
                <DriverImage bgimage={driver.photo || theme.images.icons?.noDriver} small />
              </WrapperDriverImage>
              <OptionContent>
                <DriverNameContainer className='driver-info'>
                  <DriverName small={small}>{driver.name}</DriverName>
                </DriverNameContainer>
              </OptionContent>
            </Option>
          ),
          content: (
            <Option small={small} padding={padding}>
              <WrapperDriverImage small={small} className='driver-photo'>
                <DriverImage bgimage={driver.photo || theme.images.icons?.noDriver} small={small} />
              </WrapperDriverImage>
              <OptionContent>
                <DriverNameContainer className='driver-info'>
                  <DriverName small={small}>{driver.name} {driver.lastname}</DriverName>
                  <DriverText small={small}>{dictionary?.[`${prefixForVariable}_DRIVER` ?? 'DRIVER'] ?? 'Driver'}</DriverText>
                </DriverNameContainer>
              </OptionContent>
            </Option>
          )
        }
      })

      setDriversMultiOptionList(_driversOptionListTemp)

      for (const option of _driversOptionListTemp) {
        _driversOptionList.push(option)
      }
    }
  }, [driversList, defaultValue, searchValue])

  const Placeholder = <PlaceholderTitle>{dictionary?.[`${prefixForVariable}_SELECT_DRIVER` ?? 'SELECT_DRIVER'] ?? 'Select driver'}</PlaceholderTitle>

  return (
    <MultiSelect
      isShowSearchBar
      searchBarIsCustomLayout
      optionInnerMargin='10px'
      optionInnerMaxHeight='150px'
      defaultValue={(!driversList.loading || (!useDriversByProps && pagination))
        ? driversList.loading && !useDriversByProps ? 'loading' : filterValues.driverIds
        : 'default'
      }
      options={(!driversList.loading || (!useDriversByProps && pagination))
        ? driversList.loading && !useDriversByProps ? driversLoading : driversMultiOptionList
        : driversLoading
      }
      {...(!(!driversList.loading || (!useDriversByProps && pagination)) && { className: 'driver-select' })}
      {...((!driversList.loading || (!useDriversByProps && pagination)) && {
        isLoading: driversList.loading,
        useLazyPagination: !useDriversByProps,
        placeholder: Placeholder,
        optionsPosition,
        pagination,
        onChange: (driver) => handleChangeDriver(driver),
        handleChangePage,
        handleChangePageSize
      })}
      isLoading={driversList.loading}
      andText={andText}
      useTextStyle={useTextStyle}
      hideChevronIcon={hideChevronIcon}
      searchValue={searchValue}
      searchBarIsNotLazyLoad={useDriversByProps}
      textClassnames={textClassnames}
      handleChangeSearch={(val) => setSearchValue(val)}
    />
  )
}

export const DriverMultiSelector = (props) => {
  const DriversControlProps = {
    ...props,
    UIComponent: DriverMultiSelectorUI,
    disableDriverLocationsSockets: true,
    paginationSettings: {
      initialPage: 1,
      pageSize: 10,
      controlType: 'pages'
    },
    propsToFetch: ['id', 'name', 'lastname', 'cellphone', 'photo']
  }
  return <DriversController {...DriversControlProps} />
}
