import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { generateHTML, generateJSON } from '@tiptap/core'
import { editorContextOf, keepsHtml, prepareHtml, richHtmlExtensions, tidyHtml } from '../richHtml'
import { getUtils } from '../../../Marketing/CampaignEmail/utils'

const CTA = '<a href="https://www.ordering.co/demo/" target="_blank"><button style=\'font-size: 9px;color: white;padding: 6px 11px; cursor: pointer; border-radius: 4px; background: #2C7BE5; border: none;\'>Order now</button></a>'

// The DOM rewrites the style attribute a little when it serializes it (hex to rgb, spaces, `none` to `medium` in jsdom).
const CTA_STYLE = /<button style="font-size: 9px;\s?color: white;\s?padding: 6px 11px;\s?cursor: pointer;\s?border-radius: 4px;\s?background: (#2C7BE5|rgb\(44, 123, 229\));\s?border: (none|medium);">/

const roundTrip = (html) => tidyHtml(generateHTML(generateJSON(prepareHtml(html), richHtmlExtensions), richHtmlExtensions))

// Markup the Summernote editors wrote, and what the visual editor writes back for it.
const SUMMERNOTE = [
  ['font color', '<p><font color="#ff0000">Red</font></p>', '<p><span style="color: rgb(255, 0, 0);">Red</span></p>'],
  ['font color and background', '<p><font color="#ff0000" style="background-color: rgb(255, 255, 0);">Hot</font></p>', ['color: rgb(255, 0, 0)', 'background-color: rgb(255, 255, 0)']],
  ['background span', '<p><span style="background-color: rgb(255, 255, 0);">Mark</span></p>', 'background-color: rgb(255, 255, 0)'],
  ['font size', '<p><span style="font-size: 18px;">Big</span></p>', 'font-size: 18px'],
  ['bold, italic, underline', '<p><b>A</b><i>B</i><u>C</u></p>', ['<strong>A</strong>', '<em>B</em>', '<u>C</u>']],
  ['underlined bold in the other order', '<p><u><b>AB</b></u></p>', 'AB'],
  ['font family', '<p><span style="font-family: \'Arial Black\';">Black</span><font face="Courier New">Mono</font></p>', ['font-family: &quot;Arial Black&quot;', 'font-family: &quot;Courier New&quot;']],
  ['nested size and color', '<p><span style="color: rgb(255, 0, 0);"><span style="font-size: 24px;">Both</span></span></p>', ['color: rgb(255, 0, 0)', 'font-size: 24px']],
  ['line height', '<p><span style="line-height: 2;">Tall</span></p>', 'line-height: 2'],
  ['centered paragraph', '<p style="text-align: center;">Hi</p>', '<p style="text-align: center;">Hi</p>'],
  ['indented paragraph', '<p style="margin-left: 25px;">Hi</p>', 'margin-left: 25px'],
  ['indented, right aligned heading', '<h2 style="text-align: right; margin-left: 50px;">Hi</h2>', ['text-align: right', 'margin-left: 50px']],
  ['indented quote', '<blockquote style="margin-left: 25px;">Q</blockquote>', 'margin-left: 25px'],
  ['table', '<table class="table table-bordered"><tbody><tr><td>A</td><td><br></td></tr><tr><td>&nbsp;</td><td>B</td></tr></tbody></table>', 'class="table table-bordered"'],
  ['sized image', '<p><img src="https://cdn.test/a.png" style="width: 50%;"></p>', 'style="width: 50%;"'],
  ['floated image', '<p><img src="https://cdn.test/a.png" class="note-float-left" style="float: left; width: 25%;" alt="Logo"></p>', ['class="note-float-left"', 'float: left', 'alt="Logo"']],
  ['image with size attributes', '<p><img src="https://cdn.test/a.png" width="120" height="60"></p>', ['width="120"', 'height="60"']],
  ['linked image', '<p><a href="https://burger.town"><img src="https://cdn.test/a.png"></a></p>', '<a href="https://burger.town"><img'],
  ['link', '<p><a href="https://burger.town" target="_blank">Visit</a></p>', 'target="_blank"'],
  ['empty paragraph', '<p>A</p><p><br></p><p>B</p>', '<p>A</p><p><br></p><p>B</p>'],
  ['loose line breaks', 'Line one<br>Line two<br>', 'Line one<br>Line two'],
  ['preformatted text', '<pre>one\ntwo</pre>', 'one\ntwo'],
  ['quote and headings', '<h1>A</h1><h6>F</h6><blockquote>Q</blockquote>', ['<h1>A</h1>', '<h6>F</h6>', '<blockquote>']],
  ['video', '<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/abc" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>', 'allow="autoplay; encrypted-media"'],
  ['campaign button', `<p>${CTA}</p>`, [CTA_STYLE, '>Order now</button></a>', 'href="https://www.ordering.co/demo/"', 'target="_blank"']]
]

