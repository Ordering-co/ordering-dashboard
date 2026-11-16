import { describe, expect, it } from 'vitest'
import { summarizeUserAgent } from '../summarizeUserAgent'

// ST8: a log row says «Chrome 155 · macOS», not the 150 characters of the user agent (the detail keeps the whole string).
const UA = {
  chromeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
  chromeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.54 Safari/537.36',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.58 Mobile Safari/537.36',
  chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1',
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  safariIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
  firefoxMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0',
  edgeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.2849.68'
}

describe('summarizeUserAgent', () => {
  it.each([
    ['Chrome on macOS', UA.chromeMac, 'Chrome 155 · macOS'],
    ['Chrome on Windows', UA.chromeWin, 'Chrome 141 · Windows'],
    ['Chrome on Android', UA.chromeAndroid, 'Chrome 130 · Android'],
    ['Chrome on iOS (CriOS)', UA.chromeIos, 'Chrome 126 · iOS'],
    ['Safari on macOS (version from Version/)', UA.safariMac, 'Safari 17 · macOS'],
    ['Safari on iOS', UA.safariIos, 'Safari 17 · iOS'],
    ['Firefox on Linux', UA.firefoxLinux, 'Firefox 128 · Linux'],
    ['Firefox on macOS', UA.firefoxMac, 'Firefox 131 · macOS'],
    ['Edge (it also says Chrome and Safari)', UA.edgeWin, 'Edge 130 · Windows']
  ])('%s', (_name, agent, expected) => {
    expect(summarizeUserAgent(agent)).toEqual({ text: expected, parsed: true })
  })

  it('shows a client that is not a browser as it came, trimmed', () => {
    expect(summarizeUserAgent('okhttp/4.12.0')).toEqual({ text: 'okhttp/4.12.0', parsed: false })
    expect(summarizeUserAgent('axios/1.7.2')).toEqual({ text: 'axios/1.7.2', parsed: false })
    expect(summarizeUserAgent('curl/8.0')).toEqual({ text: 'curl/8.0', parsed: false })
    expect(summarizeUserAgent('OrderingApp/2.3.1 (iPhone; iOS 17.5) CFNetwork/1494 Darwin/23.4.0')).toMatchObject({ parsed: false })
  })

  it('shows an unknown agent as it came when it is short, and cut with an ellipsis when it is long', () => {
    expect(summarizeUserAgent('Mozilla/5.0 (Macintosh)')).toEqual({ text: 'Mozilla/5.0 (Macintosh)', parsed: false })
    const long = `SomeCrawler/1.0 ${'x'.repeat(200)}`
    const { text, parsed } = summarizeUserAgent(long)
    expect(parsed).toBe(false)
    expect(text.length).toBeLessThanOrEqual(48)
    expect(text.endsWith('…')).toBe(true)
    expect(long.startsWith(text.slice(0, -1))).toBe(true)
  })

  it('names the browser alone when the system is not known, or the version is missing', () => {
    expect(summarizeUserAgent('Mozilla/5.0 (PlayStation) Chrome/100.0.1 Safari/537.36')).toEqual({ text: 'Chrome 100', parsed: true })
    expect(summarizeUserAgent('Mozilla/5.0 (Windows NT 10.0) Firefox')).toEqual({ text: 'Firefox · Windows', parsed: true })
  })

  it('collapses whitespace, and is empty for nothing', () => {
    expect(summarizeUserAgent('  curl/8.0 \n ')).toEqual({ text: 'curl/8.0', parsed: false })
    expect(summarizeUserAgent('')).toEqual({ text: '', parsed: false })
    expect(summarizeUserAgent(null)).toEqual({ text: '', parsed: false })
    expect(summarizeUserAgent(undefined)).toEqual({ text: '', parsed: false })
  })
})
