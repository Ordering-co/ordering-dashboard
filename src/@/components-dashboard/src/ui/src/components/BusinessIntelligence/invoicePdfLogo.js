import { useEffect, useRef, useState } from 'react'

import { getDashboardLogoUrl } from '../../utils'

export const isEmbeddableInvoiceLogoSrc = (src) =>
  typeof src === 'string' && src.startsWith('data:image/')

export const isPdfSafeInvoiceLogoSrc = (src) =>
  typeof src === 'string' && /^data:image\/(png|jpe?g|gif);base64,/i.test(src)

export const canCopyInvoicePdfHtml = ({ invoiceReady, logoStatus }) =>
  Boolean(invoiceReady) && logoStatus !== 'loading'

const blobToPngDataUrl = (blob) => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(blob)
  const img = new Image()
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth || img.width
      canvas.height = img.naturalHeight || img.height
      if (!canvas.width || !canvas.height) {
        throw new Error('Invalid image')
      }
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const dataUrl = canvas.toDataURL('image/png')
      URL.revokeObjectURL(objectUrl)
      resolve(dataUrl)
    } catch (error) {
      URL.revokeObjectURL(objectUrl)
      reject(error)
    }
  }
  img.onerror = () => {
    URL.revokeObjectURL(objectUrl)
    reject(new Error('Invalid image'))
  }
  img.src = objectUrl
})

export const resolveInvoiceLogoSrc = async (
  url,
  { fetchFn = fetch, encodeImage = blobToPngDataUrl } = {}
) => {
  if (!url) return { status: 'empty', src: null }
  if (isPdfSafeInvoiceLogoSrc(url)) return { status: 'ready', src: url }

  try {
    const response = await fetchFn(url)
    if (!response?.ok) return { status: 'error', src: null }
    const blob = await response.blob()
    const mime = blob?.type || ''
    if (mime && !mime.startsWith('image/') && mime !== 'application/octet-stream') {
      return { status: 'error', src: null }
    }
    const dataUrl = await encodeImage(blob)
    if (!isPdfSafeInvoiceLogoSrc(dataUrl)) return { status: 'error', src: null }
    return { status: 'ready', src: dataUrl }
  } catch {
    return { status: 'error', src: null }
  }
}

export const useInvoicePdfLogo = (configs, fallbackLogo, onStatusChange) => {
  const url = getDashboardLogoUrl(configs, fallbackLogo)
  const [logo, setLogo] = useState({
    status: url ? 'loading' : 'empty',
    src: null
  })
  const onStatusChangeRef = useRef(onStatusChange)
  onStatusChangeRef.current = onStatusChange

  useEffect(() => {
    let cancelled = false
    const nextStatus = url ? 'loading' : 'empty'
    setLogo({ status: nextStatus, src: null })
    onStatusChangeRef.current?.(nextStatus)

    if (!url) return undefined

    resolveInvoiceLogoSrc(url).then((result) => {
      if (cancelled) return
      setLogo(result)
      onStatusChangeRef.current?.(result.status)
    })

    return () => {
      cancelled = true
    }
  }, [url])

  return logo
}
