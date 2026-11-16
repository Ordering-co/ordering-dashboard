/* eslint-disable import/first */
// redesign SC-B3 (decisions 1A and 12; M-SC03, M-SC05, M-SC12, M-SC15): the Students tab and the panel of a student.
// The API calls (K/schoolApi), the school filters (they are loaded by another batch) and the app contexts are doubles; the day bar, the
// list loader, the chips, SplitView, RecordPanel, DataTable, RecordCardList, Pagination and FirstSelect are the real ones.
import React from 'react'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => {
  const t = (_key, text) => text
  const usersGet = vi.fn()
  const usersQuery = { select: null, where: null }
  const chain = {
    asDashboard: () => chain,
    select: (fields) => { usersQuery.select = fields; return chain },
    where: (where) => { usersQuery.where = where; return chain },
    get: (options) => usersGet(options)
  }
  const ordering = { users: () => chain }
  return {
    t,
    ordering,
    usersGet,
    usersQuery,
    showToast: vi.fn(),
    listStudents: vi.fn(),
    getStudent: vi.fn(),
    attachParent: vi.fn(),
    detachParent: vi.fn(),
    language: { language: { code: 'en' } },
    session: { token: 'session-token' },
    configs: { dates_general_format: { value: 'DD-MM-YYYY HH:mm' } }
  }
})

vi.mock('../../../../../../index', () => ({
  useApi: () => [mocks.ordering],
  useSession: () => [mocks.session],
  useLanguage: () => [mocks.language, mocks.t],
  useConfig: () => [{ configs: mocks.configs }],
  useToast: () => [null, { showToast: mocks.showToast }],
  ToastType: { Success: 'success', Error: 'error' }
}))

vi.mock('../../../../../../components/Schools/schoolApi', () => ({
  listStudents: (...args) => mocks.listStudents(...args),
  getStudent: (...args) => mocks.getStudent(...args),
  attachParent: (...args) => mocks.attachParent(...args),
  detachParent: (...args) => mocks.detachParent(...args)
}))

const FILTERS = vi.hoisted(() => ({
  grades: [{ id: 1, name: 'Grade A' }, { id: 2, name: 'Grade B' }],
  classrooms: [{ id: 10, name: 'Room 1' }, { id: 11, name: 'Room 2' }]
}))
vi.mock('../../useSchoolFilters', () => ({
  useSchoolFilters: () => FILTERS
}))

import { SchoolStudents } from '..'

const SCHOOL = { id: 7, name: 'Centreville' }

const ADA = { id: 1, name: 'Ada', lastname: 'Lovelace', code: 'S-001', classroom: { name: 'Room 1' }, grade: { name: 'Grade A' } }
const BOB = { id: 2, name: 'Bob', lastname: 'Marley', code: 'S-002', classroom_id: 11, grade_id: 2 }
const CAL = { id: 3, name: 'Cal', lastname: '', code: 'S-003' }

const DETAIL_ADA = {
  ...ADA,
  allergies: ['nuts', 'gluten'],
  dietary_tags: ['gluten_free', 'vegan'],
  parents: [{ id: 50, name: 'Grace', lastname: 'Hopper', email: 'grace@example.com' }]
}
const DETAIL_BOB = { ...BOB, classroom: { name: 'Room 2' }, grade: { name: 'Grade B' }, allergies: [], dietary_tags: [], parents: [] }

const CUSTOMERS = [
  { id: 5, name: 'Linus', lastname: 'Torvalds', email: 'linus@example.com' },
  { id: 6, name: 'Margaret', lastname: 'Hamilton', email: 'margaret@example.com' }
]

const ok = (result, pagination) => ({ error: false, result, pagination })
const failure = (message) => ({ error: true, result: message ? [message] : [] })

