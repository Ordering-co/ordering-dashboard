/* eslint-disable import/first */
// redesign SC-B4 (decision 3A; M-SC09): «Meals & reports» and «Print labels» share the day, the grade and the classroom through the URL.
// Both tabs are real; a change made in one is what the other asks for when it mounts. The API and the downloads are replaced.
import React from 'react'
import dayjs from 'dayjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const ORDERING = { root: 'https://api.example/v400/en/demo' }
const SESSION = { token: 'session-token' }
const listMeals = vi.fn()
const listGrades = vi.fn()
const listClassrooms = vi.fn()
const getSchoolLabelsCount = vi.fn()
const fetchSchoolLabelsPdf = vi.fn()

vi.mock('../../../../../../index', () => ({
  useApi: () => [ORDERING],
  useSession: () => [SESSION],
  useLanguage: () => [{ language: { code: 'en' } }, (_key, text) => text],
  useToast: () => [null, { showToast: () => {} }],
  ToastType: { Error: 'error', Info: 'info', Success: 'success' },
  useConfig: () => [{ configs: { dates_general_format: { value: 'DD-MM-YYYY HH:mm' } } }],
  useUtils: () => [{ parseDate: (value) => dayjs(String(value).slice(0, 10)).format('DD-MM-YYYY') }]
}))

vi.mock('../../../../../../components/Schools/schoolApi', () => ({
  listMeals: (...args) => listMeals(...args),
  listGrades: (...args) => listGrades(...args),
  listClassrooms: (...args) => listClassrooms(...args),
  getSchoolLabelsCount: (...args) => getSchoolLabelsCount(...args),
  fetchSchoolLabelsPdf: (...args) => fetchSchoolLabelsPdf(...args),
  fetchSchoolReport: vi.fn()
}))

vi.mock('../../../BusinessIntelligence/downloadInvoicePdf', () => ({ saveInvoicePdfBlob: vi.fn() }))
vi.mock('../../SchoolPrintLabels/PdfPreview', () => ({ PdfPreview: () => <div data-testid='pdf-preview' /> }))

import { SchoolMealsReports } from '..'
import { SchoolPrintLabels } from '../../SchoolPrintLabels'

const SCHOOL = { id: 67, name: 'Centreville' }
const ok = (result) => ({ error: false, result, pagination: { current_page: 1, total_pages: 1 } })

const mount = (Tab) => renderWithProviders(<Tab school={SCHOOL} />, { theme: createDashboardTheme(theme) })

const pickGrade = async (name) => {
  await waitFor(() => expect(screen.getByRole('button', { name: /^Grade All grades$/ })).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: /^Grade/ }))
  await screen.findByRole('option', { name })
  fireEvent.click(screen.getByRole('option', { name }))
}

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, '', '/schools?date=2026-10-11')
  listMeals.mockResolvedValue(ok([]))
  listGrades.mockResolvedValue(ok([{ id: 1, name: '1st Grade' }, { id: 2, name: '2nd Grade' }]))
  listClassrooms.mockResolvedValue(ok([{ id: 119, name: 'Angela Taylor - Grade 3' }]))
  getSchoolLabelsCount.mockResolvedValue({ error: false, result: { labels: 0, sheets: 0 } })
  fetchSchoolLabelsPdf.mockResolvedValue({ blob: new Blob(['x']), filename: 'x.pdf' })
})
afterEach(cleanup)

describe('the day shared by the two tabs', () => {
  it('the grade changed in Meals is the grade Labels asks the count for', async () => {
    const meals = mount(SchoolMealsReports)
    await pickGrade('1st Grade')
    await waitFor(() => expect(listMeals.mock.calls[listMeals.mock.calls.length - 1][3].gradeId).toBe(1))
    await screen.findByText('No meals for this date') // the request settled: nothing is left to update
    meals.unmount()

    mount(SchoolPrintLabels)
    await waitFor(() => expect(getSchoolLabelsCount).toHaveBeenCalled())
    expect(getSchoolLabelsCount.mock.calls[0][3]).toEqual({ preparationDate: '2026-10-11', gradeId: 1, classroomId: null })
    // and the bar of Labels shows it
    await waitFor(() => expect(screen.getByRole('button', { name: /^Grade 1st Grade$/ })).toBeInTheDocument())
  })

  it('the day changed in Labels is the day Meals asks for, and the grade goes back the same way', async () => {
    const labels = mount(SchoolPrintLabels)
    await waitFor(() => expect(getSchoolLabelsCount).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('combobox', { name: /Preparation date/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Select a date' })
    fireEvent.click(dialog.querySelector('[data-day="2026-10-14"]'))
    await pickGrade('2nd Grade')
    await waitFor(() => expect(getSchoolLabelsCount.mock.calls[getSchoolLabelsCount.mock.calls.length - 1][3]).toEqual({
      preparationDate: '2026-10-14', gradeId: 2, classroomId: null
    }))
    await screen.findByText('No meals for this date')
    labels.unmount()

    mount(SchoolMealsReports)
    await waitFor(() => expect(listMeals).toHaveBeenCalled())
    const params = listMeals.mock.calls[listMeals.mock.calls.length - 1][3]
    expect(params.preparationDate).toBe('2026-10-14')
    expect(params.gradeId).toBe(2)
    const bar = document.querySelector('.odc-school-daybar')
    expect(within(bar).getByRole('combobox', { name: /Preparation date/ })).toHaveTextContent('14-10-2026')
  })
})
