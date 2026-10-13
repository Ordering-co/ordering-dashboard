/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const showToast = vi.fn()
const getSchoolLabelsCount = vi.fn()
const fetchSchoolLabelsPdf = vi.fn()
const saveInvoicePdfBlob = vi.fn()

vi.mock('../../../../../../index', () => ({
  useApi: () => [{ root: 'https://api.example/v400/en/demo' }],
  useSession: () => [{ token: 'session-token' }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useToast: () => [null, { showToast }],
  ToastType: { Error: 'error', Info: 'info' }
}))

vi.mock('../../../../../../components/Schools/schoolApi', () => ({
  getSchoolLabelsCount: (...args) => getSchoolLabelsCount(...args),
  fetchSchoolLabelsPdf: (...args) => fetchSchoolLabelsPdf(...args)
}))

vi.mock('../../../BusinessIntelligence/downloadInvoicePdf', () => ({
  saveInvoicePdfBlob: (...args) => saveInvoicePdfBlob(...args)
}))

vi.mock('../../useSchoolFilters', () => ({
  useSchoolFilters: () => ({
    grades: [{ id: 1, name: '1st Grade' }],
    classrooms: [{ id: 119, name: 'Angela Taylor - Grade 3' }]
  })
}))

vi.mock('../../../../styles/Select/FirstSelect', () => ({
  Select: ({ placeholder }) => <div>{placeholder}</div>
}))

vi.mock('../../../Shared', () => ({
  SpinnerLoader: () => <div data-testid='spinner' />
}))

vi.mock('../PdfPreview', () => ({
  PdfPreview: ({ blob, actions }) => (
    <div>
      {blob && <div data-testid='pdf-preview'>{blob.size}</div>}
      {actions}
    </div>
  )
}))

import { SchoolPrintLabels } from '..'

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

const renderTab = () => renderWithProviders(<SchoolPrintLabels school={{ id: 67, name: 'Centreville' }} />)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SchoolPrintLabels', () => {
  it('shows the empty state without a download button when there are no meals', async () => {
    getSchoolLabelsCount.mockResolvedValue({ error: false, result: { labels: 0, sheets: 0, message: 'No meals for this date.' } })

    renderTab()

    expect(await screen.findByText('No meals for this date.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument()
    expect(fetchSchoolLabelsPdf).not.toHaveBeenCalled()
  })

  it('renders the summary and loads the guided preview when there are labels', async () => {
    getSchoolLabelsCount.mockResolvedValue({ error: false, result: countResult })
    fetchSchoolLabelsPdf.mockResolvedValue({ blob: previewBlob, filename: 'preview.pdf' })

    renderTab()

    expect(await screen.findByText('46 labels')).toBeInTheDocument()
    expect(screen.getByText('11 classrooms')).toBeInTheDocument()
    expect(screen.getByText('2 sheets')).toBeInTheDocument()
    expect(screen.getByText('K-2: 13')).toBeInTheDocument()
    expect(screen.getByText('Without grade: 3')).toBeInTheDocument()
    expect(screen.getByText('Avery 5160')).toBeInTheDocument()
    expect(await screen.findByTestId('pdf-preview')).toHaveTextContent(String(previewBlob.size))

    const [,, schoolId, params] = fetchSchoolLabelsPdf.mock.calls[0]
    expect(schoolId).toBe(67)
    expect(params.guides).toBe(true)
    expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled()
  })

  it('downloads the sheet without guides from the Download button', async () => {
    getSchoolLabelsCount.mockResolvedValue({ error: false, result: countResult })
    fetchSchoolLabelsPdf
      .mockResolvedValueOnce({ blob: previewBlob, filename: 'preview.pdf' })
      .mockResolvedValueOnce({ blob: sheetBlob, filename: 'centreville_2026-09-09.pdf' })

    renderTab()

    const button = await screen.findByRole('button', { name: 'Download' })
    await waitFor(() => expect(button).toBeEnabled())
    fireEvent.click(button)

    await waitFor(() => expect(saveInvoicePdfBlob).toHaveBeenCalledWith(sheetBlob, 'centreville_2026-09-09.pdf'))
    const [,,, params] = fetchSchoolLabelsPdf.mock.calls[1]
    expect(params.guides).toBeUndefined()
    expect(showToast).not.toHaveBeenCalled()
  })

  it('shows a toast and saves nothing when the download fails', async () => {
    getSchoolLabelsCount.mockResolvedValue({ error: false, result: countResult })
    fetchSchoolLabelsPdf
      .mockResolvedValueOnce({ blob: previewBlob, filename: 'preview.pdf' })
      .mockRejectedValueOnce(new Error('The selected grade id is invalid'))

    renderTab()

    const button = await screen.findByRole('button', { name: 'Download' })
    await waitFor(() => expect(button).toBeEnabled())
    fireEvent.click(button)

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('error', 'The selected grade id is invalid'))
    expect(saveInvoicePdfBlob).not.toHaveBeenCalled()
  })

  it('warns and hides the download button when the day exceeds the label limit', async () => {
    getSchoolLabelsCount.mockResolvedValue({ error: false, result: { ...countResult, labels: 1600, exceeds_max: true } })

    renderTab()

    expect(await screen.findByText(/Too many labels to generate/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument()
    expect(fetchSchoolLabelsPdf).not.toHaveBeenCalled()
  })
})
