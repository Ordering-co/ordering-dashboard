import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'

const api = vi.hoisted(() => ({
  getBuilderProduct: vi.fn(),
  getBuilderAppChecks: vi.fn(),
  updateBuilderProduct: vi.fn(),
  updateBuilderApp: vi.fn(),
  updateBuilderAppPlatform: vi.fn(),
  listBuilderAppSettings: vi.fn(),
  updateBuilderAppSetting: vi.fn(),
  uploadBuilderAppSettingFile: vi.fn(),
  resetBuilderAppSetting: vi.fn(),
  listBuilderAppConstants: vi.fn(),
  updateBuilderAppConstant: vi.fn(),
  resetBuilderAppConstant: vi.fn(),
  getBuilderAppCredentials: vi.fn(),
  saveBuilderAppCredentials: vi.fn()
}))

vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'http://api/v400/en/development' }] }))
vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'tok' }] }))
vi.mock('../builderApi', async () => {
  const actual = await vi.importActual('../builderApi')
  return Object.fromEntries(Object.entries(actual).map(([key, value]) => [key, api[key] ? (...args) => api[key](...args) : value]))
})

import { BuilderProductDetail } from '../BuilderProductDetail'
import { BuilderAppSettings } from '../BuilderAppSettings'
import { BuilderAppConstants } from '../BuilderAppConstants'
import { BuilderAppCredentials } from '../BuilderAppCredentials'

const ok = (result) => ({ error: false, status: 200, result, errorCodes: [] })
const fail = (status, errorCodes) => ({ error: true, status, result: ['x'], errorCodes })

const app = { id: 35, name: 'Drivers', version: '0.0.1', package: 'com.a.b', base: { id: 4, platforms: ['ios', 'android'] }, builds: [{ platform: 'ios' }], platforms: [] }
const product = { id: 40, name: 'Drivers', product_status: 'draft', apps: [app] }
const checks = { app_id: 35, errors: 0, warnings: 1, platforms: {} }

const renderWith = (Controller, props = {}) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => { ui.current = uiProps; return null }
  render(<Controller UIComponent={UIComponent} {...props} />)
  return ui
}

describe('BuilderProductDetail controller, edits', () => {
  beforeEach(() => {
    Object.values(api).forEach(fn => fn.mockReset())
    api.getBuilderProduct.mockResolvedValue(ok(product))
    api.getBuilderAppChecks.mockResolvedValue(ok(checks))
  })

  it('loads the checks of a draft app', async () => {
    const ui = renderWith(BuilderProductDetail, { productId: '40' })
    await waitFor(() => expect(ui.current.checksState.checks).toEqual(checks))
    expect(api.getBuilderAppChecks).toHaveBeenCalledWith(expect.anything(), 'tok', '40', 35)
    expect(ui.current.checksEnabled).toBe(true)
  })

  it('skips the checks of an archived app', async () => {
    api.getBuilderProduct.mockResolvedValue(ok({ ...product, product_status: 'archived' }))
    const ui = renderWith(BuilderProductDetail, { productId: '40' })
    await waitFor(() => expect(ui.current.productState.loading).toBe(false))
    expect(ui.current.checksEnabled).toBe(false)
    expect(api.getBuilderAppChecks).not.toHaveBeenCalled()
  })

  it('renames the product and keeps its app', async () => {
    api.updateBuilderProduct.mockResolvedValueOnce(ok({ id: 40, name: 'Repartidores' }))
    const ui = renderWith(BuilderProductDetail, { productId: '40' })
    await waitFor(() => expect(ui.current.productState.loading).toBe(false))
    let answer
    await act(async () => { answer = await ui.current.renameProduct('Repartidores') })
    expect(answer).toEqual({ ok: true, errorCodes: [] })
    expect(ui.current.productState.product.name).toBe('Repartidores')
    expect(ui.current.productState.product.apps).toEqual([app])
  })

  it('edits the app, keeps its base and builds, and reloads the checks', async () => {
    api.updateBuilderApp.mockResolvedValueOnce(ok({ id: 35, name: 'Drivers', version: '1.0.0', platforms: [] }))
    const ui = renderWith(BuilderProductDetail, { productId: '40' })
    await waitFor(() => expect(ui.current.checksState.checks).toEqual(checks))
    await act(async () => { await ui.current.updateApp({ version: '1.0.0' }) })
    expect(api.updateBuilderApp).toHaveBeenCalledWith(expect.anything(), 'tok', '40', 35, { version: '1.0.0' })
    const edited = ui.current.productState.product.apps[0]
    expect(edited).toMatchObject({ version: '1.0.0', base: app.base, builds: app.builds })
    expect(api.getBuilderAppChecks).toHaveBeenCalledTimes(2)
  })

  it('returns validation codes and takes the page down when the app is gone', async () => {
    api.updateBuilderAppPlatform
      .mockResolvedValueOnce(fail(400, ['version.regex']))
      .mockResolvedValueOnce(fail(404, ['app.not_found']))
    const ui = renderWith(BuilderProductDetail, { productId: '40' })
    await waitFor(() => expect(ui.current.productState.loading).toBe(false))
    let answer
    await act(async () => { answer = await ui.current.updatePlatform('ios', { version: '1' }) })
    expect(answer).toEqual({ ok: false, errorCodes: ['version.regex'] })
    expect(ui.current.productState.product).not.toBe(null)
    await act(async () => { await ui.current.updatePlatform('ios', { version: '1.0.0' }) })
    expect(ui.current.productState).toEqual({ loading: false, product: null, errorKind: 'not_found' })
  })
})

