/* eslint-disable import/first */
// redesign SC-B4 (decision 3A; M-SC01, M-SC02, M-SC03, M-SC09, M-SC13): «Print labels».
// Real: the tab, useSchoolDay (the URL), useSchoolFilters, SchoolDayBar and the P/ pieces. Replaced: the API of K/schoolApi.js,
// saveInvoicePdfBlob (the sheet is a real file: no test asks for one), PdfPreview (pdf.js; it has its own test) and the contexts.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const ORDERING = { root: 'https://api.example/v400/en/demo' }
const SESSION = { token: 'session-token' }
const showToast = vi.fn()
const getSchoolLabelsCount = vi.fn()
const fetchSchoolLabelsPdf = vi.fn()
const listGrades = vi.fn()
const listClassrooms = vi.fn()
const saveInvoicePdfBlob = vi.fn()

vi.mock('../../../../../../index', () => ({
  useApi: () => [ORDERING],
  useSession: () => [SESSION],
  useLanguage: () => [{ language: { code: 'en' } }, (_key, text) => text],
  useToast: () => [null, { showToast }],
  ToastType: { Error: 'error', Info: 'info', Success: 'success' },
  useConfig: () => [{ configs: { dates_general_format: { value: 'DD-MM-YYYY HH:mm' } } }]
}))

vi.mock('../../../../../../components/Schools/schoolApi', () => ({
  getSchoolLabelsCount: (...args) => getSchoolLabelsCount(...args),
  fetchSchoolLabelsPdf: (...args) => fetchSchoolLabelsPdf(...args),
  listGrades: (...args) => listGrades(...args),
  listClassrooms: (...args) => listClassrooms(...args)
}))

vi.mock('../../../BusinessIntelligence/downloadInvoicePdf', () => ({
  saveInvoicePdfBlob: (...args) => saveInvoicePdfBlob(...args)
}))

vi.mock('../PdfPreview', () => ({
  PdfPreview: ({ blob, loading, error, note, actions }) => (
    <div data-testid='pdf-preview' data-loading={loading ? 'true' : 'false'}>
      {blob && <div data-testid='pdf-blob'>{blob.size}</div>}
      {error && <div data-testid='pdf-error'>{error}</div>}
      {note && <p>{note}</p>}
      {actions}
    </div>
  )
}))

import { SchoolPrintLabels } from '..'

const DAY = '2026-10-11'
const SCHOOL = { id: 67, name: 'Centreville' }
const GRADES = [{ id: 1, name: '1st Grade' }, { id: 2, name: '2nd Grade' }]
const CLASSROOMS = [{ id: 119, name: 'Angela Taylor - Grade 3' }]

const countResult = {
  labels: 46,
  sheets: 2,
  students: 44,
  classrooms: 11,
  grades: 9,
  template: 'avery_5160',
  by_band: [{ band: 'K-2', labels: 13 }, { band: null, labels: 3 }],
  max_labels: 1500,
  exceeds_max: false
}

const previewBlob = new Blob(['%PDF-preview'], { type: 'application/pdf' })
const sheetBlob = new Blob(['%PDF-sheet'], { type: 'application/pdf' })

const ok = (result) => ({ error: false, result })
const deferred = () => {
  let finish
  const promise = new Promise((resolve) => { finish = resolve })
  return { promise, resolve: finish }
}

const setUrl = (search = `?date=${DAY}`) => window.history.replaceState(null, '', `/schools${search}`)
const params = () => Object.fromEntries(new URLSearchParams(window.location.search))

const renderTab = (props = {}) => renderWithProviders(
  <SchoolPrintLabels school={SCHOOL} {...props} />,
  { theme: createDashboardTheme(theme) }
)

const downloadButton = () => screen.getByRole('button', { name: 'Download' })

beforeEach(() => {
  vi.clearAllMocks()
  setUrl()
  listGrades.mockResolvedValue(ok(GRADES))
  listClassrooms.mockResolvedValue(ok(CLASSROOMS))
  getSchoolLabelsCount.mockResolvedValue(ok(countResult))
  fetchSchoolLabelsPdf.mockResolvedValue({ blob: previewBlob, filename: 'preview.pdf' })
})
afterEach(cleanup)