// jsdom answers matchMedia with `matches: false`: the split view reads (min|max)-width queries, so one is installed that evaluates them
// against a width (1440: the panel sits beside the list; 400: a phone)
const installViewport = (width) => {
  const original = { matchMedia: window.matchMedia, innerWidth: window.innerWidth }
  const matches = query => query.split(/\s+and\s+/).every(part => {
    const [, kind, value] = part.match(/\(\s*(min|max)-width:\s*(\d+)px\s*\)/) || []
    if (!kind) return false
    return kind === 'min' ? width >= Number(value) : width <= Number(value)
  })
  window.matchMedia = query => ({
    media: query,
    get matches () { return matches(query) },
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {}
  })
  window.innerWidth = width
  return () => Object.assign(window, original)
}

let restoreViewport
let onPageChange

const renderTab = async (props = {}) => {
  onPageChange = vi.fn()
  const utils = renderWithProviders(
    <SchoolStudents school={SCHOOL} initialPage={1} onPageChange={onPageChange} {...props} />,
    { theme: createDashboardTheme(theme) }
  )
  await waitFor(() => expect(mocks.listStudents).toHaveBeenCalled())
  return utils
}

// The customer picker is a C18 FirstSelect (X-SC1: its list pages through the customers, as main). Its trigger is found by its class;
// its search box is a P/SearchField named «Search» (X-SC3) that tells on every key, and the panel waits 750 ms for a pause before asking, as main
// did, hence the long waits.
const customerTrigger = () => panel().querySelector('.od-first-select-trigger')
const findCustomerTrigger = () => waitFor(() => {
  const trigger = customerTrigger()
  expect(trigger).not.toBeNull()
  return trigger
})
// the action that assigns; the trigger beside it is named «Guardian to assign …», so there is one button with this name
const assignButton = () => within(panel()).getByRole('button', { name: 'Assign parent' })
const SEARCH_WAIT = { timeout: 3000 }
const customerList = () => document.querySelector('.od-first-select-list')
const customerSearch = () => within(customerList()).getByRole('searchbox', { name: 'Search' })

const rowOf = (id) => document.querySelector(`tr[data-row-id="${id}"]`)
const panel = () => screen.getByRole('complementary', { name: 'Student' })

const openStudent = async (id = 1) => {
  await waitFor(() => expect(rowOf(id)).not.toBeNull())
  await userEvent.click(rowOf(id))
  await waitFor(() => expect(mocks.getStudent).toHaveBeenCalled())
}

const chooseCustomer = async (name) => {
  const trigger = await findCustomerTrigger()
  fireEvent.click(trigger)
  fireEvent.click(await screen.findByRole('option', { name }))
}

beforeEach(() => {
  vi.clearAllMocks()
  restoreViewport = installViewport(1440)
  mocks.listStudents.mockResolvedValue(ok([ADA, BOB, CAL], { total: 3, total_pages: 1, current_page: 1 }))
  mocks.getStudent.mockImplementation((_ordering, _token, id) => Promise.resolve(ok(id === 2 ? DETAIL_BOB : DETAIL_ADA)))
  mocks.attachParent.mockResolvedValue(ok({}))
  mocks.detachParent.mockResolvedValue(ok({}))
  mocks.usersGet.mockResolvedValue({ content: { result: CUSTOMERS, pagination: { current_page: 1, total_pages: 1 } } })
  mocks.usersQuery.select = null
  mocks.usersQuery.where = null
})

afterEach(() => {
  cleanup()
  restoreViewport()
})

