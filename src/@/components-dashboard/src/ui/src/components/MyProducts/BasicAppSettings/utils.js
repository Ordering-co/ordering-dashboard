import React from 'react'
import { useLanguage } from '../../../../../index'
import { useTheme } from 'styled-components'
import {
  Check2 as CheckIcon,
  ExclamationTriangleFill as WarningIcon,
  XCircle as CancelIcon
} from 'react-bootstrap-icons'
import { capitalize } from '../../../utils'
import {
  ANDROID_REQUIRED_FIELDS,
  IOS_NO_MERCHANT_CODES,
  IOS_REQUIRED_FIELDS
} from '../AppEditor/buildReadiness'

/**
 * The `utilities` function in the JavaScript code provides utility functions related to app building,
 * version checking, and status display.
 * @returns The `utilities` function is returning an object with `isAppUpdated`, `buildStatus`, `buildStatusText` and the lists
 * of required fields. The files of each platform and what the Build dialog offers live in AppEditor/buildTypes.js.
 */

export const buildUtilities = () => {
  const [, t] = useLanguage()
  const theme = useTheme()

  // redesign my-products B1 (M-MP-0x): the lists live in AppEditor/buildReadiness.js (same values, same names).
  const androidRequieredFields = ANDROID_REQUIRED_FIELDS
  const iosRequieredFields = IOS_REQUIRED_FIELDS
  const excludeMerchantId = IOS_NO_MERCHANT_CODES

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

  // The subtitle names the one Build button of the platform: `_button_` is filled with the button's own label (BuildsSection).
  const buildStatusText = (val) => {
    const appV = val !== 1 && val !== 0 ? val : 0
    const status = {
      1: {
        color: theme.colors.success,
        title: t('YOUR_APP_IS_UPDATED', 'Your app is updated'),
        subtitle: t('BUILD_CLICK_TO_REBUILD', 'Click _button_ to rebuild.')
      },
      0: {
        color: theme.colors.warning,
        title: t('NEW_VERSION_AVAILABLE', 'New version (:version) is available:').replace(':version', appV),
        subtitle: t('BUILD_CLICK_TO_REBUILD', 'Click _button_ to rebuild.')
      }
    }
    return status[val] ?? status[0]
  }

  return {
    isAppUpdated,
    buildStatus,
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
