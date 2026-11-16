/* eslint-disable import/first */
// redesign SC-B4 (decision 3A; M-SC01, M-SC02, M-SC03, M-SC05, M-SC08, M-SC09, M-SC13): «Meals & reports».
// Real: the tab, useSchoolDay (the URL), useSchoolFilters, useSchoolList, SchoolDayBar, ReportCards, the P/ table, cards and pagination.
// Replaced: the API of K/schoolApi.js, saveInvoicePdfBlob (the downloads make real files: nothing here asks for one), and the contexts of
// the app. `parseDate` is a double built on dayjs with the project format (the test mounts without UtilsContext).
import React from 'react'
import dayjs from 'dayjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mockState = vi.hoisted(() => ({ catalog: {} }))
const ORDERING = { root: 'https://api.example/v400/en/demo' }
const SESSION = { token: 'session-token' }
const showToast = vi.fn()
const listMeals = vi.fn()
const listGrades = vi.fn()
const listClassrooms = vi.fn()
const fetchSchoolReport = vi.fn()
const saveInvoicePdfBlob = vi.fn()

vi.mock('../../../../../../index', () => ({
  useApi: () => [ORDERING],
  useSession: () => [SESSION],
  useLanguage: () => [{ language: { code: 'en' } }, (key, text) => mockState.catalog[key] ?? text],
  useToast: () => [null, { showToast }],
  ToastType: { Error: 'error', Info: 'info', Success: 'success' },
  useConfig: () => [{ configs: { dates_general_format: { value: 'DD-MM-YYYY HH:mm' } } }],
  useUtils: () => [{ parseDate: (value) => dayjs(String(value).slice(0, 10)).format('DD-MM-YYYY') }]
}))

vi.mock('../../../../../../components/Schools/schoolApi', () => ({
  listMeals: (...args) => listMeals(...args),
  listGrades: (...args) => listGrades(...args),
  listClassrooms: (...args) => listClassrooms(...args),
  fetchSchoolReport: (...args) => fetchSchoolReport(...args)
}))

vi.mock('../../../BusinessIntelligence/downloadInvoicePdf', () => ({
  saveInvoicePdfBlob: (...args) => saveInvoicePdfBlob(...args)
}))

import { SchoolMealsReports } from '..'

const MEAL_PARAMS = 'name,quantity,allergens,dietary_tags,order(id,student(name,lastname,code,classroom(name),grade(name)))'
const DAY = '2026-10-11'
const SCHOOL = { id: 67, name: 'Centreville' }
const GRADES = [{ id: 1, name: '1st Grade' }, { id: 2, name: '2nd Grade' }]
const CLASSROOMS = [{ id: 119, name: 'Angela Taylor - Grade 3' }, { id: 120, name: 'Room 4' }]
const MEAL = {
  id: 5,
  name: 'Pasta bake',
  quantity: 2,
  allergens: ['gluten', 'nuts'],
  dietary_tags: ['gluten_free'],
  order: {
    id: 4021,
    student: { name: 'Ana', lastname: 'Diaz', code: 'S-1', classroom: { name: 'Room 3' }, grade: { name: 'Grade 3' } }
  }
}
const reportBlob = new Blob(['file'], { type: 'application/pdf' })

const ok = (result, pagination = { current_page: 1, total_pages: 1 }) => ({ error: false, result, pagination })
const deferred = () => {
  let finish
  const promise = new Promise((resolve) => { finish = resolve })
  return { promise, resolve: finish }
}

const setUrl = (search = `?date=${DAY}`) => window.history.replaceState(null, '', `/schools${search}`)
const params = () => Object.fromEntries(new URLSearchParams(window.location.search))

const renderTab = (props = {}) => renderWithProviders(
  <SchoolMealsReports school={SCHOOL} {...props} />,
  { theme: createDashboardTheme(theme) }
)

// the cards are regions named by their title
const report = (title) => within(screen.getByRole('region', { name: title }))
const triggerOf = (name) => screen.getByRole('button', { name })

beforeEach(() => {
  vi.clearAllMocks()
  mockState.catalog = {}
  setUrl()
  listMeals.mockResolvedValue(ok([]))
  listGrades.mockResolvedValue(ok(GRADES))
  listClassrooms.mockResolvedValue(ok(CLASSROOMS))
})
afterEach(cleanup)

