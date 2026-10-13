import { isPdfSafeInvoiceLogoSrc } from './invoicePdfLogo'

const filenameFromDisposition = (header, fallback) => {
  if (!header) return fallback
  const match = /filename="?([^"]+)"?/i.exec(header)
  return match?.[1] || fallback
}

export const saveInvoicePdfBlob = (blob, filename) => {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(objectUrl)
}

export const buildInvoicePdfHtml = ({ bodyHtml, logoSrc }) => {
  const logoTag = isPdfSafeInvoiceLogoSrc(logoSrc)
    ? `<img src="${logoSrc}" width="150" alt="" />`
    : ''
  const body = String(bodyHtml || '').replace(/<img\b[^>]*>/gi, '')
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:DejaVu Sans,sans-serif;color:#333}img{width:150px;height:auto;margin-bottom:15px}</style></head><body>${logoTag}${body}</body></html>`
}

export const downloadInvoicePdfFromHtml = async ({
  html,
  logoSrc,
  root,
  token,
  fetchFn = fetch,
  saveBlob = saveInvoicePdfBlob
}) => {
  const response = await fetchFn(`${root}/pdf/html`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      html: buildInvoicePdfHtml({ bodyHtml: html, logoSrc }),
      with_doctype: 0
    })
  })

  if (!response.ok) {
    const errData = await response.json().catch(() => null)
    const message = Array.isArray(errData?.result)
      ? errData.result[0]
      : (errData?.result || 'Download failed')
    throw new Error(message)
  }

  const contentType = response.headers.get('Content-Type') || ''
  if (!contentType.includes('pdf')) {
    throw new Error('Invalid response format')
  }

  const blob = await response.blob()
  const filename = filenameFromDisposition(
    response.headers.get('Content-Disposition'),
    'invoice.pdf'
  )
  saveBlob(blob, filename)
}
