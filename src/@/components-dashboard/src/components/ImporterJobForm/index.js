import React, { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

// Observed against the API: 0 = queued, 1 = completed, 3 = failed. Success is matched
// explicitly rather than by exclusion, so an unknown or intermediate status keeps polling
// instead of being announced as a completed import.
export const JOB_STATUS_SUCCESS = 1
export const JOB_STATUS_FAILED = 3

export const isJobSuccess = (status) => status === JOB_STATUS_SUCCESS
export const isJobFailed = (status) => status === JOB_STATUS_FAILED
export const isJobResolved = (status) => isJobSuccess(status) || isJobFailed(status)

const POLL_DELAYS_MS = [2000, 3000, 5000, 8000, 13000, 20000, 30000]
const POLL_MAX_ATTEMPTS = 12
const POLL_MAX_DURATION_MS = 3 * 60 * 1000 // counted only across time the tab was visible
const JOBS_PAGE_SIZE = 20
// Only used when the API ignores the id filter and returns an unfiltered list.
const MAX_FALLBACK_PAGES = 5

// Ids may come back as a string from one endpoint and a number from another.
const sameId = (a, b) => String(a) === String(b)

/**
 * Component to create importerJob form without UI component
 */
export const ImporterJobForm = (props) => {
  const {
    UIComponent,
    onImportSuccess
  } = props
  const [ordering] = useApi()
  const [session] = useSession()
  const [formState, setFormState] = useState({
    loading: false,
    changes: {
      separator: ',',
      enclosure: '"',
      escape: '/',
      start_line: 2
    },
    result: { error: false }
  })
  const [fileState, setFileState] = useState({
    fileName: null,
    fileType: null,
    csvFile: null,
    importOptions: {
      separator: ',',
      enclosure: '"',
      escape: '/',
      start_line: 2
    }
  })
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const [jobStatus, setJobStatus] = useState({ checking: false, job: null, error: false, polling: false })

  const importerIdRef = useRef(null)
  const notifiedJobRef = useRef(null)
  const mountedRef = useRef(true)
  const pollTimeoutRef = useRef(null)
  const pollJobRef = useRef(null)
  // Cancellation key for every scheduled timer and in-flight fetch. A job id repeats
  // across cycles (a manual check restarts polling for the same job), so it can't be used
  // to tell a superseded chain from the current one.
  const pollGenerationRef = useRef(0)
  const pollInFlightRef = useRef(false)
  const pollAttemptsRef = useRef(0)
  const pollActiveMsRef = useRef(0)
  const pollSegmentStartRef = useRef(null)
  // Always holds the latest closure, so a poll resumed by the visibility listener uses the
  // current session token instead of the one captured on first render.
  const scheduleRef = useRef(null)

  /**
   * The shared Alert/Confirm only renders a string or an array of strings, and silently
   * drops everything else — an empty array would open a popup with no body at all.
   */
  const toAlertContent = (value) => {
    if (typeof value === 'string' && value) return value
    if (Array.isArray(value)) {
      const strings = value.filter(item => typeof item === 'string' && item)
      if (strings.length) return strings
    }
    return [t('ERROR', 'Error')]
  }

  const notifyIfSuccess = (job) => {
    if (!job || !isJobSuccess(job.status)) return
    if (sameId(notifiedJobRef.current, job.id)) return
    notifiedJobRef.current = job.id
    onImportSuccess && onImportSuccess()
  }

  const clearPollTimeout = () => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }
  }

  const stopPolling = () => {
    pollGenerationRef.current += 1
    clearPollTimeout()
    pollInFlightRef.current = false
    pollJobRef.current = null
    pollSegmentStartRef.current = null
  }

  const fetchJobsPage = async (importerId, query) => {
    const response = await fetch(`${ordering.root}/importers/${importerId}/jobs?${query}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const body = await response.json()
    if (!Array.isArray(body?.result)) throw new Error('Unexpected jobs response')
    return body
  }

  /**
   * Resolves a single job. Asks the API to filter by id; if that filter is honored this is
   * one request returning one record. If it is ignored the response is just an unfiltered
   * page, so fall back to walking the newest pages — a fresh job sits at one end of the
   * list, never deep in the middle.
   */
  const fetchJobById = async (importerId, jobId) => {
    const where = encodeURIComponent(JSON.stringify([{ attribute: 'id', value: jobId }]))
    const filtered = await fetchJobsPage(importerId, `where=${where}&page_size=${JOBS_PAGE_SIZE}`)

    const match = filtered.result.find(job => sameId(job.id, jobId))
    if (match) return match

    const total = filtered.pagination?.total
    if (typeof total === 'number' && total <= 1) return null

    const totalPages = filtered.pagination?.total_pages || 1
    const lastPageToScan = Math.max(1, totalPages - MAX_FALLBACK_PAGES + 1)
    for (let page = totalPages; page >= lastPageToScan; page--) {
      const body = await fetchJobsPage(importerId, `page_size=${JOBS_PAGE_SIZE}&page=${page}`)
      const found = body.result.find(job => sameId(job.id, jobId))
      if (found) return found
    }
    return null
  }

  const scheduleNextPoll = (generation) => {
    if (generation !== pollGenerationRef.current || !pollJobRef.current) return
    if (typeof document !== 'undefined' && document.hidden) return
    // A fetch already in flight schedules its own follow-up; scheduling here too would
    // leave two independent timer chains hitting the API.
    if (pollInFlightRef.current) return

    const { importerId, jobId } = pollJobRef.current
    const activeElapsed = pollActiveMsRef.current + (pollSegmentStartRef.current ? Date.now() - pollSegmentStartRef.current : 0)
    if (pollAttemptsRef.current >= POLL_MAX_ATTEMPTS || activeElapsed >= POLL_MAX_DURATION_MS) {
      stopPolling()
      setJobStatus(prev => (prev.polling ? { ...prev, polling: false } : prev))
      return
    }

    clearPollTimeout()
    const delay = POLL_DELAYS_MS[Math.min(pollAttemptsRef.current, POLL_DELAYS_MS.length - 1)]
    pollTimeoutRef.current = setTimeout(async () => {
      pollTimeoutRef.current = null
      if (generation !== pollGenerationRef.current) return

      pollAttemptsRef.current += 1
      pollInFlightRef.current = true
      try {
        const job = await fetchJobById(importerId, jobId)
        if (generation !== pollGenerationRef.current) return

        if (job && isJobResolved(job.status)) {
          stopPolling()
          setJobStatus({ checking: false, job, error: false, polling: false })
          notifyIfSuccess(job)
          return
        }
        setJobStatus(prev => ({ ...prev, job: job || prev.job, error: false }))
      } catch (err) {
        if (generation !== pollGenerationRef.current) return
        setJobStatus(prev => ({ ...prev, error: true }))
      } finally {
        if (generation === pollGenerationRef.current) pollInFlightRef.current = false
      }
      scheduleNextPoll(generation)
    }, delay)
  }

  const startPolling = (importerId, jobId) => {
    stopPolling()
    const generation = pollGenerationRef.current
    pollAttemptsRef.current = 0
    pollActiveMsRef.current = 0
    pollSegmentStartRef.current = Date.now()
    pollJobRef.current = { jobId, importerId }
    setJobStatus(prev => ({ ...prev, polling: true }))
    scheduleNextPoll(generation)
  }

  useEffect(() => {
    scheduleRef.current = scheduleNextPoll
  })

  useEffect(() => {
    mountedRef.current = true
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearPollTimeout()
        if (pollSegmentStartRef.current) {
          pollActiveMsRef.current += Date.now() - pollSegmentStartRef.current
          pollSegmentStartRef.current = null
        }
        return
      }
      if (!pollJobRef.current) return
      pollSegmentStartRef.current = Date.now()
      if (!pollTimeoutRef.current) scheduleRef.current?.(pollGenerationRef.current)
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      mountedRef.current = false
      stopPolling()
    }
  }, [])

  /**
   * Process CSV file to CreateImporterJob
   * @param {File} file CSV file to create importer job
   */

  const handleUploadCsv = (file) => {
    if (file) {
      stopPolling()
      notifiedJobRef.current = null
      setJobStatus({ checking: false, job: null, error: false, polling: false })
      setFileState({
        ...fileState,
        fileName: file.name,
        fileType: file.type,
        csvFile: file
      })
    }
  }

  /**
   * Manual, user-triggered status check. Background polling is restarted on every
   * non-terminal outcome, so `polling` is never left true without a timer behind it.
   */
  const handleCheckJobStatus = async () => {
    const jobId = formState?.result?.result?.id
    const importerId = importerIdRef.current
    if (!jobId || !importerId) return

    stopPolling()
    const generation = pollGenerationRef.current
    setJobStatus(prev => ({ ...prev, checking: true, error: false, polling: false }))
    try {
      const job = await fetchJobById(importerId, jobId)
      if (!mountedRef.current || generation !== pollGenerationRef.current) return

      if (job && isJobResolved(job.status)) {
        setJobStatus({ checking: false, job, error: false, polling: false })
        notifyIfSuccess(job)
        return
      }
      setJobStatus(prev => ({ ...prev, checking: false, job: job || prev.job, error: !job }))
      startPolling(importerId, jobId)
    } catch (err) {
      if (!mountedRef.current || generation !== pollGenerationRef.current) return
      setJobStatus(prev => ({ ...prev, checking: false, error: true }))
      startPolling(importerId, jobId)
    }
  }

  /**
 * Update import_options data
 * @param {EventTarget} e Related HTML event
 */
  const handleChangeInput = (e, isMany) => {
    let currentChanges = {}
    if (isMany) {
      Object.values(e).map(obj => {
        currentChanges = {
          ...currentChanges,
          [obj.name]: obj.value
        }
      })
    } else {
      currentChanges = {
        [e.target.name]: e.target.value
      }
    }
    setFileState({
      ...fileState,
      importOptions: { ...fileState.importOptions, ...currentChanges }
    })
  }

  /**
 * Update import_options data
 */

  const handleCreateImporterJob = async (id) => {
    showToast(ToastType.Info, t('LOADING', 'Loading'))
    const formData = new FormData()
    formData.append('file', fileState?.csvFile)
    const importOptions = { ...fileState?.importOptions }
    Object.keys(importOptions).forEach(key => {
      if (!importOptions[key]) {
        delete importOptions[key]
      }
    })
    formData.append('import_options', JSON.stringify(importOptions))

    try {
      setFormState({ ...formState, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.token}`
        },
        body: formData
      }
      const response = await fetch(`${ordering.root}/importers/${id}/jobs`, requestOptions)
      const { error, result } = await response.json()
      if (error || !response.ok || !result?.id) {
        setFormState({
          ...formState,
          loading: false,
          result: {
            error: true,
            result: toAlertContent(result)
          }
        })
        return
      }

      importerIdRef.current = id
      notifiedJobRef.current = null
      showToast(ToastType.Info, t('IMPORTER_JOB_QUEUED', 'Import queued, check back in a few minutes'))
      setJobStatus({ checking: false, job: result, error: false, polling: false })
      setFormState({
        loading: false,
        changes: {},
        result: {
          error: false,
          result
        }
      })
      if (isJobResolved(result.status)) {
        notifyIfSuccess(result)
      } else {
        startPolling(id, result.id)
      }
    } catch (error) {
      // A non-JSON body (an upstream HTML error page) surfaces as a SyntaxError whose
      // message would be meaningless to the user.
      const isParseError = error instanceof SyntaxError
      setFormState({
        ...formState,
        result: {
          error: true,
          result: [isParseError ? t('ERROR', 'Error') : (error.message || t('ERROR', 'Error'))]
        },
        loading: false
      })
    }
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          formState={formState}
          fileState={fileState}
          setFileState={setFileState}
          handleChangeInput={handleChangeInput}
          handleUploadCsv={handleUploadCsv}
          handleCreateImporterJob={handleCreateImporterJob}
          jobStatus={jobStatus}
          handleCheckJobStatus={handleCheckJobStatus}
        />
      )}
    </>
  )
}

ImporterJobForm.propTypes = {
  UIComponent: PropTypes.elementType,
  /**
   * Fired once per job, when it resolves to a confirmed-successful status, so the page
   * behind the panel can refresh itself.
   */
  onImportSuccess: PropTypes.func
}