describe('the day bar and the scope', () => {
  it('the filters come first, before any report card, and there is no <input type=date> (M-SC01)', async () => {
    renderTab()
    await screen.findByText('No meals for this date')
    const bar = document.querySelector('.odc-school-daybar')
    const firstCard = document.querySelector('.odc-school-report')
    expect(bar).not.toBeNull()
    expect(firstCard).not.toBeNull()
    expect(bar.compareDocumentPosition(firstCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(document.querySelector('input[type="date"]')).toBeNull()
    expect(screen.getByRole('combobox', { name: /Preparation date/ })).toHaveTextContent('11-10-2026')
  })

  it('each card says what its download includes, with the date in the format of the project and never the ISO one (M-SC08)', async () => {
    renderTab()
    await screen.findByText('No meals for this date')
    ;['Kitchen report', 'Products ordered report'].forEach((title) => {
      const card = screen.getByRole('region', { name: title })
      expect(card).toHaveTextContent('For 11-10-2026 · All grades · All classrooms')
      expect(card).not.toHaveTextContent(DAY)
      expect(card.querySelector('.odc-figure')).toHaveTextContent('11-10-2026')
    })
  })

  it('names the grade and the classroom of the filter in the scope', async () => {
    setUrl(`?date=${DAY}&grade=1&classroom=119`)
    renderTab()
    const card = await screen.findByRole('region', { name: 'Kitchen report' })
    await waitFor(() => expect(card).toHaveTextContent('For 11-10-2026 · 1st Grade · Angela Taylor - Grade 3'))
  })

  it('the description of each card is the one of main', async () => {
    renderTab()
    await screen.findByText('No meals for this date')
    expect(screen.getByText(/What the kitchen must cook and pack on this date/)).toBeInTheDocument()
    expect(screen.getByText(/One row per ordered meal \(per student\) for this date/)).toBeInTheDocument()
  })
})

describe('the meals', () => {
  it('asks for the meals of the day with the params, 25 per page, page 1 (parity with main)', async () => {
    renderTab()
    await waitFor(() => expect(listMeals).toHaveBeenCalledTimes(1))
    expect(listMeals).toHaveBeenCalledWith(ORDERING, 'session-token', 67, {
      preparationDate: DAY,
      classroomId: null,
      gradeId: null,
      params: MEAL_PARAMS,
      page: 1,
      pageSize: 25
    })
  })

  it('opens at the page the shell holds (?page=)', async () => {
    listMeals.mockResolvedValue(ok([MEAL], { current_page: 3, total_pages: 3 }))
    renderTab({ initialPage: 3 })
    await waitFor(() => expect(listMeals).toHaveBeenCalledTimes(1))
    expect(listMeals.mock.calls[0][3].page).toBe(3)
  })

  it('draws a table with the eight columns and the allergens and dietary tags as words (M-SC05)', async () => {
    mockState.catalog = { SCHOOL_ALLERGEN_NUTS: 'Frutos secos', SCHOOL_DIETARY_GLUTEN_FREE: 'Sin gluten' }
    listMeals.mockResolvedValue(ok([MEAL]))
    renderTab()
    const table = await screen.findByRole('table', { name: 'Meals' })
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Order ID', 'Meal', 'Qty', 'Student', 'Classroom', 'Grade', 'Allergens', 'Dietary tags'
    ])
    const row = within(table).getAllByRole('row')[1]
    expect(within(row).getByRole('rowheader')).toHaveTextContent('Pasta bake')
    expect(row).toHaveTextContent('Ana Diaz')
    expect(row).toHaveTextContent('Room 3')
    expect(row).toHaveTextContent('Grade 3')
    expect(row).toHaveTextContent('4021')
    // the figures are in their node (decision 11)
    expect(within(row).getByText('4021')).toHaveClass('odc-figure')
    // apply-list row 25 (schools P-6): the order number opens the order
    expect(within(row).getByRole('link', { name: '4021' })).toHaveAttribute('href', '/orders?id=4021')
    expect(within(row).getByText('2')).toHaveClass('odc-figure')
    // translated and in words, never the raw value
    expect(within(row).getByText('Frutos secos')).toBeInTheDocument()
    expect(within(row).getByText('Gluten')).toBeInTheDocument()
    expect(within(row).getByText('Sin gluten')).toBeInTheDocument()
    expect(row).not.toHaveTextContent('gluten_free')
    expect(row).not.toHaveTextContent('nuts')
  })

  it('the rows open nothing (as main)', async () => {
    listMeals.mockResolvedValue(ok([MEAL]))
    renderTab()
    const table = await screen.findByRole('table', { name: 'Meals' })
    expect(within(table).getAllByRole('row')[1]).not.toHaveAttribute('data-interactive')
  })

  it('an empty day says so', async () => {
    renderTab()
    expect(await screen.findByText('No meals for this date')).toBeInTheDocument()
  })

  it('a failed load is an error with «Retry», never «No meals» (M-SC03)', async () => {
    listMeals.mockResolvedValueOnce({ error: true, result: ['Server said no'] })
    renderTab()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('This could not be loaded')
    expect(alert).toHaveTextContent('Server said no')
    expect(screen.queryByText('No meals for this date')).toBeNull()

    listMeals.mockResolvedValueOnce(ok([MEAL]))
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('table', { name: 'Meals' })).toBeInTheDocument()
    expect(listMeals).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('changing the grade asks again from page 1, tells the shell and writes the URL (M-SC09)', async () => {
    const onPageChange = vi.fn()
    // page 2 of 3 has rows (an empty page 2 would load page 1 by itself, M-SC10)
    listMeals.mockResolvedValue(ok([MEAL], { current_page: 2, total_pages: 3 }))
    renderTab({ initialPage: 2, onPageChange })
    await waitFor(() => expect(listMeals).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('button', { name: /^Grade All grades$/ })).toBeInTheDocument())
    fireEvent.click(triggerOf(/^Grade All grades$/))
    await screen.findByRole('option', { name: '1st Grade' })
    fireEvent.click(screen.getByRole('option', { name: '1st Grade' }))

    await waitFor(() => expect(listMeals).toHaveBeenCalledTimes(2))
    const last = listMeals.mock.calls[1][3]
    expect(last.gradeId).toBe(1)
    expect(last.page).toBe(1)
    expect(onPageChange).toHaveBeenCalledWith(1)
    expect(params()).toEqual({ date: DAY, grade: '1' })
  })

  it('changing the day asks again for that day', async () => {
    renderTab()
    await waitFor(() => expect(listMeals).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('combobox', { name: /Preparation date/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Select a date' })
    // A past day that is not DAY: today is the default and leaves ?date out of the URL, so a day that later became today
    // (2026-10-14) turned this test red on that date.
    fireEvent.click(dialog.querySelector('[data-day="2026-10-13"]'))
    await waitFor(() => expect(listMeals).toHaveBeenCalledTimes(2))
    expect(listMeals.mock.calls[1][3].preparationDate).toBe('2026-10-13')
    expect(params().date).toBe('2026-10-13')
  })

  it('a grade of the URL that the school does not have is removed and never filters (auditor 1)', async () => {
    setUrl(`?date=${DAY}&grade=99&classroom=98`)
    renderTab()
    await waitFor(() => expect(params()).toEqual({ date: DAY }))
    await waitFor(() => expect(listMeals).toHaveBeenCalled())
    const last = listMeals.mock.calls[listMeals.mock.calls.length - 1][3]
    expect(last.gradeId).toBeNull()
    expect(last.classroomId).toBeNull()
  })

  it('a grade of the URL that the school has is kept', async () => {
    setUrl(`?date=${DAY}&grade=2`)
    renderTab()
    await waitFor(() => expect(screen.getByRole('button', { name: /^Grade 2nd Grade$/ })).toBeInTheDocument())
    expect(params()).toEqual({ date: DAY, grade: '2' })
  })

  // redesign SC-B4 (coordinator): under 768px the meals are a list of RecordCards. A meal opens nothing, so its card is static
  // (`link={false}` with no onOpen, X-SC4): no <a> and no <button>, no hover affordance, every field of the table.
  describe('on a phone', () => {
    let original
    beforeEach(() => {
      original = window.matchMedia
      window.matchMedia = vi.fn(() => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }))
    })
    afterEach(() => { window.matchMedia = original })

    const cardOf = async () => {
      listMeals.mockResolvedValue(ok([MEAL]))
      renderTab()
      await waitFor(() => expect(document.querySelector('li.odc-order-card:not([data-skeleton])')).not.toBeNull())
      return document.querySelector('li.odc-order-card')
    }

    // apply-list row 25 (schools P-6): the only link is the order number, which opens the order; the card itself stays static
    it('is a list named «Meals» of static cards, with no table and no link or button but the order number', async () => {
      const card = await cardOf()
      const list = screen.getByRole('list', { name: 'Meals' })
      expect(list.tagName).toBe('UL')
      expect(card.parentElement).toBe(list)
      expect(screen.queryByRole('table')).toBeNull()
      expect(list.querySelectorAll('a')).toHaveLength(1)
      expect(within(list).getByRole('link', { name: '4021' })).toHaveAttribute('href', '/orders?id=4021')
      expect(within(list).queryAllByRole('button')).toHaveLength(0)
      expect(card).not.toHaveAttribute('tabindex')
      // a RecordCard of `link={false}` with nothing to open: static (no pointer, no hover state), the title is plain text
      expect(card).toHaveAttribute('data-static', '')
      expect(card.querySelector('.odc-order-card-title')).toHaveTextContent('Pasta bake × 2')
    })

    it('keeps every field of the table: meal × qty, student, classroom, grade, order, allergens and dietary tags', async () => {
      const card = await cardOf()
      expect(within(card).getByText('Pasta bake', { exact: false })).toBeInTheDocument()
      expect(card).toHaveTextContent('Pasta bake × 2')
      expect(card).toHaveTextContent('Ana Diaz · Room 3 · Grade 3')
      expect(card).toHaveTextContent('Grade 3')
      expect(card).toHaveTextContent('Order ID 4021')
      expect(within(card).getByText('4021')).toHaveClass('odc-figure')
      expect(within(card).getByText('2')).toHaveClass('odc-figure')
      expect(within(card).getByText('Gluten')).toBeInTheDocument()
      expect(within(card).getByText('Nuts')).toBeInTheDocument()
      expect(within(card).getByText('Gluten free')).toBeInTheDocument()
      expect(card).not.toHaveTextContent('gluten_free')
    })

    it('a meal without order or student still draws, with dashes for what is missing', async () => {
      listMeals.mockResolvedValue(ok([{ id: 9, name: 'Soup', quantity: 1, allergens: [], dietary_tags: [] }]))
      renderTab()
      await waitFor(() => expect(document.querySelector('li.odc-order-card:not([data-skeleton])')).not.toBeNull())
      const card = document.querySelector('li.odc-order-card')
      expect(card).toHaveTextContent('Soup × 1')
      expect(card).toHaveTextContent('—')
    })

    it('shows skeleton rows while it loads, not links', async () => {
      listMeals.mockReturnValue(new Promise(() => {}))
      renderTab()
      await waitFor(() => expect(document.querySelectorAll('li.odc-order-card[data-skeleton]').length).toBe(25))
      const list = screen.getByRole('list', { name: 'Meals' })
      expect(list).toHaveAttribute('aria-busy', 'true')
      expect(list.querySelector('.odc-skeleton')).not.toBeNull()
      expect(list.querySelectorAll('a')).toHaveLength(0)
    })

    it('an empty day says so, and a failed load is an error with «Retry»', async () => {
      renderTab()
      expect(await screen.findByText('No meals for this date')).toBeInTheDocument()
      cleanup()
      listMeals.mockResolvedValueOnce({ error: true, result: ['Server said no'] })
      renderTab()
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Server said no')
      expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
      expect(screen.queryByText('No meals for this date')).toBeNull()
    })
  })
})

describe('the five downloads (parity with main)', () => {
  const BUTTONS = [
    ['Kitchen report', 'CSV', 'kitchen', 'csv'],
    ['Kitchen report', 'XLSX', 'kitchen', 'xlsx'],
    ['Products ordered report', 'PDF', 'products_ordered', 'pdf'],
    ['Products ordered report', 'CSV', 'products_ordered', 'csv'],
    ['Products ordered report', 'XLSX', 'products_ordered', 'xlsx']
  ]

  it('the kitchen has two formats and the products ordered report three', async () => {
    renderTab()
    await screen.findByText('No meals for this date')
    expect(report('Kitchen report').getAllByRole('button').map((button) => button.textContent)).toEqual(['CSV', 'XLSX'])
    expect(report('Products ordered report').getAllByRole('button').map((button) => button.textContent)).toEqual(['PDF', 'CSV', 'XLSX'])
  })

  it.each(BUTTONS)('%s as %s asks for %s.%s with the scope of the card and saves the file', async (title, label, kind, format) => {
    fetchSchoolReport.mockResolvedValue({ blob: reportBlob, filename: `centreville_${kind}.${format}` })
    renderTab()
    await screen.findByText('No meals for this date')
    // the accessible name says report and format (M-SC13)
    const button = screen.getByRole('button', { name: `Download ${title} as ${label}` })
    expect(button).toBeEnabled()
    fireEvent.click(button)

    await waitFor(() => expect(saveInvoicePdfBlob).toHaveBeenCalledWith(reportBlob, `centreville_${kind}.${format}`))
    expect(fetchSchoolReport).toHaveBeenCalledTimes(1)
    expect(fetchSchoolReport).toHaveBeenCalledWith(ORDERING, 'session-token', 67, kind, format, {
      preparationDate: DAY,
      gradeId: null,
      classroomId: null
    })
    expect(showToast).not.toHaveBeenCalled()
  })

  it('a download carries the grade and the classroom the card shows (M-SC08)', async () => {
    setUrl(`?date=${DAY}&grade=2&classroom=120`)
    fetchSchoolReport.mockResolvedValue({ blob: reportBlob, filename: 'kitchen.csv' })
    renderTab()
    const card = await screen.findByRole('region', { name: 'Kitchen report' })
    await waitFor(() => expect(card).toHaveTextContent('For 11-10-2026 · 2nd Grade · Room 4'))
    fireEvent.click(report('Kitchen report').getByRole('button', { name: 'Download Kitchen report as CSV' }))
    await waitFor(() => expect(fetchSchoolReport).toHaveBeenCalledTimes(1))
    expect(fetchSchoolReport.mock.calls[0].slice(3)).toEqual(['kitchen', 'csv', { preparationDate: DAY, gradeId: 2, classroomId: 120 }])
  })

  it('does not download while a filter of the URL is not yet known to be the school’s', async () => {
    setUrl(`?date=${DAY}&grade=2`)
    const grades = deferred()
    listGrades.mockReturnValue(grades.promise)
    renderTab()
    await screen.findByRole('region', { name: 'Kitchen report' })
    // the scope could not be named yet: no button asks for a file with a filter the card does not show
    expect(screen.getByRole('button', { name: 'Download Kitchen report as CSV' })).toBeDisabled()
    grades.resolve(ok(GRADES))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download Kitchen report as CSV' })).toBeEnabled())
  })

  it('while one runs its button is busy and a second click does not repeat; the others stay available', async () => {
    const pending = deferred()
    fetchSchoolReport.mockReturnValue(pending.promise)
    renderTab()
    await screen.findByText('No meals for this date')
    const products = report('Products ordered report')
    const pdf = products.getByRole('button', { name: 'Download Products ordered report as PDF' })
    fireEvent.click(pdf)
    await waitFor(() => expect(pdf).toHaveAttribute('aria-busy', 'true'))
    fireEvent.click(pdf)
    fireEvent.click(pdf)
    expect(fetchSchoolReport).toHaveBeenCalledTimes(1)
    expect(products.getByRole('button', { name: 'Download Products ordered report as CSV' })).toBeEnabled()
    expect(products.getByRole('button', { name: 'Download Products ordered report as XLSX' })).toBeEnabled()
    expect(report('Kitchen report').getByRole('button', { name: 'Download Kitchen report as CSV' })).toBeEnabled()

    pending.resolve({ blob: reportBlob, filename: 'report.pdf' })
    await waitFor(() => expect(pdf).not.toHaveAttribute('aria-busy'))
    expect(saveInvoicePdfBlob).toHaveBeenCalledTimes(1)
  })

  it('shows the message of the API in the toast of main and saves nothing when a download fails', async () => {
    fetchSchoolReport.mockRejectedValue(new Error('No meals for this date.'))
    renderTab()
    await screen.findByText('No meals for this date')
    fireEvent.click(screen.getByRole('button', { name: 'Download Products ordered report as PDF' }))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('error', 'No meals for this date.'))
    expect(saveInvoicePdfBlob).not.toHaveBeenCalled()
    // and the button is free again
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download Products ordered report as PDF' })).not.toHaveAttribute('aria-busy'))
  })

  it('uses the text of main when the failure has no message', async () => {
    fetchSchoolReport.mockRejectedValue(new Error(''))
    renderTab()
    await screen.findByText('No meals for this date')
    fireEvent.click(screen.getByRole('button', { name: 'Download Kitchen report as XLSX' }))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('error', 'Report could not be downloaded'))
  })
})