describe('the list', () => {
  it('asks for the students of the school, ten per page, from the page the shell holds', async () => {
    await renderTab({ initialPage: 3 })
    expect(mocks.listStudents).toHaveBeenCalledWith(mocks.ordering, 'session-token', {
      schoolId: 7, classroomId: null, gradeId: null, page: 3, pageSize: 10
    })
  })

  it('draws the day bar without a date: grade and classroom only', async () => {
    await renderTab()
    expect(screen.queryByText('Preparation date')).toBeNull()
    expect(document.querySelector('input[type="date"]')).toBeNull()
    const bar = within(document.querySelector('.odc-school-daybar'))
    expect(bar.getByText('Grade')).toBeInTheDocument()
    expect(bar.getByText('Classroom')).toBeInTheDocument()
  })

  it('is a table named for the students with name, code, classroom and grade; the name is the row header', async () => {
    await renderTab()
    const table = await screen.findByRole('table', { name: 'School students' })
    expect(within(table).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(['Name', 'Code', 'Classroom', 'Grade'])
    const row = within(table).getByRole('row', { name: /Ada Lovelace/ })
    expect(within(row).getByRole('rowheader')).toHaveTextContent('Ada Lovelace')
    expect(within(row).getByText('S-001')).toHaveClass('odc-figure')
    expect(within(row).getByText('Room 1')).toBeInTheDocument()
    expect(within(row).getByText('Grade A')).toBeInTheDocument()
  })

  it('names the classroom and the grade by id when the row carries only the id, and shows a dash when it has neither', async () => {
    await renderTab()
    await screen.findByRole('table', { name: 'School students' })
    expect(within(rowOf(2)).getByText('Room 2')).toBeInTheDocument()
    expect(within(rowOf(2)).getByText('Grade B')).toBeInTheDocument()
    expect(within(rowOf(3)).getAllByText('—')).toHaveLength(2)
  })

  it('has no «View» button: the whole row opens the student', async () => {
    await renderTab()
    await screen.findByRole('table', { name: 'School students' })
    expect(screen.queryByRole('button', { name: 'View' })).toBeNull()
  })

  it('shows loading rows (no spinner) until the list arrives', async () => {
    mocks.listStudents.mockReturnValue(new Promise(() => {}))
    await renderTab()
    expect(document.querySelector('tr[data-skeleton]')).not.toBeNull()
    expect(screen.queryByText('No students yet')).toBeNull()
  })

  it('says «No students yet» when the school has none', async () => {
    mocks.listStudents.mockResolvedValue(ok([], { total: 0, total_pages: 1 }))
    await renderTab()
    expect(await screen.findByText('No students yet')).toBeInTheDocument()
  })

  it('a failed load is never «No students yet»: it says so and Retry asks again', async () => {
    mocks.listStudents.mockResolvedValueOnce(failure('Unauthorized request'))
    await renderTab()
    expect(await screen.findByText('This could not be loaded')).toBeInTheDocument()
    expect(screen.getByText('Unauthorized request')).toBeInTheDocument()
    expect(screen.queryByText('No students yet')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('table', { name: 'School students' })).toBeInTheDocument()
    expect(mocks.listStudents).toHaveBeenCalledTimes(2)
  })

  it('a grade filter asks again with that grade, from page 1, and tells the shell', async () => {
    await renderTab({ initialPage: 3 })
    await screen.findByRole('table', { name: 'School students' })
    fireEvent.click(screen.getByRole('button', { name: /^Grade/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Grade B' }))
    await waitFor(() => expect(mocks.listStudents).toHaveBeenLastCalledWith(mocks.ordering, 'session-token', {
      schoolId: 7, classroomId: null, gradeId: 2, page: 1, pageSize: 10
    }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('a classroom filter works the same, and «All classrooms» takes it away', async () => {
    await renderTab()
    await screen.findByRole('table', { name: 'School students' })
    fireEvent.click(screen.getByRole('button', { name: /^Classroom/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Room 2' }))
    await waitFor(() => expect(mocks.listStudents).toHaveBeenLastCalledWith(mocks.ordering, 'session-token', expect.objectContaining({ classroomId: 11, page: 1 })))
    fireEvent.click(screen.getByRole('button', { name: /^Classroom/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'All classrooms' }))
    await waitFor(() => expect(mocks.listStudents).toHaveBeenLastCalledWith(mocks.ordering, 'session-token', expect.objectContaining({ classroomId: null, page: 1 })))
  })

  it('the filters are not in the URL (as main)', async () => {
    await renderTab()
    await screen.findByRole('table', { name: 'School students' })
    fireEvent.click(screen.getByRole('button', { name: /^Grade/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Grade B' }))
    await waitFor(() => expect(mocks.listStudents).toHaveBeenCalledTimes(2))
    expect(window.location.search).toBe('')
  })

  it('pages: next page asks for page 2 and tells the shell', async () => {
    mocks.listStudents.mockResolvedValue(ok([ADA, BOB], { total: 25, total_pages: 3, current_page: 1 }))
    await renderTab()
    await screen.findByRole('table', { name: 'School students' })
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(mocks.listStudents).toHaveBeenLastCalledWith(mocks.ordering, 'session-token', expect.objectContaining({ page: 2, pageSize: 10 })))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('a phone gets cards: the name, the code, the classroom and the grade', async () => {
    restoreViewport()
    restoreViewport = installViewport(400)
    await renderTab()
    const list = await screen.findByRole('list', { name: 'School students' })
    expect(screen.queryByRole('table')).toBeNull()
    const card = within(list).getByRole('link', { name: 'Open Ada Lovelace' })
    expect(card).toHaveTextContent('Ada Lovelace')
    const item = card.closest('li')
    expect(item).toHaveTextContent('S-001')
    expect(item).toHaveTextContent('Room 1 · Grade A')
    expect(within(item).getByText('S-001')).toHaveClass('odc-figure')
  })

  it('a card opens the student', async () => {
    restoreViewport()
    restoreViewport = installViewport(400)
    await renderTab()
    await userEvent.click(await screen.findByRole('link', { name: 'Open Ada Lovelace' }))
    await waitFor(() => expect(mocks.getStudent).toHaveBeenCalledWith(mocks.ordering, 'session-token', 1))
    expect(await screen.findByRole('heading', { level: 2, name: 'Ada Lovelace' })).toBeInTheDocument()
  })
})

describe('the panel of a student', () => {
  it('a row opens it: the student is asked for, and the row is marked as the open one', async () => {
    await renderTab()
    await openStudent(1)
    expect(mocks.getStudent).toHaveBeenCalledWith(mocks.ordering, 'session-token', 1)
    expect(await within(panel()).findByRole('heading', { level: 2, name: 'Ada Lovelace' })).toBeInTheDocument()
    expect(rowOf(1)).toHaveAttribute('aria-current', 'true')
  })

  it('names the student and shows the code in mono under the name', async () => {
    await renderTab()
    await openStudent(1)
    const code = await within(panel()).findByText('S-001')
    expect(code).toHaveClass('odc-figure')
  })

  it('shows skeletons (not a lone spinner) while the student loads', async () => {
    mocks.getStudent.mockReturnValue(new Promise(() => {}))
    await renderTab()
    await openStudent(1)
    const body = within(panel()).getByRole('status')
    expect(body).toHaveAttribute('aria-busy', 'true')
    expect(within(panel()).getByRole('heading', { level: 2, name: 'Ada Lovelace' })).toBeInTheDocument()
  })

  it('has the sections Class, Diet and Guardians, each with a heading', async () => {
    await renderTab()
    await openStudent(1)
    const view = within(panel())
    await view.findByRole('heading', { level: 3, name: 'Class' })
    expect(view.getByRole('heading', { level: 3, name: 'Diet' })).toBeInTheDocument()
    expect(view.getByRole('heading', { level: 3, name: 'Guardians' })).toBeInTheDocument()
  })

  it('class: classroom and grade, a dash when one is missing', async () => {
    mocks.getStudent.mockResolvedValue(ok({ ...DETAIL_ADA, classroom: null }))
    await renderTab()
    await openStudent(1)
    const classSection = (await within(panel()).findByRole('heading', { level: 3, name: 'Class' })).closest('section')
    expect(within(classSection).getByText('Classroom').nextElementSibling).toHaveTextContent('—')
    expect(within(classSection).getByText('Grade').nextElementSibling).toHaveTextContent('Grade A')
  })

  it('diet: allergies and dietary tags as words, never the raw value', async () => {
    await renderTab()
    await openStudent(1)
    const view = within(panel())
    const allergies = await view.findByRole('list', { name: 'Allergies' })
    expect(within(allergies).getAllByRole('listitem').map(item => item.textContent)).toEqual(['Nuts', 'Gluten'])
    const tags = view.getByRole('list', { name: 'Dietary tags' })
    expect(within(tags).getAllByRole('listitem').map(item => item.textContent)).toEqual(['Gluten free', 'Vegan'])
    expect(panel().textContent).not.toMatch(/gluten_free/)
  })

  it('diet: a dash when there are none', async () => {
    await renderTab()
    await openStudent(2)
    const diet = (await within(panel()).findByRole('heading', { level: 3, name: 'Diet' })).closest('section')
    expect(within(diet).queryByRole('list')).toBeNull()
    expect(within(diet).getAllByText('—')).toHaveLength(2)
  })

  it('guardians: one row per guardian with name and email, and a Remove named for them', async () => {
    await renderTab()
    await openStudent(1)
    const view = within(panel())
    expect(await view.findByText(/Grace Hopper/)).toBeInTheDocument()
    expect(view.getByText('grace@example.com')).toBeInTheDocument()
    expect(view.getByRole('button', { name: 'Remove Grace Hopper as guardian' })).toHaveTextContent('Remove')
  })

  it('guardians: «—» when there are none', async () => {
    await renderTab()
    await openStudent(2)
    const guardians = (await within(panel()).findByRole('heading', { level: 3, name: 'Guardians' })).closest('section')
    expect(within(guardians).getByText('—')).toBeInTheDocument()
    expect(within(guardians).queryByRole('button', { name: /^Remove/ })).toBeNull()
  })

  it('asks for the first page of customers (level 3), as main', async () => {
    await renderTab()
    await openStudent(1)
    await waitFor(() => expect(mocks.usersGet).toHaveBeenCalledWith({ query: { page: 1, page_size: 10 } }))
    expect(mocks.usersQuery.select).toEqual(['id', 'name', 'lastname', 'email'])
    expect(mocks.usersQuery.where).toEqual({ conditions: [{ attribute: 'level', value: 3 }], conector: 'AND' })
  })

  it('the customer picker is a C18 select like the others of the page, named by its own words (X-SC1, X-SC2)', async () => {
    await renderTab()
    await openStudent(1)
    const trigger = await findCustomerTrigger()
    expect(trigger.closest('.od-first-select-root')).toHaveAttribute('data-fit', 'trigger')
    // not by the label of the Field: «Assign parent» is the button beside it
    expect(within(panel()).getByRole('button', { name: 'Guardian to assign Select a customer' })).toBe(trigger)
    expect(within(panel()).getAllByRole('button', { name: 'Assign parent' })).toHaveLength(1)
  })

  it('searching customers shows the text at once and asks once, when the person pauses (as main), with the text (ilike on the name)', async () => {
    await renderTab()
    await openStudent(1)
    const trigger = await findCustomerTrigger()
    fireEvent.click(trigger)
    fireEvent.change(customerSearch(), { target: { value: 'lin' } })
    expect(customerSearch()).toHaveValue('lin')
    expect(mocks.usersGet).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(mocks.usersGet).toHaveBeenCalledTimes(2), SEARCH_WAIT)
    expect(mocks.usersGet).toHaveBeenLastCalledWith({ query: { page: 1, page_size: 10 } })
    expect(mocks.usersQuery.where).toEqual({
      conditions: [{ attribute: 'level', value: 3 }, { attribute: 'name', value: { condition: 'ilike', value: '%lin%' } }],
      conector: 'AND'
    })
  })

  describe('the customer list pages (main pages through the customers)', () => {
    const pagesOf = (total) => ({ content: { result: CUSTOMERS, pagination: { current_page: 1, total_pages: total } } })
    const openPicker = async () => {
      await renderTab()
      await openStudent(1)
      fireEvent.click(await findCustomerTrigger())
      await screen.findAllByRole('option')
    }

    it('page 2 is reachable: the pager of the list asks the API for page 2', async () => {
      mocks.usersGet.mockResolvedValue(pagesOf(3))
      await openPicker()
      await waitFor(() => expect(within(customerList()).getByRole('button', { name: 'Page 2' })).toBeInTheDocument())
      fireEvent.click(within(customerList()).getByRole('button', { name: 'Page 2' }))
      await waitFor(() => expect(mocks.usersGet).toHaveBeenLastCalledWith({ query: { page: 2, page_size: 10 } }))
      expect(mocks.usersQuery.where).toEqual({ conditions: [{ attribute: 'level', value: 3 }], conector: 'AND' })
    })

    it('page 2 keeps the search text', async () => {
      mocks.usersGet.mockResolvedValue(pagesOf(3))
      await openPicker()
      fireEvent.change(customerSearch(), { target: { value: 'lin' } })
      await waitFor(() => expect(mocks.usersGet).toHaveBeenCalledTimes(2), SEARCH_WAIT)
      await waitFor(() => expect(within(customerList()).getByRole('button', { name: 'Page 2' })).toBeInTheDocument())
      fireEvent.click(within(customerList()).getByRole('button', { name: 'Page 2' }))
      await waitFor(() => expect(mocks.usersGet).toHaveBeenLastCalledWith({ query: { page: 2, page_size: 10 } }))
      expect(mocks.usersQuery.where).toEqual({
        conditions: [{ attribute: 'level', value: 3 }, { attribute: 'name', value: { condition: 'ilike', value: '%lin%' } }],
        conector: 'AND'
      })
    })

    it('a single page of customers draws no pager', async () => {
      await openPicker()
      expect(within(customerList()).queryByRole('button', { name: 'Page 2' })).toBeNull()
    })
  })

  it('«Assign parent» without a customer says so and sends nothing', async () => {
    await renderTab()
    await openStudent(1)
    await findCustomerTrigger()
    await userEvent.click(assignButton())
    expect(mocks.showToast).toHaveBeenCalledWith('error', 'Select a customer')
    expect(mocks.attachParent).not.toHaveBeenCalled()
  })

  it('«Assign parent» with a customer attaches it, tells so and asks for the student again', async () => {
    await renderTab()
    await openStudent(1)
    await chooseCustomer('Linus Torvalds · linus@example.com')
    await userEvent.click(assignButton())
    await waitFor(() => expect(mocks.attachParent).toHaveBeenCalledWith(mocks.ordering, 'session-token', 1, { user_id: 5 }))
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('success', 'Parent assigned'))
    await waitFor(() => expect(mocks.getStudent).toHaveBeenCalledTimes(2))
    // the selection is cleared
    expect(customerTrigger()).toHaveTextContent('Select a customer')
  })

  it('a failed assign shows the API message and keeps the selection', async () => {
    mocks.attachParent.mockResolvedValue(failure('The parent is already assigned'))
    await renderTab()
    await openStudent(1)
    await chooseCustomer('Linus Torvalds · linus@example.com')
    await userEvent.click(assignButton())
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('error', 'The parent is already assigned'))
    expect(mocks.getStudent).toHaveBeenCalledTimes(1)
    expect(customerTrigger()).toHaveTextContent('Linus Torvalds')
  })

  it('«Remove» detaches the guardian at once, with no confirmation, tells so and asks for the student again', async () => {
    await renderTab()
    await openStudent(1)
    await userEvent.click(await within(panel()).findByRole('button', { name: 'Remove Grace Hopper as guardian' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(mocks.detachParent).toHaveBeenCalledWith(mocks.ordering, 'session-token', 1, 50))
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('success', 'Parent removed'))
    await waitFor(() => expect(mocks.getStudent).toHaveBeenCalledTimes(2))
  })

  it('a failed remove shows the API message', async () => {
    mocks.detachParent.mockResolvedValue(failure('Not allowed'))
    await renderTab()
    await openStudent(1)
    await userEvent.click(await within(panel()).findByRole('button', { name: 'Remove Grace Hopper as guardian' }))
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('error', 'Not allowed'))
    expect(mocks.getStudent).toHaveBeenCalledTimes(1)
  })

  it('a failed refresh after assigning keeps what was on screen and says it failed (main swallowed it)', async () => {
    await renderTab()
    await openStudent(1)
    await within(panel()).findByText(/Grace Hopper/)
    mocks.getStudent.mockResolvedValueOnce(failure('Server is down'))
    await userEvent.click(within(panel()).getByRole('button', { name: 'Remove Grace Hopper as guardian' }))
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('error', 'Server is down'))
    expect(within(panel()).getByText(/Grace Hopper/)).toBeInTheDocument()
    expect(within(panel()).queryByText('This could not be loaded')).toBeNull()
  })

  it('if the student cannot be loaded the panel says so with Retry and offers no parent assignment (M-SC15)', async () => {
    mocks.getStudent.mockResolvedValueOnce(failure('Student not found'))
    await renderTab()
    await openStudent(1)
    const view = within(panel())
    expect(await view.findByText('This could not be loaded')).toBeInTheDocument()
    expect(view.getByText('Student not found')).toBeInTheDocument()
    expect(view.queryByRole('heading', { level: 3, name: 'Guardians' })).toBeNull()
    expect(customerTrigger()).toBeNull()
    expect(view.queryByRole('button', { name: 'Assign parent' })).toBeNull()
    await userEvent.click(view.getByRole('button', { name: 'Retry' }))
    expect(await view.findByRole('heading', { level: 3, name: 'Guardians' })).toBeInTheDocument()
    expect(customerTrigger()).toBeInTheDocument()
    expect(mocks.getStudent).toHaveBeenCalledTimes(2)
  })

  it('opening another student starts with no search and no customer chosen (M-SC12)', async () => {
    await renderTab()
    await openStudent(1)
    await chooseCustomer('Linus Torvalds · linus@example.com')
    expect(customerTrigger()).toHaveTextContent('Linus Torvalds')
    await userEvent.click(rowOf(2))
    await waitFor(() => expect(mocks.getStudent).toHaveBeenLastCalledWith(mocks.ordering, 'session-token', 2))
    const trigger = await findCustomerTrigger()
    expect(trigger).toHaveTextContent('Select a customer')
    expect(trigger).not.toHaveTextContent('Linus')
    expect(await within(panel()).findByRole('heading', { level: 2, name: 'Bob Marley' })).toBeInTheDocument()
    expect(mocks.usersQuery.where).toEqual({ conditions: [{ attribute: 'level', value: 3 }], conector: 'AND' })
  })

  it('can open as a page and go back to the split view', async () => {
    await renderTab()
    await openStudent(1)
    const view = within(panel())
    await userEvent.click(await view.findByRole('button', { name: 'Open as page' }))
    expect(document.querySelector('.odc-split')).toHaveAttribute('data-expanded')
    await userEvent.click(view.getByRole('button', { name: 'Back to split view' }))
    expect(document.querySelector('.odc-split')).not.toHaveAttribute('data-expanded')
  })

  it('closing it removes the panel and is not expanded for the next student', async () => {
    await renderTab()
    await openStudent(1)
    await userEvent.click(await within(panel()).findByRole('button', { name: 'Open as page' }))
    await userEvent.click(within(panel()).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('complementary', { name: 'Student' })).toBeNull()
    expect(document.querySelector('.odc-split')).not.toHaveAttribute('data-expanded')
    expect(rowOf(1)).not.toHaveAttribute('aria-current')
  })

  it('closing the panel gives the focus back to the row', async () => {
    await renderTab()
    await openStudent(1)
    act(() => { document.body.focus() })
    await userEvent.click(await within(panel()).findByRole('button', { name: 'Close' }))
    await waitFor(() => expect(rowOf(1).contains(document.activeElement)).toBe(true))
  })

  it('Escape closes it and the focus goes back to the row', async () => {
    await renderTab()
    await openStudent(1)
    await within(panel()).findByRole('heading', { level: 3, name: 'Class' })
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Student' })).toBeNull())
    await waitFor(() => expect(rowOf(1).contains(document.activeElement)).toBe(true))
  })

  it('remembers its width under its own key', async () => {
    const getItem = vi.spyOn(window.localStorage, 'getItem')
    await renderTab()
    expect(getItem).toHaveBeenCalledWith('odc-schools-student-panel')
    getItem.mockRestore()
  })
})
