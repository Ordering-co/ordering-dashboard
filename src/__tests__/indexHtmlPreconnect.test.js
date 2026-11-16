// (T10): index.html preconnected to «https://apiv4.orderingplus», a host with no domain: the hint did nothing and WebKit
// logged it as an error on every load. Every preconnect must name a real origin, and the API one is the default API of src/config.json.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import config from '../config.json'

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
const preconnects = [...html.matchAll(/<link\s+rel="preconnect"\s+href="([^"]+)"/g)].map(([, href]) => href)

describe('index.html preconnect hints', () => {
  it('name an https origin with a domain (a dot and a top-level label)', () => {
    expect(preconnects.length).toBeGreaterThan(0)
    preconnects.forEach(href => {
      const url = new URL(href)
      expect(url.protocol, href).toBe('https:')
      expect(url.hostname, href).toMatch(/\.[a-z]{2,}$/i)
    })
  })

  it('warm the default API origin of src/config.json', () => {
    expect(preconnects).toContain(new URL(config.api.url).origin)
  })

  // review: the API is called with CORS (an Authorization header), so only a crossorigin preconnect is reused by those requests
  it('mark the API preconnect crossorigin', () => {
    const api = new URL(config.api.url).origin
    expect(html).toMatch(new RegExp(`<link\\s+rel="preconnect"\\s+href="${api.replace(/[.]/g, '\\.')}"\\s+crossorigin\\s*/>`))
  })
})
