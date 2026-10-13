import { describe, expect, it } from 'vitest'
import { ASSISTANT_NOTICE, getAssistantNotice, getAssistantNoticeLanguage } from '../notice'

describe('getAssistantNotice', () => {
  it('picks the text by the base language code', () => {
    expect(getAssistantNotice('es')).toBe(ASSISTANT_NOTICE.es)
    expect(getAssistantNotice('es-MX')).toBe(ASSISTANT_NOTICE.es)
    expect(getAssistantNotice(' ES_419 ')).toBe(ASSISTANT_NOTICE.es)
    expect(getAssistantNotice('en')).toBe(ASSISTANT_NOTICE.en)
    expect(getAssistantNotice('fr')).toBe(ASSISTANT_NOTICE.fr)
    expect(getAssistantNotice('pt-BR')).toBe(ASSISTANT_NOTICE.pt)
  })

  it('falls back to English without text for the language', () => {
    expect(getAssistantNotice('ja')).toBe(ASSISTANT_NOTICE.en)
    expect(getAssistantNotice('zh-CN')).toBe(ASSISTANT_NOTICE.en)
    expect(getAssistantNotice(null)).toBe(ASSISTANT_NOTICE.en)
    expect(getAssistantNotice(undefined)).toBe(ASSISTANT_NOTICE.en)
  })

  it('has the same shape in every language', () => {
    Object.values(ASSISTANT_NOTICE).forEach(notice => {
      expect(notice.points).toHaveLength(ASSISTANT_NOTICE.en.points.length)
      notice.points.forEach(point => expect(point).toEqual(expect.any(String)))
      expect(notice.paragraphs).toHaveLength(ASSISTANT_NOTICE.en.paragraphs.length)
      notice.paragraphs.forEach(paragraph => expect(paragraph).toEqual(expect.any(String)))
      ;['title', 'version', 'accept', 'error', 'outdated'].forEach(field => expect(notice[field]).toEqual(expect.any(String)))
      expect(notice.version).toContain('_version_')
    })
  })

  it('has a text for every Dashboard language', () => {
    expect(Object.keys(ASSISTANT_NOTICE).sort()).toEqual(['ar', 'bg', 'da', 'de', 'el', 'en', 'es', 'fr', 'it', 'nl', 'pt', 'tr'])
  })

  it('gives the language of the text it shows', () => {
    expect(getAssistantNoticeLanguage('es-MX')).toBe('es')
    expect(getAssistantNoticeLanguage('ja')).toBe('en')
    expect(getAssistantNoticeLanguage('constructor')).toBe('en')
    expect(getAssistantNoticeLanguage(null)).toBe('en')
  })
})
