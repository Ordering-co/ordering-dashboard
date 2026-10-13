import { describe, expect, it } from 'vitest'

import {
  formatFileRules,
  getAppFieldError,
  getBuildErrorMessage,
  getBuildKind,
  getCheckProblems,
  getCredentialsErrorMessage,
  getFileErrorMessage,
  getFileGroups,
  getMissingCredentialsText,
  getPlatformBuilds,
  getPlatformRows,
  getSettingGroupLabel,
  getStatusLabel,
  getTypeLabel,
  getValueErrorMessage,
  sortCatalogBases
} from '../utils'

const app = {
  id: 310,
  name: 'Repartidores',
  description: 'Driver app',
  version: '0.0.1',
  package: 'com.miproyecto.k3x9a',
  base: { id: 14, name: 'Driver 26', platforms: ['ios', 'android'] },
  platforms: [
    { platform: 'android', name: 'Repartidores Android', description: null, version: '0.0.2', package: null }
  ],
  builds: [
    { platform: 'android', mode: 'release', status: 'failed', error_code: null, app_version: '0.0.2' }
  ]
}

describe('Builder utils', () => {
  it('gives every base platform a row and inherits the app values', () => {
    const [ios, android] = getPlatformRows(app)
    expect(ios).toEqual({
      platform: 'ios',
      customized: false,
      ownFields: { name: false, description: false, version: false, package: false },
      name: 'Repartidores',
      description: 'Driver app',
      version: '0.0.1',
      package: 'com.miproyecto.k3x9a',
      lastBuild: null
    })
    // An edited platform keeps its values; its empty fields take the app's
    expect(android).toMatchObject({
      platform: 'android',
      customized: true,
      name: 'Repartidores Android',
      description: 'Driver app',
      version: '0.0.2',
      package: 'com.miproyecto.k3x9a'
    })
    expect(android.lastBuild.status).toBe('failed')
  })

  it('returns no rows without an app', () => {
    expect(getPlatformRows(null)).toEqual([])
  })

  it('lists each platform with its last build status for the list icons', () => {
    expect(getPlatformBuilds(app)).toEqual([
      { platform: 'ios', status: null },
      { platform: 'android', status: 'failed' }
    ])
  })

  it('groups build statuses into four looks', () => {
    expect(getBuildKind(null)).toBe('never')
    expect(getBuildKind('successful')).toBe('success')
    expect(getBuildKind('failed')).toBe('failed')
    expect(['pending', 'queued', 'building', 'finishing'].map(getBuildKind)).toEqual(['progress', 'progress', 'progress', 'progress'])
  })

  it('explains known build error codes and falls back to the generic message', () => {
    expect(getBuildErrorMessage('build_timed_out')).toBe('The build took too long and was stopped.')
    expect(getBuildErrorMessage('missing_credentials')).toMatch(/Upload it again in Credentials/)
    expect(getBuildErrorMessage('invalid_distribution_certificate')).toMatch(/Apple Developer portal/)
    expect(getBuildErrorMessage(null)).toBe('Build failed. Check the logs.')
    expect(getBuildErrorMessage('build_failed')).toBe('Build failed. Check the logs.')
  })

  it('labels types and statuses, and shows an unknown value as is', () => {
    expect(getTypeLabel('driver_app')).toBe('Driver app')
    expect(getTypeLabel('call_center')).toBe('call_center')
    expect(getStatusLabel('archived')).toBe('Archived')
  })

  it('orders catalog bases by product type', () => {
    const bases = [
      { id: 14, product_type: 'driver_app' },
      { id: 11, product_type: 'marketplace_app' },
      { id: 12, product_type: 'store_app' },
      { id: 15, product_type: 'store_app' }
    ]
    expect(sortCatalogBases(bases).map(base => base.id)).toEqual([11, 12, 15, 14])
  })
})

