import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
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
    setAccessToken: () => ({ configs: () => ({ save: state.save }) }),
    businesses: () => ({ asDashboard: () => ({ select: () => ({ get: async () => ({ content: {} }) }) }) })
  }],
  useConfig: () => [{ configs: state.configs }, { refreshConfigs: state.refreshConfigs }],
  useSession: () => [{ token: 'token', user: { level: state.level } }],
  useLanguage: () => [{}, (_key, fallback) => fallback]
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
vi.mock('../../../utils', async () => {
  const { isDashboardFeatureEnabled } = await import('../../../../../utils/dashboardFeatureAccess')
  return { isDashboardFeatureEnabled, addQueryToUrl: vi.fn(), removeQueryToUrl: vi.fn() }
})
vi.mock('../../../styles/Select/FirstSelect', () => ({
  Select: ({ placeholder }) => <div data-testid='school-select'>{placeholder}</div>
}))
vi.mock('../../../styles', () => ({
  Button: (props) => <button {...props} />,
  IconButton: (props) => <button {...props} />
}))
vi.mock('../../Shared', () => ({
  SpinnerLoader: () => <div data-testid='spinner' />,
  Confirm: ({ open, title, content, onAccept, onCancel }) => open
    ? (
      <div role='dialog'>
        <h1>{title}</h1>
        <p>{content}</p>
        <button onClick={onCancel}>Cancel</button>
        <button onClick={onAccept}>Accept</button>
      </div>
      )
    : null
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
  await act(async () => { renderWithProviders(<SchoolsManagement />) })
}

describe('SchoolsManagement module gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.level = 0
    state.configs = moduleConfig('0')
    state.save.mockResolvedValue({ content: { error: false, result: {} } })
    state.refreshConfigs.mockResolvedValue()
    state.listSchools.mockResolvedValue({ error: false, result: [{ id: 1, name: 'Sunrise School' }], pagination: { total_pages: 1 } })
  })

  it('shows the disabled panel with an enable button for administrators', async () => {
    await renderPage()

    expect(screen.queryByText('Schools')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'School module' })).toBeInTheDocument()
    expect(screen.getByText(/Enable the School module to run school meal programs/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enable school module' })).toBeInTheDocument()
    expect(screen.queryByText('Only an administrator can enable this module.')).not.toBeInTheDocument()
    expect(screen.queryByTestId('school-select')).not.toBeInTheDocument()
    expect(state.listSchools).not.toHaveBeenCalled()
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
  })

  it('renders the school select and a disable action when the module is on', async () => {
    state.configs = moduleConfig('1')
    await renderPage()

    expect(screen.getByText('Schools')).toBeInTheDocument()
    expect(screen.getByTestId('school-select')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument()
    expect(state.listSchools).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/Enable the School module to run/)).not.toBeInTheDocument()
  })

  it('asks for confirmation before disabling and cancels without saving', async () => {
    state.configs = moduleConfig('1')
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Disable' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Disable the School module?')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(state.save).not.toHaveBeenCalled()
  })

  it('disables the module after confirming', async () => {
    state.configs = moduleConfig('1')
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Disable' }))
    await act(async () => { fireEvent.click(screen.getByText('Accept')) })

    expect(state.save).toHaveBeenCalledWith({ value: '0' })
    expect(state.refreshConfigs).toHaveBeenCalledTimes(1)
  })

  it('hides the disable action from business owners while the module is on', async () => {
    state.level = 2
    state.configs = moduleConfig('1')
    await renderPage()

    expect(screen.getByTestId('school-select')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument()
  })
})
