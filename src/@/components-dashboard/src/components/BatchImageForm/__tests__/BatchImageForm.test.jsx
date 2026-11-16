/* eslint-disable import/first */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// bugs E D16c: a failed update is kept in formState.result for the UI to show (the UI test covers the Alert)
const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  save: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [{ loading: false }] }))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{
    businesses: () => ({ categories: () => ({ products: () => ({ save: mocks.save }) }) })
  }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [null, { showToast: mocks.showToast }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [null, (_key, fallback) => fallback] }))

import { BatchImageForm } from '..'

const renderController = async () => {
  const ui = { current: null }
  const UIComponent = (props) => {
    ui.current = props
    return null
  }
  render(
    <BatchImageForm
      UIComponent={UIComponent}
      businessState={{ business: { id: 1, categories: [] } }}
      categorySelected={{ id: 2, products: [{ id: 5, category_id: 2 }] }}
    />
  )
  await act(async () => {
    await ui.current.handleUploadImages([new File(['x'], '5.png', { type: 'image/png' })])
  })
  await waitFor(() => expect(ui.current.formState.photos).toHaveLength(1))
  act(() => ui.current.updateProduct())
  return ui
}

describe('BatchImageForm controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exposes the API failure in formState.result', async () => {
    mocks.save.mockResolvedValue({ content: { error: true, result: ['Product not found'] } })
    const ui = await renderController()
    await waitFor(() => expect(ui.current.formState.result).toEqual({ error: true, result: ['Product not found'] }))
    expect(ui.current.formState.loading).toBe(false)
  })

  it('does not retry on its own after a failure', async () => {
    mocks.save.mockResolvedValue({ content: { error: true, result: ['Product not found'] } })
    const ui = await renderController()
    await waitFor(() => expect(ui.current.formState.result.error).toBe(true))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)) })
    expect(mocks.save).toHaveBeenCalledTimes(1)
    expect(ui.current.formState.API).toBe(false)
    expect(ui.current.formState.loading).toBe(false)
  })

  it('does not retry on its own after a thrown failure', async () => {
    mocks.save.mockRejectedValue(new Error('Network down'))
    const ui = await renderController()
    await waitFor(() => expect(ui.current.formState.result.error).toBe(true))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)) })
    expect(mocks.save).toHaveBeenCalledTimes(1)
  })

  it('exposes a thrown failure in formState.result', async () => {
    const failure = new Error('Network down')
    mocks.save.mockRejectedValue(failure)
    const ui = await renderController()
    await waitFor(() => expect(ui.current.formState.result).toEqual({ error: true, result: failure }))
  })
})
