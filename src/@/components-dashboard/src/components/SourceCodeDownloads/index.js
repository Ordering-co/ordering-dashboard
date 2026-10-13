import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { useSession } from '../../contexts/SessionContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { isOfficialOrderingDashboardHost, SOURCE_PROJECT_HEADER } from '../../../../../utils/sourceDownloadsProject.js'

const CATALOG_URL = '/api/source-catalog'
const PRODUCT_ID = 'website-marketplace'
const VERSION = /^v\d{4}\.\d{2}\.\d{2}\.\d{6}$/
const SHA = /^[a-f0-9]{40}$/i
const CHECKSUM = /^[a-f0-9]{64}$/i
const hasText = value => typeof value === 'string' && value.trim().length > 0
const emptyCatalog = (status, error = null) => ({ status, error, products: [] })
export const sourceRequestHeaders = (session, accept, hostname = window.location.hostname) => ({
  Authorization: `Bearer ${session.token}`,
  Accept: accept,
  ...(isOfficialOrderingDashboardHost(hostname) ? { [SOURCE_PROJECT_HEADER]: session.project || '' } : {})
})

export const getSourceCodeSessionStatus = session => {
  if (session.loading) return 'loading'
  if (!session.auth || !hasText(session.token) || !session.user?.id) return 'sessionExpired'
  if (![0, 2].includes(session.user.level) || session.user.enabled === false) return 'forbidden'
  return 'ready'
}

const isSameSession = (requested, current) => requested && current && getSourceCodeSessionStatus(current) === 'ready' &&
  requested.token === current.token && requested.user?.id === current.user?.id &&
  requested.user?.level === current.user?.level && requested.project === current.project

// Producer metadata is the only source of versions, instructions and license.
// Reject an incomplete record instead of offering a download with made-up data.
export const readSourceCodeCatalog = payload => {
  if (payload?.schemaVersion !== 1 || !Array.isArray(payload.products)) throw new Error('invalidCatalog')
  const products = payload.products.filter(product => product?.id === PRODUCT_ID)
  if (products.length > 1) throw new Error('invalidCatalog')
  for (const product of products) {
    const artifact = product.artifact
    const valid = hasText(product.name) && VERSION.test(product.version) &&
      hasText(product.publishedAt) && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(product.publishedAt) && Number.isFinite(Date.parse(product.publishedAt)) &&
      product.timezone === 'UTC-06:00' && SHA.test(product.sourceSha) &&
      Array.isArray(product.submodules) && product.submodules.every(item => hasText(item?.path) && SHA.test(item.sha)) &&
      hasText(product.license?.id) && hasText(product.license?.text) &&
      hasText(product.descriptionByLocale?.en) && hasText(product.instructionsByLocale?.en) &&
      hasText(artifact?.filename) && /^[a-zA-Z0-9._-]+\.zip$/.test(artifact.filename) &&
      artifact.filename.includes(product.version) && Number.isSafeInteger(artifact.sizeBytes) &&
      artifact.sizeBytes > 0 && CHECKSUM.test(artifact.sha256)
    if (!valid) throw new Error('invalidCatalog')
  }
  return products
}

const getLocale = code => {
  try {
    return Intl.getCanonicalLocales(String(code || 'en').replaceAll('_', '-'))[0] || 'en'
  } catch (_) {
    return 'en'
  }
}

const getLocalizedContent = (content, locale) => {
  const base = locale.split('-')[0]
  const selected = hasText(content[locale]) ? locale : hasText(content[base]) ? base : 'en'
  return { text: content[selected], locale: selected }
}

