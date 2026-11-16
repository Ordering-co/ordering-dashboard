// the shared iframe of the email previews (recovery rules and campaigns). It must never run the body, and it must fit its height.
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { EmailPreviewFrame, buildEmailPreviewDoc } from '../EmailPreviewFrame'

afterEach(cleanup)

describe('EmailPreviewFrame', () => {
  it('is one titled iframe whose sandbox grants same-origin and link popups only: no scripts, top navigation, forms or modals', () => {
    render(<EmailPreviewFrame body='<p>Hi</p>' />)
    const frame = screen.getByTitle('Email preview')
    expect(frame.tagName).toBe('IFRAME')
    const tokens = frame.getAttribute('sandbox').split(/\s+/).sort()
    expect(tokens).toEqual(['allow-popups', 'allow-popups-to-escape-sandbox', 'allow-same-origin'])
    expect(tokens).not.toContain('allow-scripts')
  })

  it('takes the type and colour of the wrapper it sits in, as the injected body inherited them', () => {
    render(<div style={{ color: 'rgb(1, 2, 3)', fontSize: '13px' }}><EmailPreviewFrame body='<p>Hi</p>' /></div>)
    const frame = screen.getByTitle('Email preview')
    const frameBody = { scrollHeight: 10, style: {} }
    Object.defineProperty(frame, 'contentDocument', { configurable: true, value: { body: frameBody } })
    fireEvent.load(frame)
    expect(frameBody.style.color).toBe('rgb(1, 2, 3)')
    expect(frameBody.style.fontSize).toBe('13px')
  })

  it('puts the body in srcdoc after a head with a no-script CSP and a base that targets _blank, and survives an empty body', () => {
    const body = '<img src="x" onerror="window.__xssProbe=1">'
    render(<EmailPreviewFrame body={body} />)
    const srcdoc = screen.getByTitle('Email preview').getAttribute('srcdoc')
    expect(srcdoc).toContain(`<body>${body}</body>`)
    expect(srcdoc).toContain('<base target="_blank">')
    expect(srcdoc).toContain("script-src 'none'")
    expect(buildEmailPreviewDoc(undefined)).toContain('<body></body>')
    expect(buildEmailPreviewDoc(null)).toContain('<body></body>')
  })

  // (review, live): the paragraphs took the browser's margins (the wrapper had `p { margin: 0 }`), the height left out the
  // first paragraph's margin (the last line was cut), and an Arabic body read left to right
  it('takes the direction and the element rules of its wrapper, and fits the height of the whole document', () => {
    const style = document.createElement('style')
    style.textContent = '.host p { margin: 0px; font-size: 12px }'
    document.head.appendChild(style)
    try {
      render(<div className='host' dir='rtl' style={{ direction: 'rtl' }}><EmailPreviewFrame body='<p>Hi</p>' /></div>)
      const frame = screen.getByTitle('Email preview')
      const frameDocument = document.implementation.createHTMLDocument('frame')
      Object.defineProperty(frameDocument.documentElement, 'scrollHeight', { configurable: true, value: 154 })
      Object.defineProperty(frameDocument.body, 'scrollHeight', { configurable: true, value: 140 })
      Object.defineProperty(frame, 'contentDocument', { configurable: true, value: frameDocument })
      fireEvent.load(frame)
      expect(frameDocument.documentElement.dir).toBe('rtl')
      const injected = [...frameDocument.head.querySelectorAll('style')].map(node => node.textContent).join('')
      expect(injected).toMatch(/(^|\})p\{margin-top:0px;margin-bottom:0px;font-size:12px/)
      expect(frame.style.height).toBe('154px')
      expect(document.querySelectorAll('.host [aria-hidden="true"]')).toHaveLength(0) // the probe is gone
    } finally {
      style.remove()
    }
  })

  it('fits its height to the content on load, and leaves it alone when the document cannot be measured', () => {
    render(<EmailPreviewFrame body='<p>Hi</p>' />)
    const frame = screen.getByTitle('Email preview')
    // jsdom does not lay out: stand in for the measured document
    Object.defineProperty(frame, 'contentDocument', { configurable: true, value: { body: { scrollHeight: 321 } } })
    fireEvent.load(frame)
    expect(frame.style.height).toBe('321px')
    Object.defineProperty(frame, 'contentDocument', { configurable: true, value: null })
    fireEvent.load(frame)
    expect(frame.style.height).toBe('321px')
  })
})
