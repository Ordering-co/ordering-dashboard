/* eslint-disable import/first */
// the setup guide is a React iframe whose address comes from the API. It is drawn only when it is an https address on the
// plugin's own origin, it has an accessible name, and nothing the API sends is ever parsed as HTML.
import React from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('~components', () => ({
  useApi: () => [{ project: 'demo' }],
  useLanguage: () => [{}, (key, fallback) => fallback ?? key]
}))

import { DoordashContent } from '../index'

const pluginWith = (infoSetup, root = 'https://plugin.example.com') => ({
  root,
  links: JSON.stringify({ info_setup: infoSetup })
})

afterEach(cleanup)

describe('DoordashContent', () => {
  it('draws the guide as a titled iframe on the plugin origin, with the project code filled in', () => {
    const { container } = render(<DoordashContent plugin={pluginWith('/info?project=@{project_code}')} />)
    const frame = container.querySelector('iframe')
    expect(frame).not.toBeNull()
    expect(frame.getAttribute('src')).toBe('https://plugin.example.com/info?project=demo')
    expect(frame.getAttribute('title')).toBe('Setup guide')
  })

  it.each([
    ['a quote that tries to add attributes', '/info" onload="alert(1)" x="'],
    ['a tag that tries to close the iframe', '/info"></iframe><img src=x onerror=alert(1)>'],
    ['a javascript: address', 'javascript:alert(1)'],
    ['a userinfo trick that moves the host', '@evil.example.net/info'],
    ['a suffix that moves the host', '.evil.example.net/info']
  ])('draws no iframe and injects no HTML for %s', (_label, infoSetup) => {
    const { container } = render(<DoordashContent plugin={pluginWith(infoSetup)} />)
    expect(container.querySelector('iframe')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('[onload], [onerror]')).toBeNull()
  })

  it('draws no iframe when the plugin root is not https', () => {
    const { container } = render(<DoordashContent plugin={pluginWith('/info', 'http://plugin.example.com')} />)
    expect(container.querySelector('iframe')).toBeNull()
  })

  it('draws no iframe when the plugin root is a javascript: address or garbage', () => {
    expect(render(<DoordashContent plugin={pluginWith('/info', 'javascript:alert(1)//')} />).container.querySelector('iframe')).toBeNull()
    expect(render(<DoordashContent plugin={pluginWith('/info', 'not a url')} />).container.querySelector('iframe')).toBeNull()
  })

  it('draws nothing when the plugin has no guide address or no root', () => {
    expect(render(<DoordashContent plugin={{ root: 'https://plugin.example.com', links: '{}' }} />).container.querySelector('iframe')).toBeNull()
    expect(render(<DoordashContent plugin={{ links: '{"info_setup":"/info"}' }} />).container.querySelector('iframe')).toBeNull()
  })
})
