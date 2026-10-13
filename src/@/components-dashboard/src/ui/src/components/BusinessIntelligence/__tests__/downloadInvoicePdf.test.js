import { describe, expect, it, vi } from 'vitest'

import { buildInvoicePdfHtml, downloadInvoicePdfFromHtml } from '../downloadInvoicePdf'

const pdfBlob = new Blob(['%PDF-fake'], { type: 'application/pdf' })

const pdfResponse = ({
  ok = true,
  status = 200,
  contentType = 'application/pdf',
  disposition = 'attachment; filename="invoice_123.pdf"',
  blob = pdfBlob,
  json
} = {}) => ({
  ok,
  status,
  headers: {
    get: (name) => {
      if (name === 'Content-Type') return contentType
      if (name === 'Content-Disposition') return disposition
      return null
    }
  },
  blob: async () => blob,
  json: async () => json
})

describe('buildInvoicePdfHtml', () => {
  it('sends a complete document with a png data logo so the api does not wrap body incorrectly', () => {
    const logoSrc = 'data:image/png;base64,abc'
    const html = buildInvoicePdfHtml({
      bodyHtml: '<div style="color:#333"><img src="https://cdn.example/logo.webp" /><span>Invoice</span></div>',
      logoSrc
    })

    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('<body>')
    expect(html).not.toContain('<body<img')
    expect(html).not.toContain('<body<div')
    expect(html).toContain(`<img src="${logoSrc}" width="150" alt="" />`)
    expect(html).toContain('<span>Invoice</span>')
    expect(html).not.toContain('https://cdn.example/logo.webp')
  })

  it('does not insert a remote logo url', () => {
    const html = buildInvoicePdfHtml({
      bodyHtml: '<div>Invoice</div>',
      logoSrc: 'https://cdn.example/logo.png'
    })
    expect(html).not.toContain('https://cdn.example/logo.png')
    expect(html).not.toContain('<img')
  })
})

describe('downloadInvoicePdfFromHtml', () => {
  it('posts html to /pdf/html with a bearer token and saves the file locally', async () => {
    const fetchFn = vi.fn().mockResolvedValue(pdfResponse())
    const saveBlob = vi.fn()

    await downloadInvoicePdfFromHtml({
      html: '<div>invoice</div>',
      root: 'https://api.example/v400/en/demo',
      token: 'session-token',
      fetchFn,
      saveBlob
    })

    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, options] = fetchFn.mock.calls[0]
    expect(url).toBe('https://api.example/v400/en/demo/pdf/html')
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer session-token')
    expect(options.headers['Content-Type']).toBe('application/json')
    const posted = JSON.parse(options.body)
    expect(posted.with_doctype).toBe(0)
    expect(posted.html).toContain('<!DOCTYPE html>')
    expect(posted.html).toContain('<div>invoice</div>')
    expect(posted.html).toContain('<body>')
    expect(saveBlob).toHaveBeenCalledWith(pdfBlob, 'invoice_123.pdf')
  })

  it('does not open a new tab or put the token in the url', async () => {
    const fetchFn = vi.fn().mockResolvedValue(pdfResponse())
    const saveBlob = vi.fn()

    await downloadInvoicePdfFromHtml({
      html: '<div>invoice</div>',
      root: 'https://api.example/v400/en/demo',
      token: 'secret-token',
      fetchFn,
      saveBlob
    })

    const [url, options] = fetchFn.mock.calls[0]
    expect(url).not.toMatch(/token=/)
    expect(options).not.toHaveProperty('target')
    expect(saveBlob).toHaveBeenCalled()
  })

  it('rejects when the api is unauthorized', async () => {
    const fetchFn = vi.fn().mockResolvedValue(pdfResponse({
      ok: false,
      status: 401,
      contentType: 'application/json',
      json: { error: true, result: ['Unauthorized'] }
    }))

    await expect(downloadInvoicePdfFromHtml({
      html: '<div>invoice</div>',
      root: 'https://api.example/v400/en/demo',
      token: 'bad-token',
      fetchFn,
      saveBlob: vi.fn()
    })).rejects.toThrow('Unauthorized')
  })

  it('rejects a non-pdf response so html is never saved as a file', async () => {
    const fetchFn = vi.fn().mockResolvedValue(pdfResponse({
      contentType: 'text/html',
      blob: new Blob(['nope'], { type: 'text/html' })
    }))
    const saveBlob = vi.fn()

    await expect(downloadInvoicePdfFromHtml({
      html: '<div>invoice</div>',
      root: 'https://api.example/v400/en/demo',
      token: 'session-token',
      fetchFn,
      saveBlob
    })).rejects.toThrow('Invalid response format')

    expect(saveBlob).not.toHaveBeenCalled()
  })
})
