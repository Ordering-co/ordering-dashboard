// redesign my-products B1 (M-MP-0x): what an app still misses before it can be built, as a pure rule.
// It is main's rule (its `checkRequieredFields`), now readable on every render: a missing list
// of constants or credentials is «nothing there», not an error.

export const BUILD_REQUIRED_FIELDS = ['name', 'description', 'package', 'version']
export const ANDROID_REQUIRED_FIELDS = [...BUILD_REQUIRED_FIELDS, 'key_alias', 'store_file']
export const IOS_REQUIRED_FIELDS = [...BUILD_REQUIRED_FIELDS, 'apple_merchant_id', 'team_id', 'api_key_id', 'api_key_issuer_id', 'api_key_file']
export const IOS_NO_MERCHANT_CODES = ['app_driver_x', 'app_business_x', 'app_kiosk_x', 'app_business_26', 'app_driver_26']

// Where each missing field is fixed.
export const FIELD_SECTION = {
  name: 'general',
  description: 'general',
  package: 'general',
  version: 'general',
  apple_merchant_id: 'constants',
  key_alias: 'credentials',
  store_file: 'credentials',
  team_id: 'credentials',
  api_key_id: 'credentials',
  api_key_issuer_id: 'credentials',
  api_key_file: 'credentials'
}

const isMissing = (value) => !value || (typeof value === 'object' && Object.keys(value).length === 0)

/**
 * @returns {{ field: string, section: string }[]} the fields the app misses for that platform, in the order of the lists.
 */
export const getMissingBuildFields = (app, platform) => {
  if (!app) return []

  let fields
  let info
  if (platform === 'ios') {
    const constants = (app.baseConstants ?? []).reduce((acc, item) => ({ ...acc, [item.code]: item.value }), {})
    fields = IOS_NO_MERCHANT_CODES.includes(app.base?.code)
      ? IOS_REQUIRED_FIELDS.filter(field => field !== 'apple_merchant_id')
      : IOS_REQUIRED_FIELDS
    info = { ...app, ...app.ios_credentials, ...constants }
  } else if (platform === 'android') {
    fields = ANDROID_REQUIRED_FIELDS
    info = { ...app, ...app.android_credentials }
  } else {
    return []
  }

  return fields
    .filter(field => isMissing(info[field]))
    .map(field => ({ field, section: FIELD_SECTION[field] }))
}
