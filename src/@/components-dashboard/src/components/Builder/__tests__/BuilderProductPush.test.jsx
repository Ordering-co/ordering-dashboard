import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'

const api = vi.hoisted(() => ({
  getBuilderProductPush: vi.fn(),
  saveBuilderProductFirebase: vi.fn(),
  removeBuilderProductFirebase: vi.fn()
}))

vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'http://api/v400/en/development' }] }))
vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'tok' }] }))
vi.mock('../builderApi', async () => {
  const actual = await vi.importActual('../builderApi')
  const wrapped = Object.fromEntries(Object.keys(api).map(name => [name, (...args) => api[name](...args)]))
  return { ...actual, ...wrapped }
})

import { BuilderProductPush } from '../BuilderProductPush'

const ok = (result) => ({ error: false, status: 200, result, errorCodes: [] })
const fail = (status, errorCodes) => ({ error: true, status, result: ['x'], errorCodes })
const project = { firebase: { source: 'project', project_id: 'ordering-push', client_email: 'sdk@ordering-push.iam.gserviceaccount.com' } }
const own = { firebase: { source: 'site', project_id: 'burger-app', client_email: 'sdk@burger-app.iam.gserviceaccount.com' } }

const renderController = async (props = {}) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => { ui.current = uiProps; return null }
  render(<BuilderProductPush UIComponent={UIComponent} productId={41} {...props} />)
  await waitFor(() => expect(ui.current.pushState.loading).toBe(false))
  return ui
}

describe('BuilderProductPush controller', () => {
  beforeEach(() => {
    Object.values(api).forEach(fn => fn.mockReset())
    api.getBuilderProductPush.mockResolvedValue(ok(project))
  })

  it('loads which Firebase account the product uses', async () => {
    const ui = await renderController()
    expect(api.getBuilderProductPush).toHaveBeenCalledWith(expect.anything(), 'tok', 41)
    expect(ui.current.pushState.firebase).toEqual(project.firebase)
  })

  it('saves its own account and takes the answer as the state', async () => {
    api.saveBuilderProductFirebase.mockResolvedValueOnce(ok(own))
    const ui = await renderController()
    let answer
    await act(async () => { answer = await ui.current.saveFirebase('{"type":"service_account"}') })
    expect(api.saveBuilderProductFirebase).toHaveBeenCalledWith(expect.anything(), 'tok', 41, '{"type":"service_account"}')
    expect(answer).toEqual({ ok: true, errorCodes: [], source: 'site' })
    expect(ui.current.pushState.firebase.source).toBe('site')
  })

  it('answers the codes of a refused account and keeps the state', async () => {
    api.saveBuilderProductFirebase.mockResolvedValueOnce(fail(400, ['service_account.invalid']))
    const ui = await renderController()
    let answer
    await act(async () => { answer = await ui.current.saveFirebase('{}') })
    expect(answer).toEqual({ ok: false, errorCodes: ['service_account.invalid'], source: null })
    expect(ui.current.pushState.firebase).toEqual(project.firebase)
  })

  it('removes its own account and says which one it uses now', async () => {
    api.getBuilderProductPush.mockResolvedValue(ok(own))
    api.removeBuilderProductFirebase.mockResolvedValueOnce(ok({ firebase: { source: null, project_id: null, client_email: null } }))
    const ui = await renderController()
    let answer
    await act(async () => { answer = await ui.current.removeFirebase() })
    expect(answer).toEqual({ ok: true, errorCodes: [], source: null })
    expect(ui.current.pushState.firebase.source).toBeNull()
  })

  it('replaces the page when the product is gone', async () => {
    api.getBuilderProductPush.mockResolvedValue(fail(404, ['product.not_found']))
    const onPageFailure = vi.fn()
    const ui = await renderController({ onPageFailure })
    expect(onPageFailure).toHaveBeenCalledWith('not_found')
    expect(ui.current.pushState.error).toBe(true)
  })
})
