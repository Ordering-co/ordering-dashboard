import { Extension, Mark, Node, generateHTML, generateJSON } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyleKit } from '@tiptap/extension-text-style'
import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'

const IFRAME_ATTRIBUTES = ['src', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen', 'title', 'loading', 'referrerpolicy']

const Iframe = Node.create({
  name: 'iframe',
  group: 'block',
  atom: true,
  addAttributes () {
    return Object.fromEntries(IFRAME_ATTRIBUTES.map(name => [name, { default: null, parseHTML: element => element.getAttribute(name) }]))
  },
  parseHTML () {
    return [{ tag: 'iframe' }]
  },
  renderHTML ({ HTMLAttributes }) {
    return ['iframe', HTMLAttributes]
  }
})

const TableClass = Extension.create({
  name: 'tableClass',
  addGlobalAttributes () {
    return [{ types: ['table'], attributes: { class: { default: null, parseHTML: element => element.getAttribute('class') } } }]
  }
})

const ImageWithStyle = Image.extend({
  addAttributes () {
    return {
      ...this.parent?.(),
      style: { default: null, parseHTML: element => element.getAttribute('style') },
      class: { default: null, parseHTML: element => element.getAttribute('class') }
    }
  }
})

const BlockIndent = Extension.create({
  name: 'blockIndent',
  addGlobalAttributes () {
    return [{
      types: ['paragraph', 'heading', 'blockquote'],
      attributes: {
        marginLeft: {
          default: null,
          parseHTML: element => element.style.marginLeft || null,
          renderHTML: attributes => (attributes.marginLeft ? { style: `margin-left: ${attributes.marginLeft}` } : {})
        }
      }
    }]
  }
})

export const CTA_BUTTON_STYLE = 'font-size: 9px;color: white;padding: 6px 11px; cursor: pointer; border-radius: 4px; background: #2C7BE5; border: none;'

const CtaButton = Mark.create({
  name: 'button',
  inclusive: false,
  addAttributes () {
    return { style: { default: null, parseHTML: element => element.getAttribute('style') } }
  },
  parseHTML () {
    return [{ tag: 'button' }]
  },
  renderHTML ({ HTMLAttributes }) {
    return ['button', HTMLAttributes, 0]
  }
})

export const richHtmlExtensions = [
  StarterKit.configure({
    trailingNode: false,
    link: { openOnClick: false, autolink: false, HTMLAttributes: { target: null, rel: null } }
  }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TextStyleKit,
  ImageWithStyle.configure({ inline: true, allowBase64: true }),
  TableKit.configure({ table: { resizable: false } }),
  TableClass,
  BlockIndent,
  CtaButton,
  Iframe
]

const ALIASES = { b: 'strong', i: 'em', strike: 's', del: 's' }
const INLINE = new Set(['a', 'abbr', 'b', 'br', 'button', 'code', 'del', 'em', 'font', 'i', 'img', 'kbd', 'mark', 's', 'small', 'span', 'strike', 'strong', 'sub', 'sup', 'u'])
const CONTAINERS = new Set(['body', 'li', 'td', 'th', 'blockquote'])
const INLINE_HOSTS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'code'])
const TABLE_PARTS = new Set(['table', 'col'])
const MARK_ORDER = ['a', 'button', 'strong', 'em', 'u', 's', 'code', 'sub', 'sup']

const isElement = (node) => node.nodeType === 1
const isText = (node) => node.nodeType === 3
const tagOf = (element) => element.nodeName.toLowerCase()
const isInline = (node) => isText(node) || INLINE.has(tagOf(node))
const escapeText = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const hexToRgb = (hex) => {
  const full = hex.length === 3 ? [...hex].map(char => char + char).join('') : hex
  return `rgb(${parseInt(full.slice(0, 2), 16)}, ${parseInt(full.slice(2, 4), 16)}, ${parseInt(full.slice(4, 6), 16)})`
}