export const formatSourceCodeProduct = (product, languageCode) => {
  if (!product) return null
  const locale = getLocale(languageCode)
  const description = getLocalizedContent(product.descriptionByLocale, locale)
  const instructions = getLocalizedContent(product.instructionsByLocale, locale)
  return {
    ...product,
    description: description.text,
    descriptionLocale: description.locale,
    instructions: instructions.text,
    instructionsLocale: instructions.locale,
    instructionsFallback: instructions.locale === 'en' && locale.split('-')[0] !== 'en',
    // Etc/GMT+6 is fixed UTC-06:00, including summer; never America/Chicago.
    publishedLabel: new Intl.DateTimeFormat(locale, {
      timeZone: 'Etc/GMT+6',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).format(new Date(product.publishedAt)),
    sizeLabel: new Intl.NumberFormat(locale).format(product.artifact.sizeBytes)
  }
}

const readRequestError = async response => {
  // Read the contract envelope but never render/log arbitrary server messages
  // (or session credentials). UI copy is selected by HTTP status.
  await response.json().catch(() => null)
  const error = new Error(response.status === 404 ? 'notFound' : 'unavailable')
  error.status = response.status
  return error
}

const getErrorStatus = error => error.status === 401 ? 'sessionExpired' : error.status === 403 ? 'forbidden' : 'error'

export const verifySourceCodeArtifact = async (blob, artifact) => {
  if (blob.size !== artifact.sizeBytes) throw new Error('integrityMismatch')
  if (globalThis.isSecureContext === false || !globalThis.crypto?.subtle?.digest || typeof blob.arrayBuffer !== 'function') {
    throw new Error('verificationUnavailable')
  }
  let digest
  try {
    digest = await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  } catch (_) {
    throw new Error('verificationUnavailable')
  }
  const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  if (sha256 !== artifact.sha256.toLowerCase()) throw new Error('integrityMismatch')
}

export const SourceCodeDownloads = ({ UIComponent }) => {
  const [session, sessionActions] = useSession()
  const [languageState] = useLanguage()
  const history = useHistory()
  const [catalog, setCatalog] = useState(emptyCatalog('loading'))
  const [downloadState, setDownloadState] = useState({ status: 'idle', error: null })
  const catalogRequest = useRef(null)
  const downloadRequest = useRef(null)
  const currentSession = useRef(session)
  const catalogSession = useRef(null)
  currentSession.current = session
  const sessionStatus = getSourceCodeSessionStatus(session)

  const loadCatalog = useCallback(async () => {
    catalogRequest.current?.abort()
    downloadRequest.current?.abort()
    downloadRequest.current = null
    setDownloadState({ status: 'idle', error: null })
    if (sessionStatus !== 'ready') {
      setCatalog(emptyCatalog(sessionStatus))
      return
    }
    if (!isSameSession(session, currentSession.current)) return
    const request = new AbortController()
    catalogRequest.current = request
    catalogSession.current = session
    setCatalog(emptyCatalog('loading'))
    try {
      const response = await fetch(CATALOG_URL, {
        method: 'GET',
        headers: sourceRequestHeaders(session, 'application/json'),
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: request.signal
      })
      if (!response.ok) throw await readRequestError(response)
      const products = readSourceCodeCatalog(await response.json())
      if (!request.signal.aborted && isSameSession(session, currentSession.current)) setCatalog({ status: products.length ? 'ready' : 'empty', error: null, products })
    } catch (error) {
      if (!request.signal.aborted && isSameSession(session, currentSession.current)) setCatalog(emptyCatalog(getErrorStatus(error), error.message === 'invalidCatalog' ? 'invalidCatalog' : 'unavailable'))
    }
  }, [sessionStatus, session.token, session.user?.id, session.user?.level, session.project])

  useEffect(() => {
    loadCatalog()
    return () => {
      catalogRequest.current?.abort()
      downloadRequest.current?.abort()
    }
  }, [loadCatalog])

  const signInAgain = async () => {
    try {
      await sessionActions.logout()
      history.replace({ pathname: '/login', state: { from: '/open-source-code' } })
    } catch (_) {
      setCatalog(emptyCatalog('error', 'unavailable'))
    }
  }

  const downloadSource = async () => {
    const product = catalog.products[0]
    if (!isSameSession(session, currentSession.current) || !isSameSession(catalogSession.current, session) || catalog.status !== 'ready' || !product || downloadRequest.current) return
    const request = new AbortController()
    downloadRequest.current = request
    setDownloadState({ status: 'pending', error: null })
    try {
      const url = `/api/source-downloads/${encodeURIComponent(product.id)}/${encodeURIComponent(product.version)}`
      const response = await fetch(url, {
        method: 'GET',
        headers: sourceRequestHeaders(session, 'application/zip'),
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: request.signal
      })
      if (!response.ok) throw await readRequestError(response)
      const blob = await response.blob()
      if (request.signal.aborted || !isSameSession(session, currentSession.current)) return
      if (response.headers.get('content-type')?.split(';')[0].trim() !== 'application/zip') {
        throw new Error('invalidArchive')
      }
      await verifySourceCodeArtifact(blob, product.artifact)
      if (request.signal.aborted || !isSameSession(session, currentSession.current)) return
      const objectUrl = URL.createObjectURL(blob)
      const revokeObjectUrl = URL.revokeObjectURL.bind(URL)
      try {
        const anchor = document.createElement('a')
        anchor.href = objectUrl
        anchor.download = product.artifact.filename
        document.body.appendChild(anchor)
        try { anchor.click() } finally { anchor.remove() }
        setDownloadState({ status: 'success', error: null })
      } finally {
        // Let the browser start saving before releasing the temporary URL.
        setTimeout(() => revokeObjectUrl(objectUrl), 1000)
      }
    } catch (error) {
      if (!request.signal.aborted && isSameSession(session, currentSession.current)) {
        const status = getErrorStatus(error)
        if (status !== 'error') setCatalog(emptyCatalog(status))
        const reason = ['integrityMismatch', 'verificationUnavailable'].includes(error.message) ? error.message : error.status === 404 ? 'notFound' : 'failed'
        setDownloadState({ status: 'error', error: reason })
      }
    } finally {
      if (downloadRequest.current === request) downloadRequest.current = null
    }
  }

  const product = useMemo(() => formatSourceCodeProduct(catalog.products[0], languageState.language?.code), [catalog.products, languageState.language?.code])
  const visibleStatus = sessionStatus === 'ready' ? isSameSession(catalogSession.current, session) ? catalog.status : 'loading' : sessionStatus

  return UIComponent
    ? <UIComponent catalogStatus={visibleStatus} catalogError={catalog.error} product={visibleStatus === 'ready' ? product : null} downloadState={downloadState} reloadCatalog={loadCatalog} downloadSource={downloadSource} signInAgain={signInAgain} />
    : null
}
