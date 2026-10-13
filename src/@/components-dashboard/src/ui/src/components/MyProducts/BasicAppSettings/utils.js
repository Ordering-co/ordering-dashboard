import React from 'react'
import { useLanguage, useApi } from '../../../../../index'
import { useTheme } from 'styled-components'
import {
  Check2 as CheckIcon,
  ExclamationTriangleFill as WarningIcon,
  XCircle as CancelIcon
} from 'react-bootstrap-icons'
import { capitalize } from '../../../utils'

/**
 * The `utilities` function in the JavaScript code provides utility functions related to app building,
 * version checking, and status display.
 * @returns The `utilities` function is returning an object with three properties: `buildButtons`,
 * `isAppUpdated`, `getQRs`, and `buildStatus`.
 */

export const buildUtilities = () => {
  const [, t] = useLanguage()
  const [ordering] = useApi()
  const theme = useTheme()

  const requieredFields = ['name', 'description', 'package', 'version']
  const androidRequieredFields = [...requieredFields, 'key_alias', 'store_file']
  const iosRequieredFields = [...requieredFields, 'apple_merchant_id', 'team_id', 'api_key_id', 'api_key_issuer_id', 'api_key_file']
  const excludeMerchantId = ['app_driver_x', 'app_business_x', 'app_kiosk_x', 'app_business_26', 'app_driver_26']

  const textRequieredFields = {
    name: t('NAME', 'Name'),
    description: t('DESCRIPTION', 'Description'),
    package: t('PACKAGE', 'Package'),
    version: t('VERSION', 'Version'),
    key_alias: t('KEY_ALIAS', 'Key alias'),
    store_file: t('STORE_FILE', 'Store file'),
    apple_merchant_id: t('APPLE_MERCHANT_ID', 'Apple merchant id'),
    team_id: t('TEAM_ID', 'Team id'),
    api_key_id: t('API_KEY_ID', 'Api key id'),
    api_key_issuer_id: t('API_KEY_ISSUER_ID', 'Api key issuer id'),
    api_key_file: t('API_KEY_FILE', 'Api key file')
  }

  const isAppUpdated = (buildVer, appVer) => {
    if (!buildVer || !appVer) return buildVer ?? appVer ?? 0
    const oldParts = buildVer.split('.')
    const newParts = appVer.split('.')
    for (let i = 0; i < newParts.length; i++) {
      const a = ~~newParts[i]
      const b = ~~oldParts[i]
      if (a > b) return appVer
      if (a < b) return 1
    }
    return 1
  }

  const buildButtons = [
    { typ: 'android/ios', text: t('BUILD_PRO', 'Build PRO'), mode: { ios: 'app-store', android: 'release' }, type: 'assemble' },
    { typ: 'android/ios', text: t('BUILD_TEST', 'Build Test'), mode: { ios: 'ad-hoc', android: 'debug' }, type: 'assemble' },
    { typ: 'android', text: t('BUILD_AAB_PRO', 'Build AAB PRO'), mode: 'release', type: 'bundle' },
    { typ: 'android', text: t('BUILD_AAB_DEBUG', 'Build AAB Debug'), mode: 'debug', type: 'bundle' }
  ]

  const getQRs = ({ platform, appId, builtApps }) => {
    const urlToDownload = `${ordering.root}/builder/apps/${appId}/downloads`
    const list = {
      android: [
        { url: `${urlToDownload}/android/release/apk`, type: 'pro', typeText: t('MODE_PRO', 'Mode Pro'), ext: '.apk', zip: builtApps?.android?.release?.assemble?.zip, qr: builtApps?.android?.release?.assemble?.apk },
        { url: `${urlToDownload}/android/debug/apk`, type: 'test', typeText: t('MODE_TEST', 'Mode Test'), ext: '.apk', zip: builtApps?.android?.debug?.assemble?.zip, qr: builtApps?.android?.debug?.assemble?.apk },
        { url: `${urlToDownload}/android/release/aab`, text: t('DOWNLOAD_ANDROID_AAB', 'Download .AAB'), type: 'aabpro', ext: '.aab', zip: builtApps?.android?.release?.bundle?.zip, qr: builtApps?.android?.release?.bundle?.aab },
        { url: `${urlToDownload}/android/debug/aab`, text: t('DOWNLOAD_ANDROID_AAB', 'Download .AAB'), type: 'aabdebug', ext: '.aab', zip: builtApps?.android?.debug?.bundle?.zip, qr: builtApps?.android?.debug?.bundle?.aab }
      ],
      ios: [
        { url: `${urlToDownload}/ios/app-store/ipa`, type: 'iospro', typeText: t('MODE_PRO', 'Mode Pro'), ext: '.ipa', qr: builtApps?.ios?.['app-store']?.ipa, zip: builtApps?.ios?.['app-store']?.ipa },
        { url: `${urlToDownload}/ios/ad-hoc/ipa`, type: 'iostest', typeText: t('MODE_TEST', 'Mode Test'), ext: '.ipa', qr: builtApps?.ios?.['ad-hoc']?.ipa, zip: builtApps?.ios?.['ad-hoc']?.ipa }
      ]
    }
    return list[platform]
  }

  const buildStatus = (val) => {
    if (!val) return null

    const items = {
      successful: { icon: <CheckIcon color={theme.colors.success} />, color: theme.colors.success },
      pending: { icon: <WarningIcon color={theme.colors.warning} />, color: theme.colors.warning },
      queued: { icon: <WarningIcon color={theme.colors.warning} />, color: theme.colors.warning },
      building: { icon: <WarningIcon color={theme.colors.warning} />, color: theme.colors.warning },
      finishing: { icon: <WarningIcon color={theme.colors.warning} />, color: theme.colors.warning },
      failed: { icon: <CancelIcon color={theme.colors.danger} />, color: theme.colors.danger }
    }

    return {
      icon: items[val]?.icon,
      color: items[val]?.color,
      value: t(val.toUpperCase(), capitalize(val))
    }
  }

  const buildStatusText = (val) => {
    const appV = val !== 1 && val !== 0 ? val : 0
    const status = {
      1: {
        color: theme.colors.success,
        title: t('YOUR_APP_IS_UPDATED', 'Your app is updated'),
        subtitle: t('CLICK_OPTIONS_BUILD', 'Click Build Pro, Build Test or Store to re-build.')
      },
      0: {
        color: theme.colors.warning,
        title: t('NEW_VERSION_AVAILABLE', 'New version (:version) is available:').replace(':version', appV),
        subtitle: t('CLICK_OPTIONS_BUILD', 'Click Build Pro, Build Test or Store to re-build.')
      }
    }
    return status[val] ?? status[0]
  }

  return {
    isAppUpdated,
    buildStatus,
    buildButtons,
    getQRs,
    buildStatusText,
    androidRequieredFields,
    iosRequieredFields,
    textRequieredFields,
    excludeMerchantId
  }
}

