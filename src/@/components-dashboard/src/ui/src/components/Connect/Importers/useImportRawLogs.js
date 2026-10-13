import { useCallback, useEffect, useState } from 'react'
import { useApi, useLanguage, useSession, useToast, ToastType } from '~components'
import { getMenuImportApiUrl } from './menuImportConfig'

const triggerBrowserDownload = (blob, filename) => {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}

const filenameFromDisposition = (header, fallback) => {
  if (!header) return fallback
  const match = /filename="?([^"]+)"?/i.exec(header)
  return match?.[1] || fallback
}

export const useImportRawLogs = ({ businessId, enabled = true } = {}) => {
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [{ token }] = useSession()
  const [ordering] = useApi()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const project = ordering?.project
  const orderingApiBaseUrl = ordering?.root

  const fetchLogs = useCallback(async () => {
    const baseUrl = getMenuImportApiUrl()
    if (!enabled || !businessId) {
      setLogs([])
      setLoading(false)
      return
    }
    if (!baseUrl) {
      const message = t(
        'IMPORTER_STATUS_API_NOT_CONFIGURED',
        'Menu import API is not configured. Set VITE_MENU_IMPORT_API_URL in your environment.'
      )
      setError(new Error(message))
      setLogs([])
      setLoading(false)
      return
    }
    if (!project || !orderingApiBaseUrl) {
      setError(new Error(t('IMPORTER_LOGS_ERROR', 'Could not load import logs.')))
      setLogs([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const url = new URL(`${baseUrl}/api/import-logs`)
      url.searchParams.set('businessId', String(businessId))
      url.searchParams.set('project', project)
      url.searchParams.set('orderingApiBaseUrl', orderingApiBaseUrl)

      const headers = {}
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const response = await fetch(url.toString(), { headers })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.detail || data.error || t('IMPORTER_LOGS_ERROR', 'Could not load import logs.'))
      }
      setLogs(Array.isArray(data.logs) ? data.logs : [])
    } catch (err) {
      const message = err?.message || t('IMPORTER_LOGS_ERROR', 'Could not load import logs.')
      setError(err instanceof Error ? err : new Error(message))
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [businessId, enabled, orderingApiBaseUrl, project, t, token])

  useEffect(() => {
    fetchLogs()
  }, [businessId, enabled, orderingApiBaseUrl, project, token])

  const downloadLog = useCallback(async (log) => {
    const baseUrl = getMenuImportApiUrl()
    if (!log?.id || !log?.downloadable) return
    if (!baseUrl || !orderingApiBaseUrl) {
      showToast(
        ToastType.Error,
        t('IMPORTER_LOGS_DOWNLOAD_ERROR', 'Could not download this log.')
      )
      return
    }

    setDownloadingId(log.id)
    try {
      const url = new URL(`${baseUrl}/api/import-logs/${log.id}/download`)
      url.searchParams.set('orderingApiBaseUrl', orderingApiBaseUrl)

      const headers = {}
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const response = await fetch(url.toString(), { headers })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(
          data.detail || data.error || t('IMPORTER_LOGS_DOWNLOAD_ERROR', 'Could not download this log.')
        )
      }

      const blob = await response.blob()
      const fallback = `${log.source || 'import'}-${log.businessId || businessId}-${log.id}.json`
      const filename = filenameFromDisposition(
        response.headers.get('Content-Disposition'),
        fallback
      )
      triggerBrowserDownload(blob, filename)
    } catch (err) {
      showToast(
        ToastType.Error,
        err?.message || t('IMPORTER_LOGS_DOWNLOAD_ERROR', 'Could not download this log.')
      )
    } finally {
      setDownloadingId(null)
    }
  }, [businessId, orderingApiBaseUrl, showToast, t, token])

  const deleteLogs = useCallback(async (logIds) => {
    const baseUrl = getMenuImportApiUrl()
    const ids = Array.isArray(logIds) ? logIds.filter(Boolean) : []
    if (!ids.length) return { deleted: 0 }
    if (!baseUrl || !orderingApiBaseUrl || !project || !businessId) {
      showToast(
        ToastType.Error,
        t('IMPORTER_LOGS_DELETE_ERROR', 'Could not delete the selected logs.')
      )
      return null
    }

    setDeleting(true)
    try {
      const headers = {
        'Content-Type': 'application/json'
      }
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const response = await fetch(`${baseUrl}/api/import-logs`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({
          logIds: ids,
          businessId,
          project,
          orderingApiBaseUrl
        })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(
          data.detail || data.error || t('IMPORTER_LOGS_DELETE_ERROR', 'Could not delete the selected logs.')
        )
      }

      const deletedCount = Number(data.deleted) || 0
      if (deletedCount > 0) {
        showToast(
          ToastType.Success,
          deletedCount === 1
            ? t('IMPORTER_LOGS_DELETE_SUCCESS_ONE', 'Log deleted.')
            : t('IMPORTER_LOGS_DELETE_SUCCESS', 'Deleted {{count}} logs.').replace('{{count}}', String(deletedCount))
        )
        await fetchLogs()
      }
      return data
    } catch (err) {
      showToast(
        ToastType.Error,
        err?.message || t('IMPORTER_LOGS_DELETE_ERROR', 'Could not delete the selected logs.')
      )
      return null
    } finally {
      setDeleting(false)
    }
  }, [businessId, fetchLogs, orderingApiBaseUrl, project, showToast, t, token])

  return {
    logs,
    loading,
    error,
    refetch: fetchLogs,
    downloadLog,
    downloadingId,
    deleteLogs,
    deleting
  }
}
