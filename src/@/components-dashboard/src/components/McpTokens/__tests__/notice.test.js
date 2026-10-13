import { describe, expect, it } from 'vitest'
import { MCP_DATA_NOTICE, getMcpDataNotice, getMcpDataNoticeLanguage } from '../notice'

describe('getMcpDataNotice', () => {
  it('picks the text by the base language code, in English without a text for it', () => {
    expect(getMcpDataNotice('es-MX')).toBe(MCP_DATA_NOTICE.es)
    expect(getMcpDataNotice('pt_BR')).toBe(MCP_DATA_NOTICE.pt)
    expect(getMcpDataNotice('ja')).toBe(MCP_DATA_NOTICE.en)
    expect(getMcpDataNoticeLanguage('ja')).toBe('en')
    expect(getMcpDataNoticeLanguage(null)).toBe('en')
  })

  it('has a text for every Dashboard language, with the same shape', () => {
    expect(Object.keys(MCP_DATA_NOTICE).sort()).toEqual(['ar', 'bg', 'da', 'de', 'el', 'en', 'es', 'fr', 'it', 'nl', 'pt', 'tr'])
    Object.values(MCP_DATA_NOTICE).forEach(notice => {
      expect(notice.intro).toEqual(expect.any(String))
      expect(notice.accept).toEqual(expect.any(String))
      expect(notice.title).toEqual(expect.any(String))
      expect(notice.outdated).toEqual(expect.any(String))
      ;['read', 'write'].forEach(scope => {
        expect(notice.scopes[scope].title).toEqual(expect.any(String))
        expect(notice.scopes[scope].description).toEqual(expect.any(String))
      })
      expect(notice.points).toHaveLength(MCP_DATA_NOTICE.en.points.length)
      notice.points.forEach(point => {
        expect(point.label).toEqual(expect.any(String))
        expect(point.text).toEqual(expect.any(String))
      })
    })
  })
})
