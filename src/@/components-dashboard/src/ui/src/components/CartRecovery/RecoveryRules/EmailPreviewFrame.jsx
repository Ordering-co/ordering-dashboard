import React, { useCallback, useMemo, useRef } from 'react'

import { useLanguage } from '../../../../../index'
import './email-preview-frame.css'

// the preview of an email body (recovery rules and campaigns). The body is HTML typed by the project, so it is painted in an
// iframe instead of being injected into the app document with `dangerouslySetInnerHTML` (where `<img onerror>` or a `<script>` would run
// with the session of the dashboard). Shared by CartRecovery/RecoveryRules/MessagePreview and Marketing/CampaignEmail.
//
// `sandbox="allow-same-origin"`, WITHOUT `allow-scripts`: a sandboxed document with no `allow-scripts` runs no script and no inline handler
// (`onerror`, `onclick`, `javascript:` links), so same-origin is harmless here, and it is what lets `onLoad` read the document to fit the
// height. `allow-same-origin` must never be combined with `allow-scripts` (the framed page could then remove its own sandbox).
// `allow-popups allow-popups-to-escape-sandbox`: a link of the email opens in a new tab as an ordinary page (the `<base target>` below),
// as it would from the inbox; before this change it navigated the whole dashboard away. Popups need a click: with no scripts nothing can
// open one by itself. Not allowed on purpose: `allow-top-navigation`, `allow-forms`, `allow-modals`.
// The `<meta>` CSP is a second belt: no script source at all, even if the sandbox attribute were ever dropped.
const SANDBOX = 'allow-same-origin allow-popups allow-popups-to-escape-sandbox'

// What the body inherited from the page when it was injected into it: the frame's document starts from the browser's defaults, so on load
// it takes these from the wrapper the frame sits in, and the email reads as it did (the face itself is the first one of the family the
// frame's document can load: the app's self-hosted Inter is not declared in it, so it falls back to the system sans of the same stack).
const INHERITED = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'color']

// (review): the wrapper also styled the elements of the body (the campaign's `p { margin: 0; font-size: 12px }`), and the
// frame's paragraphs took the browser's 1em margins instead. Each of these tags is drawn once inside the wrapper, hidden, and what the
// wrapper gives it is written as a rule of the frame's document, so the email keeps the look it had when it was injected.
const STYLED_TAGS = ['p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a']
const TAG_PROPERTIES = ['margin-top', 'margin-bottom', 'font-size', 'font-weight', 'line-height', 'color', 'text-align']

const hostRules = (host) => {
  const probe = host.ownerDocument.createElement('div')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText = 'position:absolute;visibility:hidden;inline-size:0;block-size:0;overflow:hidden'
  host.appendChild(probe)
  const rules = STYLED_TAGS.map(tag => {
    const element = probe.appendChild(host.ownerDocument.createElement(tag))
    const style = window.getComputedStyle(element)
    const declarations = TAG_PROPERTIES.map(property => style.getPropertyValue(property) && `${property}:${style.getPropertyValue(property)}`).filter(Boolean)
    return declarations.length ? `${tag}{${declarations.join(';')}}` : ''
  }).join('')
  probe.remove()
  return rules
}

const FRAME_HEAD = [
  '<meta charset="utf-8">',
  '<meta http-equiv="Content-Security-Policy" content="script-src \'none\'; object-src \'none\'">',
  '<base target="_blank">', // a link opens a new tab, never inside the frame
  '<style>body{margin:0;overflow-wrap:anywhere}img{max-width:100%;height:auto}</style>'
].join('')

export const buildEmailPreviewDoc = (body) => `<!doctype html><html><head>${FRAME_HEAD}</head><body>${body ?? ''}</body></html>`

/**
 * Props: `body` (the HTML of the email). The frame fits the height of its content once loaded (images included); a wrapper decides the width,
 * the zoom and the maximum height, and scrolls when the content is taller.
 */
export const EmailPreviewFrame = ({ body }) => {
  const [, t] = useLanguage()
  const frameRef = useRef(null)
  const srcDoc = useMemo(() => buildEmailPreviewDoc(body), [body])

  const fitHeight = useCallback(() => {
    const frame = frameRef.current
    const frameBody = frame?.contentDocument?.body
    if (!frameBody) return
    const host = frame.parentElement
    const frameDocument = frame.contentDocument
    if (host && frameBody.style && typeof window.getComputedStyle === 'function') {
      const style = window.getComputedStyle(host)
      INHERITED.forEach(property => { if (style[property]) frameBody.style[property] = style[property] })
      // the body's direction is the page's (an Arabic dashboard reads an Arabic email right to left, as when it was injected)
      if (frameDocument.documentElement && style.direction) frameDocument.documentElement.dir = style.direction
      if (frameDocument.head && typeof frameDocument.createElement === 'function') {
        const rules = frameDocument.createElement('style')
        rules.textContent = hostRules(host)
        frameDocument.head.appendChild(rules)
      }
    }
    // the document's height, not the body's: the body's scrollHeight leaves out the margins of its first and last children
    const height = frameDocument.documentElement?.scrollHeight || frameBody.scrollHeight
    if (height) frame.style.height = `${height}px`
  }, [])

  return (
    <iframe
      ref={frameRef}
      className='odc-email-preview-frame'
      title={t('EMAIL_PREVIEW_TITLE', 'Email preview')}
      sandbox={SANDBOX}
      srcDoc={srcDoc}
      onLoad={fitHeight}
    />
  )
}
