import { useCallback, useState } from 'react'
import { useApi, useLanguage, useSession, useToast, ToastType } from '~components'
import { mapMenuImportError } from './menuImportErrors'
import { getMenuImportApiUrl } from './menuImportConfig'
import { logMenuImportSync } from './logMenuImportSync'

export const useMenuImport = (source = 'doordash') => {
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [{ token }] = useSession()
  const [ordering] = useApi()
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState(null)

  const triggerImport = useCallback(async (params, { onSuccess, onError } = {}) => {
    const baseUrl = getMenuImportApiUrl()
    if (!baseUrl) {
      const message = t(
        'IMPORTER_STATUS_API_NOT_CONFIGURED',
        'Menu import API is not configured. Set VITE_MENU_IMPORT_API_URL in your environment.'
      )
      setError(new Error(message))
      showToast(ToastType.Error, message)
      onError?.(new Error(message))
      return
    }

    setIsImporting(true)
    setError(null)

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
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const message = mapMenuImportError(
          source,
          data.detail || data.message || data.error,
          response.status,
          t
        )
        throw new Error(message)
      }

      if (data.success === false) {
        throw new Error(data.error || data.message || t('IMPORTER_STATUS_ERROR', 'Import failed'))
      }

      logMenuImportSync({ token, source, params })
      showToast(ToastType.Success, t('IMPORTER_STATUS_SUCCESS', 'Menu imported successfully'))
      onSuccess?.(data, params)
      return data
    } catch (err) {
      const message = err?.message || t('IMPORTER_STATUS_ERROR', 'Import failed')
      setError(err instanceof Error ? err : new Error(message))
      showToast(ToastType.Error, message)
      onError?.(err instanceof Error ? err : new Error(message))
    } finally {
      setIsImporting(false)
    }
  }, [ordering?.project, showToast, source, t, token])

  return {
    triggerImport,
    isImporting,
    error
  }
}