describe('keepsHtml', () => {
  it.each([
    ['', 'nothing'],
    ['© 2026 Burger Town', 'plain text'],
    ['<p style="text-align: center;"><b>Open</b> <i>every</i> <u>day</u></p>', 'aligned text with styles'],
    ['<p><span style="font-size: 18px;">Big</span> <span style="color: rgb(255, 0, 0); background-color: rgb(255, 255, 0);">red</span></p>', 'font sizes and colors'],
    ['<h2>Menu</h2><ul><li>Burgers</li><li>Fries</li></ul><ol><li>One</li></ol>', 'headings and lists'],
    ['<p><a href="https://burger.town" target="_blank">Visit</a> <a href="/menu">Menu</a></p>', 'links'],
    ['<p><img src="https://cdn.test/logo.png" alt="Logo"></p>', 'an image'],
    ['<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/abc" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>', 'a video'],
    ['<table class="table table-bordered"><tbody><tr><td>Mon</td><td><br></td></tr></tbody></table>', 'a table'],
    ['<p><br></p><blockquote>Best in town</blockquote><pre>code</pre>', 'blank lines, quotes and code']
  ])('keeps %j (%s)', (html) => {
    expect(keepsHtml(html)).toBe(true)
  })

  it.each([
    ['<div class="row"><div class="col">A</div></div>', 'layout'],
    ['<style>.x{color:red}</style><p class="x">A</p>', 'a style sheet'],
    ['<script>window.a = 1</script>', 'a script'],
    ['<p><font color="#ff0000" size="4">A</font></p>', 'a font size'],
    ['<p onclick="go()">A</p>', 'an event handler'],
    ['<p><span style="letter-spacing: 2px;">A</span></p>', 'a style the editor doesn’t have'],
    ['<button type="button">Order</button>', 'a button']
  ])('doesn’t keep %j (%s)', (html) => {
    expect(keepsHtml(html)).toBe(false)
  })
})

describe('Summernote markup', () => {
  it.each(SUMMERNOTE)('opens %s in the visual editor and keeps it', (_name, html, expected) => {
    expect(keepsHtml(html)).toBe(true)
    const saved = roundTrip(html)
    ;[].concat(expected).forEach(part => (part instanceof RegExp ? expect(saved).toMatch(part) : expect(saved).toContain(part)))
  })

  it('opens the default campaign email in the visual editor', () => {
    const { defaultBodyContent } = getUtils()
    expect(keepsHtml(defaultBodyContent)).toBe(true)
    const saved = roundTrip(defaultBodyContent)
    expect(saved).toMatch(CTA_STYLE)
    expect(saved).toContain('>[Link to your marketplace with hyperlink]</button></a>')
    expect(saved).toContain('<a target="_blank" href="https://www.ordering.co/demo/">')
    expect(saved).toContain('<strong>Exclusive Offer</strong>')
    expect(saved).toContain('We look forward to serving you with unique flavors!<br>[Your Name]<br>[Marketplace_Name]')
  })

  it.each([
    ['a layout div', '<div class="row"><div class="col">A</div></div>'],
    ['a plain div', '<p>A</p><div>B</div>'],
    ['a leading style sheet', '<style>.x{color:red}</style><p>A</p>'],
    ['a leading script', '<script>track()</script><p>A</p>'],
    ['an email table', '<table bgcolor="#ffffff" cellpadding="0" cellspacing="0"><tbody><tr><td>A</td></tr></tbody></table>'],
    ['a cell width', '<table><tbody><tr><td style="width: 50%;">A</td></tr></tbody></table>'],
    ['a font size', '<p><font size="5">A</font></p>'],
    ['a class on text', '<p><span class="lead">A</span></p>'],
    ['a color on a paragraph', '<p style="color: red;">A</p>'],
    ['an image attribute it doesn’t know', '<p><img src="https://cdn.test/a.png" usemap="#areas"></p>'],
    ['a style on a list item', '<ul><li style="margin-left: 10px;">A</li></ul>'],
    ['highlighted text', '<p><mark>A</mark></p>']
  ])('still doesn’t keep %s', (_name, html) => {
    expect(keepsHtml(html)).toBe(false)
  })
})

