import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { editorContextOf, keepsHtml, richHtmlExtensions, tidyHtml } from '../richHtml'

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
    ['<p><font color="#ff0000">A</font></p>', 'a font tag'],
    ['<p onclick="go()">A</p>', 'an event handler'],
    ['<p><span style="letter-spacing: 2px;">A</span></p>', 'a style the editor doesn’t have'],
    ['<button type="button">Order</button>', 'a button']
  ])('doesn’t keep %j (%s)', (html) => {
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

  it('inserts an image from the image dialog', () => {
    editorWith('<p>Logo:</p>').invoke('editor.insertImage', 'https://cdn.test/logo.png')
    expect(editor.getHTML()).toBe('<p>Logo:<img src="https://cdn.test/logo.png"></p>')
  })

  it('inserts the video the video dialog embeds', () => {
    editorWith('<p>Watch</p>').invoke('editor.pasteHTML', '<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/abc" frameborder="0" allowfullscreen></iframe>')
    expect(editor.getHTML()).toBe('<p>Watch</p><iframe src="https://www.youtube-nocookie.com/embed/abc" width="560" height="315" frameborder="0" allowfullscreen=""></iframe>')
  })
})
