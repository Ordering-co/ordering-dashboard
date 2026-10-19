import { useCallback, useState } from 'react'
import { useApi, useLanguage, useSession, useToast, ToastType } from '~components'
import { classifyMenuImportError } from './menuImportErrors'
import { getMenuImportApiUrl } from './menuImportConfig'
import { logMenuImportSync, resolveMenuImportSourceUrl } from './logMenuImportSync'
import { saveRun } from './menuImportRuns'
import { fetchBusinessMenuSnapshot } from './useBusinessMenuSnapshot'

const nowIso = () => new Date().toISOString()

export const useMenuImport = (source = 'doordash') => {
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [{ token }] = useSession()
  const [ordering] = useApi()
  const [status, setStatus] = useState('idle')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [startedAt, setStartedAt] = useState(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setResult(null)
    setError(null)
    setStartedAt(null)
  }, [])

  const fail = useCallback((verdict, onError) => {
    setStatus('failed')
    setError(verdict)
    onError?.(new Error(verdict.message))
  }, [])

  const loseConnection = useCallback((onError) => {
    const message = t(
      'IMPORTER_ERROR_CONNECTION_LOST',
      'We lost the connection to the importer. The import may still be running.'
    )
    setStatus('unknown')
    setError({ message, retryable: true })
    onError?.(new Error(message))
  }, [t])

  const triggerImport = useCallback(async (params, { onSuccess, onError } = {}) => {
    const baseUrl = getMenuImportApiUrl()
    if (!baseUrl) {
      const message = t(
        'IMPORTER_STATUS_API_NOT_CONFIGURED',
        'Menu import API is not configured. Set VITE_MENU_IMPORT_API_URL in your environment.'
      )
      fail({ message, retryable: false }, onError)
      return
    }

    const startedAt = nowIso()
    setStatus('importing')
    setStartedAt(startedAt)
    setError(null)
    setResult(null)

    const businessId = params.businessIds?.[0]
    const project = params.project || ordering?.project
    const runRef = businessId != null && project ? { project, businessId, source } : null
    let run = null
    const persist = (patch) => {
      if (!runRef) return
      run = { ...run, ...patch }
      saveRun(runRef, run)
    }
    const failRun = (verdict) => {
      persist({ status: 'failed', finishedAt: nowIso(), errorMessage: verdict.message })
      fail(verdict, onError)
    }
    const loseRun = () => {
      persist({ status: 'unknown' })
      loseConnection(onError)
    }

    persist({
      status: 'importing',
      startedAt,
      finishedAt: null,
      sourceUrl: resolveMenuImportSourceUrl(source, params),
      appliedCount: null,
      errorMessage: null,
      menuBefore: runRef ? await fetchBusinessMenuSnapshot(ordering, businessId) : null,
      menuAfter: null
    })

    try {
      const path = `/api/import/${source}`
      const url = new URL(`${baseUrl}${path}`)

      if (params.useFixture) {
        url.searchParams.set('useFixture', 'true')
      }

      const headers = { 'Content-Type': 'application/json' }
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const { useFixture: _uf, gloriafoodMasterKey: _masKey, ...body } = params
      Object.assign(body, { source })

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })
      let data = null
      try {
        data = await response.json()
      } catch {
        data = null
      }
      const detail = data && typeof data === 'object'
        ? (data.detail || data.message || data.error)
        : null

      if (!response.ok) {
        if ((response.status === 502 || response.status === 504) && !detail) {
          loseRun()
          return
        }
        failRun(classifyMenuImportError(source, detail, response.status, t))
        return
      }

      if (data?.success === false) {
        failRun(classifyMenuImportError(source, data.error || data.message, response.status, t))
        return
      }

      const appliedCount = data?.appliedCount ?? null
      persist({
        status: 'success',
        finishedAt: nowIso(),
        appliedCount,
        menuAfter: runRef ? await fetchBusinessMenuSnapshot(ordering, businessId) : null
      })
      logMenuImportSync({ token, source, params })
      showToast(ToastType.Success, t('IMPORTER_STATUS_SUCCESS', 'Menu imported successfully'))
      setStatus('success')
      setResult({ appliedCount, jobId: data?.jobId ?? null })
      onSuccess?.(data, params)
      return data
    } catch {
      loseRun()
    }
  }, [fail, loseConnection, ordering, showToast, source, t, token])

  return {
    status,
    result,
    error,
    startedAt,
    triggerImport,
    reset,
    isImporting: status === 'importing'
  }
}