describe('the layout', () => {
  it('the filters come first, there is no <input type=date>, and the section has its title (M-SC01)', async () => {
    renderTab()
    await screen.findByText('46', { selector: '.odc-figure' })
    expect(document.querySelector('input[type="date"]')).toBeNull()
    expect(screen.getByRole('combobox', { name: /Preparation date/ })).toHaveTextContent('11-10-2026')
    const title = screen.getByRole('heading', { level: 2, name: 'Print labels' })
    expect(document.querySelector('.odc-school-daybar').compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText(/One peel-and-stick label per ordered meal/)).toBeInTheDocument()
  })

  it('shows a skeleton, not a spinner, while the count loads', async () => {
    getSchoolLabelsCount.mockReturnValue(new Promise(() => {}))
    renderTab()
    await waitFor(() => expect(getSchoolLabelsCount).toHaveBeenCalled())
    expect(document.querySelector('.odc-skeleton')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull()
  })
})

describe('the count and the summary', () => {
  it('asks for the count of the day with the grade and the classroom (parity with main)', async () => {
    renderTab()
    await waitFor(() => expect(getSchoolLabelsCount).toHaveBeenCalledTimes(1))
    expect(getSchoolLabelsCount).toHaveBeenCalledWith(ORDERING, 'session-token', 67, { preparationDate: DAY, gradeId: null, classroomId: null })
  })

  it('reads the grade and the classroom from the URL, the one the other tab shares (M-SC09)', async () => {
    setUrl('?date=2026-10-14&grade=2&classroom=119')
    renderTab()
    await waitFor(() => expect(getSchoolLabelsCount).toHaveBeenCalled())
    expect(getSchoolLabelsCount.mock.calls[0][3]).toEqual({ preparationDate: '2026-10-14', gradeId: 2, classroomId: 119 })
  })

  it('summarizes labels, classrooms, grades and sheets as figures, and the bands and the template as chips', async () => {
    renderTab()
    const summary = await waitFor(() => {
      const node = document.querySelector('.odc-school-labels-summary')
      expect(node).not.toBeNull()
      return node
    })
    expect(summary).toHaveTextContent('46 labels')
    expect(summary).toHaveTextContent('11 classrooms')
    expect(summary).toHaveTextContent('9 grades')
    expect(summary).toHaveTextContent('2 sheets')
    ;['46', '11', '9', '2'].forEach((figure) => {
      expect(within(summary).getAllByText(figure).some((node) => node.classList.contains('odc-figure'))).toBe(true)
    })
    const chips = [...summary.querySelectorAll('.odc-school-chip')].map((chip) => chip.textContent)
    expect(chips).toEqual(['K-2: 13', 'Without grade: 3', 'Avery 5160'])
    // review r1 #3: a flex chip drops the space before the figure («K-2:13»); the band chip keeps its words in one inline run
    const band = summary.querySelector('.odc-school-chip')
    expect(band.children).toHaveLength(1)
    expect(band.firstElementChild.tagName).toBe('SPAN')
    expect(band.firstElementChild.textContent).toBe('K-2: 13')
  })

  it('the band without a grade has the text of main and no band name', async () => {
    getSchoolLabelsCount.mockResolvedValue(ok({ ...countResult, by_band: [{ band: null, labels: 46 }], template: null }))
    renderTab()
    await screen.findAllByText('46', { selector: '.odc-figure' })
    const chips = [...document.querySelectorAll('.odc-school-chip')].map((chip) => chip.textContent)
    expect(chips).toEqual(['Without grade: 46'])
  })

  it('says the message of the API when there are no labels, and offers no download', async () => {
    getSchoolLabelsCount.mockResolvedValue(ok({ labels: 0, sheets: 0, message: 'No meals for this date.' }))
    renderTab()
    expect(await screen.findByText('No meals for this date.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull()
    expect(fetchSchoolLabelsPdf).not.toHaveBeenCalled()
  })

  it('says «No meals for this date» when there are no labels and no message', async () => {
    getSchoolLabelsCount.mockResolvedValue(ok({ labels: 0, sheets: 0 }))
    renderTab()
    expect(await screen.findByText('No meals for this date')).toBeInTheDocument()
  })

  it('a failed count is an error with «Retry», not an empty tab (M-SC03)', async () => {
    getSchoolLabelsCount.mockResolvedValueOnce({ error: true, result: ['Server said no'] })
    renderTab()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('This could not be loaded')
    expect(alert).toHaveTextContent('Server said no')
    expect(screen.queryByText('No meals for this date')).toBeNull()

    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    await screen.findByText('46', { selector: '.odc-figure' })
    expect(getSchoolLabelsCount).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a grade of the URL that the school does not have is removed and the count is asked without it (auditor 1)', async () => {
    setUrl(`?date=${DAY}&grade=99`)
    renderTab()
    await waitFor(() => expect(params()).toEqual({ date: DAY }))
    await waitFor(() => {
      const last = getSchoolLabelsCount.mock.calls[getSchoolLabelsCount.mock.calls.length - 1]
      expect(last[3].gradeId).toBeNull()
    })
  })
})

describe('the preview', () => {
  it('loads the sheet with the cut guides and a signal to cancel it', async () => {
    renderTab()
    expect(await screen.findByTestId('pdf-blob')).toHaveTextContent(String(previewBlob.size))
    const [ordering, token, schoolId, query, options] = fetchSchoolLabelsPdf.mock.calls[0]
    expect(ordering).toBe(ORDERING)
    expect(token).toBe('session-token')
    expect(schoolId).toBe(67)
    expect(query).toEqual({ preparationDate: DAY, gradeId: null, classroomId: null, guides: true })
    expect(options.signal).toBeInstanceOf(AbortSignal)
    expect(screen.getByText('Preview shows cut guides; the downloaded sheet has none.')).toBeInTheDocument()
  })

  it('a day over the limit warns and draws no preview and no download', async () => {
    getSchoolLabelsCount.mockResolvedValue(ok({ ...countResult, labels: 1600, exceeds_max: true }))
    renderTab()
    const notice = (await screen.findByText(/Too many labels to generate/)).closest('[role="status"]')
    expect(notice).toHaveAttribute('data-tone', 'warning')
    expect(notice).toHaveTextContent('Too many labels to generate; narrow the selection by grade or classroom.')
    expect(notice).toHaveTextContent('max 1500')
    expect(screen.queryByTestId('pdf-preview')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull()
    expect(fetchSchoolLabelsPdf).not.toHaveBeenCalled()
  })

  it('the old preview is cancelled when the day changes', async () => {
    const first = deferred()
    fetchSchoolLabelsPdf.mockReturnValueOnce(first.promise)
    renderTab()
    await waitFor(() => expect(fetchSchoolLabelsPdf).toHaveBeenCalledTimes(1))
    const signal = fetchSchoolLabelsPdf.mock.calls[0][4].signal
    expect(signal.aborted).toBe(false)

    fireEvent.click(screen.getByRole('combobox', { name: /Preparation date/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Select a date' })
    fireEvent.click(dialog.querySelector('[data-day="2026-10-14"]'))

    await waitFor(() => expect(signal.aborted).toBe(true))
    await waitFor(() => expect(fetchSchoolLabelsPdf).toHaveBeenCalledTimes(2))
    expect(fetchSchoolLabelsPdf.mock.calls[1][3].preparationDate).toBe('2026-10-14')
    // the old answer, late, paints nothing
    first.resolve({ blob: new Blob(['old-old-old-old']), filename: 'old.pdf' })
    expect(await screen.findByTestId('pdf-blob')).toHaveTextContent(String(previewBlob.size))
  })

  it('cancels the preview when the tab goes away', async () => {
    fetchSchoolLabelsPdf.mockReturnValueOnce(new Promise(() => {}))
    const { unmount } = renderTab()
    await waitFor(() => expect(fetchSchoolLabelsPdf).toHaveBeenCalledTimes(1))
    const signal = fetchSchoolLabelsPdf.mock.calls[0][4].signal
    unmount()
    expect(signal.aborted).toBe(true)
  })

  it('hands the message of a failed preview to the viewer', async () => {
    fetchSchoolLabelsPdf.mockRejectedValueOnce(new Error('Preview broke'))
    renderTab()
    expect(await screen.findByTestId('pdf-error')).toHaveTextContent('Preview broke')
  })
})

describe('the download of the sheet (the sixth button)', () => {
  it('asks for the sheet with the scope of the day, no guides, and saves the file', async () => {
    setUrl(`?date=${DAY}&grade=2&classroom=119`)
    fetchSchoolLabelsPdf
      .mockResolvedValueOnce({ blob: previewBlob, filename: 'preview.pdf' })
      .mockResolvedValueOnce({ blob: sheetBlob, filename: 'centreville_2026-10-11.pdf' })
    renderTab()
    await screen.findByTestId('pdf-blob')
    await waitFor(() => expect(downloadButton()).toBeEnabled())
    fireEvent.click(downloadButton())

    await waitFor(() => expect(saveInvoicePdfBlob).toHaveBeenCalledWith(sheetBlob, 'centreville_2026-10-11.pdf'))
    expect(fetchSchoolLabelsPdf).toHaveBeenCalledTimes(2)
    const [ordering, token, schoolId, query] = fetchSchoolLabelsPdf.mock.calls[1]
    expect(ordering).toBe(ORDERING)
    expect(token).toBe('session-token')
    expect(schoolId).toBe(67)
    expect(query).toEqual({ preparationDate: DAY, gradeId: 2, classroomId: 119 })
    expect('guides' in query).toBe(false)
    expect(showToast).not.toHaveBeenCalled()
  })

  it('is busy while it runs and a second click does not repeat it', async () => {
    const pending = deferred()
    fetchSchoolLabelsPdf
      .mockResolvedValueOnce({ blob: previewBlob, filename: 'preview.pdf' })
      .mockReturnValueOnce(pending.promise)
    renderTab()
    await screen.findByTestId('pdf-blob')
    await waitFor(() => expect(downloadButton()).toBeEnabled())
    fireEvent.click(downloadButton())
    await waitFor(() => expect(downloadButton()).toHaveAttribute('aria-busy', 'true'))
    fireEvent.click(downloadButton())
    fireEvent.click(downloadButton())
    expect(fetchSchoolLabelsPdf).toHaveBeenCalledTimes(2)

    pending.resolve({ blob: sheetBlob, filename: 'sheet.pdf' })
    await waitFor(() => expect(downloadButton()).not.toHaveAttribute('aria-busy'))
    expect(saveInvoicePdfBlob).toHaveBeenCalledTimes(1)
  })

  it('shows the toast of main and saves nothing when it fails', async () => {
    fetchSchoolLabelsPdf
      .mockResolvedValueOnce({ blob: previewBlob, filename: 'preview.pdf' })
      .mockRejectedValueOnce(new Error('The selected grade id is invalid'))
    renderTab()
    await screen.findByTestId('pdf-blob')
    await waitFor(() => expect(downloadButton()).toBeEnabled())
    fireEvent.click(downloadButton())
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('error', 'The selected grade id is invalid'))
    expect(saveInvoicePdfBlob).not.toHaveBeenCalled()
  })

  it('uses the text of main when the failure has no message', async () => {
    fetchSchoolLabelsPdf
      .mockResolvedValueOnce({ blob: previewBlob, filename: 'preview.pdf' })
      .mockRejectedValueOnce(new Error(''))
    renderTab()
    await screen.findByTestId('pdf-blob')
    await waitFor(() => expect(downloadButton()).toBeEnabled())
    fireEvent.click(downloadButton())
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('error', 'Labels could not be downloaded'))
  })

  it('is not available while the count loads', async () => {
    const pending = deferred()
    getSchoolLabelsCount.mockReturnValue(pending.promise)
    renderTab()
    await waitFor(() => expect(getSchoolLabelsCount).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull()
  })
})
