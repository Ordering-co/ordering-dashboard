import React from 'react'
import { useLanguage } from '../../../../../index'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { NotFoundSource } from '../../Shared'
import { SettingsSelectUI } from '../SettingsSelectUI'

import {
  SettingsListContainer,
  GeneralContainer,
  GeneralTitle,
  FormContainer,
  FormGroupText,
  SkeletonWrapper,
  ContentWrapper,
  HeaderTitleContainer,
  Content,
  CategoryName,
  Description,
  SubCategoryWrapper
} from './styles'

export const SiteSettingDetails = (props) => {
  const {
    selectedSiteId,
    siteConfigsState,
    siteGroupConfigsState,
    handleChangeConfig
  } = props

  const [, t] = useLanguage()

  return (
    <>
      <SettingsListContainer>
        <GeneralTitle>
          <p>{t('SETTINGS', 'All Settings')}</p>
        </GeneralTitle>
        {
          (siteConfigsState.loading || siteGroupConfigsState?.loading)
            ? (
            <SkeletonWrapper>
              {[...Array(6).keys()].map(i => (
                <div key={i}>
                  <Skeleton height={14} width={200} />
                  <Skeleton height={30} />
                </div>
              ))}
            </SkeletonWrapper>
              )
            : (
              <GeneralContainer>
                <FormContainer>
                  {
                    siteConfigsState.configs.length > 0 && siteGroupConfigsState?.categories?.length === 0 && siteConfigsState.configs.map((config, i) => (
                      <div key={i}>
                        {
                          config.type === 1 && (
                            <FormGroupText className='form-group'>
                              <label>{config?.name}</label>
                              <input
                                type='text'
                                defaultValue={config?.value}
                                onChange={(e) => handleChangeConfig(e.target.value, selectedSiteId, config?.id)}
                                className='form-control'
                                placeholder={config?.name}
                              />
                            </FormGroupText>
                          )
                        }
                        {
                          config.type === 2 && (
                            <SettingsSelectUI
                              config={config}
                              defaultValue={config?.value}
                              handleSelectChange={(value) => handleChangeConfig(value, selectedSiteId, config?.id)}
                            />
                          )
                        }
                        {
                          config.type === 7 && (
                            <FormGroupText className='form-group'>
                              <label>{config?.name}</label>
                              <input
                                type='password'
                                defaultValue={config?.value}
                                onChange={(e) => handleChangeConfig(e.target.value, selectedSiteId, config?.id)}
                                className='form-control'
                                placeholder={config?.name}
                              />
                            </FormGroupText>
                          )
                        }
                      </div>
                    ))
                  }
                </FormContainer>
              </GeneralContainer>
              )
        }
        {!siteGroupConfigsState?.loading && siteGroupConfigsState?.categories?.length > 0 && (
          siteGroupConfigsState?.categories.map((category, i) => (
            <div key={i} className='shadow-container'>
              <ContentWrapper className='row'>
                <HeaderTitleContainer style={{ padding: '0 20px' }}>
                  {category && (
                    <Content>
                      <CategoryName>
                        <p>{category.name}</p>
                      </CategoryName>
                      <Description>{category?.description}</Description>
                    </Content>
                  )}
                </HeaderTitleContainer>
                <SubCategoryWrapper>
                  {category.configs.length > 0 && category.configs.map((config, i) => (
                    <div key={i}>
                      {config.type === 1 && (
                          <FormGroupText className='form-group'>
                            <label>{config?.name}</label>
                            <input
                              type='text'
                              defaultValue={config?.value}
                              onChange={(e) => handleChangeConfig(e.target.value, selectedSiteId, config?.id)}
                              className='form-control'
                              placeholder={config?.name}
                            />
                          </FormGroupText>
                      )
                      }
                      {config.type === 2 && (
                          <SettingsSelectUI
                            config={config}
                            defaultValue={config?.value}
                            handleSelectChange={(value) => handleChangeConfig(value, selectedSiteId, config?.id)}
                          />
                      )
                      }
                      {config.type === 7 && (
                          <FormGroupText className='form-group'>
                            <label>{config?.name}</label>
                            <input
                              type='password'
                              defaultValue={config?.value}
                              onChange={(e) => handleChangeConfig(e.target.value, selectedSiteId, config?.id)}
                              className='form-control'
                              placeholder={config?.name}
                            />
                          </FormGroupText>
                      )
                      }
                    </div>
                  ))}
                </SubCategoryWrapper>
              </ContentWrapper>
            </div>
          ))
        )}
        {
          !siteConfigsState.loading && siteConfigsState.error && (
            <NotFoundSource
              content={t('NOT_FOUND_CONFIG', 'Sorry, we couldn\'t find the config.')}
            />
          )
        }
      </SettingsListContainer>
    </>
  )
}