describe('Builder app tab controllers', () => {
  const onChanged = vi.fn()
  const onPageFailure = vi.fn()
  const props = { productId: 40, appId: 35, onChanged, onPageFailure }

  beforeEach(() => {
    Object.values(api).forEach(fn => fn.mockReset())
    onChanged.mockReset()
    onPageFailure.mockReset()
  })

  it('settings: swaps in the saved item and tells the detail', async () => {
    api.listBuilderAppSettings.mockResolvedValue(ok([{ id: 1, kind: 'color', value: '#000' }, { id: 2, kind: 'file' }]))
    api.updateBuilderAppSetting.mockResolvedValueOnce(ok({ id: 1, kind: 'color', value: '#FFF', customized: true }))
    const ui = renderWith(BuilderAppSettings, props)
    await waitFor(() => expect(ui.current.settingsState.loading).toBe(false))
    let answer
    await act(async () => { answer = await ui.current.saveValue(1, '#FFF') })
    expect(answer.errorCodes).toEqual([])
    expect(ui.current.settingsState.settings[0]).toEqual({ id: 1, kind: 'color', value: '#FFF', customized: true })
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(ui.current.savingId).toBe(null)
  })

  it('settings: a rejected upload returns its codes and keeps the page', async () => {
    api.listBuilderAppSettings.mockResolvedValue(ok([{ id: 2, kind: 'file' }]))
    api.uploadBuilderAppSettingFile.mockResolvedValueOnce(fail(400, ['file.dimensions']))
    api.resetBuilderAppSetting.mockResolvedValueOnce(fail(404, ['setting.not_found']))
    const ui = renderWith(BuilderAppSettings, props)
    await waitFor(() => expect(ui.current.settingsState.loading).toBe(false))
    let answer
    await act(async () => { answer = await ui.current.uploadFile(2, new File(['x'], 'a.png')) })
    expect(answer).toEqual({ setting: null, errorCodes: ['file.dimensions'] })
    await act(async () => { await ui.current.resetSetting(2) })
    expect(onPageFailure).not.toHaveBeenCalled()
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('settings: a disabled module takes the page down', async () => {
    api.listBuilderAppSettings.mockResolvedValue(fail(403, ['builder.disabled']))
    const ui = renderWith(BuilderAppSettings, props)
    await waitFor(() => expect(ui.current.settingsState.error).toBe(true))
    expect(onPageFailure).toHaveBeenCalledWith('disabled')
  })

  it('constants: saves and resets one constant', async () => {
    api.listBuilderAppConstants.mockResolvedValue(ok([{ id: 3, type: 'boolean', value: '0' }]))
    api.updateBuilderAppConstant.mockResolvedValueOnce(ok({ id: 3, type: 'boolean', value: '1', customized: true }))
    api.resetBuilderAppConstant.mockResolvedValueOnce(ok({ id: 3, type: 'boolean', value: '0', customized: false }))
    const ui = renderWith(BuilderAppConstants, props)
    await waitFor(() => expect(ui.current.constantsState.loading).toBe(false))
    await act(async () => { await ui.current.saveConstant(3, '1') })
    expect(ui.current.constantsState.constants[0].value).toBe('1')
    await act(async () => { await ui.current.resetConstant(3) })
    expect(ui.current.constantsState.constants[0]).toMatchObject({ value: '0', customized: false })
    expect(onChanged).toHaveBeenCalledTimes(2)
  })

  it('credentials: saves one platform and keeps the answer', async () => {
    api.getBuilderAppCredentials.mockResolvedValue(ok({ android: { key_alias: null, complete: false } }))
    api.saveBuilderAppCredentials.mockResolvedValueOnce(ok({ android: { key_alias: 'drivers', has_key_password: true, complete: false } }))
    const ui = renderWith(BuilderAppCredentials, props)
    await waitFor(() => expect(ui.current.credentialsState.loading).toBe(false))
    await act(async () => { await ui.current.saveCredentials('android', { key_alias: 'drivers', key_password: 'secret' }) })
    expect(api.saveBuilderAppCredentials).toHaveBeenCalledWith(expect.anything(), 'tok', 40, 35, 'android', { key_alias: 'drivers', key_password: 'secret' })
    expect(ui.current.credentialsState.credentials.android.has_key_password).toBe(true)
    expect(onChanged).toHaveBeenCalledTimes(1)
  })
})