describe('tidyHtml', () => {
  it('writes list items and table cells without a paragraph inside', () => {
    expect(tidyHtml('<ul><li><p>Burgers</p></li></ul><table><tbody><tr><td><p>Mon</p></td></tr></tbody></table>'))
      .toBe('<ul><li>Burgers</li></ul><table><tbody><tr><td>Mon</td></tr></tbody></table>')
  })

  it('keeps a list item’s paragraph when it has a style', () => {
    expect(tidyHtml('<ul><li><p style="text-align: center;">Burgers</p></li></ul>')).toBe('<ul><li><p style="text-align: center;">Burgers</p></li></ul>')
  })

  it('keeps blank lines', () => {
    expect(tidyHtml('<p>A</p><p></p><p>B</p>')).toBe('<p>A</p><p><br></p><p>B</p>')
  })

  it('is empty for an empty document', () => {
    expect(tidyHtml('<p></p>')).toBe('')
  })
})

describe('editorContextOf', () => {
  let editor
  const editorWith = (content) => {
    editor = new Editor({ extensions: richHtmlExtensions, content })
    editor.commands.focus('end')
    return editorContextOf(editor)
  }

  afterEach(() => editor?.destroy())

  it('inserts a link as the link dialog asks', () => {
    editorWith('<p>See:</p>').invoke('editor.createLink', { text: 'the menu', url: '/menu', isNewWindow: false })
    expect(editor.getHTML()).toBe('<p>See:<a href="/menu">the menu</a></p>')
  })

  it('opens the link in a new window when asked', () => {
    editorWith('<p></p>').invoke('editor.createLink', { text: 'Visit', url: 'https://burger.town', isNewWindow: true })
    expect(editor.getHTML()).toBe('<p><a target="_blank" href="https://burger.town">Visit</a></p>')
  })

  it('inserts the campaign button inside a link', () => {
    editorWith('<p>Visit us</p>').invoke('editor.createLink', { text: 'Order now', url: 'https://www.ordering.co/demo/', isNewWindow: true, isButton: true })
    const html = tidyHtml(editor.getHTML())
    expect(html).toMatch(/^<p>Visit us<a target="_blank" href="https:\/\/www\.ordering\.co\/demo\/">/)
    expect(html).toMatch(CTA_STYLE)
    expect(html).toMatch(/>Order now<\/button><\/a><\/p>$/)
    expect(keepsHtml(editor.getHTML())).toBe(true)
  })

  it('turns the selected text into the campaign button when no text is given', () => {
    editorWith('<p>Order</p>')
    editor.commands.selectAll()
    editorContextOf(editor).invoke('editor.createLink', { text: '', url: '/menu', isNewWindow: false, isButton: true })
    const html = tidyHtml(editor.getHTML())
    expect(html).toMatch(/^<p><a href="\/menu"><button style=/)
    expect(html).toMatch(CTA_STYLE)
    expect(html).toMatch(/>Order<\/button><\/a><\/p>$/)
  })

  it('doesn’t extend the button when typing after it', () => {
    editorWith('<p></p>').invoke('editor.createLink', { text: 'Go', url: '/menu', isNewWindow: false, isButton: true })
    editor.commands.insertContent(' after')
    expect(tidyHtml(editor.getHTML())).toContain('</button></a> after</p>')
  })

  it('inserts an image from the image dialog', () => {
    editorWith('<p>Logo:</p>').invoke('editor.insertImage', 'https://cdn.test/logo.png')
    expect(editor.getHTML()).toBe('<p>Logo:<img src="https://cdn.test/logo.png"></p>')
  })

  it('inserts the video the video dialog embeds', () => {
    editorWith('<p>Watch</p>').invoke('editor.pasteHTML', '<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/abc" frameborder="0" allowfullscreen></iframe>')
    expect(editor.getHTML()).toBe('<p>Watch</p><iframe src="https://www.youtube-nocookie.com/embed/abc" width="560" height="315" frameborder="0" allowfullscreen=""></iframe>')
  })
})

describe('markup pasted from another tool', () => {
  it('keeps in the visual editor the paragraphs that only carry data-* attributes', () => {
    expect(keepsHtml('<p data-start="856" data-end="932">We noticed you left your order behind — here’s 10% OFF to help you decide.</p><p></p><p data-start="939" data-end="1005"><br></p>')).toBe(true)
    expect(keepsHtml('<p data-start="488" data-end="575">Hey! Looks like you left something in your cart.</p><p>\n</p><p data-start="582" data-end="623">Ready when you are 👉</p>')).toBe(true)
  })

  it('still opens as HTML what carries a class or a script', () => {
    expect(keepsHtml('<p data-start="1" class="lead">Open</p>')).toBe(false)
    expect(keepsHtml('<p data-start="1">Open</p><script>track()</script>')).toBe(false)
  })
})
