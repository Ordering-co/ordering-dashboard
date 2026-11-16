/* eslint-disable import/first */
// redesign SC-B5 (decisions 1A, 2A, 3A; M-SC03, M-SC04, M-SC07, M-SC13, M-SC14): the shell of /schools: header, picker, tabs, the school
// that opens, the states. Real: P/ (PageHeader, Tabs, EmptyState, Skeleton), U/FirstSelect with `portal`, useSchoolList, useSchoolDay,
// rememberedSchool, addQueryToUrl and the URL (jsdom). Replaced: the contexts of the app, the API (`listSchools`, the business request), the
// five tabs (their own batches) and the module switch (its own test).
import React from 'react'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => ({
  level: 0,
  userId: 7,
  project: 'demo',
  configs: {},
  catalog: {},
  isCollapse: false,
  handleMenuCollapse: vi.fn(),
  listSchools: vi.fn(),
  getBusiness: vi.fn()
}))
const tabLog = vi.hoisted(() => ({ mounts: [], unmounts: [], props: {} }))

const { useApi, useConfig, useSession, useLanguage } = vi.hoisted(() => ({
  useApi: () => [{
    root: 'https://api.test',
    project: state.project,
    businesses: (id) => ({ asDashboard: () => ({ select: (fields) => ({ get: () => state.getBusiness(id, fields) }) }) })
  }],
  useConfig: () => [{ configs: state.configs }, { refreshConfigs: vi.fn() }],
  useSession: () => [{ token: 'token', user: { id: state.userId, level: state.level } }],
  useLanguage: () => [{ language: { code: 'en' } }, (key, fallback) => state.catalog[key] ?? fallback]
}))

vi.mock('../../../../../../index', () => ({ useApi, useConfig, useLanguage, useSession }))
vi.mock('../../../../../../components/Schools/schoolApi', () => ({
  listSchools: (...args) => state.listSchools(...args)
}))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: state.isCollapse }, { handleMenuCollapse: state.handleMenuCollapse }]
}))
vi.mock('../../SchoolModuleToggle', () => ({
  SchoolModuleToggle: () => <button type='button'>Disable school module</button>
}))
// the tabs have their own batches: stand-ins that show the three props the shell gives them and when they are mounted
const { makeTab } = await vi.hoisted(async () => {
  const { createElement, useEffect } = await import('react')
  const makeTab = (name) => function TabStub (props) {
    useEffect(() => {
      tabLog.mounts.push(`${name}:${props.school?.id}`)
      return () => tabLog.unmounts.push(`${name}:${props.school?.id}`)
    }, [])
    tabLog.props[name] = props
    return createElement('div', { 'data-testid': `tab-${name}`, 'data-school': props.school?.id, 'data-initial-page': props.initialPage },
      createElement('button', { type: 'button', onClick: () => props.onPageChange(3) }, `${name} to page 3`),
      createElement('button', { type: 'button', onClick: () => props.onPageChange(1) }, `${name} to page 1`))
  }
  return { makeTab }
})
vi.mock('../../SchoolGrades', () => ({ SchoolGrades: makeTab('grades') }))
vi.mock('../../SchoolClassrooms', () => ({ SchoolClassrooms: makeTab('classrooms') }))
vi.mock('../../SchoolStudents', () => ({ SchoolStudents: makeTab('students') }))
vi.mock('../../SchoolMealsReports', () => ({ SchoolMealsReports: makeTab('meals') }))
vi.mock('../../SchoolPrintLabels', () => ({ SchoolPrintLabels: makeTab('labels') }))

import { SchoolsManagement } from '../index'

const SUNRISE = { id: 1, name: 'Sunrise School' }
const MOON = { id: 2, name: 'Moonlight Academy' }
const KEY = 'odc-schools-last:demo:7'

const answer = (result, pagination = { total_pages: 1 }) => ({ error: false, result, pagination })
const business = (id, name = `School ${id}`, vertical = 'school') => ({ content: { error: false, result: { id, name, logo: null, vertical } } })
const deferred = () => {
  let release
  const promise = new Promise((resolve) => { release = resolve })
  return { promise, resolve: release }
}

const setUrl = (search = '') => window.history.replaceState(null, '', `/schools${search}`)
const params = () => Object.fromEntries(new URLSearchParams(window.location.search))

const renderPage = async () => {
  let view
  await act(async () => {
    view = renderWithProviders(<SchoolsManagement />, { theme: createDashboardTheme(theme) })
  })
  return view
}
const settle = () => act(async () => {})

