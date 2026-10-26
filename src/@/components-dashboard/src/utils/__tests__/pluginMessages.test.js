import { describe, expect, it } from 'vitest'
import {
  PLUGIN_FRAME_MIN_HEIGHT,
  clampPluginFrameHeight,
  getUrlOrigin,
  pluginFrameHeight,
  pluginModalSize,
  readPluginMessage,
  rememberPluginFrameHeight,
  rememberedPluginFrameHeight
} from '../pluginMessages'

const source = { name: 'plugin frame' }
const origin = 'https://pos.test'
const expected = { source, origin, businessId: 42 }
const event = (data, overrides = {}) => ({ source, origin, data: { type: 'ordering:plugin', ...data }, ...overrides })

describe('readPluginMessage', () => {
  it('reads a successful setup', () => {
    expect(readPluginMessage(event({ event: 'setup_finished', status: 'success', business_id: 42 }), expected))
      .toEqual({ event: 'setup_finished', status: 'success', message: null, close: false, height: null, size: null })
  })

  it('reads a failed setup with its message', () => {
    expect(readPluginMessage(event({ event: 'setup_finished', status: 'failed', message: ' Invalid merchant ' }), expected))
      .toEqual({ event: 'setup_finished', status: 'failed', message: 'Invalid merchant', close: false, height: null, size: null })
  })

  it('counts an unknown status as failed', () => {
    expect(readPluginMessage(event({ event: 'setup_finished', status: 'done' }), expected).status).toBe('failed')
  })

  it('reads a close request', () => {
    expect(readPluginMessage(event({ event: 'close' }), expected)).toEqual({ event: 'close', status: null, message: null, close: true, height: null, size: null })
  })

  it('closes after a setup only when the page asks', () => {
    expect(readPluginMessage(event({ event: 'setup_finished', status: 'success', close: true }), expected).close).toBe(true)
    expect(readPluginMessage(event({ event: 'setup_finished', status: 'success', close: 'yes' }), expected).close).toBe(false)
  })

  it('ignores another origin', () => {
    expect(readPluginMessage(event({ event: 'close' }, { origin: 'https://evil.test' }), expected)).toBeNull()
  })

  it('ignores another window, even from the same origin', () => {
    expect(readPluginMessage(event({ event: 'close' }, { source: {} }), expected)).toBeNull()
  })

  it('ignores other message types and unknown events', () => {
    expect(readPluginMessage(event({ type: 'webpackHotUpdate', event: 'close' }), expected)).toBeNull()
    expect(readPluginMessage({ source, origin, data: 'close' }, expected)).toBeNull()
    expect(readPluginMessage(event({ event: 'resize' }), expected)).toBeNull()
  })

  it('ignores a message about another store', () => {
    expect(readPluginMessage(event({ event: 'setup_finished', status: 'success', business_id: 7 }), expected)).toBeNull()
    expect(readPluginMessage(event({ event: 'setup_finished', status: 'success', business_id: '42' }), expected)).not.toBeNull()
  })

  it('ignores everything while no plugin window is known', () => {
    expect(readPluginMessage(event({ event: 'close' }), { ...expected, source: null })).toBeNull()
    expect(readPluginMessage(event({ event: 'close' }), { ...expected, origin: null })).toBeNull()
  })
})

describe('getUrlOrigin', () => {
  it('keeps only the origin of an absolute URL', () => {
    expect(getUrlOrigin('https://pos.test/views/setup?token=@{access_token}')).toBe('https://pos.test')
    expect(getUrlOrigin('/views/setup')).toBeNull()
  })
})

describe('resize', () => {
  it('reads the height the page reports', () => {
    expect(readPluginMessage(event({ event: 'resize', height: 412.4 }), expected))
      .toEqual({ event: 'resize', status: null, message: null, close: false, height: 412.4, size: null })
  })

  it('ignores a height that is not a positive number', () => {
    expect(readPluginMessage(event({ event: 'resize', height: '400' }), expected)).toBeNull()
    expect(readPluginMessage(event({ event: 'resize', height: 0 }), expected)).toBeNull()
    expect(readPluginMessage(event({ event: 'resize' }), expected)).toBeNull()
  })

  it('ignores a resize from another origin', () => {
    expect(readPluginMessage(event({ event: 'resize', height: 400 }, { origin: 'https://evil.test' }), expected)).toBeNull()
  })

  it('keeps the window between its minimum and 80% of the viewport', () => {
    expect(clampPluginFrameHeight(100, 1000)).toBe(PLUGIN_FRAME_MIN_HEIGHT)
    expect(clampPluginFrameHeight(450.2, 1000)).toBe(451)
    expect(clampPluginFrameHeight(2000, 1000)).toBe(800)
    expect(clampPluginFrameHeight(2000, 150)).toBe(PLUGIN_FRAME_MIN_HEIGHT)
  })

  it('reads the width the page asks for, and ignores an unknown one', () => {
    expect(readPluginMessage(event({ event: 'resize', height: 400, size: 'medium' }), expected).size).toBe('medium')
    expect(readPluginMessage(event({ event: 'resize', height: 400, size: 'huge' }), expected).size).toBeNull()
    expect(readPluginMessage(event({ event: 'resize', height: 400, size: 'toString' }), expected).size).toBeNull()
  })

  it('sizes the modal before it opens: small for a launch, large for any other, or what the page asked', () => {
    expect(pluginModalSize({ fits: true, size: null, height: null })).toEqual({ width: '640px', height: 'auto' })
    expect(pluginModalSize({ fits: false, size: null, height: null })).toEqual({ width: '80vw', height: '80vh' })
    expect(pluginModalSize({ fits: false, size: null, height: 500 })).toEqual({ width: '80vw', height: 'auto' })
    expect(pluginModalSize({ fits: true, size: 'medium', height: 500 })).toEqual({ width: '900px', height: 'auto' })
  })

  it('starts a page that fits at its remembered or compact height', () => {
    expect(pluginFrameHeight({ fits: true, height: null })).toBe('320px')
    expect(pluginFrameHeight({ fits: true, height: null, initialHeight: 410 })).toBe('410px')
    expect(pluginFrameHeight({ fits: true, height: 452, initialHeight: 410 })).toBe('452px')
    expect(pluginFrameHeight({ fits: false, height: null })).toBe('85%')
  })

  it('remembers the height a page reported, per plugin and page', () => {
    window.localStorage.clear()
    expect(rememberedPluginFrameHeight('clover_integration:setup')).toBeNull()
    rememberPluginFrameHeight('clover_integration:setup', 401)
    expect(rememberedPluginFrameHeight('clover_integration:setup')).toBe(401)
    expect(rememberedPluginFrameHeight('clover_integration:general_settings')).toBeNull()
    window.localStorage.setItem('ordering:pluginFrameHeight:bad:setup', 'abc')
    expect(rememberedPluginFrameHeight('bad:setup')).toBeNull()
  })
})
