import { useCallback, useRef, useState } from 'react'

import { useSession } from '../../../../../contexts/SessionContext'
import { useLanguage } from '../../../../../contexts/LanguageContext'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { isNetworkFailure } from '../../../../../utils/networkFailure'

// redesign reviews FB (D9, RV-03): the CSV download of /intelligence/reviews, as main (ReviewsListing handleDownload)
// but as a hook. `download(request)` takes what `reviewsCsvRequest` gives ({ url, filename }), asks for the file with
// the session token and saves the blob through a temporary link. It answers `{ ok: true }` or `{ ok: false, error }`;
// a second call while one is going is ignored.
export const useReviewsCsv = () => {
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [state, setState] = useState({ loading: false, error: null })
  const running = useRef(false)

  const download = useCallback(async (request) => {
    if (running.current) return undefined
    running.current = true
    setState({ loading: true, error: null })
    const fallback = t('DOWNLOAD_FAILED', 'Download failed')
    try {
      const response = await fetch(request.url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => null)
        const error = translateApiMessage(t, errData?.result?.[0], fallback)
        setState({ loading: false, error })
        return { ok: false, error }
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = request.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      setState({ loading: false, error: null })
      return { ok: true }
    } catch (err) {
      // redesign when the request never reaches the server the browser's own text («Failed to fetch») is not for a person
      const error = isNetworkFailure(err?.message)
        ? t('REVIEWS_DOWNLOAD_NETWORK_FAILED', 'The report could not be downloaded. Try again.')
        : translateApiMessage(t, err?.message, fallback)
      setState({ loading: false, error })
      return { ok: false, error }
    } finally {
      running.current = false
    }
  }, [token, t])

  const reset = useCallback(() => {
    setState(prev => (prev.error === null ? prev : { ...prev, error: null }))
  }, [])

  return { loading: state.loading, error: state.error, download, reset }
}