const valueOf = (property, value) => {
  const plain = value
    .replace(/\s*!important$/i, '')
    .replace(/#([0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-z])/gi, (_match, hex) => hexToRgb(hex.toLowerCase()))
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
  if (property === 'font-family') return plain.replace(/['"]/g, '')
  // DOM implementations rewrite these: `border: none` can come back as `border: medium` (no visible border either way) and `0` as `0px`.
  if (property === 'border') return plain === 'medium' ? 'none' : plain.replace(/(^| )0(?= |$)/g, '$10px')
  return /^(margin|padding|border)(-|$)/.test(property) ? plain.replace(/(^| )0(?= |$)/g, '$10px') : plain
}

const rulesOf = (value, tag) => value.split(';')
  .map(rule => [rule.slice(0, rule.indexOf(':')).trim().toLowerCase(), rule.slice(rule.indexOf(':') + 1)])
  .map(([property, propertyValue]) => [property, valueOf(property, propertyValue)])
  .filter(([property, propertyValue]) => property && propertyValue && !(TABLE_PARTS.has(tag) && property === 'min-width'))

const styleOf = (value, tag) => [...new Map(rulesOf(value, tag)).entries()]
  .map(([property, propertyValue]) => `${property}: ${propertyValue}`)
  .sort()
  .join('; ')

const attributesOf = (element, tag, skip = []) => [...element.attributes]
  .map(({ name, value }) => [name.toLowerCase(), value])
  // `data-*` is what a paste from another tool leaves behind (ChatGPT's `data-start`, `data-end`): nothing a reader sees, so losing it is not a loss.
  .filter(([name, value]) => !skip.includes(name) && !name.startsWith('data-') && !((name === 'colspan' || name === 'rowspan') && value === '1'))
  .map(([name, value]) => [name, name === 'style' ? styleOf(value, tag) : name === 'class' ? value.split(/\s+/).filter(Boolean).sort().join(' ') : value])
  .filter(([name, value]) => !((name === 'style' || name === 'class') && !value))
  .sort(([a], [b]) => (a < b ? -1 : 1))
  .map(([name, value]) => ` ${name}="${escapeText(value)}"`)
  .join('')

const rankOf = (tag) => {
  const index = MARK_ORDER.indexOf(tag)
  return index === -1 ? MARK_ORDER.length : index
}

const withMark = (context, node, tag) => {
  if (tag === 'span' || tag === 'font') {
    const style = { ...context.style }
    if (node.hasAttribute('style')) rulesOf(node.getAttribute('style'), tag).forEach(([property, value]) => { style[property] = value })
    const rest = attributesOf(node, tag, ['style'])
    const marks = rest || tag === 'font' ? [...context.marks, { tag, rank: MARK_ORDER.length + 1, open: `<${tag}${rest}>` }] : context.marks
    return { marks, style }
  }
  return { marks: [...context.marks, { tag, rank: rankOf(tag), open: `<${tag}${attributesOf(node, tag)}>` }], style: context.style }
}

const keyOf = ({ marks, style }) => JSON.stringify([marks.map(mark => mark.open).sort(), Object.entries(style).sort()])

const wrapped = (content, { marks, style }) => {
  const styled = Object.keys(style).length ? `<span style="${styleOf(Object.entries(style).map(([property, value]) => `${property}: ${value}`).join(';'), 'span')}">${content}</span>` : content
  return [...marks]
    .sort((a, b) => a.rank - b.rank || (a.open < b.open ? -1 : 1))
    .reduceRight((inner, mark) => `${mark.open}${inner}</${mark.tag}>`, styled)
}

const flatten = (nodes, context, tokens, preserve) => nodes.forEach(node => {
  if (isText(node)) return tokens.push({ text: preserve ? node.textContent : node.textContent.replace(/\s+/g, ' '), context })
  if (!isElement(node)) return
  const original = tagOf(node)
  const tag = ALIASES[original] || original
  if (tag === 'br' || tag === 'img') return tokens.push({ atom: `<${tag}${attributesOf(node, tag)}>`, context })
  flatten([...node.childNodes], withMark(context, node, tag), tokens, preserve)
})

const inlineHtml = (nodes, preserve) => {
  const tokens = []
  flatten(nodes, { marks: [], style: {} }, tokens, preserve)
  const runs = []
  tokens.forEach(token => {
    const key = keyOf(token.context)
    const last = runs[runs.length - 1]
    if (token.text !== undefined && last && last.text !== undefined && last.key === key) last.text += token.text
    else runs.push({ ...token, key })
  })
  return runs
    .filter(run => run.atom || run.text)
    .map(run => wrapped(run.atom || escapeText(run.text), run.context))
    .join('')
}

const childrenOf = (element, tag) => {
  const nodes = [...element.childNodes].filter(node => isElement(node) || isText(node))
  if (tag === 'pre' && nodes.length === 1 && tagOf(nodes[0]) === 'code' && !nodes[0].attributes.length) return childrenOf(nodes[0], 'code')
  if (INLINE_HOSTS.has(tag)) return inlineHtml(nodes, tag === 'pre' || tag === 'code')
  if (!CONTAINERS.has(tag)) return nodes.map(serialize).join('')
  const parts = []
  let run = []
  const flush = () => {
    const content = inlineHtml(run)
    if (run.some(node => !isText(node) || node.textContent.trim()) && content) parts.push(`<p>${content}</p>`)
    run = []
  }
  nodes.forEach(node => {
    if (isInline(node)) return run.push(node)
    flush()
    parts.push(serialize(node))
  })
  flush()
  if (tag !== 'body' && parts.length === 1 && parts[0].startsWith('<p>')) return parts[0].slice(3, -4)
  return parts.join('')
}

const serialize = (node) => {
  if (isText(node)) return escapeText(node.textContent.replace(/\s+/g, ' '))
  const original = tagOf(node)
  if (original === 'colgroup') return ''
  const tag = ALIASES[original] || original
  return `<${tag}${attributesOf(node, tag)}>${childrenOf(node, tag)}</${tag}>`
}

const documentOf = (html) => new window.DOMParser().parseFromString(html, 'text/html')

const bodyOf = (html) => documentOf(html).body

const FONT_ATTRIBUTES = ['color', 'face', 'style']

// Summernote writes colors as <font color> and fonts as <font face>. They mean the same as the
// style the editor writes, so they become that before parsing. <font size> has no safe equivalent.
export const prepareHtml = (html) => {
  if (!html || !/<font[\s>]/i.test(html)) return html
  const body = bodyOf(html)
  body.querySelectorAll('font').forEach(font => {
    const names = [...font.attributes].map(attribute => attribute.name.toLowerCase())
    if (names.some(name => !FONT_ATTRIBUTES.includes(name))) return
    const span = body.ownerDocument.createElement('span')
    const rules = [font.getAttribute('color') && `color: ${font.getAttribute('color')}`, font.getAttribute('face') && `font-family: ${font.getAttribute('face')}`, font.getAttribute('style')]
    const style = rules.filter(Boolean).join(';')
    if (style) span.setAttribute('style', style)
    span.append(...font.childNodes)
    font.replaceWith(span)
  })
  return body.innerHTML
}

const canonicalHtml = (html) => childrenOf(bodyOf(html), 'body').replace(/\s*(<[^>]+>)\s*/g, '$1').trim()

export const keepsHtml = (html) => {
  if (!html || !html.trim()) return true
  try {
    // <style>, <script>, <link>... go to the <head>, where neither the editor nor the comparison would see them.
    if (documentOf(html).head.children.length) return false
    const prepared = prepareHtml(html)
    return canonicalHtml(generateHTML(generateJSON(prepared, richHtmlExtensions), richHtmlExtensions)) === canonicalHtml(prepared)
  } catch {
    return false
  }
}

export const tidyHtml = (html) => {
  const body = bodyOf(html)
  body.querySelectorAll('li, td, th').forEach(cell => {
    const only = cell.children.length === 1 ? cell.firstElementChild : null
    const alone = only && [...cell.childNodes].every(node => node === only || !node.textContent.trim())
    if (alone && tagOf(only) === 'p' && !only.attributes.length) only.replaceWith(...only.childNodes)
  })
  body.querySelectorAll('p, h1, h2, h3, h4, h5, h6').forEach(block => {
    if (!block.childNodes.length) block.appendChild(body.ownerDocument.createElement('br'))
  })
  return body.innerHTML === '<p><br></p>' ? '' : body.innerHTML
}

export const editorContextOf = (editor) => ({
  invoke: (command, value) => {
    const chain = editor.chain().focus()
    if (command === 'editor.createLink') {
      if (!value?.url) return
      const link = { type: 'link', attrs: { href: value.url, target: value.isNewWindow ? '_blank' : null } }
      const marks = value.isButton ? [link, { type: 'button', attrs: { style: CTA_BUTTON_STYLE } }] : [link]
      if (value.text || editor.state.selection.empty) return chain.insertContent({ type: 'text', text: value.text || value.url, marks }).run()
      const selected = chain.extendMarkRange('link').setLink(link.attrs)
      return (value.isButton ? selected.setMark('button', { style: CTA_BUTTON_STYLE }) : selected).run()
    }
    if (command === 'editor.insertImage') return value && chain.setImage({ src: value }).run()
    if (command === 'editor.pasteHTML') return value && chain.insertContent(value).run()
  }
})
