import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  ViewList,
  Table,
  List as MenuIcon
} from 'react-bootstrap-icons'
import { useLanguage, LanguageManager as LanguageManagerController } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'

import { IconButton } from '../../../styles'
import { Select } from '../../../styles/Select'
import {
  LanguageManagerContainer,
  HeaderContainer,
  HeaderTitleContainer,
  ActionsGroup,
  TranslationManagerContainer,
  ActionGroup,
  ViewIconWrapper,
  ActionGroupWrapper,
  SelectContent,
  LanguageSelectorContainer
} from './styles'
import { SearchBar } from '../../Shared'
import { LanguageTransTable } from '../LanguageTransTable'
import { LanguageTransSpread } from '../LanguageTransSpread'
import { LanguageSelector } from '../../LanguageSelector'

import { removeQueryToUrl, addQueryToUrl } from '../../../utils'
import { productTypes } from './utils'

const LanguageManagerUI = (props) => {
  const {
    translationList,
    searchValue,
    onSearch,
    avoidExpand,
    isShowProductType,
    selectedProductType,
    handleSelectChange,
    productAvailabilityReady
  } = props

  const [{ languageList }, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [viewMode, setViewMode] = useState('table')
  const location = useLocation()

  const query = new URLSearchParams(location.search)

  const isHasManyLanguages = languageList?.filter((language) => (language.enabled))?.length > 1
  const productTypesOptions = productTypes(t)

  useEffect(() => {
    if (!isShowProductType || !productAvailabilityReady) return

    const availableProductTypes = productTypesOptions?.map(option => option.value) ?? []
    if (!availableProductTypes.length) return

    const productTypeFromQuery = query.get('product_type')
    const selectedProductTypeIsValid = availableProductTypes.includes(selectedProductType)
    const queryProductTypeIsValid = availableProductTypes.includes(productTypeFromQuery)

    const nextProductType = selectedProductTypeIsValid
      ? selectedProductType
      : queryProductTypeIsValid
        ? productTypeFromQuery
        : availableProductTypes[0]

    if (nextProductType && nextProductType !== selectedProductType) {
      handleSelectChange(nextProductType)
      return
    }

    if (nextProductType && productTypeFromQuery !== nextProductType) {
      addQueryToUrl({ product_type: nextProductType })
    }
  }, [isShowProductType, productAvailabilityReady, productTypesOptions, selectedProductType, location.search])

  return (
    <LanguageManagerContainer allowOverflow={!selectedProductType}>
      <HeaderContainer>
        <HeaderTitleContainer>
          {isCollapse && !avoidExpand && (
            <IconButton
              color='black'
              onClick={() => handleMenuCollapse(false)}
            >
              <MenuIcon />
            </IconButton>
          )}
          <h1>{t('LANGUAGE_MANAGER', 'Language Manager')}</h1>
        </HeaderTitleContainer>
        <ActionsGroup>
          {isShowProductType && isHasManyLanguages && (
            <LanguageSelectorContainer>
              <LanguageSelector />
            </LanguageSelectorContainer>
          )}
          <SearchBar
            lazyLoad
            search={searchValue}
            onSearch={(value) => onSearch(value)}
            placeholder={t('SEARCH', 'Search')}
          />
        </ActionsGroup>
      </HeaderContainer>
      <TranslationManagerContainer>
        {isShowProductType && productTypesOptions?.length > 1 && (
          <SelectContent>
            <Select
              defaultValue={selectedProductType}
              options={productTypesOptions}
              onChange={(typeValue) => handleSelectChange(typeValue)}
              placeholder={t('SELECT_A_PRODUCT', 'Select a product')}
            />
          </SelectContent>
        )}
        {((isShowProductType && !!selectedProductType) || !isShowProductType) && !translationList.loading && (
          <>
            <ActionGroupWrapper>
              <ActionGroup>
                <ViewIconWrapper
                  className='table-mode'
                  active={viewMode === 'table'}
                  onClick={() => setViewMode('table')}
                >
                  <ViewList />
                </ViewIconWrapper>
                <ViewIconWrapper
                  active={viewMode === 'spread'}
                  onClick={() => {
                    setViewMode('spread')
                    removeQueryToUrl(['page', 'pageSize'])
                  }}
                >
                  <Table />
                </ViewIconWrapper>
              </ActionGroup>
            </ActionGroupWrapper>
            {
              viewMode === 'table' && (
                <LanguageTransTable
                  {...props}
                />
              )
            }
            {
              viewMode === 'spread' && (
                <LanguageTransSpread {...props} />
              )
            }
          </>
        )}
      </TranslationManagerContainer>
    </LanguageManagerContainer>
  )
}

export const LanguageManager = (props) => {
  const languageManagerProps = {
    ...props,
    UIComponent: LanguageManagerUI
  }
  return <LanguageManagerController {...languageManagerProps} />
}
