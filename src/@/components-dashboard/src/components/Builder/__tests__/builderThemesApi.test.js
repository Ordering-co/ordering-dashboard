import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  activateBuilderTheme,
  createBuilderTheme,
  deleteBuilderTheme,
  discardBuilderThemeDraft,
  getBuilderTheme,
  getBuilderThemeSchema,
  listBuilderThemePresets,
  listBuilderThemes,
  publishBuilderTheme,
  renameBuilderTheme,
  resetBuilderTheme,
  saveBuilderThemeDraft,
  uploadBuilderThemeImage
} from '../builderApi'

const ordering = { root: 'http://localhost:8080/v400/en/development', appInternalName: 'dashboard' }
const BUILDER = '/v400/en/development/dashboard/builder'
const THEMES = `${BUILDER}/products/45/themes`

const respond = (body, { ok = true, status = 200 } = {}) => {
  global.fetch = vi.fn(async () => ({ ok, status, json: async () => body }))
}

const lastCall = () => {
  const [url, options] = global.fetch.mock.calls.at(-1)
  return { url: new URL(url), options }
}

describe('builderApi themes (themes v2)', () => {
  const originalFetch = global.fetch

  beforeEach(() => respond({ error: false, result: {} }))
  afterEach(() => { global.fetch = originalFetch })

  it.each([
    ['schema', () => getBuilderThemeSchema(ordering, 'tok', 45), `${BUILDER}/products/45/theme/schema`, 'GET'],
    ['detail', () => getBuilderTheme(ordering, 'tok', 45, 10), `${THEMES}/10`, 'GET'],
    ['delete', () => deleteBuilderTheme(ordering, 'tok', 45, 10), `${THEMES}/10`, 'DELETE'],
    ['discard', () => discardBuilderThemeDraft(ordering, 'tok', 45, 10), `${THEMES}/10/draft`, 'DELETE'],
    ['publish', () => publishBuilderTheme(ordering, 'tok', 45, 10), `${THEMES}/10/publish`, 'POST'],
    ['activate', () => activateBuilderTheme(ordering, 'tok', 45, 10), `${THEMES}/10/activate`, 'POST']
  ])('calls %s on its route', async (_name, call, path, method) => {
    await call()
    const { url, options } = lastCall()
    expect(url.pathname).toBe(path)
    expect(options.method).toBe(method)
    expect(options.headers.Authorization).toBe('Bearer tok')
  })

  it('lists every page of the themes', async () => {
    respond({ error: false, result: [{ id: 10, active: true }], pagination: { total_pages: 1 } })
    const response = await listBuilderThemes(ordering, 'tok', 45)
    expect(lastCall().url.pathname).toBe(THEMES)
    expect(response.result).toEqual([{ id: 10, active: true }])
  })

  it('creates a theme with its name and source, and the preset only for a preset', async () => {
    await createBuilderTheme(ordering, 'tok', 45, { name: 'Summer', source: 'current', presetId: 3 })
    expect(JSON.parse(lastCall().options.body)).toEqual({ name: 'Summer', source: 'current' })

    await createBuilderTheme(ordering, 'tok', 45, { name: 'Bold', source: 'preset', presetId: 3 })
    const { url, options } = lastCall()
    expect(url.pathname).toBe(THEMES)
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ name: 'Bold', source: 'preset', preset_id: 3 })
  })

  it('renames, saves the draft and resets a section', async () => {
    await renameBuilderTheme(ordering, 'tok', 45, 10, 'Night')
    expect(lastCall().options.method).toBe('PUT')
    expect(JSON.parse(lastCall().options.body)).toEqual({ name: 'Night' })

    const values = { components: { button: { colors: { primary: { main: '#00AA00' } } } }, tokens: { color: { secondary: null } } }
    await saveBuilderThemeDraft(ordering, 'tok', 45, 10, values)
    expect(lastCall().url.pathname).toBe(`${THEMES}/10/draft`)
    expect(lastCall().options.method).toBe('PUT')
    expect(JSON.parse(lastCall().options.body)).toEqual({ values })

    await resetBuilderTheme(ordering, 'tok', 45, 10, 'tokens.color')
    expect(lastCall().url.pathname).toBe(`${THEMES}/10/reset`)
    expect(JSON.parse(lastCall().options.body)).toEqual({ section: 'tokens.color' })

    await resetBuilderTheme(ordering, 'tok', 45, 10, ['visibility.header.cart', 'platforms.mobile_web.visibility.header.cart'])
    expect(JSON.parse(lastCall().options.body)).toEqual({ sections: ['visibility.header.cart', 'platforms.mobile_web.visibility.header.cart'] })

    await resetBuilderTheme(ordering, 'tok', 45, 10)
    expect(JSON.parse(lastCall().options.body)).toEqual({})
  })

  it('keeps the errors of an invalid draft', async () => {
    const errors = [{ path: 'components.button.base.radius', code: 'components.button.base.radius.invalid' }]
    respond({ error: true, error_codes: ['theme.invalid'], errors, result: ['x'] }, { ok: false, status: 400 })
    const response = await saveBuilderThemeDraft(ordering, 'tok', 45, 10, { components: { button: { base: { radius: 4 } } } })
    expect(response).toMatchObject({ error: true, errorCodes: ['theme.invalid'], errors })
  })

  it('uploads an image as multipart, with the key it is for', async () => {
    const file = new File(['x'], 'logo.png', { type: 'image/png' })
    await uploadBuilderThemeImage(ordering, 'tok', 45, 10, 'empty.not_found', file)
    const { url, options } = lastCall()
    expect(url.pathname).toBe(`${THEMES}/10/images`)
    expect(options.body.get('key')).toBe('empty.not_found')
    expect(options.body.get('file')).toBe(file)
    expect(options.headers['Content-Type']).toBeUndefined()
  })

  it('keeps the limit a refused image broke', async () => {
    respond({ error: true, error_codes: ['file.invalid_type'], formats: ['jpg', 'png'], result: ['x'] }, { ok: false, status: 400 })
    const refused = await uploadBuilderThemeImage(ordering, 'tok', 45, 10, 'logo', new File(['x'], 'logo.gif'))
    expect(refused).toMatchObject({ error: true, errorCodes: ['file.invalid_type'], formats: ['jpg', 'png'] })
    respond({ error: true, error_codes: ['file.too_large'], max_bytes: 5000000, result: ['x'] }, { ok: false, status: 400 })
    expect(await uploadBuilderThemeImage(ordering, 'tok', 45, 10, 'logo', new File(['x'], 'logo.png'))).toMatchObject({ maxBytes: 5000000 })
  })

  it('asks for the presets of the product', async () => {
    await listBuilderThemePresets(ordering, 'tok', 45)
    const { url } = lastCall()
    expect(url.pathname).toBe(`${BUILDER}/theme_presets`)
    expect(url.searchParams.get('product_id')).toBe('45')
  })
})
