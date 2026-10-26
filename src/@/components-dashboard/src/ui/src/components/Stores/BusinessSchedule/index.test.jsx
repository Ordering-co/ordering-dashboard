import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import theme from '~/theme.json'

const mocks = vi.hoisted(() => {
  const save = vi.fn()
  const businesses = vi.fn(() => ({ save }))
  const showToast = vi.fn()
  const state = { configs: {} }
  return {
    save,
    businesses,
    ordering: { businesses },
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
  const { BusinessSchedule } = await import('../../../../../components/BusinessSchedule/index.js')
  const { Schedule } = await import('../../../../../components/Schedule/index.js')
  const { Popup } = await import('../../../../../components/Popup/index.js')
  return {
    BusinessSchedule,
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

import { BusinessSchedule } from './index'

const buildBusiness = () => ({
  id: 777,
  name: 'Fixture Store',
  schedule: [
    {
      enabled: true,
      lapses: [{ open: { hour: 13, minute: 15 }, close: { hour: 18, minute: 45 } }]
    },
    {
      enabled: true,
      lapses: [
        { open: { hour: 9, minute: 0 }, close: { hour: 12, minute: 0 } },
        { open: { hour: 14, minute: 0 }, close: { hour: 20, minute: 0 } }
      ]
    },
    {
      enabled: false,
      lapses: [{ open: { hour: 8, minute: 0 }, close: { hour: 22, minute: 30 } }]
    },
    {
      enabled: false,
      lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }]
    },
    {
      enabled: false,
      lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }]
    },
    {
      enabled: false,
      lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }]
    },
    {
      enabled: false,
      lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }]
    }
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

const renderSchedule = (business, extraProps = {}) => render(
  <ThemeProvider theme={theme}>
    <BusinessSchedule business={business} {...extraProps} />
  </ThemeProvider>
)

const saveButton = () => screen.getByRole('button', { name: 'Save' })

const saveChanges = async () => {
  await waitFor(() => expect(saveButton()).toBeEnabled())
  fireEvent.click(saveButton())
  await waitFor(() => expect(mocks.save).toHaveBeenCalled())
}

const expectSavedSchedule = (business, expectedSchedule) => {
  expect(mocks.businesses).toHaveBeenCalledWith(business.id)
  expect(mocks.save).toHaveBeenCalledTimes(1)
  expect(mocks.save).toHaveBeenCalledWith(
    { schedule: JSON.stringify(expectedSchedule) },
    { accessToken: 'test-session-token' }
  )
}

const withExpected = (business, dayIndex, mutateDay) => {
  const expected = JSON.parse(JSON.stringify(business.schedule))
  mutateDay(expected[dayIndex])
  return expected
}

const dismissAlert = async () => {
  const accept = await screen.findByRole('button', { name: 'Accept' })
  fireEvent.click(accept)
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument())
}