const trigger = () => document.querySelector('.od-first-select-trigger')
const openPicker = async (user) => {
  await user.click(trigger())
  return screen.findByRole('listbox')
}
// the search of a C18 list is a searchbox named «Search» (X-SC3: not the label of the field around it)
const searchInput = () => screen.getByRole('searchbox', { name: 'Search' })
const tabNamed = (name) => screen.getByRole('tab', { name })

beforeEach(() => {
  vi.clearAllMocks()
  state.level = 0
  state.userId = 7
  state.project = 'demo'
  state.configs = { school_module_enabled: { id: 77, key: 'school_module_enabled', name: 'School module', value: '1' } }
  state.catalog = {}
  state.isCollapse = false
  state.listSchools.mockResolvedValue(answer([SUNRISE, MOON]))
  state.getBusiness.mockImplementation(async (id) => business(Number(id)))
  tabLog.mounts = []
  tabLog.unmounts = []
  tabLog.props = {}
  window.localStorage.clear()
  setUrl()
})
afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

describe('the header', () => {
  it('has «Schools» as the only h1, the module switch beside it, and no hard-coded English outside the catalog', async () => {
    state.catalog = { SCHOOLS: 'Colegios' }
    await renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Colegios' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disable school module' })).toBeInTheDocument()
  })

  it('the open-menu button shows only while the sidebar is collapsed, and opens it', async () => {
    await renderPage()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
    cleanup()

    state.isCollapse = true
    await renderPage()
    // the opener is PageHeader's `leading`, the first child of the lead block
    const opener = screen.getByRole('button', { name: 'Open menu' })
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    await userEvent.click(opener)
    expect(state.handleMenuCollapse).toHaveBeenCalledWith(false)
  })

  it('the picker is on its own row under the header, not inside it', async () => {
    await renderPage()
    const heading = screen.getByRole('heading', { level: 1 })
    const row = document.querySelector('.odc-school-picker')
    expect(row).not.toBeNull()
    expect(heading.closest('.odc-pagehead').contains(row)).toBe(false)
    expect(heading.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(row).toContainElement(trigger())
  })
})

