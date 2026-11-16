// api-core restrictions on campaign emails (verified there): placeholders are replaced with an exact str_replace and
// links are rewritten for tracking with a regex over double or single quoted http(s) hrefs. The editor must hand them
// back untouched.
import { describe, expect, it } from 'vitest'
import { generateHTML, generateJSON } from '@tiptap/core'
import { keepsHtml, prepareHtml, richHtmlExtensions, tidyHtml } from '../richHtml'
import { getUtils } from '../../../Marketing/CampaignEmail/utils'

const roundTrip = (html) => tidyHtml(generateHTML(generateJSON(prepareHtml(html), richHtmlExtensions), richHtmlExtensions))

const TOKENS = [
  '{{ user_name }}', '{{user_name}}', '{{ user_lastname }}', '{{ user_email }}', '{{ user_full_name }}',
  '{{ unsubscribe_link }}', '{{ tracking_id }}', '{{ pixel_url }}', ':user_name', ':user_lastname', ':user_email'
]

// The backend regex for tracked links
const LINK = /(<a\b[^>]*?\shref\s*=\s*)(["'])(.*?)\2/is
const hrefsOf = (html) => [...html.matchAll(new RegExp(LINK.source, 'gis'))].map(match => match[3])

describe('campaign email: placeholders leave the editor byte for byte', () => {
  it.each(TOKENS)('keeps %s in a paragraph', (token) => {
    const html = `<p>Hi ${token}, welcome</p>`
    expect(roundTrip(html)).toBe(html)
    expect(roundTrip(html)).toContain(token)
  })

  it.each(TOKENS)('keeps %s whole when the whole token is bold', (token) => {
    const html = `<p>Hi <strong>${token}</strong>!</p>`
    expect(roundTrip(html)).toBe(html)
  })

  it.each(TOKENS)('keeps %s whole when the whole token has a color and a size', (token) => {
    const out = roundTrip(`<p><span style="color: rgb(255, 0, 0); font-size: 18px;">${token}</span></p>`)
    expect(out).toContain(`>${token}</span>`)
  })

  it.each(TOKENS)('keeps %s in headings, list items and table cells', (token) => {
    const html = `<h2>${token}</h2><ul><li>${token}</li></ul><table><tbody><tr><td>${token}</td></tr></tbody></table>`
    const out = roundTrip(html)
    expect(out.split(token)).toHaveLength(4)
  })

  it('has no &nbsp; or escaped braces inside any token', () => {
    const out = roundTrip(`<p>${TOKENS.join(' / ')}</p>`)
    TOKENS.forEach(token => expect(out).toContain(token))
    expect(out).not.toMatch(/&nbsp;|&#123;|&lbrace;|%7B|%20/i)
  })

  it('keeps an unsubscribe token in a href without encoding braces or spaces', () => {
    const html = '<p><a href="{{ unsubscribe_link }}">Unsubscribe</a></p>'
    const out = roundTrip(html)
    expect(out).toContain('href="{{ unsubscribe_link }}"')
    expect(hrefsOf(out)).toEqual(['{{ unsubscribe_link }}'])
  })

  it('keeps the tokens as the visual editor and the code view both see them', () => {
    expect(keepsHtml('<p>Hi {{ user_name }} :user_email <a href="{{ unsubscribe_link }}">x</a></p>')).toBe(true)
  })
})

describe('campaign email: links keep a quoted href the backend can rewrite', () => {
  it('keeps a plain link', () => {
    const out = roundTrip('<p><a href="https://burger.town/menu">Menu</a></p>')
    expect(out).toBe('<p><a href="https://burger.town/menu">Menu</a></p>')
    expect(hrefsOf(out)).toEqual(['https://burger.town/menu'])
  })

  it('keeps a link whose query has &', () => {
    const out = roundTrip('<p><a href="https://burger.town/menu?a=1&amp;b=2">Menu</a></p>')
    expect(LINK.test(out)).toBe(true)
    expect(hrefsOf(out)).toEqual(['https://burger.town/menu?a=1&amp;b=2'])
  })

  it('keeps a link written with single quotes, now double quoted', () => {
    const out = roundTrip("<p><a href='https://burger.town'>Visit</a></p>")
    expect(out).toContain('href="https://burger.town"')
  })

  it('keeps the campaign button as a link with a quoted href around the button', () => {
    const html = '<p><a href="https://www.ordering.co/demo/" target="_blank"><button style="font-size: 9px;color: white;padding: 6px 11px; cursor: pointer; border-radius: 4px; background: #2C7BE5; border: none;">Order now</button></a></p>'
    const out = roundTrip(html)
    expect(LINK.test(out)).toBe(true)
    expect(hrefsOf(out)).toEqual(['https://www.ordering.co/demo/'])
    expect(out).toMatch(/<a [^>]*href="https:\/\/www\.ordering\.co\/demo\/"[^>]*><button style="[^"]*">Order now<\/button><\/a>/)
  })
})

describe('campaign email: the default template', () => {
  const { defaultBodyContent } = getUtils()

  it('is kept by the visual editor', () => {
    expect(keepsHtml(defaultBodyContent)).toBe(true)
  })

  it('keeps its text, emoji, button link and bracketed placeholders', () => {
    const out = roundTrip(defaultBodyContent)
    expect(out).toContain("<p>Hi [Recipient's Name]!</p>")
    expect(out).toContain('💥 <strong>Exclusive Offer</strong>')
    expect(out).toContain('Fast &amp; Easy</strong>')
    expect(out).toContain('[Link to your marketplace with hyperlink]</button></a>')
    expect(hrefsOf(out)).toEqual(['https://www.ordering.co/demo/'])
  })

  it('is stable: a second round trip changes nothing', () => {
    const once = roundTrip(defaultBodyContent)
    expect(roundTrip(once)).toBe(once)
  })
})
