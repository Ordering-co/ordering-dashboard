import React, { useEffect, useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { List as MenuIcon, GearFill } from 'react-bootstrap-icons'
import { useLanguage, useEvent, Settings as SettingsController } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { IconButton } from '../../../styles'
import { SettingsDetail } from '../SettingsDetail'
import { SettingsList } from '../SettingsList'

import {
  Container,
  CategoryContainer,
  HeaderTitleContainer,
  LoyaltyItemWrapper,
  IconWrapper,
  LoyaltyItemContent
} from './styles'
import { learnOptionsValues } from '../../../utils'
import { LearnDropDown } from '../../Shared'

const FilterSettingsUI = (props) => {
  const {
    categoryList,
    allowOptions,
    pageURL,
    title,
    externalShowOption,
    closeSidebars,
    isShowOnlyList,
    isShowOnlyDetails,
    configsToHide
  } = props

  const [events] = useEvent()
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()

  const history = useHistory()
  const query = new URLSearchParams(useLocation().search)

  const [selectedCategory, setSelectedCategory] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showOption, setShowOption] = useState(null)

  const learnOptions = learnOptionsValues([], t)

  const handleOptionClick = (key, isInitialRender) => {
    setShowOption(key)
    if (!isInitialRender) {
      history.replace(`${location.pathname}?id=${key}`)
    }
  }
  const handleBackRedirect = () => {
    setShowDetail(false)
    setSelectedCategory(null)
    history.replace(`${location.pathname}`)
  }

  const onBasicSettingsRedirect = ({ category }) => {
    if (!category) {
      return events.emit('go_to_page', { page: pageURL, replace: true })
    }
    if (category) {
      events.emit('go_to_page', {
        page: pageURL,
        search: `?category=${category}`,
        replace: true
      })
    }
  }

  const handleOpenSetting = (category, initialRender) => {
    closeSidebars && closeSidebars()
    if (Array.isArray(configsToHide) && Array.isArray(category?.configs) && configsToHide.length) {
      const configs = category?.configs?.filter((config) => (!configsToHide.includes(config?.key)))
      category.configs = configs
    }
    setSelectedCategory(category)
    setShowOption(category.key)
    setShowDetail(true)
    if (!initialRender) {
      history.replace(`${location.pathname}?category=${category?.id}`)
    }
  }

  useEffect(() => {
    const id = query.get('id')
    if (id) {
      handleOptionClick(id, true)
    }
  }, [])

  useEffect(() => {
    if (categoryList.loading) return
    const categoryId = query.get('category')
    if (categoryId) {
      const categorySelected = categoryList?.categories.find(item => item?.id === parseInt(categoryId))
      if (categorySelected) {
        handleOpenSetting(categorySelected, true)
      }
    }
  }, [categoryList.loading])

  useEffect(() => {
    if (externalShowOption) {
      setShowDetail(false)
    }
  }, [externalShowOption])

  return (
    <>
      {!isShowOnlyList
        ? (
          <>
            {isShowOnlyDetails
              ? (
                <SettingsList
                  {...props}
                  category={{
                    ...categoryList?.categories[0],
                    configs: categoryList?.categories[0]?.configs?.filter(config => !configsToHide?.includes(config.key))
                  }}
                  onCloseSettingsList={() => (null)}
                  isRemoveGeneralTitle
                />
                )
              : (
                <Container>
                  <HeaderTitleContainer>
                    {isCollapse && (
                      <IconButton
                        color='black'
                        onClick={() => handleMenuCollapse(false)}
                      >
                        <MenuIcon />
                      </IconButton>
                    )}
                    <h1>{title ?? t('CONFIG', 'Config')}
                    </h1>
                    <LearnDropDown
                      learnOptions={learnOptions}
                    />
                  </HeaderTitleContainer>
                  <CategoryContainer>
                    {!categoryList?.loading && (
                      <>
                        {categoryList?.categories?.filter(item => (allowOptions.includes(item.key) || allowOptions.length === 0)).map(setting => (
                          <LoyaltyItemWrapper
                            key={setting?.id}
                            onClick={() => handleOpenSetting(setting)}
                          >
                            <IconWrapper>
                              {setting?.image ? <img src={setting?.image} /> : <GearFill />}
                            </IconWrapper>
                            <LoyaltyItemContent>
                              <h5>{setting?.name}</h5>
                              <p>{setting?.description}</p>
                            </LoyaltyItemContent>
                          </LoyaltyItemWrapper>
                        ))}
                      </>
                    )}

                    {categoryList?.loading && (
                      <>
                        {[...Array(2).keys()].map(i => (
                          <LoyaltyItemWrapper
                            key={i}
                          >
                            <IconWrapper>
                              <Skeleton width={24} height={24} />
                            </IconWrapper>
                            <LoyaltyItemContent>
                              <h5><Skeleton height={18} width={120} /></h5>
                              <p><Skeleton height={13} count={2} /></p>
                            </LoyaltyItemContent>
                          </LoyaltyItemWrapper>
                        ))}
                      </>
                    )}
                  </CategoryContainer>
                </Container>
                )
            }
          </>
          )
        : (
          <>
            {!categoryList?.loading && (
              <>
                {categoryList?.categories?.filter(item => (allowOptions.includes(item.key) || allowOptions.length === 0)).map(setting => (
                  <LoyaltyItemWrapper
                    key={setting?.id}
                    onClick={() => handleOpenSetting(setting)}
                  >
                    <IconWrapper>
                      {setting?.image ? <img src={setting?.image} /> : <GearFill />}
                    </IconWrapper>
                    <LoyaltyItemContent>
                      <h5>{setting?.name}</h5>
                      <p>{setting?.description}</p>
                    </LoyaltyItemContent>
                  </LoyaltyItemWrapper>
                ))}
              </>
            )}

            {categoryList?.loading && (
              <>
                {[...Array(2).keys()].map(i => (
                  <LoyaltyItemWrapper
                    key={i}
                  >
                    <IconWrapper>
                      <Skeleton width={24} height={24} />
                    </IconWrapper>
                    <LoyaltyItemContent>
                      <h5><Skeleton height={18} width={120} /></h5>
                      <p><Skeleton height={13} count={2} /></p>
                    </LoyaltyItemContent>
                  </LoyaltyItemWrapper>
                ))}
              </>
            )}
          </>
          )}

      {showDetail && (allowOptions.includes(showOption) || allowOptions.length === 0) && (
        <SettingsDetail
          {...props}
          open={showDetail}
          category={selectedCategory}
          onClose={handleBackRedirect}
          onBasicSettingsRedirect={onBasicSettingsRedirect}
        />
      )}
    </>
  )
}

export const FilterSettings = (props) => {
  const filterSettingsProps = {
    ...props,
    UIComponent: FilterSettingsUI
  }

  return (
    <SettingsController {...filterSettingsProps} />
  )
}
