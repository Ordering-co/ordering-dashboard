import React from 'react'

import { FormWrapper } from './styles'

import { BuildApps as BuildAppsController, useLanguage } from '../../../../../index'
import { AppSettings } from './AppSettings'
import { AppContants } from './AppConstants'
import { AppImages } from './AppImages'
import { AppTheme } from './AppTheme'
import { AppCredentials } from './AppCredentials'
import { AppBuild } from './AppBuild'
import { AppFiles } from './AppFiles'
import { Alert } from '../../Shared'

export const BasicAppSettingsUI = (props) => {
  const { app, buildAppState, setBuildAppState } = props
  const [, t] = useLanguage()

  const closeAlert = () => {
    setBuildAppState({
      ...buildAppState,
      error: null,
      result: null
    })
  }

  return (
    <FormWrapper>
      <AppSettings
        app={app}
        updateProductApp={props.updateProductApp}
        updateAppValues={props.updateAppValues}
      />
      {!!app?.baseConstants?.length && (
        <AppContants
          app={app}
          constants={app?.baseConstants}
          updateContants={props.updateBaseContants}
          updateAppValues={props.updateAppValues}
          businessesList={props.businessesList}
        />
      )}
      {!!app?.baseActions?.filter(img => img?.group === 'general_images')?.length && (
        <AppImages
          app={app}
          generalImages={app?.baseActions?.filter(img => img?.group === 'general_images')}
          updateImages={props.updateBaseActions}
        />
      )}
      {!!app?.baseActions?.filter(color => color?.group === 'colors')?.length && (
        <AppTheme
          app={app}
          appTheme={app?.baseActions?.filter(color => color?.group === 'colors')}
          updateTheme={props.updateBaseActions}
          updateAppValues={props.updateAppValues}
        />
      )}
      {!!app?.baseActions?.filter(file => file?.group === 'files')?.length && (
        <AppFiles
          app={app}
          files={app?.baseActions?.filter(file => file?.group === 'files')}
          updateFiles={props.updateBaseActions}
          updateAppValues={props.updateAppValues}
        />
      )}
      <AppCredentials
        app={app}
        credentials={{
          ios: app?.ios_credentials,
          android: app?.android_credentials
        }}
        updateCredentials={props.updateProductAppCredentials}
        updateAppValues={props.updateAppValues}
      />
      {(
        !!app?.baseActions?.filter(img => img?.group === 'resources_icons')?.length ||
        !!app?.baseActions?.filter(img => img?.group === 'resources_notifications')?.length ||
        !!app?.baseActions?.filter(img => ['splash', 'android'].every(c => img?.group?.includes(c)))?.length ||
        !!app?.baseActions?.filter(img => ['splash', 'ios'].every(c => img?.group?.includes(c)))?.length
      ) && (
          <AppImages
            app={app}
            iconsImages={app?.baseActions?.filter(img => img?.group === 'resources_icons')}
            notificationsImages={app?.baseActions?.filter(img => img?.group === 'resources_notifications')}
            splashesAndroid={app?.baseActions?.filter(img => ['splash', 'android'].every(c => img?.group?.includes(c)))}
            splashesiOS={app?.baseActions?.filter(img => ['splash', 'ios'].every(c => img?.group?.includes(c)))}
            updateImages={props.updateBaseActions}
          />
      )}
      <AppBuild
        app={app}
        appId={props.appId}
        buildApp={props.buildApp}
        buildAppState={props.buildAppState}
        downloadApp={props.downloadApp}
        getBuildLogs={props.getBuildLogs}
        downloadAppState={props.downloadAppState}
        deleteCertificates={props.deleteCertificates}
      />
      <Alert
        title={t('BUILD_ERROR', 'Build error')}
        content={buildAppState.result}
        acceptText={t('ACCEPT', 'Accept')}
        open={buildAppState.error}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
      />
    </FormWrapper>
  )
}

export const BasicAppSettings = (props) => {
  const appProps = {
    ...props,
    UIComponent: BasicAppSettingsUI
  }
  return <BuildAppsController {...appProps} />
}
