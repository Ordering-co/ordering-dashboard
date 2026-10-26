import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import theme from '~/theme.json'

const mocks = vi.hoisted(() => {
  const save = vi.fn()
  const users = vi.fn(() => ({ save }))
  const showToast = vi.fn()
  const state = { configs: {} }
  return {
    save,
    users,
    ordering: { users },
    showToast,
    state
  }
})

vi.mock('react-popper', () => ({
  usePopper: () => ({ styles: {}, attributes: {}, update: vi.fn() })
}))

vi.mock('../../../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-session-token', user: { id: 9, level: 0 } }]
}))

vi.mock('../../../../../contexts/ApiContext', () => ({
  useApi: () => [mocks.ordering]
}))

vi.mock('../../../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [undefined, { showToast: mocks.showToast, hideToast: vi.fn() }]
}))

vi.mock('../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [undefined, (key, fallback) => fallback]
}))

vi.mock('../../Shared/HtmlEditor', () => ({
  HtmlEditor: () => null
}))

vi.mock('../../Shared/SpreadSheetEditor', () => ({
  default: () => null
}))

vi.mock('../../../../../index', async () => {
  const { ProfessionalSchedule } = await import('../../../../../components/ProfessionalSchedule/index.js')
  const { Schedule } = await import('../../../../../components/Schedule/index.js')
  const { Popup } = await import('../../../../../components/Popup/index.js')
  return {
    ProfessionalSchedule,
    Schedule,
    Popup,
    useLanguage: () => [undefined, (key, fallback) => fallback],
    useSession: () => [{ token: 'test-session-token', user: { id: 9, level: 0 } }],
    useApi: () => [mocks.ordering],
    useToast: () => [undefined, { showToast: mocks.showToast, hideToast: vi.fn() }],
    ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
    useConfig: () => [{ configs: mocks.state.configs }],
    useUtils: () => [{ parseDate: () => '' }]
  }
})

import { ProfessionalSchedule } from './index'
import { Schedule as WrappedSchedule } from './Schedule'

const defaultDay = (enabled = false) => ({
  enabled,
  lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }]
})

const buildUser = () => ({
  id: 99,
  name: 'Fixture Professional',
  max_days_in_future: 7,
  schedule: [
    {
      enabled: true,
      lapses: [{ open: { hour: 13, minute: 15 }, close: { hour: 18, minute: 45 } }]
    },
    defaultDay(),
    defaultDay(),
    defaultDay(),
    defaultDay(),
    defaultDay(),
    defaultDay()
  ]
})

const selectHeaders = (container) => Array.from(container.querySelectorAll('.select'))
const optionLists = (container) => Array.from(container.querySelectorAll('.list'))

const pickOption = (container, selectIndex, optionIndex) => {
  const headers = selectHeaders(container)
  fireEvent.click(headers[selectIndex])
  const options = optionLists(container)[selectIndex].querySelectorAll('.option')
  fireEvent.click(options[optionIndex])
}

const pickHour = async (container, selectIndex, hour, expectedText) => {
  pickOption(container, selectIndex, hour)
  await waitFor(() => expect(selectHeaders(container)[selectIndex]).toHaveTextContent(expectedText))
}

const pickMinute = async (container, selectIndex, minute) => {
  pickOption(container, selectIndex, minute)
  const expected = minute < 10 ? `0${minute}` : `${minute}`
  await waitFor(() => expect(selectHeaders(container)[selectIndex]).toHaveTextContent(expected))
}

const renderWithTheme = (ui) => render(
  <ThemeProvider theme={theme}>
    {ui}
  </ThemeProvider>
)

const rerenderWithTheme = (rerender, ui) => rerender(
  <ThemeProvider theme={theme}>
    {ui}
  </ThemeProvider>
)

const saveButton = () => screen.getByRole('button', { name: 'Save' })

const saveChanges = async () => {
  await waitFor(() => expect(saveButton()).toBeEnabled())
  fireEvent.click(saveButton())
  await waitFor(() => expect(mocks.save).toHaveBeenCalled())
}

describe('ProfessionalSchedule', () => {
  beforeEach(() => {
    mocks.save.mockReset()
    mocks.users.mockClear()
    mocks.showToast.mockClear()
    mocks.state.configs = {}
  })

  test('renders the persisted schedule with Save disabled and performs no request', () => {
    const user = buildUser()
    const { container } = renderWithTheme(<ProfessionalSchedule user={user} />)

    expect(saveButton()).toBeDisabled()
    expect(mocks.save).not.toHaveBeenCalled()
    expect(mocks.users).not.toHaveBeenCalled()

    const headers = selectHeaders(container)
    expect(headers[0]).toHaveTextContent('13')
    expect(headers[1]).toHaveTextContent('15')
    expect(headers[2]).toHaveTextContent('18')
    expect(headers[3]).toHaveTextContent('45')
  })

  test('keeps form changes while editing schedule and saves the exact payload', async () => {
    const user = buildUser()
    const snapshot = JSON.parse(JSON.stringify(user.schedule))
    mocks.save.mockResolvedValue({ content: { error: false, result: { ...user } } })
    const { container } = renderWithTheme(<ProfessionalSchedule user={user} />)

    await waitFor(() => expect(selectHeaders(container).length).toBeGreaterThan(0))

    const maxDaysInput = screen.getByPlaceholderText('00')
    await waitFor(() => expect(maxDaysInput).toBeEnabled())
    fireEvent.change(maxDaysInput, { target: { name: 'max_days_in_future', value: '12' } })

    await pickHour(container, 0, 14, '14')
    await pickMinute(container, 1, 30)
    expect(selectHeaders(container)[0]).toHaveTextContent('14')

    await saveChanges()

    const expected = JSON.parse(JSON.stringify(snapshot))
    expected[0].lapses = [{ open: { hour: 14, minute: 30 }, close: { hour: 18, minute: 45 } }]
    expect(mocks.users).toHaveBeenCalledWith(99)
    expect(mocks.save).toHaveBeenCalledTimes(1)
    expect(mocks.save).toHaveBeenCalledWith({ max_days_in_future: '12', schedule: expected })
    expect(user.schedule).toEqual(snapshot)
  })
})

describe('ProfessionalSchedule Schedule wrapper', () => {
  test('forwards the latest handleChangeScheduleState with the edited schedule', async () => {
    const firstChange = vi.fn()
    const latestChange = vi.fn()
    const schedule = buildUser().schedule
    const { container, rerender } = renderWithTheme(
      <WrappedSchedule scheduleList={schedule} handleChangeScheduleState={firstChange} />
    )
    rerenderWithTheme(rerender,
      <WrappedSchedule scheduleList={schedule} handleChangeScheduleState={latestChange} />
    )

    await waitFor(() => expect(selectHeaders(container).length).toBeGreaterThan(0))

    await pickHour(container, 0, 14, '14')
    await waitFor(() => expect(latestChange).toHaveBeenCalled())
    expect(firstChange).not.toHaveBeenCalled()
    expect(latestChange.mock.calls.at(-1)[0][0].lapses[0].open).toEqual({ hour: 14, minute: 15 })

    await pickMinute(container, 1, 30)
    await waitFor(() => expect(latestChange.mock.calls.at(-1)[0][0].lapses[0].open).toEqual({ hour: 14, minute: 30 }))
    expect(firstChange).not.toHaveBeenCalled()
  })
})