describe('Builder edit helpers', () => {
  it('turns checks into rows: warnings for the customer with their tab, errors for Ordering, no info', () => {
    const checks = {
      platforms: {
        ios: {
          problems: [
            { code: 'missing_credentials', level: 'warning', fields: ['team_id', 'api_key_file'] },
            { code: 'missing_file', level: 'warning', subject: { name: 'Icon iOS', group: 'resources_icons' } },
            { code: 'source_not_scanned', level: 'info' }
          ]
        },
        android: {
          problems: [
            { code: 'empty_constant', level: 'warning', subject: { name: 'Google Maps API key' } },
            { code: 'missing_app_field', level: 'warning', subject: { name: 'package' } },
            { code: 'undefined_variable', level: 'error', subject: { name: 'constant__x' } },
            { code: 'something_new', level: 'warning', message: 'Fix it.' }
          ]
        }
      }
    }
    const rows = getCheckProblems(checks)
    expect(rows.map(row => [row.platform, row.owner, row.tab, row.text])).toEqual([
      ['ios', 'customer', 'credentials', 'Complete the App Store Connect credentials: Team ID. Upload API key file (.p8). If you already uploaded it, upload it again.'],
      ['ios', 'customer', 'files', 'Upload Icon iOS'],
      ['android', 'customer', 'constants', 'Set a value for Google Maps API key'],
      ['android', 'customer', 'general', 'Add the app’s package'],
      ['android', 'ordering', null, 'Ordering is reviewing an issue in the base. It doesn’t stop your builds.'],
      ['android', 'customer', null, 'Fix it.']
    ])
    expect(rows[1].group).toBe('resources_icons')
  })

  it('asks to upload a missing credentials file again instead of filling it in', () => {
    const upload = (files) => `Upload ${files}. If you already uploaded it, upload it again.`
    expect(getMissingCredentialsText('ios', ['api_key_file'])).toBe(upload('API key file (.p8)'))
    expect(getMissingCredentialsText('android', ['store_file'])).toBe(upload('Keystore file (.jks or .keystore)'))
    expect(getMissingCredentialsText('android', ['store_file', 'playstore_credential_file']))
      .toBe(upload('Keystore file (.jks or .keystore), Play Store credentials (.json)'))
    expect(getMissingCredentialsText('android', ['key_alias', 'key_password']))
      .toBe('Complete the Android signing credentials: Key alias, Key password')
    expect(getMissingCredentialsText('ios', [])).toBe('Complete the App Store Connect credentials')
  })

  it('writes file rules on one line, with the 3 MB floor', () => {
    expect(formatFileRules({ extension: 'png', width: 1024, height: 1024, max_size: 512 })).toBe('PNG · 1024 × 1024 px · up to 3 MB')
    expect(formatFileRules({ extension: ['json', 'plist'], max_size: 10240 })).toBe('JSON, PLIST · up to 10 MB')
    expect(formatFileRules(null)).toBe('')
  })

  it('explains a rejected file from its codes and rules', () => {
    const rules = { extension: 'png', width: 1024, height: 1024, max_size: 100 }
    expect(getFileErrorMessage(['file.dimensions'], rules)).toBe('The image must be 1024 × 1024 px.')
    expect(getFileErrorMessage(['file.extensions'], rules)).toBe('Upload a PNG file.')
    expect(getFileErrorMessage(['file.max'], rules)).toBe('The file must be 3 MB or smaller.')
    expect(getFileErrorMessage(['setting.upload_failed'], rules)).toBe('We couldn’t save the file. Try again.')
  })

  it('lists file groups in tab order and leaves colors out', () => {
    const settings = [{ group: 'files' }, { group: 'colors' }, { group: 'texts' }, { group: 'resources_icons' }, { group: 'resources_icons' }]
    expect(getFileGroups(settings)).toEqual(['resources_icons', 'files', 'texts'])
    expect(getSettingGroupLabel('texts')).toBe('Texts')
  })

  it('marks which platform fields are the platform’s own', () => {
    const [ios] = getPlatformRows({
      name: 'App',
      version: '1.0.0',
      package: 'com.a.b',
      base: { platforms: ['ios'] },
      platforms: [{ platform: 'ios', name: null, version: '2.0.0', package: null }]
    })
    expect(ios).toMatchObject({ customized: true, version: '2.0.0', name: 'App', ownFields: { name: false, version: true, package: false, description: false } })
    const [blank] = getPlatformRows({ name: 'App', base: { platforms: ['ios'] }, platforms: [{ platform: 'ios', name: null }] })
    expect(blank.customized).toBe(false)
  })

  it('names the field a rejected value is about', () => {
    expect(getAppFieldError('version', ['version.regex'])).toBe('Use a version like 1.2.0.')
    expect(getAppFieldError('package', ['package.regex'])).toBe('Use a reverse domain like com.brand.app.')
    expect(getAppFieldError('name', ['version.regex'])).toBe(null)
    expect(getValueErrorMessage(['value.json'], 'json')).toBe('Enter valid JSON.')
    expect(getCredentialsErrorMessage('ios', ['api_key_file.extensions'])).toBe('API key file (.p8): this type of file isn’t accepted.')
  })
})
