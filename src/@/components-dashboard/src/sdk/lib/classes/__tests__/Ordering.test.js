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

// bugs E 40b: a reply that is not JSON used to throw inside xhr.onload and the promise never settled (the store add
// stayed «creating» forever). It now rejects, like a network failure or a 5xx, which every caller already handles.
describe('Ordering makeRequest settles on every reply', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const installReply = ({ status = 200, response = '', event = 'onload' } = {}) => {
    const instances = []
    const thrown = []
    class ReplyXhr {
      constructor () { instances.push(this) }
      open () {}
      setRequestHeader () {}
      abort () {}
      send () {
        this.status = status
        this.statusText = 'status'
        this.response = response
        // a real XMLHttpRequest calls its handlers later, outside the Promise executor: a throw there cannot reject the promise
        setTimeout(() => {
          try { this[event]?.({ type: event }) } catch (err) { thrown.push(err) }
        }, 0)
      }
    }
    vi.stubGlobal('window', { XMLHttpRequest: ReplyXhr })
    instances.thrown = thrown
    return instances
  }
  const ordering = () => new Ordering({ url: 'https://api.test', version: 'v400', language: 'en', project: 'demo' })

  it('rejects when the reply is not JSON (HTML error page)', async () => {
    installReply({ status: 200, response: '<html>Bad gateway</html>' })
    await expect(ordering().post('/business', {})).rejects.toThrow()
  })

  it('rejects when a 4xx reply is not JSON', async () => {
    installReply({ status: 404, response: '<html>Not found</html>' })
    await expect(ordering().get('/business')).rejects.toThrow()
  })

  it('rejects when the reply is empty and JSON was expected', async () => {
    installReply({ status: 200, response: '' })
    await expect(ordering().get('/business')).rejects.toThrow()
  })

  it('still resolves a JSON error reply with its content, so callers keep reading error/result', async () => {
    installReply({ status: 422, response: JSON.stringify({ error: true, result: ['The slug has already been taken.'] }) })
    const answer = await ordering().post('/business', {})
    expect(answer.content).toEqual({ error: true, result: ['The slug has already been taken.'] })
    expect(answer.status).toBe(422)
  })

  it('still rejects a 5xx reply and a network error', async () => {
    installReply({ status: 502, response: '<html>Bad gateway</html>' })
    await expect(ordering().get('/business')).rejects.toThrow('Internal error')
    installReply({ event: 'onerror' })
    await expect(ordering().get('/business')).rejects.toBeDefined()
  })

  it('rejects when the request times out', async () => {
    installReply({ event: 'ontimeout' })
    await expect(ordering().get('/business')).rejects.toThrow()
  })

  it('a request cancelled on purpose stays silent: callers that cancel (cancelToken) must not get an error', async () => {
    const instances = installReply({ event: 'onabort' })
    const settled = vi.fn()
    ordering().get('/business').then(settled, settled)
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(instances).toHaveLength(1)
    expect(settled).not.toHaveBeenCalled()
  })
})
