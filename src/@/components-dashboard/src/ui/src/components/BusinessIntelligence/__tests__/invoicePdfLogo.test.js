import { describe, expect, it, vi } from 'vitest'

import {
  canCopyInvoicePdfHtml,
  isEmbeddableInvoiceLogoSrc,
  resolveInvoiceLogoSrc
} from '../invoicePdfLogo'

describe('isEmbeddableInvoiceLogoSrc', () => {
  it('accepts data image URLs only', () => {
    expect(isEmbeddableInvoiceLogoSrc('data:image/png;base64,abc')).toBe(true)
    expect(isEmbeddableInvoiceLogoSrc('https://cdn.example/logo.png')).toBe(false)
    expect(isEmbeddableInvoiceLogoSrc('/assets/logo-pdf.png')).toBe(false)
    expect(isEmbeddableInvoiceLogoSrc(null)).toBe(false)
  })
})

describe('canCopyInvoicePdfHtml', () => {
  it('waits while the logo is still converting', () => {
    expect(canCopyInvoicePdfHtml({ invoiceReady: true, logoStatus: 'loading' })).toBe(false)
  })

  it('allows copy when the invoice is ready and the logo finished or failed', () => {
    expect(canCopyInvoicePdfHtml({ invoiceReady: true, logoStatus: 'ready' })).toBe(true)
    expect(canCopyInvoicePdfHtml({ invoiceReady: true, logoStatus: 'error' })).toBe(true)
    expect(canCopyInvoicePdfHtml({ invoiceReady: true, logoStatus: 'empty' })).toBe(true)
    expect(canCopyInvoicePdfHtml({ invoiceReady: false, logoStatus: 'ready' })).toBe(false)
  })
})

describe('resolveInvoiceLogoSrc', () => {
  it('returns empty when there is no logo url', async () => {
    await expect(resolveInvoiceLogoSrc('')).resolves.toEqual({ status: 'empty', src: null })
  })

  it('keeps an already embeddable data url', async () => {
    const src = 'data:image/png;base64,abc'
    await expect(resolveInvoiceLogoSrc(src)).resolves.toEqual({ status: 'ready', src })
  })

  it('does not submit a remote url when fetch fails', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('CORS'))
    await expect(resolveInvoiceLogoSrc('https://cdn.example/logo.png', { fetchFn }))
      .resolves.toEqual({ status: 'error', src: null })
  })

  it('does not embed a non-image response', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['<html></html>'], { type: 'text/html' })
    })
    await expect(resolveInvoiceLogoSrc('https://cdn.example/logo.png', { fetchFn }))
      .resolves.toEqual({ status: 'error', src: null })
  })

  it('embeds a fetched image as a png data url', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['fake-bytes'], { type: 'image/png' })
    })
    const encodeImage = vi.fn().mockResolvedValue('data:image/png;base64,abc')
    await expect(resolveInvoiceLogoSrc('https://cdn.example/logo.png', { fetchFn, encodeImage }))
      .resolves.toEqual({ status: 'ready', src: 'data:image/png;base64,abc' })
  })

  it('converts webp to png because the pdf engine cannot embed webp', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['fake-webp'], { type: 'image/webp' })
    })
    const encodeImage = vi.fn().mockResolvedValue('data:image/png;base64,pngfromwebp')
    await expect(resolveInvoiceLogoSrc('https://cdn.example/logo.webp', { fetchFn, encodeImage }))
      .resolves.toEqual({ status: 'ready', src: 'data:image/png;base64,pngfromwebp' })
  })
})
