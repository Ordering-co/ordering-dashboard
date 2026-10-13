import React, { useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

import { useLanguage, AppsController } from '../../../../../index'
import { AdvancedSettings } from '../AdvancedSettings'
import { BasicAppSettings } from '../BasicAppSettings'
import { AppLayout } from '../AppLayout'

import { BoxLayout } from '../AdvancedSettings/styles'
import {
  SettingsContainer,
  TabWrapper,
  Tabs,
  Tab
} from './styles'
import { AppsUtilities } from './utils'

const codesWithThemes = [
  'app_franchises_x', 'app_kiosk_x', 'app_marketplace_x',
  'app_franchises_26', 'app_kiosk_26', 'app_marketplace_26'
]

const AppControllerUI = (props) => {
  const {
    themesList,
    singleAppState,
    updateAppValues,
    orderingTheme,
    advancedValues,
    setAdvancedValues,
    handleUpdateSiteTheme,
    appId
  } = props

  const [, t] = useLanguage()
  const { getAppInfo } = AppsUtilities()

  const settingsList = codesWithThemes.includes(appId)
    ? [
        { key: 'basic', name: t('BASIC_SETTINGS', 'Basic Settings') },
        { key: 'advanced', name: t('ADVANCED_SETTINGS', 'Advanced Settings') }
      ]
    : []

  const [selectedSetting, setSelectedSetting] = useState('basic')

  const appInfo = singleAppState.app?.name && getAppInfo(singleAppState.app)

  const hideBuyBlocks = true

  return (
    <>
      <AppLayout appInfo={appInfo} hideBuyBlocks={hideBuyBlocks} appId={appId}>
        <SettingsContainer>
          <h2>{t('MORE_SETTINGS_FOR_YOUR', 'More settings for your')} <span>{singleAppState.app?.name}</span></h2>
          <p>{t('CUSTOMER_APP_SETTING_DESC', 'Change background, colors, fonts, style, branding and all the essentials of your brand.')}</p>
          {!!settingsList.length && (
            <TabWrapper>
              <Tabs>
                {settingsList.map(setting => (
                  <Tab
                    key={setting.key}
                    active={selectedSetting === setting.key}
                    onClick={() => setSelectedSetting(setting.key)}
                  >
                    {setting.name}
                  </Tab>
                ))}
              </Tabs>
            </TabWrapper>
          )}
          {singleAppState.loading && (
            <LoadingComponent />
          )}
          {selectedSetting === 'basic' && !singleAppState.loading && (
            <BasicAppSettings
              appId={singleAppState.app?.id}
              app={singleAppState.app}
              updateAppValues={updateAppValues}
            />
          )}
          {selectedSetting === 'advanced' && (
            <>
              {orderingTheme?.loading && (
                <LoadingComponent />
              )}
              {!orderingTheme?.loading && (
                <AdvancedSettings
                  isApp
                  isKiosk={appId === 'app_kiosk_x'}
                  isFranchise={appId === 'app_franchises_x'}
                  themesList={themesList}
                  advancedValues={advancedValues}
                  setAdvancedValues={setAdvancedValues}
                  handleUpdateSiteTheme={handleUpdateSiteTheme}
                />
              )}
            </>
          )}
        </SettingsContainer>
      </AppLayout>
    </>
  )
}

const LoadingComponent = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {[1, 2].map(i => (
        <div key={i} style={{ display: 'flex', width: '100%' }}>
          <BoxLayout>
            <h2>
              <Skeleton height={25} width={200} />
            </h2>
            <h2>
              <Skeleton height={25} width={150} />
            </h2>
            <div style={{ display: 'flex', maxWidth: '100%' }}>
              <Skeleton width={160} height={160} count={4} style={{ marginLeft: 20 }} />
            </div>
          </BoxLayout>
        </div>
      ))}
    </div>
  )
}

export const AppUI = (props) => {
  const appProps = {
    ...props,
    appId: props?.app?.base?.code,
    UIComponent: AppControllerUI
  }
  return <AppsController {...appProps} />
}
