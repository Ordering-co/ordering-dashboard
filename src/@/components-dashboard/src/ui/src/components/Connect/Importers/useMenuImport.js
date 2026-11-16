import { useCallback, useState } from 'react'
import { useApi, useLanguage, useSession, useToast, ToastType } from '~components'
import { classifyMenuImportError, classifyStoreFailure } from './menuImportErrors'
import { getMenuImportApiUrl } from './menuImportConfig'
import { logMenuImportSync, resolveMenuImportSourceUrl } from './logMenuImportSync'
import { saveRun } from './menuImportRuns'
import { fetchBusinessMenuSnapshot } from './useBusinessMenuSnapshot'

const nowIso = () => new Date().toISOString()

// the service's 502 when Ordering refused every store (app.py `_execute_import`); any other 502 is about the source
const ALL_STORES_FAILED = /^Failed to send menu to Ordering API: /
const RATE_LIMITED = 'MENU_IMPORT_RATE_LIMITED'

/**
 * which stores of a multi-store import got the menu. The service sends the menu store by store, in the order of
 * `businessIds`, and stops at a quota cut: the first `appliedCount + failures` stores were tried, the rest were left.
 */
export const splitStoreOutcome = (businessIds, { appliedCount = 0, partialFailures = [] } = {}) => {
  const failedIds = partialFailures.map(({ businessId }) => businessId)
  const tried = businessIds.slice(0, appliedCount + partialFailures.length)
  return {
    applied: tried.filter((id) => !failedIds.includes(id)),
    failed: partialFailures,
    pending: businessIds.slice(tried.length)
  }
}

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

    // each store keeps its own run (state, menu before and after), as one store did
    const businessIds = (params.businessIds || []).filter((id) => id != null)
    const project = params.project || ordering?.project
    const runs = new Map()
    const persist = (ids, patch) => {
      if (!project) return
      ids.forEach((businessId) => {
        const run = { ...runs.get(businessId), ...patch }
        runs.set(businessId, run)
        saveRun({ project, businessId, source }, run)
      })
    }
    // one read at a time: a burst of reads spends the quota that would cut the import short
    const snapshots = async (ids) => {
      const menus = []
      for (const businessId of ids) menus.push(project ? await fetchBusinessMenuSnapshot(ordering, businessId) : null)
      return menus
    }
    const failRun = (verdict) => {
      persist(businessIds, { status: 'failed', finishedAt: nowIso(), errorMessage: verdict.message })
      fail(verdict, onError)
    }
    const loseRun = () => {
      persist(businessIds, { status: 'unknown' })
      loseConnection(onError)
    }
    const finishRuns = async (ids, appliedCount) => {
      const after = await snapshots(ids)
      ids.forEach((businessId, index) => persist([businessId], { status: 'success', finishedAt: nowIso(), appliedCount, menuAfter: after[index] }))
    }

    const before = await snapshots(businessIds)
    businessIds.forEach((businessId, index) => persist([businessId], {
      status: 'importing',
      startedAt,
      finishedAt: null,
      sourceUrl: resolveMenuImportSourceUrl(source, params),
      appliedCount: null,
      errorMessage: null,
      menuBefore: before[index],
      menuAfter: null
    }))

    // a multi-store answer that says store by store what happened: the dialog lists the stores that failed, with Retry for them
    const settleStores = async ({ applied, failed, pending }, quotaDetail, status) => {
      const quotaMessage = quotaDetail ? classifyMenuImportError(source, quotaDetail, status, t).message : null
      const failures = failed.map(({ businessId, error }) => ({ businessId, message: classifyStoreFailure(error, t) }))
      await finishRuns(applied, applied.length)
      failures.forEach(({ businessId, message }) => persist([businessId], { status: 'failed', finishedAt: nowIso(), errorMessage: message }))
      persist(pending, { status: 'failed', finishedAt: nowIso(), errorMessage: quotaMessage })
      if (applied.length) logMenuImportSync({ token, source, params: { ...params, businessIds: applied } })
      setStatus('partial')
      setResult({ appliedCount: applied.length, total: businessIds.length, failed: failures, pending, quotaMessage })
    }
    const multi = businessIds.length > 1

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
        if (multi && response.status === 429) {
          await settleStores({ applied: [], failed: [], pending: businessIds }, detail, response.status)
          return data
        }
        if (multi && response.status === 502 && ALL_STORES_FAILED.test(detail)) {
          const error = String(detail).replace(ALL_STORES_FAILED, '')
          await settleStores({ applied: [], failed: businessIds.map((businessId) => ({ businessId, error })), pending: [] }, null, response.status)
          return data
        }
        failRun(classifyMenuImportError(source, detail, response.status, t))
        return
      }

      if (data?.success === false) {
        if (multi && data.appliedCount != null) {
          const quotaDetail = String(data.error || '').includes(RATE_LIMITED) ? data.error : null
          await settleStores(splitStoreOutcome(businessIds, data), quotaDetail, response.status)
          return data
        }
        failRun(classifyMenuImportError(source, data.error || data.message, response.status, t))
        return
      }

      // a queued import (202 + jobId) or a count short of the stores is not a success yet: the runs stay importing, nothing is logged
      if (multi && !(data?.success === true && data.appliedCount === businessIds.length)) {
        setStatus('queued')
        setResult({ jobId: data?.jobId ?? null, total: businessIds.length })
        return data
      }

      const appliedCount = data?.appliedCount ?? null
      await finishRuns(businessIds, appliedCount)
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
