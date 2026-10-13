import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getBuilderAppChecks,
  getBuilderAppCredentials,
  getBuilderErrorKind,
  getBuilderPageFailure,
  listBuilderAppConstants,
  listBuilderAppSettings,
  resetBuilderAppConstant,
  resetBuilderAppSetting,
  saveBuilderAppCredentials,
  updateBuilderApp,
  updateBuilderAppConstant,
  updateBuilderAppPlatform,
  updateBuilderAppSetting,
  updateBuilderProduct,
  uploadBuilderAppSettingFile
} from '../builderApi'

const ordering = { root: 'http://localhost:8080/v400/en/development', appInternalName: 'dashboard' }
const APP = '/v400/en/development/dashboard/builder/products/40/apps/35'

const respond = (...bodies) => {
  const queue = [...bodies]
  global.fetch = vi.fn(async () => {
    const body = queue.length > 1 ? queue.shift() : queue[0]
    return { ok: !body.error, status: body.error ? 400 : 200, json: async () => body }
  })
}

const call = (index = -1) => {
  const [url, options] = global.fetch.mock.calls.at(index)
  return { url: new URL(url), options }
}

describe('builderApi edit endpoints', () => {
  const originalFetch = global.fetch

  beforeEach(() => respond({ error: false, result: {} }))
  afterEach(() => { global.fetch = originalFetch })

  it('renames the product and edits the app and a platform with JSON bodies', async () => {
    await updateBuilderProduct(ordering, 'tok', 40, { name: 'Drivers' })
    expect(call().url.pathname).toBe('/v400/en/development/dashboard/builder/products/40')
    expect(call().options.method).toBe('PUT')
    expect(JSON.parse(call().options.body)).toEqual({ name: 'Drivers' })

    await updateBuilderApp(ordering, 'tok', 40, 35, { version: '1.2.0' })
    expect(call().url.pathname).toBe(APP)
    expect(JSON.parse(call().options.body)).toEqual({ version: '1.2.0' })

    await updateBuilderAppPlatform(ordering, 'tok', 40, 35, 'ios', { version: null })
    expect(call().url.pathname).toBe(`${APP}/platforms/ios`)
    expect(JSON.parse(call().options.body)).toEqual({ version: null })

    await getBuilderAppChecks(ordering, 'tok', 40, 35)
    expect(call().url.pathname).toBe(`${APP}/checks`)
  })

  it('reads every page of settings at 50, filtered by group when asked', async () => {
    respond(
      { error: false, result: [{ id: 1 }], pagination: { total_pages: 2 } },
      { error: false, result: [{ id: 2 }], pagination: { total_pages: 2 } }
    )
    const response = await listBuilderAppSettings(ordering, 'tok', 40, 35, { group: 'resources_icons' })
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(call(0).url.searchParams.get('page')).toBe('1')
    expect(call(1).url.searchParams.get('page')).toBe('2')
    expect(call(1).url.searchParams.get('page_size')).toBe('50')
    expect(JSON.parse(call(1).url.searchParams.get('where'))).toEqual([{ attribute: 'group', value: 'resources_icons' }])
    expect(response).toEqual({ status: 200, error: false, result: [{ id: 1 }, { id: 2 }], errorCodes: [] })
  })

  it('stops on a failed page and sends no where without a filter', async () => {
    respond({ error: true, result: ['x'], error_codes: ['app.not_found'] })
    const response = await listBuilderAppConstants(ordering, 'tok', 40, 35)
    expect(call().url.pathname).toBe(`${APP}/constants`)
    expect(call().url.searchParams.has('where')).toBe(false)
    expect(response).toMatchObject({ error: true, errorCodes: ['app.not_found'] })
  })

  it('sets, resets and uploads settings and constants', async () => {
    await updateBuilderAppSetting(ordering, 'tok', 40, 35, 7, '#1E6BD6')
    expect(call().url.pathname).toBe(`${APP}/settings/7`)
    expect(JSON.parse(call().options.body)).toEqual({ value: '#1E6BD6' })

    await resetBuilderAppSetting(ordering, 'tok', 40, 35, 7)
    expect(call().options.method).toBe('DELETE')

    const file = new File(['png'], 'icon.png', { type: 'image/png' })
    await uploadBuilderAppSettingFile(ordering, 'tok', 40, 35, 8, file)
    expect(call().url.pathname).toBe(`${APP}/settings/8/file`)
    expect(call().options.method).toBe('POST')
    expect(call().options.headers).toEqual({ Authorization: 'Bearer tok' })
    expect(call().options.body.get('file')).toBeInstanceOf(File)

    await updateBuilderAppConstant(ordering, 'tok', 40, 35, 3, '1')
    expect(call().url.pathname).toBe(`${APP}/constants/3`)
    await resetBuilderAppConstant(ordering, 'tok', 40, 35, 3)
    expect(call().options.method).toBe('DELETE')
  })

  it('posts only the credentials given, as multipart', async () => {
    await getBuilderAppCredentials(ordering, 'tok', 40, 35)
    expect(call().url.pathname).toBe(`${APP}/credentials`)
    await saveBuilderAppCredentials(ordering, 'tok', 40, 35, 'android', { key_alias: 'drivers', key_password: '', store_file: undefined })
    expect(call().url.pathname).toBe(`${APP}/credentials/android`)
    expect([...call().options.body.keys()]).toEqual(['key_alias'])
  })

  it('takes the page down only for product, app, module and access failures', () => {
    expect(getBuilderPageFailure({ error: false })).toBe(null)
    expect(getBuilderPageFailure({ error: true, status: 404, errorCodes: ['app.not_found'] })).toBe('not_found')
    expect(getBuilderPageFailure({ error: true, status: 404, errorCodes: ['product.not_found'] })).toBe('not_found')
    expect(getBuilderPageFailure({ error: true, status: 403, errorCodes: ['builder.disabled'] })).toBe('disabled')
    expect(getBuilderPageFailure({ error: true, status: 401, errorCodes: [] })).toBe('no_access')
    expect(getBuilderPageFailure({ error: true, status: 404, errorCodes: ['setting.not_found'] })).toBe(null)
    expect(getBuilderPageFailure({ error: true, status: 400, errorCodes: ['version.regex'] })).toBe(null)
    expect(getBuilderErrorKind({ error: true, status: 404, errorCodes: ['app.not_found'] })).toBe('not_found')
  })
})