describe('the module is off', () => {
  beforeEach(() => {
    state.configs = { school_module_enabled: { id: 77, key: 'school_module_enabled', name: 'School module', value: '0' } }
  })

  it('shows the panel and asks for no schools: the page title (review r1 #2: the page had no heading), no picker', async () => {
    await renderPage()
    expect(screen.getByText('School module')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Schools' })).toBeInTheDocument()
    expect(trigger()).toBeNull()
    expect(state.listSchools).not.toHaveBeenCalled()
    expect(state.getBusiness).not.toHaveBeenCalled()
  })

  it('an administrator gets the switch; anyone else, the line that only an administrator can enable it', async () => {
    await renderPage()
    expect(screen.getByRole('button', { name: 'Disable school module' })).toBeInTheDocument()
    expect(screen.queryByText(/missing the School module setting/)).toBeNull()
    cleanup()

    state.level = 2
    await renderPage()
    expect(screen.getByText('Only an administrator can enable this module.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Disable school module' })).toBeNull()
  })

  // without the config row the switch cannot work, so the administrator is told why instead of a mute panel
  it('without the config row, an administrator reads why it cannot be enabled and gets no switch', async () => {
    state.configs = {}
    await renderPage()
    expect(screen.getByText(/This project is missing the School module setting/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Disable school module' })).toBeNull()
    expect(screen.queryByText('Only an administrator can enable this module.')).toBeNull()
  })

  it('without the config row, anyone else still reads that only an administrator can enable it', async () => {
    state.configs = {}
    state.level = 2
    await renderPage()
    expect(screen.getByText('Only an administrator can enable this module.')).toBeInTheDocument()
    expect(screen.queryByText(/missing the School module setting/)).toBeNull()
  })

  it('does not read the remembered school nor ask for it', async () => {
    window.localStorage.setItem(KEY, '5')
    await renderPage()
    expect(state.getBusiness).not.toHaveBeenCalled()
  })

  it('keeps the open-menu button while the sidebar is collapsed', async () => {
    state.isCollapse = true
    await renderPage()
    const opener = screen.getByRole('button', { name: 'Open menu' })
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    await userEvent.click(opener)
    expect(state.handleMenuCollapse).toHaveBeenCalledWith(false)
  })
})

describe('the tabs (M-SC07)', () => {
  it('is a tablist named «Schools» with the five tabs of today, in order (Grades first), and opens on Meals & Reports (n.º 7, P-1)', async () => {
    await renderPage()
    const list = screen.getByRole('tablist', { name: 'Schools' })
    expect(within(list).getAllByRole('tab').map((tab) => tab.textContent.trim())).toEqual(['Grades', 'Classrooms', 'Students', 'Meals & Reports', 'Print Labels'])
    expect(tabNamed('Meals & Reports')).toHaveAttribute('aria-selected', 'true')
    expect(list.closest('[data-wrap="true"]')).not.toBeNull()
  })

  it('the tab content sits in a panel that keeps its distance from the tabs (live check: content touched the hairline)', async () => {
    await renderPage()
    expect(screen.getByRole('tabpanel')).toHaveClass('odc-school-tabpanel')
  })

  it('takes the tab names from the catalog', async () => {
    state.catalog = { SCHOOL_TAB_GRADES: 'Grados', SCHOOL_TAB_MEALS: 'Comidas e informes' }
    await renderPage()
    expect(tabNamed('Grados')).toBeInTheDocument()
    expect(tabNamed('Comidas e informes')).toBeInTheDocument()
  })

  it('?tab=students opens Students', async () => {
    setUrl('?tab=students&school=1')
    await renderPage()
    await settle()
    expect(tabNamed('Students')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('tab-students')).toBeInTheDocument()
    expect(screen.queryByTestId('tab-meals')).toBeNull()
  })

  it('an unknown ?tab= is Meals & Reports', async () => {
    setUrl('?tab=nonsense&school=1')
    await renderPage()
    await settle()
    expect(tabNamed('Meals & Reports')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('tab-meals')).toBeInTheDocument()
  })

  it('without ?tab= a school opens on Meals & Reports; an explicit ?tab=grades still wins (n.º 7, P-1)', async () => {
    setUrl('?school=1')
    await renderPage()
    await settle()
    expect(tabNamed('Meals & Reports')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('tab-meals')).toBeInTheDocument()
    expect(screen.queryByTestId('tab-grades')).toBeNull()
    cleanup()

    setUrl('?tab=grades&school=1')
    await renderPage()
    await settle()
    expect(tabNamed('Grades')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('tab-grades')).toBeInTheDocument()
    expect(screen.queryByTestId('tab-meals')).toBeNull()
  })

  it('changing tab writes ?tab=, drops ?page=, keeps ?date=, ?grade= and ?classroom= (decision 3A) and mounts only the active tab', async () => {
    setUrl('?school=1&tab=meals&page=4&date=2026-03-04&grade=3&classroom=9')
    await renderPage()
    await settle()
    expect(screen.getByTestId('tab-meals')).toBeInTheDocument()

    await userEvent.click(tabNamed('Print Labels'))
    expect(params()).toEqual({ school: '1', tab: 'labels', date: '2026-03-04', grade: '3', classroom: '9' })
    expect(screen.getByTestId('tab-labels')).toBeInTheDocument()
    expect(screen.queryByTestId('tab-meals')).toBeNull()
  })

  it('?page= goes to the tab as initialPage, and the tab can move it', async () => {
    setUrl('?school=1&page=3')
    await renderPage()
    await settle()
    expect(screen.getByTestId('tab-meals')).toHaveAttribute('data-initial-page', '3')

    await userEvent.click(screen.getByRole('button', { name: 'meals to page 1' }))
    expect(params().page).toBeUndefined()
    await userEvent.click(screen.getByRole('button', { name: 'meals to page 3' }))
    expect(params().page).toBe('3')
  })

  it('without ?page= the tab starts on page 1', async () => {
    setUrl('?school=1')
    await renderPage()
    await settle()
    expect(screen.getByTestId('tab-meals')).toHaveAttribute('data-initial-page', '1')
  })

  it('the tabs are there with no school chosen, and the prompt takes the place of the tab', async () => {
    await renderPage()
    await settle()
    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getByText('Select a school to manage its grades, classrooms, students and meals.')).toBeInTheDocument()
    expect(screen.queryByTestId('tab-meals')).toBeNull()
  })
})

describe('the school at the door (decision 2A, M-SC04)', () => {
  it('?school= restores that school (same request as main) behind a skeleton, with no prompt in between', async () => {
    setUrl('?school=2')
    const pending = deferred()
    state.getBusiness.mockReturnValueOnce(pending.promise)
    await renderPage()

    expect(state.getBusiness).toHaveBeenCalledWith('2', ['id', 'name', 'logo', 'vertical'])
    expect(document.querySelector('.odc-school-restoring')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText(/Select a school to manage/)).toBeNull()

    await act(async () => { pending.resolve(business(2, 'Moonlight Academy')) })
    expect(screen.getByTestId('tab-meals')).toHaveAttribute('data-school', '2')
    expect(document.querySelector('.odc-school-restoring')).toBeNull()
  })

  it('?school= that fails leaves the prompt, as main did', async () => {
    setUrl('?school=2')
    state.getBusiness.mockRejectedValueOnce(new Error('boom'))
    await renderPage()
    await settle()
    expect(screen.getByText(/Select a school to manage/)).toBeInTheDocument()
  })

  it('?school= wins over the remembered school', async () => {
    window.localStorage.setItem(KEY, '5')
    setUrl('?school=2')
    await renderPage()
    await settle()
    expect(state.getBusiness).toHaveBeenCalledTimes(1)
    expect(state.getBusiness).toHaveBeenCalledWith('2', expect.anything())
    expect(screen.getByTestId('tab-meals')).toHaveAttribute('data-school', '2')
  })

  it('without ?school= it restores the remembered one, writes ?school=, and shows a skeleton meanwhile', async () => {
    window.localStorage.setItem(KEY, '5')
    const pending = deferred()
    state.getBusiness.mockReturnValueOnce(pending.promise)
    await renderPage()

    expect(state.getBusiness).toHaveBeenCalledWith(5, ['id', 'name', 'logo', 'vertical'])
    expect(document.querySelector('.odc-school-restoring')).not.toBeNull()
    expect(screen.queryByText(/Select a school to manage/)).toBeNull()

    await act(async () => { pending.resolve(business(5, 'Remembered School')) })
    expect(screen.getByTestId('tab-meals')).toHaveAttribute('data-school', '5')
    expect(params().school).toBe('5')
    expect(window.localStorage.getItem(KEY)).toBe('5')
    expect(trigger()).toHaveTextContent('Remembered School')
  })

  it.each([
    ['the request fails', () => state.getBusiness.mockRejectedValueOnce(new Error('403'))],
    ['it brings nothing', () => state.getBusiness.mockResolvedValueOnce({ content: {} })],
    ['the API says error', () => state.getBusiness.mockResolvedValueOnce({ content: { error: true, result: ['Unauthorized'] } })],
    ['the business is not a school', () => state.getBusiness.mockResolvedValueOnce(business(5, 'A store', 'store'))]
  ])('forgets the remembered school when %s, and goes on to the next step', async (_name, arrange) => {
    window.localStorage.setItem(KEY, '5')
    arrange()
    await renderPage()
    await settle()
    expect(window.localStorage.getItem(KEY)).toBeNull()
    expect(params().school).toBeUndefined()
    expect(screen.queryByTestId('tab-meals')).toBeNull()
    expect(screen.getByText(/Select a school to manage/)).toBeInTheDocument()
  })

  it('a remembered school that fails, with a single school in the project, opens that one', async () => {
    window.localStorage.setItem(KEY, '5')
    state.getBusiness.mockRejectedValueOnce(new Error('403'))
    state.listSchools.mockResolvedValue(answer([SUNRISE]))
    await renderPage()
    await settle()
    expect(screen.getByTestId('tab-meals')).toHaveAttribute('data-school', '1')
    expect(window.localStorage.getItem(KEY)).toBe('1')
    expect(params().school).toBe('1')
  })

  it('the remembered school is per project and per user', async () => {
    window.localStorage.setItem('odc-schools-last:other:7', '5')
    window.localStorage.setItem('odc-schools-last:demo:8', '5')
    await renderPage()
    await settle()
    expect(state.getBusiness).not.toHaveBeenCalled()
  })

  it('a single school is opened and remembered (only after the first load, no search)', async () => {
    state.listSchools.mockResolvedValue(answer([SUNRISE]))
    await renderPage()
    await settle()
    expect(screen.getByTestId('tab-meals')).toHaveAttribute('data-school', '1')
    expect(params().school).toBe('1')
    expect(window.localStorage.getItem(KEY)).toBe('1')
  })

  it('a single school on a list of several pages is not opened', async () => {
    state.listSchools.mockResolvedValue(answer([SUNRISE], { total_pages: 2 }))
    await renderPage()
    await settle()
    expect(screen.queryByTestId('tab-meals')).toBeNull()
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })

  it('two schools and nothing remembered: «Select a school», nothing opened, nothing remembered', async () => {
    await renderPage()
    await settle()
    expect(screen.getByText(/Select a school to manage/)).toBeInTheDocument()
    expect(trigger()).toHaveTextContent('Select a school')
    expect(screen.queryByTestId('tab-meals')).toBeNull()
    expect(window.localStorage.getItem(KEY)).toBeNull()
    expect(params().school).toBeUndefined()
  })

  it('a search that leaves one school does not open it: the single school is only for the first load', async () => {
    const user = userEvent.setup()
    await renderPage()
    await settle()
    state.listSchools.mockResolvedValue(answer([MOON]))
    await openPicker(user)
    fireEvent.change(searchInput(), { target: { value: 'moon' } })
    await waitFor(() => expect(state.listSchools).toHaveBeenLastCalledWith(expect.anything(), 'token', { page: 1, pageSize: 10, search: 'moon' }), { timeout: 3000 })
    await settle()
    expect(screen.queryByTestId('tab-meals')).toBeNull()
    expect(params().school).toBeUndefined()
  })

  it('never opens a school by itself when the person already chose another while it was loading', async () => {
    window.localStorage.setItem(KEY, '5')
    const pending = deferred()
    state.getBusiness.mockReturnValueOnce(pending.promise)
    const user = userEvent.setup()
    await renderPage()
    await settle()

    await user.click(within(await openPicker(user)).getByRole('option', { name: 'Moonlight Academy' }))
    expect(screen.getByTestId('tab-meals')).toHaveAttribute('data-school', '2')

    await act(async () => { pending.resolve(business(5, 'Remembered School')) })
    expect(screen.getByTestId('tab-meals')).toHaveAttribute('data-school', '2')
    expect(params().school).toBe('2')
    expect(window.localStorage.getItem(KEY)).toBe('2')
  })
})

describe('choosing a school', () => {
  it('writes ?school=, drops ?page=, remembers it, and mounts the tab for it', async () => {
    setUrl('?page=3')
    const user = userEvent.setup()
    await renderPage()
    await settle()
    await user.click(within(await openPicker(user)).getByRole('option', { name: 'Sunrise School' }))

    expect(params()).toEqual({ school: '1' })
    expect(window.localStorage.getItem(KEY)).toBe('1')
    expect(screen.getByTestId('tab-meals')).toHaveAttribute('data-school', '1')
    expect(trigger()).toHaveTextContent('Sunrise School')
  })

  it('changing school clears grade, classroom and page, keeps the date, and remounts the tab with the new school (M-SC13)', async () => {
    setUrl('?school=1&tab=meals&date=2026-03-04&grade=3&classroom=9&page=2')
    const user = userEvent.setup()
    await renderPage()
    await settle()
    expect(tabLog.mounts).toEqual(['meals:1'])

    await user.click(within(await openPicker(user)).getByRole('option', { name: 'Moonlight Academy' }))

    expect(params()).toEqual({ school: '2', tab: 'meals', date: '2026-03-04' })
    // not the same tab with other props: the old one is gone and a new one is born, so it starts from the URL it finds
    expect(tabLog.unmounts).toEqual(['meals:1'])
    expect(tabLog.mounts).toEqual(['meals:1', 'meals:2'])
  })

  it('choosing the school that is already open does nothing', async () => {
    setUrl('?school=1&grade=3&page=2')
    const user = userEvent.setup()
    await renderPage()
    await settle()
    await user.click(within(await openPicker(user)).getByRole('option', { name: 'Sunrise School' }))
    expect(params()).toEqual({ school: '1', grade: '3', page: '2' })
    expect(tabLog.mounts).toEqual(['meals:1'])
  })

  it('the school that is not on the first page is still chosen from the pages of the picker', async () => {
    const user = userEvent.setup()
    state.listSchools.mockImplementation(async (_ordering, _token, { page }) => (
      page === 1 ? answer([SUNRISE], { total_pages: 2 }) : answer([MOON], { total_pages: 2 })
    ))
    await renderPage()
    await settle()
    // the pager is inside the list (legacy anatomy, as main); using it keeps the list open and picks nothing
    const list = await openPicker(user)
    expect(within(list).queryByRole('option', { name: 'Moonlight Academy' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(state.listSchools).toHaveBeenLastCalledWith(expect.anything(), 'token', { page: 2, pageSize: 10, search: '' }))
    await user.click(await within(screen.getByRole('listbox')).findByRole('option', { name: 'Moonlight Academy' }))
    expect(screen.getByTestId('tab-meals')).toHaveAttribute('data-school', '2')
  })
})

describe('the list of schools', () => {
  it('asks like main: page 1, 10 per page, empty search', async () => {
    await renderPage()
    expect(state.listSchools).toHaveBeenCalledTimes(1)
    expect(state.listSchools).toHaveBeenCalledWith(expect.objectContaining({ root: 'https://api.test' }), 'token', { page: 1, pageSize: 10, search: '' })
  })

  it('the search reaches the API, from page 1, once the person stops typing (the search box of the list debounces)', async () => {
    const user = userEvent.setup()
    await renderPage()
    await settle()
    await openPicker(user)
    fireEvent.change(searchInput(), { target: { value: 'mo' } })
    fireEvent.change(searchInput(), { target: { value: 'moon' } })
    // the search box of the list waits for the person to stop typing (as in main): not one request per key
    expect(state.listSchools).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(state.listSchools).toHaveBeenCalledTimes(2), { timeout: 3000 })
    expect(state.listSchools).toHaveBeenLastCalledWith(expect.anything(), 'token', { page: 1, pageSize: 10, search: 'moon' })
  })

  it('a search with no results does not hide the page: the tabs stay and the picker says «No results» (M-SC14)', async () => {
    const user = userEvent.setup()
    setUrl('?school=1')
    await renderPage()
    await settle()
    state.listSchools.mockResolvedValue(answer([]))
    await openPicker(user)
    fireEvent.change(searchInput(), { target: { value: 'zzz' } })
    await waitFor(() => expect(screen.getByRole('option', { name: 'No results' })).toBeInTheDocument(), { timeout: 3000 })

    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getByTestId('tab-meals')).toHaveAttribute('data-school', '1')
    expect(screen.queryByText(/No schools yet/)).toBeNull()
  })

  it('no schools and no search: the empty state with the words of today, and no tabs', async () => {
    state.listSchools.mockResolvedValue(answer([]))
    await renderPage()
    await settle()
    expect(screen.getByText('No schools yet. Create a business with the "School" vertical first.')).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('does not flash the empty state before the first answer', async () => {
    const pending = deferred()
    state.listSchools.mockReturnValueOnce(pending.promise)
    await renderPage()
    expect(screen.queryByText(/No schools yet/)).toBeNull()
    await act(async () => { pending.resolve(answer([SUNRISE, MOON])) })
    expect(screen.queryByText(/No schools yet/)).toBeNull()
  })

  it('a failure is an error with «Retry», never «No schools yet» (M-SC03)', async () => {
    state.listSchools.mockResolvedValueOnce({ error: true, result: ['Service unavailable'] })
    await renderPage()
    await settle()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Service unavailable')
    expect(screen.queryByText(/No schools yet/)).toBeNull()
    expect(screen.queryByRole('tablist')).toBeNull()

    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    await settle()
    expect(state.listSchools).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('tablist')).toBeInTheDocument()
  })

  it('with a school open, a failed page of the picker keeps the tab and says so under the picker, with «Retry»', async () => {
    setUrl('?school=1&tab=meals')
    const user = userEvent.setup()
    state.listSchools.mockImplementation(async (_ordering, _token, { page }) => (
      page === 1 ? answer([SUNRISE], { total_pages: 2 }) : { error: true, result: ['Service unavailable'] }
    ))
    await renderPage()
    await settle()
    await openPicker(user)
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await settle()

    expect(screen.getByTestId('tab-meals')).toHaveAttribute('data-school', '1')
    expect(tabLog.unmounts).toEqual([])
    const notice = screen.getByText('The list of schools could not be loaded.').closest('.odc-notice')
    expect(notice).not.toBeNull()
    state.listSchools.mockResolvedValue(answer([SUNRISE], { total_pages: 2 }))
    await user.click(within(notice).getByRole('button', { name: 'Retry' }))
    await settle()
    expect(screen.queryByText('The list of schools could not be loaded.')).toBeNull()
  })

  it('a request that throws is the same error', async () => {
    state.listSchools.mockRejectedValueOnce(new Error('network down'))
    await renderPage()
    await settle()
    expect(screen.getByRole('alert')).toHaveTextContent('This could not be loaded')
    expect(screen.queryByText(/No schools yet/)).toBeNull()
  })
})
