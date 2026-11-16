/* eslint-disable import/first */
// The module gate of /schools, end to end with the real controller of the switch (K/SchoolModuleToggle): off → the panel, on → the page.
// redesign SC-B5 (decisions 1A and 4): on Product pieces. Real: the shell, the picker, the switch, the panel, the confirmation (ConfirmDialog).
// Replaced: the contexts of the app, the API and the tabs (their own batches). The cases of the shell itself are in
// SchoolsManagement/__tests__/SchoolsManagement.shell.test.jsx.
import React from 'react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => ({
  level: 0,
  configs: {},
  save: vi.fn(),
  refreshConfigs: vi.fn(),
  showToast: vi.fn(),
  listSchools: vi.fn()
}))

const { useApi, useConfig, useSession, useLanguage } = vi.hoisted(() => ({
  useApi: () => [{
    root: 'https://api.test',
    project: 'demo',
    setAccessToken: () => ({ configs: () => ({ save: state.save }) }),
    businesses: () => ({ asDashboard: () => ({ select: () => ({ get: async () => ({ content: {} }) }) }) })
  }],
  useConfig: () => [{ configs: state.configs }, { refreshConfigs: state.refreshConfigs }],
  useSession: () => [{ token: 'token', user: { id: 7, level: state.level } }],
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback]
}))

vi.mock('../../../../../index', () => ({ useApi, useConfig, useLanguage, useSession }))
vi.mock('../../../../../contexts/ApiContext', () => ({ useApi }))
vi.mock('../../../../../contexts/ConfigContext', () => ({ useConfig }))
vi.mock('../../../../../contexts/SessionContext', () => ({ useSession }))
vi.mock('../../../../../contexts/LanguageContext', () => ({ useLanguage }))
vi.mock('../../../../../contexts/ToastContext', () => ({
  ToastType: { Error: 'ERROR' },
  useToast: () => [null, { showToast: state.showToast }]
}))
vi.mock('../../../../../components/Schools/schoolApi', () => ({
  listSchools: (...args) => state.listSchools(...args)
}))
vi.mock('../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]
}))
vi.mock('../SchoolGrades', () => ({ SchoolGrades: () => <div data-testid='grades' /> }))
vi.mock('../SchoolClassrooms', () => ({ SchoolClassrooms: () => null }))
vi.mock('../SchoolStudents', () => ({ SchoolStudents: () => null }))
vi.mock('../SchoolMealsReports', () => ({ SchoolMealsReports: () => null }))
vi.mock('../SchoolPrintLabels', () => ({ SchoolPrintLabels: () => null }))

import { SchoolsManagement } from '../SchoolsManagement'

const moduleConfig = (value) => ({
  school_module_enabled: { id: 77, key: 'school_module_enabled', name: 'School module', value }
})

const renderPage = async () => {
  await act(async () => { renderWithProviders(<SchoolsManagement />, { theme: createDashboardTheme(theme) }) })
}

beforeEach(() => {
  vi.clearAllMocks()
  state.level = 0
  state.configs = moduleConfig('0')
  state.save.mockResolvedValue({ content: { error: false, result: {} } })
  state.refreshConfigs.mockResolvedValue()
  state.listSchools.mockResolvedValue({ error: false, result: [{ id: 1, name: 'Sunrise School' }, { id: 2, name: 'Moonlight Academy' }], pagination: { total_pages: 1 } })
  window.localStorage.clear()
  window.history.replaceState(null, '', '/schools')
})
afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

describe('SchoolsManagement module gate', () => {
  it('shows the disabled panel with an enable button for administrators', async () => {
    await renderPage()

    // redesign SC-R1 (review r1 #2): the page keeps its title with the module off, so it has a heading
    expect(screen.getByRole('heading', { level: 1, name: 'Schools' })).toBeInTheDocument()
    expect(screen.getByText('School module')).toBeInTheDocument()
    expect(screen.getByText(/Enable the School module to run school meal programs/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enable school module' })).toHaveAttribute('data-variant', 'primary')
    expect(screen.queryByText('Only an administrator can enable this module.')).not.toBeInTheDocument()
    expect(document.querySelector('.od-first-select-trigger')).toBeNull()
    expect(state.listSchools).not.toHaveBeenCalled()
  })

  it('titles the panel with the name the API gives the config, else with the translated one', async () => {
    state.configs = { school_module_enabled: { id: 77, key: 'school_module_enabled', name: 'Campus meals', value: '0' } }
    await renderPage()
    expect(screen.getByText('Campus meals')).toBeInTheDocument()
    cleanup()

    state.configs = { school_module_enabled: { id: 77, key: 'school_module_enabled', value: '0' } }
    await renderPage()
    expect(screen.getByText('School module')).toBeInTheDocument()
  })

  it('enables the module from the button below the description', async () => {
    await renderPage()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Enable school module' })) })

    expect(state.save).toHaveBeenCalledWith({ value: '1' })
    expect(state.refreshConfigs).toHaveBeenCalledTimes(1)
  })

  it('shows the state without controls to business owners', async () => {
    state.level = 2
    await renderPage()

    expect(screen.getByText('Only an administrator can enable this module.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enable school module' })).not.toBeInTheDocument()
    expect(state.listSchools).not.toHaveBeenCalled()
  })

  it('renders the school picker and a disable action when the module is on', async () => {
    state.configs = moduleConfig('1')
    await renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Schools' })).toBeInTheDocument()
    expect(document.querySelector('.od-first-select-trigger')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disable school module' })).toBeInTheDocument()
    expect(state.listSchools).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/Enable the School module to run/)).not.toBeInTheDocument()
  })

  it('asks for confirmation before disabling and cancels without saving', async () => {
    state.configs = moduleConfig('1')
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Disable school module' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Disable the School module?')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(state.save).not.toHaveBeenCalled()
  })

  it('disables the module after confirming', async () => {
    state.configs = moduleConfig('1')
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Disable school module' }))
    const dialog = await screen.findByRole('alertdialog')
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Disable module' })) })

    expect(state.save).toHaveBeenCalledWith({ value: '0' })
    expect(state.refreshConfigs).toHaveBeenCalledTimes(1)
  })

  it('hides the disable action from business owners while the module is on', async () => {
    state.level = 2
    state.configs = moduleConfig('1')
    await renderPage()

    expect(document.querySelector('.od-first-select-trigger')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Disable school module' })).not.toBeInTheDocument()
  })
})
