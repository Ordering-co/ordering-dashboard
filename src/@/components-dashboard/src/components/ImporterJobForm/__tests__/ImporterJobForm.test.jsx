/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, act } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const showToast = vi.fn()

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token' }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.example.com' }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [null, { showToast }],
  ToastType: { Info: 'INFO', Success: 'SUCCESS', Error: 'ERROR' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { ImporterJobForm } from '../index'

// Mirrors POLL_DELAYS_MS in the controller.
const FIRST_DELAY = 2000
const SECOND_DELAY = 3000
// Comfortably past both POLL_MAX_ATTEMPTS and POLL_MAX_DURATION_MS.
const BEYOND_ALL_CAPS = 6 * 60 * 1000

// Stand-in for the UI layer: exposes the controller's props without dragging in
// styled-components or react-hook-form.
const StubUI = (props) => (
  <div>
    <pre data-testid='job-status'>{JSON.stringify(props.jobStatus)}</pre>
    <button onClick={() => props.handleCreateImporterJob(99)}>create</button>
    <button onClick={() => props.handleCheckJobStatus()}>check</button>
  </div>
)

const renderForm = (extraProps = {}) => {
  const onImportSuccess = vi.fn()
  const view = renderWithProviders(
    <ImporterJobForm UIComponent={StubUI} onImportSuccess={onImportSuccess} {...extraProps} />
  )
  return { onImportSuccess, view }
}

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body
})

const jobsPage = (jobs, pagination = { total: 1, total_pages: 1 }) =>
  jsonResponse({ result: jobs, pagination })

const jobStatusText = () => screen.getByTestId('job-status').textContent

