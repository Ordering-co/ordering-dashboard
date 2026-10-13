/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const showToast = vi.fn()
const listMeals = vi.fn()
const fetchSchoolReport = vi.fn()
const saveInvoicePdfBlob = vi.fn()

vi.mock('../../../../../../index', () => ({
  useApi: () => [{ root: 'https://api.example/v400/en/demo' }],
  useSession: () => [{ token: 'session-token' }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useToast: () => [null, { showToast }],
  ToastType: { Error: 'error', Info: 'info' }
}))

vi.mock('../../../../../../components/Schools/schoolApi', () => ({
  listMeals: (...args) => listMeals(...args),
  fetchSchoolReport: (...args) => fetchSchoolReport(...args)
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
  SpinnerLoader: () => <div data-testid='spinner' />,
  Pagination: () => null
}))

import { SchoolMealsReports } from '..'

const reportBlob = new Blob(['file'], { type: 'application/pdf' })

const renderTab = () => renderWithProviders(<SchoolMealsReports school={{ id: 67, name: 'Centreville' }} />)

const card = (title) => within(screen.getByText(title).parentElement)

beforeEach(() => {
  vi.clearAllMocks()
  listMeals.mockResolvedValue({ error: false, result: [], pagination: { current_page: 1, total_pages: 1 } })
})

describe('SchoolMealsReports', () => {
  it('offers direct downloads per report instead of the emailed report', async () => {
    renderTab()

    await screen.findByText('No meals for this date')
    const kitchen = card('Kitchen report')
    const products = card('Products ordered report')

    expect(kitchen.getByRole('button', { name: 'CSV' })).toBeEnabled()
    expect(kitchen.getByRole('button', { name: 'XLSX' })).toBeEnabled()
    expect(kitchen.queryByRole('button', { name: 'PDF' })).not.toBeInTheDocument()
    expect(products.getByRole('button', { name: 'PDF' })).toBeEnabled()
    expect(products.getByRole('button', { name: 'CSV' })).toBeEnabled()
    expect(products.getByRole('button', { name: 'XLSX' })).toBeEnabled()
    expect(screen.queryByText('Generate & email')).not.toBeInTheDocument()
  })

  it('downloads the requested file with the school, date and filters', async () => {
    fetchSchoolReport.mockResolvedValue({ blob: reportBlob, filename: 'centreville_2026-09-14_kitchen.xlsx' })

    renderTab()

    await screen.findByText('No meals for this date')
    fireEvent.click(card('Kitchen report').getByRole('button', { name: 'XLSX' }))

    await waitFor(() => expect(saveInvoicePdfBlob).toHaveBeenCalledWith(reportBlob, 'centreville_2026-09-14_kitchen.xlsx'))
    const [ordering, token, schoolId, report, format, params] = fetchSchoolReport.mock.calls[0]
    expect(ordering.root).toBe('https://api.example/v400/en/demo')
    expect(token).toBe('session-token')
    expect(schoolId).toBe(67)
    expect(report).toBe('kitchen')
    expect(format).toBe('xlsx')
    expect(params).toEqual({ preparationDate: new Date().toISOString().slice(0, 10), gradeId: null, classroomId: null })
    expect(showToast).not.toHaveBeenCalled()
  })

  it('shows the api message and saves nothing when the download fails', async () => {
    fetchSchoolReport.mockRejectedValue(new Error('No meals for this date.'))

    renderTab()

    await screen.findByText('No meals for this date')
    fireEvent.click(card('Products ordered report').getByRole('button', { name: 'PDF' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('error', 'No meals for this date.'))
    expect(saveInvoicePdfBlob).not.toHaveBeenCalled()
  })

  it('disables only the button that is downloading', async () => {
    let finish
    fetchSchoolReport.mockReturnValue(new Promise((resolve) => { finish = resolve }))

    renderTab()

    await screen.findByText('No meals for this date')
    const products = card('Products ordered report')
    fireEvent.click(products.getByRole('button', { name: 'PDF' }))

    const loading = await products.findByRole('button', { name: 'Loading' })
    expect(loading).toBeDisabled()
    expect(products.getByRole('button', { name: 'CSV' })).toBeEnabled()
    expect(products.getByRole('button', { name: 'XLSX' })).toBeEnabled()
    expect(card('Kitchen report').getByRole('button', { name: 'CSV' })).toBeEnabled()

    finish({ blob: reportBlob, filename: 'report.pdf' })
    await waitFor(() => expect(products.getByRole('button', { name: 'PDF' })).toBeEnabled())
  })

  it('disables every download when there is no date', async () => {
    renderTab()

    await screen.findByText('No meals for this date')
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: '' } })

    screen.getAllByRole('button').forEach((button) => expect(button).toBeDisabled())
  })
})