export const credentialsUtilities = () => {
  const formatInputName = (name) => capitalize(name.replace(/_/g, ' '))

  const CREDENTIALINPUTS = [
    {
      platform: 'ios',
      inputs: [
        { name: 'team_id', type: 'text' },
        { name: 'itc_team_id', type: 'text' },
        { name: 'api_key_id', type: 'text' },
        { name: 'api_key_issuer_id', type: 'text' },
        { name: 'api_key_file', type: 'file', accept: '.p8,.txt' }
      ]
    },
    {
      platform: 'android',
      inputs: [
        { name: 'key_alias', type: 'text' },
        { name: 'key_password', type: 'text' },
        { name: 'store_file', type: 'file', accept: '.jks' },
        { name: 'store_password', type: 'text' },
        { name: 'playstore_credential_file', type: 'file', accept: '.json' }
      ]
    }
  ]

  const roundSizeBToKB = (number, decimalPlaces = 1) => {
    const factor = 10 ** decimalPlaces
    const roundedNumber = Math.round(number * factor) / factor
    return roundedNumber
  }

  const formatPlatformName = (platform) => {
    const platforms = { android: 'Android', ios: 'iOS' }
    return platforms[platform]
  }

  const extractFileExtensions = (inputString) => {
    if (!inputString) return null
    const extensions = inputString.split(',')
    return extensions.map(extension => extension.trim().replace('.', ''))
  }

  return {
    formatInputName,
    CREDENTIALINPUTS,
    roundSizeBToKB,
    formatPlatformName,
    extractFileExtensions
  }
}

export const imagesUtilities = () => {
  const base64ToBlob = ({ img }) => {
    const base64String = img.split(',')[1]
    const mimeString = img.split(',')[0].split(':')[1].split(';')[0]
    const byteCharacters = atob(base64String)
    const byteArrays = []
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArrays.push(byteCharacters.charCodeAt(i))
    }
    const byteArray = new Uint8Array(byteArrays)
    return new Blob([byteArray], { type: mimeString })
  }

  return {
    base64ToBlob
  }
}

export const constantsUtilities = () => {
  const typeDictionary = {
    string: 'text',
    integer: 'number',
    decimal: 'number',
    boolean: 'checkbox',
    json: 'textarea'
  }

  return {
    typeDictionary
  }
}