let hidden = false
const setTabHidden = async (value) => {
  hidden = value
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

const isJobsRequest = (url, opts) => !opts || opts.method !== 'POST'

describe('ImporterJobForm controller', () => {
  beforeEach(() => {
    showToast.mockReset()
    global.fetch = vi.fn()
    hidden = false
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('job creation', () => {
    it('does not report success when the job resolves to an unknown/intermediate status', async () => {
      global.fetch.mockResolvedValue(jsonResponse({ error: false, result: { id: 1, status: 2 } }))

      const { onImportSuccess } = renderForm()
      await act(async () => {
        fireEvent.click(screen.getByText('create'))
      })

      expect(jobStatusText()).toContain('"id":1')
      expect(onImportSuccess).not.toHaveBeenCalled()
      expect(jobStatusText()).toContain('"polling":true')
    })

    it('shows no status panel when the API responds success but without a job id', async () => {
      global.fetch.mockResolvedValueOnce(jsonResponse({ error: false, result: [] }))

      const { onImportSuccess } = renderForm()
      await act(async () => {
        fireEvent.click(screen.getByText('create'))
      })

      expect(jobStatusText()).toContain('"job":null')
      expect(onImportSuccess).not.toHaveBeenCalled()
    })

    it('calls onImportSuccess only for the confirmed success status', async () => {
      global.fetch.mockResolvedValueOnce(
        jsonResponse({ error: false, result: { id: 2, status: 1, result_data: { inserts: 3, updates: 0 } } })
      )

      const { onImportSuccess } = renderForm()
      await act(async () => {
        fireEvent.click(screen.getByText('create'))
      })

      expect(onImportSuccess).toHaveBeenCalledTimes(1)
    })
  })

  describe('manual check', () => {
    it('keeps the job on screen when a manual check fails', async () => {
      global.fetch
        .mockResolvedValueOnce(jsonResponse({ error: false, result: { id: 3, status: 0 } }))
        .mockRejectedValueOnce(new Error('network down'))

      renderForm()
      await act(async () => {
        fireEvent.click(screen.getByText('create'))
      })
      expect(jobStatusText()).toContain('"id":3')

      await act(async () => {
        fireEvent.click(screen.getByText('check'))
      })

      expect(jobStatusText()).toContain('"error":true')
      expect(jobStatusText()).toContain('"id":3')
    })

    it('keeps auto-polling alive after a failed manual check, so a blip recovers on its own', async () => {
      global.fetch
        .mockResolvedValueOnce(jsonResponse({ error: false, result: { id: 10, status: 0 } }))
        .mockRejectedValueOnce(new Error('network blip'))
        .mockResolvedValueOnce(jobsPage([{ id: 10, status: 1, result_data: { inserts: 1, updates: 0 } }]))

      const { onImportSuccess } = renderForm()
      await act(async () => {
        fireEvent.click(screen.getByText('create'))
      })
      await act(async () => {
        fireEvent.click(screen.getByText('check'))
      })

      expect(jobStatusText()).toContain('"error":true')
      // `polling: true` must always be backed by a real scheduled timer.
      expect(jobStatusText()).toContain('"polling":true')

      await act(async () => {
        await vi.advanceTimersByTimeAsync(FIRST_DELAY)
      })

      expect(onImportSuccess).toHaveBeenCalledTimes(1)
      expect(jobStatusText()).toContain('"polling":false')
    })
  })

  describe('auto-polling', () => {
    it('retries on the backoff schedule until the job resolves', async () => {
      global.fetch
        .mockResolvedValueOnce(jsonResponse({ error: false, result: { id: 8, status: 0 } }))
        .mockResolvedValueOnce(jobsPage([{ id: 8, status: 0 }]))
        .mockResolvedValueOnce(jobsPage([{ id: 8, status: 1, result_data: { inserts: 2, updates: 0 } }]))

      const { onImportSuccess } = renderForm()
      await act(async () => {
        fireEvent.click(screen.getByText('create'))
      })
      expect(onImportSuccess).not.toHaveBeenCalled()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(FIRST_DELAY)
      })
      expect(onImportSuccess).not.toHaveBeenCalled()
      expect(jobStatusText()).toContain('"polling":true')

      await act(async () => {
        await vi.advanceTimersByTimeAsync(SECOND_DELAY)
      })
      expect(onImportSuccess).toHaveBeenCalledTimes(1)
      expect(jobStatusText()).toContain('"polling":false')
    })

    it('gives up once the caps are reached and stops claiming it is still checking', async () => {
      global.fetch.mockImplementation((url, opts) =>
        Promise.resolve(isJobsRequest(url, opts)
          ? jobsPage([{ id: 9, status: 0 }])
          : jsonResponse({ error: false, result: { id: 9, status: 0 } }))
      )

      renderForm()
      await act(async () => {
        fireEvent.click(screen.getByText('create'))
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(BEYOND_ALL_CAPS)
      })

      expect(jobStatusText()).toContain('"polling":false')
      const pollCalls = global.fetch.mock.calls.filter(([url, opts]) => isJobsRequest(url, opts))
      expect(pollCalls.length).toBeLessThanOrEqual(12)
    })

    it('does not start a second polling chain when the tab is hidden and shown mid-flight', async () => {
      const pollUrls = []
      let releasePoll

      global.fetch.mockImplementation((url, opts) => {
        if (!isJobsRequest(url, opts)) {
          return Promise.resolve(jsonResponse({ error: false, result: { id: 7, status: 0 } }))
        }
        pollUrls.push(url)
        return new Promise(resolve => {
          releasePoll = () => resolve(jobsPage([{ id: 7, status: 0 }]))
        })
      })

      renderForm()
      await act(async () => {
        fireEvent.click(screen.getByText('create'))
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(FIRST_DELAY)
      })
      expect(pollUrls).toHaveLength(1)

      // Tab hidden and shown again while the first poll is still in flight.
      await setTabHidden(true)
      await setTabHidden(false)
      expect(pollUrls).toHaveLength(1)

      await act(async () => {
        releasePoll()
        await vi.advanceTimersByTimeAsync(SECOND_DELAY)
      })
      // Exactly one follow-up — a duplicated chain would have fired twice by now.
      expect(pollUrls).toHaveLength(2)
    })

    it('keeps a real timer behind polling when a manual check overlaps an in-flight poll', async () => {
      let releaseBackgroundPoll
      const backgroundPoll = new Promise(resolve => { releaseBackgroundPoll = resolve })

      global.fetch.mockImplementation((url, opts) => {
        if (!isJobsRequest(url, opts)) {
          return Promise.resolve(jsonResponse({ error: false, result: { id: 1, status: 0 } }))
        }
        // The first jobs request is the background poll; it stays unresolved until released.
        if (global.fetch.mock.calls.filter(([u, o]) => isJobsRequest(u, o)).length === 1) {
          return backgroundPoll.then(() => jobsPage([{ id: 1, status: 0 }]))
        }
        return Promise.resolve(jobsPage([{ id: 1, status: 0 }]))
      })

      renderForm()
      await act(async () => { fireEvent.click(screen.getByText('create')) })
      await act(async () => { await vi.advanceTimersByTimeAsync(FIRST_DELAY) })
      // Manual check while the background fetch is still in flight, then let it land.
      await act(async () => { fireEvent.click(screen.getByText('check')) })
      await act(async () => { releaseBackgroundPoll(); await vi.advanceTimersByTimeAsync(0) })

      expect(jobStatusText()).toContain('"polling":true')

      const requestsBefore = global.fetch.mock.calls.length
      await act(async () => { await vi.advanceTimersByTimeAsync(FIRST_DELAY + SECOND_DELAY) })
      expect(global.fetch.mock.calls.length).toBeGreaterThan(requestsBefore)
    })

    it('stops polling when the panel unmounts', async () => {
      global.fetch.mockImplementation((url, opts) =>
        Promise.resolve(isJobsRequest(url, opts)
          ? jobsPage([{ id: 11, status: 0 }])
          : jsonResponse({ error: false, result: { id: 11, status: 0 } }))
      )

      const { view } = renderForm()
      await act(async () => {
        fireEvent.click(screen.getByText('create'))
      })

      view.unmount()
      const callsAfterUnmount = global.fetch.mock.calls.length

      await act(async () => {
        await vi.advanceTimersByTimeAsync(BEYOND_ALL_CAPS)
      })

      expect(global.fetch.mock.calls.length).toBe(callsAfterUnmount)
    })
  })

  describe('finding the job', () => {
    it('resolves in a single request when the API honors the id filter', async () => {
      global.fetch
        .mockResolvedValueOnce(jsonResponse({ error: false, result: { id: 5, status: 0 } }))
        .mockResolvedValueOnce(jobsPage([{ id: 5, status: 1, result_data: { inserts: 1, updates: 0 } }]))

      const { onImportSuccess } = renderForm()
      await act(async () => {
        fireEvent.click(screen.getByText('create'))
      })
      await act(async () => {
        fireEvent.click(screen.getByText('check'))
      })

      expect(onImportSuccess).toHaveBeenCalledTimes(1)
      const pollCalls = global.fetch.mock.calls.filter(([url, opts]) => isJobsRequest(url, opts))
      expect(pollCalls).toHaveLength(1)
      expect(pollCalls[0][0]).toContain('where=')
    })

    it('falls back to scanning pages when the API ignores the id filter', async () => {
      global.fetch
        .mockResolvedValueOnce(jsonResponse({ error: false, result: { id: 4, status: 0 } }))
        .mockResolvedValueOnce(jobsPage([{ id: 100, status: 1 }], { total: 21, total_pages: 2 }))
        .mockResolvedValueOnce(jobsPage([{ id: 4, status: 1, result_data: { inserts: 1, updates: 0 } }], { total: 21, total_pages: 2 }))

      const { onImportSuccess } = renderForm()
      await act(async () => {
        fireEvent.click(screen.getByText('create'))
      })
      await act(async () => {
        fireEvent.click(screen.getByText('check'))
      })

      expect(onImportSuccess).toHaveBeenCalledTimes(1)
    })

    it('matches the job even when the two endpoints disagree on the id type', async () => {
      global.fetch
        .mockResolvedValueOnce(jsonResponse({ error: false, result: { id: '6', status: 0 } }))
        .mockResolvedValueOnce(jobsPage([{ id: 6, status: 1, result_data: { inserts: 1, updates: 0 } }]))

      const { onImportSuccess } = renderForm()
      await act(async () => {
        fireEvent.click(screen.getByText('create'))
      })
      await act(async () => {
        fireEvent.click(screen.getByText('check'))
      })

      expect(onImportSuccess).toHaveBeenCalledTimes(1)
    })
  })
})
