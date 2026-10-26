import React, { useRef } from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useToast: () => [null, { showToast: vi.fn() }],
  ToastType: { Error: 'error', Success: 'success' }
}))

import { usePluginMessages } from '../usePluginMessages'
import { rememberedPluginFrameHeight } from '../../../../utils/pluginMessages'

const URL = 'https://plugin.test/views/setup'
let frame
const Probe = ({ onFrame }) => {
  const iframeRef = useRef(null)
  const result = usePluginMessages({
    open: true,
    iframeRef,
    url: URL,
    businessId: 42,
    name: 'Clover',
    closeModal: vi.fn(),
    reload: vi.fn(),
    fits: true,
    frameKey: 'clover_integration:setup'
  })
  onFrame(result)
  return <iframe ref={iframeRef} src={URL} />
}

const send = (data, origin = 'https://plugin.test') => act(() => {
  window.dispatchEvent(new MessageEvent('message', {
    data: { type: 'ordering:plugin', event: 'resize', ...data },
    origin,
    source: document.querySelector('iframe').contentWindow
  }))
})

describe('usePluginMessages: resize', () => {
  beforeEach(() => {
    window.localStorage.clear()
    render(<Probe onFrame={(result) => { frame = result }} />)
  })

  it('takes the width the page asks for only once', () => {
    send({ height: 400, size: 'medium' })
    expect(frame).toEqual({ height: 400, size: 'medium' })

    send({ height: 420, size: 'large' })
    expect(frame).toEqual({ height: 420, size: 'medium' })
  })

  it('ignores an unknown size and keeps the height', () => {
    send({ height: 400, size: 'huge' })
    expect(frame).toEqual({ height: 400, size: null })
  })

  it('ignores a resize from another origin', () => {
    send({ height: 400, size: 'medium' }, 'https://evil.test')
    expect(frame).toEqual({ height: null, size: null })
  })

  it('remembers the height for the next open of the same page', () => {
    send({ height: 433 })
    expect(rememberedPluginFrameHeight('clover_integration:setup')).toBe(433)
  })
})
