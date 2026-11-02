import { Extension, Node, generateHTML, generateJSON } from '@tiptap/core'
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

export const richHtmlExtensions = [
  StarterKit.configure({
    trailingNode: false,
    link: { openOnClick: false, autolink: false, HTMLAttributes: { target: null, rel: null } }
  }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TextStyleKit.configure({ fontFamily: false, lineHeight: false }),
  Image.configure({ inline: true, allowBase64: true }),
  TableKit.configure({ table: { resizable: false } }),
  TableClass,
  Iframe
]

const ALIASES = { b: 'strong', i: 'em', strike: 's', del: 's' }
const INLINE = new Set(['a', 'abbr', 'b', 'br', 'code', 'del', 'em', 'font', 'i', 'img', 'kbd', 'mark', 's', 'small', 'span', 'strike', 'strong', 'sub', 'sup', 'u'])
const CONTAINERS = new Set(['body', 'li', 'td', 'th', 'blockquote'])
const TABLE_PARTS = new Set(['table', 'col'])

const isElement = (node) => node.nodeType === 1
const isText = (node) => node.nodeType === 3
const tagOf = (element) => element.nodeName.toLowerCase()
const isInline = (node) => isText(node) || INLINE.has(tagOf(node))
const escapeText = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const styleOf = (value, tag) => value.split(';')
  .map(rule => [rule.slice(0, rule.indexOf(':')).trim().toLowerCase(), rule.slice(rule.indexOf(':') + 1).trim().replace(/\s+/g, ' ')])
  .filter(([property, propertyValue]) => property && propertyValue && !(TABLE_PARTS.has(tag) && property === 'min-width'))
  .map(([property, propertyValue]) => `${property}: ${propertyValue}`)
  .sort()
  .join('; ')

const attributesOf = (element, tag) => [...element.attributes]
  .map(({ name, value }) => [name.toLowerCase(), value])
  .filter(([name, value]) => !((name === 'colspan' || name === 'rowspan') && value === '1'))
  .map(([name, value]) => [name, name === 'style' ? styleOf(value, tag) : name === 'class' ? value.split(/\s+/).filter(Boolean).sort().join(' ') : value])
  .filter(([name, value]) => !((name === 'style' || name === 'class') && !value))
  .sort(([a], [b]) => (a < b ? -1 : 1))
  .map(([name, value]) => ` ${name}="${escapeText(value)}"`)
  .join('')

const childrenOf = (element, tag) => {
  const nodes = [...element.childNodes].filter(node => isElement(node) || isText(node))
  if (tag === 'pre' && nodes.length === 1 && tagOf(nodes[0]) === 'code' && !nodes[0].attributes.length) return childrenOf(nodes[0], 'code')
  if (!CONTAINERS.has(tag)) return nodes.map(serialize).join('')
  const parts = []
  let run = []
  const flush = () => {
    const content = run.map(serialize).join('')
    if (content.trim()) parts.push(`<p>${content}</p>`)
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

const bodyOf = (html) => new window.DOMParser().parseFromString(html, 'text/html').body

const canonicalHtml = (html) => childrenOf(bodyOf(html), 'body').replace(/\s*(<[^>]+>)\s*/g, '$1').trim()

export const keepsHtml = (html) => {
  if (!html || !html.trim()) return true
  try {
    return canonicalHtml(generateHTML(generateJSON(html, richHtmlExtensions), richHtmlExtensions)) === canonicalHtml(html)
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
      if (value.text || editor.state.selection.empty) return chain.insertContent({ type: 'text', text: value.text || value.url, marks: [link] }).run()
      return chain.extendMarkRange('link').setLink(link.attrs).run()
    }
    if (command === 'editor.insertImage') return value && chain.setImage({ src: value }).run()
    if (command === 'editor.pasteHTML') return value && chain.insertContent(value).run()
  }
})
