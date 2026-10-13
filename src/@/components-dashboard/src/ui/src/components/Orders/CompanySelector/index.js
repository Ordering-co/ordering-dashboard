import React, { useEffect, useState } from 'react'
import { useLanguage, DriversList as CompanysController } from '../../../../../index'
import { useTheme } from 'styled-components'
import { Select } from '../../../styles/Select'
import { Select as FirstSelect } from '../../../styles/Select/FirstSelect'
import { MultiSelect } from '../../../styles/MultiSelect'

import { CompanySelectorContainer } from '../OrderContactInformation/styles'
import {
  shouldShowDriverCompanyBlock,
  shouldShowDriverCompanyPicker
} from './shouldShowDriverCompanyBlock'
import {
  Option,
  OptionContent,
  CompanyNameContainer,
  WrapperCompanyImage,
  CompanyImage,
  CompanyName,
  CompanyText,
  PlaceholderTitle
} from './styles'

const CompanySelectorUI = (props) => {
  const {
    isFirstSelect,
    order,
    company,
    companysList,
    defaultValue,
    isPhoneView,
    isFilterView,
    small,
    padding,
    orderView,
    handleAssignDriverCompany,
    handleChangeCompany,
    filterValues,
    isTourOpen,
    setCurrentTourStep,
    handleOpenMessages
  } = props

  const [, t] = useLanguage()
  const theme = useTheme()
  const [defaultOption, setDefaultOption] = useState(null)
  const [companysOptionList, setCompanysOptionList] = useState([])
  const [companyssMultiOptionList, setCompanysMultiOptionList] = useState([])
  const [searchValue, setSearchValue] = useState(null)
  const companysLoading = [{ value: 'default', content: <Option small={small}>{t('LOADING', 'loading')}...</Option> }]

  useEffect(() => {
    const _companysOptionList = [
      {
        value: 'default',
        content: (
          <Option
            padding={orderView ? padding : '0px'}
          >
            {orderView
              ? (
              <>
                <WrapperCompanyImage small={small} className='driver-photo'>
                  <CompanyImage bgimage={company?.logo || theme?.images?.icons?.noDriver} small={small} />
                </WrapperCompanyImage>
                <OptionContent>
                  <CompanyNameContainer className='driver-info'>
                    <CompanyName small={small}>{t('NO_COMPANY', 'No Company')}</CompanyName>
                  </CompanyNameContainer>
                </OptionContent>
              </>
                )
              : (
              <span>{t('SELECT_COMPANY', 'Select company')}</span>
                )}
          </Option>
        ),
        color: 'primary',
        disabled: !isFilterView,
        showDisable: true
      }
    ]
    if (!isFilterView) {
      _companysOptionList.push({
        value: 'remove',
        content: (
          <Option isRemove><span>{t('REMOVE_COMPANY', 'Remove assigned company')}</span></Option>
        ),
        disabled: defaultValue === 'default'
      })
    }
    if (!companysList?.loading) {
      const availableCompanies = Array.isArray(companysList?.companys) ? companysList.companys : []
      let _companysList
      if (searchValue) {
        _companysList = availableCompanies.filter(company => (company.name).toLocaleLowerCase().includes(searchValue.toLocaleLowerCase()))
      } else {
        _companysList = availableCompanies
      }
      const _companysOptionListTemp = _companysList.map((company, i) => {
        return {
          value: company.id,
          showDisable: isFilterView ? true : !(isFilterView || !company?.busy),
          content: (
            <Option small={small} isPhoneView={isPhoneView} padding={padding} isFilterView={isFilterView}>
              <WrapperCompanyImage small={small} className='driver-photo'>
                <CompanyImage bgimage={company.logo || theme.images.icons?.noDriver} small={small} />
              </WrapperCompanyImage>
              <OptionContent>
                <CompanyNameContainer className='driver-info'>
                  <CompanyName small={small}>{company.name}</CompanyName>
                  <CompanyText small={small}>{t('COMPANY', 'Company')}</CompanyText>
                </CompanyNameContainer>
              </OptionContent>
            </Option>
          )
        }
      })

      setCompanysMultiOptionList(_companysOptionListTemp)

      for (const option of _companysOptionListTemp) {
        _companysOptionList.push(option)
      }
    }
    setCompanysOptionList(_companysOptionList)
  }, [companysList, defaultValue, searchValue])

  const changeCompany = (companyId) => {
    if (isFilterView) {
      if (companyId === 'default') {
        handleChangeCompany(null)
      } else {
        handleChangeCompany(companyId)
      }
      return
    }
    if (companyId === 'default') return
    if (companyId === 'remove') {
      companyId = null
    }
    handleAssignDriverCompany({ orderId: order.id, companyId })
    if (isTourOpen && setCurrentTourStep) {
      handleOpenMessages('chat')
      setTimeout(() => {
        isTourOpen && setCurrentTourStep && setCurrentTourStep(3)
      }, 50)
    }
  }

  useEffect(() => {
    setDefaultOption(defaultValue)
  }, [defaultValue])

  const Placeholder = <PlaceholderTitle>{t('SELECT_COMPANY', 'Select company')}</PlaceholderTitle>

  const handleSearch = (val) => {
    setSearchValue(val)
  }

  const assignedCompanyId = order?.driver_company_id ?? defaultValue
  const showBlock = shouldShowDriverCompanyBlock({
    isFilterView,
    loading: companysList?.loading,
    companies: companysList?.companys,
    assignedCompanyId
  })
  const showPicker = shouldShowDriverCompanyPicker({
    isFilterView,
    loading: companysList?.loading,
    error: companysList?.error,
    companies: companysList?.companys
  })

  if (isFilterView) {
    return (
      <>
        {!companysList.loading
          ? (
          <MultiSelect
            defaultValue={filterValues.companyIds}
            placeholder={Placeholder}
            options={companyssMultiOptionList}
            optionInnerMargin='10px'
            optionInnerMaxHeight='150px'
            onChange={(company) => handleChangeCompany(company)}
            isShowSearchBar
            searchBarIsCustomLayout
            searchBarIsNotLazyLoad
            searchValue={searchValue}
            handleChangeSearch={(val) => setSearchValue(val)}
          />
            )
          : (
          <MultiSelect
            defaultValue='default'
            options={companysLoading}
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

  if (!showBlock) {
    return null
  }

  const pickerProps = {
    defaultValue: defaultOption || 'default',
    options: companysOptionList,
    optionInnerMaxHeight: '200px',
    onChange: (companyId) => changeCompany(companyId),
    isShowSearchBar: true,
    searchBarPlaceholder: t('SEARCH', 'Search'),
    searchBarIsCustomLayout: true,
    searchBarIsNotLazyLoad: true,
    searchValue,
    handleChangeSearch: handleSearch,
    className: 'driver-select'
  }

  let companyContent = (
    <span>{order?.driver_company?.name || t('DRIVER_COMPANY', 'Driver company')}</span>
  )
  if (showPicker && isFirstSelect) {
    companyContent = <FirstSelect {...pickerProps} />
  } else if (showPicker) {
    companyContent = <Select {...pickerProps} />
  }

  return (
    <CompanySelectorContainer>
      <p>{t('DRIVER_COMPANY', 'Driver company')}</p>
      {companyContent}
    </CompanySelectorContainer>
  )
}

export const CompanySelector = (props) => {
  const CompanysControlProps = {
    ...props,
    UIComponent: CompanySelectorUI,
    propsToFetch: ['id', 'name', 'lastname', 'cellphone', 'photo']
  }
  return (
    <>
      <CompanysController {...CompanysControlProps} />
    </>
  )
}
