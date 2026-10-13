import React, { useState } from 'react'
import { Download as DownloadIcon } from 'react-bootstrap-icons'
import QRCode from 'react-qr-code'

import { useLanguage, useUtils } from '../../../../../index'
import {
  AppBuildButtons,
  BuildBlock,
  BuildBoldText,
  BuildContainer,
  ButtonCustom,
  InputFormWrapper,
  QRContainer,
  StatusText,
  UpdatedAppBar,
  UpdatedAppContainer,
  UpdatedAppContent
} from './styles'

import { buildUtilities } from './utils'
import { Button } from '../../../styles'
import { capitalize } from '../../../utils'
import { Alert } from '../../Shared'

export const AppBuild = (props) => {
  const {
    app,
    appId,
    buildApp,
    buildAppState,
    getBuildLogs,
    downloadApp,
    downloadAppState,
    sendAppToStore,
    deleteCertificates
  } = props

  const availableStatus = ['successful', 'failed', 'error_request']
  const typeDictionary = {
    'ad-hoc': 'Test',
    'app-store': 'Pro',
    release: 'Pro',
    debug: 'Test'
  }

  const [, t] = useLanguage()
  const [{ parseDate }] = useUtils()
  const {
    buildButtons,
    isAppUpdated,
    getQRs,
    buildStatus,
    buildStatusText,
    androidRequieredFields,
    iosRequieredFields,
    textRequieredFields,
    excludeMerchantId
  } = buildUtilities()

  const [fieldsRequiered, setFieldsRequiered] = useState({ open: false, content: [] })

  const closeAlert = () => {
    setFieldsRequiered({ open: false, content: [] })
  }

  const environmentList = app.base.platforms.sort().map(platform => {
    const build = app.builds.find(b => b.platform === platform)
    return {
      env: platform,
      status: buildStatusText(isAppUpdated(build?.app_version, app.version)),
      buttons: buildButtons.filter(btn => btn.typ.includes(platform)),
      qr: getQRs({ platform, appId, builtApps: app.built_apps }),
      status_build: buildStatus(build?.status),
      status_build_text: build?.status,
      details: {
        version: app.version ?? '-',
        build_version: build?.app_version ?? '-',
        package: app.package ?? '-',
        type: build?.mode ?? '-',
        job: build?.job_id ?? '-',
        last_build: build?.updated_at ? parseDate(build?.updated_at) : '-'
      },
      error: {
        error_code: build?.error_code,
        error_description: build?.error_description
      }
    }
  })

  const checkRequieredFields = (env, btn) => {
    if (!props?.app) return
    const appInfo = props?.app
    const missingFields = []
    const checkFields = (fields, info) => {
      fields.forEach(field => {
        if (!info[field] || (typeof info[field] === 'object' && Object.keys(info[field]).length === 0)) {
          missingFields.push(textRequieredFields[field] ?? field)
        }
      })
    }

    if (env === 'ios') {
      let _iosRequieredFields = [...iosRequieredFields]

      if (excludeMerchantId.includes(appInfo?.base?.code)) {
        _iosRequieredFields = iosRequieredFields.filter(field => field !== 'apple_merchant_id')
      }
      checkFields(_iosRequieredFields, {
        ...appInfo,
        ...appInfo.ios_credentials,
        ...appInfo.baseConstants.reduce((acc, item) => ({ ...acc, [item.code]: item.value }), {})
      })
    }
    if (env === 'android') {
      checkFields(androidRequieredFields, {
        ...appInfo,
        ...appInfo.android_credentials
      })
    }
    if (missingFields.length !== 0) {
      setFieldsRequiered({ open: true, content: missingFields })
      return
    }
    buildApp({
      appId: appInfo.id,
      platform: env,
      mode: btn?.mode?.[env] ?? btn.mode,
      ...(env !== 'ios' && { type: btn.type })
    })
  }

  return (
    <InputFormWrapper>
      <h4 style={{ marginTop: 5 }}>{t('BUILD_APPS', 'Build Apps')}</h4>
      <h4 style={{ marginTop: 10 }}>{app.name}</h4>
      {!!app.description && (
        <span id='light-text'>{app.description}</span>
      )}

      {environmentList.map(env => (
        <React.Fragment key={env.env}>
          <h4 style={{ marginTop: 40 }}>{t(env.env.toUpperCase(), capitalize(env.env))}</h4>
          {env.status_build?.icon && (
            <StatusText color={env.status_build.color}>
              <span>{env.status_build.value}</span>
              {env.status_build.icon}
              {env.status_build_text === 'failed' && (
                <>
                  <Button
                    color='primary'
                    borderRadius='8px'
                    style={{ height: 44 }}
                    onClick={() => getBuildLogs({ platform: env.env })}
                  >
                    {t('SEE_LOGS', 'See Logs')}
                  </Button>
                  <Button
                    color='primary'
                    borderRadius='8px'
                    style={{ height: 44 }}
                    onClick={() => deleteCertificates({ platform: env.env })}
                  >
                    {t('DELETE_CERTIFICATES', 'Delete certificates')}
                  </Button>
                  {(env.error.error_code || env.error.error_description) && (
                    <div className='error-code'>
                      {env.error.error_code && <p>{t('ERROR_CODE', 'Error code')}: {env.error.error_code}</p>}
                      {env.error.error_description && <p>{t('ERROR_DESCRIPTION', 'Error description')}: {env.error.error_description}</p>}
                    </div>
                  )}
                </>
              )}
            </StatusText>
          )}
          <UpdatedAppContainer>
            <UpdatedAppBar color={env.status.color} />
            <UpdatedAppContent>
              <p>{env.status.title}</p>
              <p
                dangerouslySetInnerHTML={{
                  __html:
                    env.status.subtitle
                      .replace(/\b(Build Pro|Build Test|Store)\b/g, (keyword) => `<b>${keyword}</b>`)
                }
                }
              />
            </UpdatedAppContent>
          </UpdatedAppContainer>
          <QRContainer>
            {env.qr.filter(qr => qr?.qr || qr?.zip).map((qr, i) => (
              <div key={i} style={{ height: 'auto', maxWidth: 156, width: '100%' }}>
                {qr?.typeText
                  ? (
                  <p id='typeText'>{qr.typeText}</p>
                    )
                  : (
                  <div className='invisible-margin'/>
                    )}
                {qr?.qr && (
                  <QRCode
                    size={256}
                    style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                    value={qr.url}
                    viewBox={'0 0 256 256'}
                  />
                )}
                {qr.zip && (
                  <ButtonCustom
                    onClick={() => downloadApp({ type: qr.type, url: qr.url, appName: app?.name, ext: qr.ext })}
                    disabled={downloadAppState.loading && downloadAppState?.type === qr.type}
                  >
                    {downloadAppState.loading && downloadAppState?.type === qr.type
                      ? <p className='loader'>{t('LOADING', 'Loading')}</p>
                      : (
                        <>
                          <p>{qr.text ?? t('DOWNLOAD_APP_FILE', 'Download')}</p>
                          <DownloadIcon />
                        </>)}
                  </ButtonCustom>
                )}
              </div>
            ))}
          </QRContainer>
          <BuildContainer>
            {Object.keys(env.details).map((prop, i) => (
              <BuildBlock key={i}>
                <BuildBoldText>{typeDictionary?.[env.details[prop]] ?? env.details[prop]}</BuildBoldText>
                <span>{capitalize(prop).replace('_', ' ')}</span>
              </BuildBlock>
            ))}
          </BuildContainer>
          <AppBuildButtons>
            {env.buttons.map((btn, i) => (
              <Button
                key={i}
                color='primary'
                borderRadius='8px'
                disabled={
                  buildAppState.loading ||
                  (app.builds?.some(b => b.platform === env.env.toLowerCase()) &&
                    !availableStatus.includes(app.builds.find(b => b.platform === env.env.toLowerCase())?.status))
                }
                onClick={() => checkRequieredFields(env?.env?.toLowerCase(), btn)}
              >
                {btn.text}
              </Button>
            ))}
          </AppBuildButtons>
          {env.env === 'android' && sendAppToStore && (
            <Button
              color='secundary'
              borderRadius='8px'
              disabled={buildAppState.loading}
              style={{ height: 44 }}
              onClick={() => sendAppToStore()}
            >
              {t('BUILD_STORE_WITH_KEYS', 'Store (Add keys and files)')}
            </Button>
          )}
        </React.Fragment>
      ))}

      <Alert
        title={t('REQUIERED_FIELDS', 'Requiered Fields')}
        content={fieldsRequiered.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={fieldsRequiered.open}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
      />
    </InputFormWrapper>
  )
}
