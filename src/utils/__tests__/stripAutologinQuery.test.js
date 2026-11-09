import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

import {
  AUTOLOGIN_STASH_KEY,
  readAutologinParams,
  stashAndStripAutologinQuery,
  stripAutologinTokenFromUrl
} from '../stripAutologinQuery'

const indexHtml = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../index.html'),
  'utf8'
)

describe('stripAutologinTokenFromUrl', () => {
  it('removes token from an absolute URL and keeps the rest', () => {
    expect(
      stripAutologinTokenFromUrl(
        'https://dashboard.orderingplus.com/orders?token=jwt-secret&project=tenant&filter=open#details'
      )
    ).toBe('https://dashboard.orderingplus.com/orders?project=tenant&filter=open#details')
  })

  it('leaves URLs without a token unchanged', () => {
    const url = 'https://dashboard.orderingplus.com/orders?project=tenant'
    expect(stripAutologinTokenFromUrl(url)).toBe(url)
  })

  it('removes a handoff code on the root path', () => {
    expect(
      stripAutologinTokenFromUrl('https://dashboard.orderingplus.com/?project=tenant&code=one-time')
    ).toBe('https://dashboard.orderingplus.com/?project=tenant')
  })

  it('keeps `code` on other pages such as password reset', () => {
    const url = 'https://dashboard.orderingplus.com/password/reset?code=reset-code&random=abc&project=tenant'
    expect(stripAutologinTokenFromUrl(url)).toBe(url)
  })

  it('returns non-string values unchanged', () => {
    expect(stripAutologinTokenFromUrl(null)).toBe(null)
    expect(stripAutologinTokenFromUrl(undefined)).toBe(undefined)
  })
})

describe('readAutologinParams', () => {
  afterEach(() => {
    delete window[AUTOLOGIN_STASH_KEY]
    window.history.replaceState(null, '', '/')
  })

  it('prefers the in-memory stash over the query string', () => {
    window.history.replaceState(null, '', '/orders?project=from-url')
    window[AUTOLOGIN_STASH_KEY] = { token: 'stashed-jwt', project: 'stashed-tenant' }

    expect(readAutologinParams(window)).toEqual({
      token: 'stashed-jwt',
      code: null,
      project: 'stashed-tenant'
    })
  })

  it('falls back to the query string when nothing is stashed', () => {
    window.history.replaceState(null, '', '/orders?token=query-jwt&project=query-tenant')

    expect(readAutologinParams(window)).toEqual({
      token: 'query-jwt',
      code: null,
      project: 'query-tenant'
    })
  })

  it('reads a stashed handoff code', () => {
    window[AUTOLOGIN_STASH_KEY] = { token: null, code: 'one-time', project: 'tenant' }

    expect(readAutologinParams(window)).toEqual({
      token: null,
      code: 'one-time',
      project: 'tenant'
    })
  })

  it('reads a handoff code from the query only on the root path', () => {
    window.history.replaceState(null, '', '/?code=one-time&project=tenant')
    expect(readAutologinParams(window).code).toBe('one-time')

    window.history.replaceState(null, '', '/password/reset?code=reset-code&random=abc&project=tenant')
    expect(readAutologinParams(window).code).toBeNull()
  })
})

describe('stashAndStripAutologinQuery', () => {
  afterEach(() => {
    delete window[AUTOLOGIN_STASH_KEY]
    window.history.replaceState(null, '', '/')
  })

  it('stashes token and project then removes token from the location', () => {
    window.history.replaceState(
      null,
      '',
      '/orders?token=jwt-secret&project=tenant&filter=open#details'
    )

    stashAndStripAutologinQuery(window)

    expect(window[AUTOLOGIN_STASH_KEY]).toEqual({
      token: 'jwt-secret',
      code: null,
      project: 'tenant'
    })
    expect(window.location.pathname).toBe('/orders')
    expect(window.location.search).toBe('?project=tenant&filter=open')
    expect(window.location.hash).toBe('#details')
    expect(window.location.href).not.toContain('jwt-secret')
  })
})

describe('stashAndStripAutologinQuery handoff code', () => {
  afterEach(() => {
    delete window[AUTOLOGIN_STASH_KEY]
    window.history.replaceState(null, '', '/')
  })

  it('stashes the code and removes it from the location', () => {
    window.history.replaceState(null, '', '/?project=tenant&code=one-time-secret')

    stashAndStripAutologinQuery(window)

    expect(window[AUTOLOGIN_STASH_KEY]).toEqual({ token: null, code: 'one-time-secret', project: 'tenant' })
    expect(window.location.search).toBe('?project=tenant')
    expect(window.location.href).not.toContain('one-time-secret')
  })

  it('leaves the password reset code alone', () => {
    window.history.replaceState(null, '', '/password/reset?code=reset-code&random=abc&project=tenant')

    stashAndStripAutologinQuery(window)

    expect(window[AUTOLOGIN_STASH_KEY]).toBeUndefined()
    expect(window.location.search).toBe('?code=reset-code&random=abc&project=tenant')
  })
})

const runIndexHtmlStash = (path) => {
  const script = indexHtml.match(/<script>\s*(\(function \(\) \{[\s\S]*?__ORDERING_AUTOLOGIN__[\s\S]*?\}\)\(\);)\s*<\/script>/)
  expect(script).not.toBeNull()
  window.history.replaceState(null, '', path)
  // eslint-disable-next-line no-new-func
  new Function(script[1])()
}

describe('index.html handoff code stash', () => {
  afterEach(() => {
    delete window[AUTOLOGIN_STASH_KEY]
    window.history.replaceState(null, '', '/')
  })

  it('stashes and strips a root-path code before the app loads', () => {
    runIndexHtmlStash('/?project=tenant&code=one-time-secret')

    expect(window[AUTOLOGIN_STASH_KEY]).toEqual({ token: null, code: 'one-time-secret', project: 'tenant' })
    expect(window.location.search).toBe('?project=tenant')
  })

  it('does not touch the password reset code', () => {
    runIndexHtmlStash('/password/reset?code=reset-code&random=abc&project=tenant')

    expect(window[AUTOLOGIN_STASH_KEY]).toBeUndefined()
    expect(window.location.search).toBe('?code=reset-code&random=abc&project=tenant')
  })
})

describe('index.html autologin boot', () => {
  it('runs a blocking stash-and-strip before OneSignal and Canny', () => {
    const stashIdx = indexHtml.indexOf(AUTOLOGIN_STASH_KEY)
    const onesignalIdx = indexHtml.indexOf('cdn.onesignal.com')
    const gtmIdx = indexHtml.indexOf('canny.io/sdk.js')

    expect(stashIdx).toBeGreaterThan(-1)
    expect(onesignalIdx).toBeGreaterThan(-1)
    expect(gtmIdx).toBeGreaterThan(-1)
    expect(stashIdx).toBeLessThan(onesignalIdx)
    expect(stashIdx).toBeLessThan(gtmIdx)
    expect(indexHtml).not.toContain('googletagmanager.com')
    expect(indexHtml).toMatch(/searchParams\.delete\(['"]token['"]\)/)
    expect(indexHtml).toMatch(/searchParams\.delete\(['"]code['"]\)/)
    expect(stashIdx).toBeLessThan(indexHtml.indexOf('intercomSettings'))
    expect(indexHtml.slice(0, onesignalIdx)).not.toMatch(/type=["']module["']/)
  })
})
