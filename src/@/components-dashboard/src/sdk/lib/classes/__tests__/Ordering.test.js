import { describe, it, expect, vi, afterEach } from 'vitest'
import { Ordering } from '../Ordering'

const installXhrMock = (onRequest) => {
  class MockXhr {
    open (method, url) {
      this.method = method
      this.url = url
      this.status = 200
      this.statusText = 'OK'
      this.response = JSON.stringify({ error: false, result: [] })
    }

    setRequestHeader () {}
    abort () {}

    send () {
      onRequest(this)
      this.onload?.()
    }
  }
  vi.stubGlobal('window', { XMLHttpRequest: MockXhr })
}

describe('Ordering URL building', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds root and system URLs from settings', () => {
    const ordering = new Ordering({ url: 'https://api.test', version: 'v400', language: 'en', project: 'demo' })
    expect(ordering.root).toBe('https://api.test/v400/en/demo')
    expect(ordering.systemRoot).toBe('https://api.test/v400')
  })

  it('strips trailing slashes from the base url', () => {
    const ordering = new Ordering({ url: 'https://api.test/', version: 'v400', language: 'en', project: 'orderingv1' })
    expect(ordering.root).toBe('https://api.test/v400/en/orderingv1')
    expect(ordering.systemRoot).toBe('https://api.test/v400')
    expect(ordering.setUrl('https://other.test//').root).toBe('https://other.test/v400/en/orderingv1')
  })

  it.each([
    ['https://api.test', '/users/1/addresses'],
    ['https://api.test/', '/users/1/addresses'],
    ['https://api.test', 'users/1/addresses'],
    ['https://api.test/', 'users/1/addresses']
  ])('requests exactly one slash between root and path (base %s, path %s)', async (url, path) => {
    const captured = []
    installXhrMock((xhr) => captured.push(xhr))
    const ordering = new Ordering({ url, version: 'v400', language: 'en', project: 'orderingv1' })
    await ordering.get(path)
    await ordering.post(path, {})
    await ordering.put(path, {})
    await ordering.delete(path)
    expect(captured).toHaveLength(4)
    captured.forEach((xhr) => {
      expect(xhr.url).toBe('https://api.test/v400/en/orderingv1/users/1/addresses')
    })
  })
})
