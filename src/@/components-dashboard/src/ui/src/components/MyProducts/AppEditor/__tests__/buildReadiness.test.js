// redesign my-products B1 (M-MP-0x): the build-readiness rule, pure, is main's rule (its Build tab).
import { describe, expect, it } from 'vitest'
import {
  ANDROID_REQUIRED_FIELDS,
  BUILD_REQUIRED_FIELDS,
  FIELD_SECTION,
  IOS_NO_MERCHANT_CODES,
  IOS_REQUIRED_FIELDS,
  getMissingBuildFields
} from '../buildReadiness'

const completeIos = () => ({
  name: 'Repartidores',
  description: 'App',
  package: 'com.demo.app',
  version: '1.0.0',
  base: { code: 'app_marketplace_x' },
  baseConstants: [{ code: 'apple_merchant_id', value: 'merchant.com.demo' }],
  ios_credentials: { team_id: 'T1', api_key_id: 'K1', api_key_issuer_id: 'I1', api_key_file: 'key.p8' }
})

describe('buildReadiness lists', () => {
  it('keeps main\'s required fields, in order', () => {
    expect(BUILD_REQUIRED_FIELDS).toEqual(['name', 'description', 'package', 'version'])
    expect(ANDROID_REQUIRED_FIELDS).toEqual(['name', 'description', 'package', 'version', 'key_alias', 'store_file'])
    expect(IOS_REQUIRED_FIELDS).toEqual(['name', 'description', 'package', 'version', 'apple_merchant_id', 'team_id', 'api_key_id', 'api_key_issuer_id', 'api_key_file'])
    expect(IOS_NO_MERCHANT_CODES).toEqual(['app_driver_x', 'app_business_x', 'app_kiosk_x', 'app_business_26', 'app_driver_26'])
  })

  it('places every missing field in the section where it is fixed', () => {
    expect(FIELD_SECTION).toEqual({
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
    })
  })
})

describe('getMissingBuildFields', () => {
  it('a complete iOS app misses nothing', () => {
    expect(getMissingBuildFields(completeIos(), 'ios')).toEqual([])
  })

  it('iOS without api_key_file and without the apple_merchant_id constant lists both, in order, each with its section', () => {
    const app = completeIos()
    app.baseConstants = []
    delete app.ios_credentials.api_key_file
    expect(getMissingBuildFields(app, 'ios')).toEqual([
      { field: 'apple_merchant_id', section: 'constants' },
      { field: 'api_key_file', section: 'credentials' }
    ])
  })

  it('a driver app does not ask for the merchant id', () => {
    const app = { ...completeIos(), base: { code: 'app_driver_x' }, baseConstants: [] }
    expect(getMissingBuildFields(app, 'ios')).toEqual([])
  })

  it('Android without store_file misses it in credentials', () => {
    const app = {
      ...completeIos(),
      android_credentials: { key_alias: 'alias' }
    }
    expect(getMissingBuildFields(app, 'android')).toEqual([{ field: 'store_file', section: 'credentials' }])
  })

  it('empty ios_credentials and an empty name are missing; an empty object counts as missing too', () => {
    const app = { ...completeIos(), name: '', ios_credentials: {}, baseConstants: [{ code: 'apple_merchant_id', value: {} }] }
    expect(getMissingBuildFields(app, 'ios')).toEqual([
      { field: 'name', section: 'general' },
      { field: 'apple_merchant_id', section: 'constants' },
      { field: 'team_id', section: 'credentials' },
      { field: 'api_key_id', section: 'credentials' },
      { field: 'api_key_issuer_id', section: 'credentials' },
      { field: 'api_key_file', section: 'credentials' }
    ])
  })

  it('without an app, or with an unknown platform, there is nothing to list', () => {
    expect(getMissingBuildFields(undefined, 'ios')).toEqual([])
    expect(getMissingBuildFields(null, 'android')).toEqual([])
    expect(getMissingBuildFields(completeIos(), 'web')).toEqual([])
  })

  it('does not throw when baseConstants or the credentials are null or absent', () => {
    const base = { name: 'n', description: 'd', package: 'p', version: '1' }
    expect(() => getMissingBuildFields({ ...base, baseConstants: null, ios_credentials: null }, 'ios')).not.toThrow()
    expect(() => getMissingBuildFields({ ...base, android_credentials: null }, 'android')).not.toThrow()
    expect(getMissingBuildFields({ ...base, baseConstants: null }, 'ios').map(item => item.field)).toEqual(['apple_merchant_id', 'team_id', 'api_key_id', 'api_key_issuer_id', 'api_key_file'])
    expect(getMissingBuildFields(base, 'android').map(item => item.field)).toEqual(['key_alias', 'store_file'])
  })
})