describe('BusinessSchedule', () => {
  beforeEach(() => {
    mocks.save.mockReset()
    mocks.businesses.mockClear()
    mocks.showToast.mockClear()
    mocks.state.configs = {}
  })

  test('renders the persisted schedule with Save disabled and performs no request', () => {
    const business = buildBusiness()
    const { container } = renderSchedule(business)

    expect(saveButton()).toBeDisabled()
    expect(mocks.save).not.toHaveBeenCalled()
    expect(mocks.businesses).not.toHaveBeenCalled()

    const headers = selectHeaders(container)
    expect(headers).toHaveLength(12)
    expect(headers[0]).toHaveTextContent('13')
    expect(headers[1]).toHaveTextContent('15')
    expect(headers[2]).toHaveTextContent('18')
    expect(headers[3]).toHaveTextContent('45')
  })

  test('applies hour then minute selections to opening and closing times in 24h format', async () => {
    const business = buildBusiness()
    const snapshot = JSON.parse(JSON.stringify(business.schedule))
    const handleSuccessUpdate = vi.fn()
    mocks.save.mockResolvedValue({ content: { error: false, result: { ...business } } })
    const { container } = renderSchedule(business, { handleSuccessUpdate })

    await pickHour(container, 0, 14, '14')
    await pickMinute(container, 1, 30)
    expect(selectHeaders(container)[0]).toHaveTextContent('14')

    await pickHour(container, 2, 19, '19')
    await pickMinute(container, 3, 20)
    expect(selectHeaders(container)[2]).toHaveTextContent('19')

    await saveChanges()

    const expected = withExpected(business, 0, day => {
      day.lapses = [{ open: { hour: 14, minute: 30 }, close: { hour: 19, minute: 20 } }]
    })
    expectSavedSchedule(business, expected)
    expect(business.schedule).toEqual(snapshot)

    await waitFor(() => expect(handleSuccessUpdate).toHaveBeenCalled())
    await waitFor(() => expect(saveButton()).toBeDisabled())
  })

  test('shows 12h labels while persisting 24h values', async () => {
    mocks.state.configs = { general_hour_format: { value: 'hh:mm A' } }
    const business = buildBusiness()
    mocks.save.mockResolvedValue({ content: { error: false, result: { ...business } } })
    const { container } = renderSchedule(business)

    await waitFor(() => expect(selectHeaders(container)[0]).toHaveTextContent('1 PM'))

    pickOption(container, 0, 14)
    await waitFor(() => expect(selectHeaders(container)[0]).toHaveTextContent('2 PM'))
    await pickMinute(container, 1, 30)
    expect(selectHeaders(container)[0]).toHaveTextContent('2 PM')

    pickOption(container, 2, 19)
    await waitFor(() => expect(selectHeaders(container)[2]).toHaveTextContent('7 PM'))
    await pickMinute(container, 3, 20)
    expect(selectHeaders(container)[2]).toHaveTextContent('7 PM')
    expect(selectHeaders(container)[0]).toHaveTextContent('2 PM')

    await saveChanges()

    const expected = withExpected(business, 0, day => {
      day.lapses = [{ open: { hour: 14, minute: 30 }, close: { hour: 19, minute: 20 } }]
    })
    expectSavedSchedule(business, expected)
  })

  test('keeps the persisted non-default hour on a minute-only change', async () => {
    const business = buildBusiness()
    mocks.save.mockResolvedValue({ content: { error: false, result: { ...business } } })
    const { container } = renderSchedule(business)

    await pickMinute(container, 1, 45)
    expect(selectHeaders(container)[0]).toHaveTextContent('13')

    await saveChanges()

    const expected = withExpected(business, 0, day => {
      day.lapses = [{ open: { hour: 13, minute: 45 }, close: { hour: 18, minute: 45 } }]
    })
    expectSavedSchedule(business, expected)
  })

  test('enabling an unrelated day preserves every persisted time', async () => {
    const business = buildBusiness()
    mocks.save.mockResolvedValue({ content: { error: false, result: { ...business } } })
    const { container } = renderSchedule(business)

    const checkboxes = container.querySelectorAll('input[type="checkbox"]')
    fireEvent.click(checkboxes[2])

    await waitFor(() => expect(selectHeaders(container)).toHaveLength(16))
    const headers = selectHeaders(container)
    expect(headers[12]).toHaveTextContent('08')
    expect(headers[13]).toHaveTextContent('00')
    expect(headers[14]).toHaveTextContent('22')
    expect(headers[15]).toHaveTextContent('30')

    await saveChanges()

    const expected = withExpected(business, 2, day => {
      day.enabled = true
    })
    expectSavedSchedule(business, expected)
  })

  test('accepts the 00 and 59 boundary values', async () => {
    const business = buildBusiness()
    mocks.save.mockResolvedValue({ content: { error: false, result: { ...business } } })
    const { container } = renderSchedule(business)

    await pickHour(container, 0, 0, '00')
    await pickMinute(container, 1, 0)
    expect(selectHeaders(container)[0]).toHaveTextContent('00')

    await pickMinute(container, 3, 59)
    expect(selectHeaders(container)[3]).toHaveTextContent('59')

    await saveChanges()

    const expected = withExpected(business, 0, day => {
      day.lapses = [{ open: { hour: 0, minute: 0 }, close: { hour: 18, minute: 59 } }]
    })
    expectSavedSchedule(business, expected)
  })

  test('rejects invalid end and overlapping times and still accepts the next valid selection', async () => {
    const business = buildBusiness()
    mocks.save.mockResolvedValue({ content: { error: false, result: { ...business } } })
    const { container } = renderSchedule(business)

    pickOption(container, 2, 10)
    await screen.findByText('Choose an end time later than the start time.')
    expect(selectHeaders(container)[2]).toHaveTextContent('18')
    await dismissAlert()

    pickOption(container, 6, 15)
    await screen.findByText('There is an schedule conflict')
    expect(selectHeaders(container)[6]).toHaveTextContent('12')
    await dismissAlert()

    await pickHour(container, 2, 19, '19')
    expect(selectHeaders(container)[3]).toHaveTextContent('45')
    await pickHour(container, 6, 13, '13')

    await saveChanges()

    const expected = JSON.parse(JSON.stringify(business.schedule))
    expected[0].lapses = [{ open: { hour: 13, minute: 15 }, close: { hour: 19, minute: 45 } }]
    expected[1].lapses = [
      { open: { hour: 9, minute: 0 }, close: { hour: 13, minute: 0 } },
      { open: { hour: 14, minute: 0 }, close: { hour: 20, minute: 0 } }
    ]
    expectSavedSchedule(business, expected)
  })

  test('adds a lapse in the free slot and edits its hour then minutes', async () => {
    const business = buildBusiness()
    mocks.save.mockResolvedValue({ content: { error: false, result: { ...business } } })
    const { container } = renderSchedule(business)

    const iconGroups = container.querySelectorAll('.icons')
    const addIcon = iconGroups[1].querySelector('span svg')
    fireEvent.click(addIcon)

    await waitFor(() => expect(selectHeaders(container)).toHaveLength(16))
    const headers = selectHeaders(container)
    expect(headers[8]).toHaveTextContent('12')
    expect(headers[9]).toHaveTextContent('01')
    expect(headers[10]).toHaveTextContent('13')
    expect(headers[11]).toHaveTextContent('59')

    await pickHour(container, 8, 13, '13')
    await pickMinute(container, 9, 30)
    expect(headers[8]).toHaveTextContent('13')

    await saveChanges()

    const expected = JSON.parse(JSON.stringify(business.schedule))
    expected[1].lapses = [
      { open: { hour: 9, minute: 0 }, close: { hour: 12, minute: 0 } },
      { open: { hour: 13, minute: 30 }, close: { hour: 13, minute: 59 } },
      { open: { hour: 14, minute: 0 }, close: { hour: 20, minute: 0 } }
    ]
    expectSavedSchedule(business, expected)
  })
})
