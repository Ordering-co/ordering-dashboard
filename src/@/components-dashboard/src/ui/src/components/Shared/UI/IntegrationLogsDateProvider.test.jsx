/* eslint-disable import/first */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from 'styled-components'

const runtime = vi.hoisted(() => {
  const state = {
    configs: { format_time: { value: '24' } },
    language: { code: 'en', loading: false }
  }
  state.translate = (key, fallback) => {
    if (key === 'INVALID_FORMAT' && state.language.code === 'es') return 'formato inválido'
    return fallback || key
  }
  return state
})

vi.mock('../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: runtime.configs }]
}))

vi.mock('../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [runtime.language, runtime.translate]
}))

vi.mock('../../../../../index', async () => {
  const { useUtils } = await import('../../../../../contexts/UtilsContext')
  return {
    IntegrationLogs: () => null,
    useLanguage: () => [runtime.language, runtime.translate],
    useUtils
  }
})

vi.mock('react-loading-skeleton', () => ({
  default: () => <span data-testid='skeleton' />
}))

vi.mock('react-syntax-highlighter', () => ({
  default: ({ children }) => <pre>{children}</pre>
}))

vi.mock('..', () => ({
  Modal: () => null,
  Pagination: () => null
}))

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'
import { UtilsProviders, useUtils } from '../../../../../contexts/UtilsContext'
import { IntegrationLogsUI } from './IntegrationLogs'

const dashboardTheme = createDashboardTheme(theme)
const timestamp = '2026-01-02 12:34:56'

const pad = value => String(value).padStart(2, '0')
// redesign W0-4a (decision 13): with no dates_general_format the default is the readable DD MMM YYYY, never ISO
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const formatNativeLocal = (date, hour12 = false) => {
  const day = `${pad(date.getDate())} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
  const minutes = pad(date.getMinutes())
  if (!hour12) return `${day} ${pad(date.getHours())}:${minutes}`
  const period = date.getHours() >= 12 ? 'PM' : 'AM'
  const hour = date.getHours() % 12 || 12
  return `${day} ${pad(hour)}:${minutes} ${period}`
}

const FormatterProbe = ({ value }) => {
  const [{ parseDate }] = useUtils()
  return (
    <>
      <output data-testid='utc-date'>{parseDate(value, { utc: true })}</output>
      <output data-testid='local-date'>{parseDate(value, { utc: false })}</output>
    </>
  )
}

const integrationProps = createdAt => ({
  model: 'Business',
  modelId: 51,
  logsList: {
    error: false,
    loading: false,
    logs: [{
      id: 81,
      model: 'Business',
      model_id: 51,
      event: 'fixture.updated',
      type: 0,
      created_at: createdAt
    }]
  },
  paginationProps: { currentPage: 1, from: 1, totalPages: 1 },
  getLogs: vi.fn(),
  selectedLogState: { loading: false, log: {} },
  setSelectedLogState: vi.fn(),
  relatedGroupEvent: '',
  setRelatedGroupEvent: vi.fn()
})

const Harness = ({ createdAt = timestamp, includeProbe = false }) => (
  <ThemeProvider theme={dashboardTheme}>
    <UtilsProviders>
      <IntegrationLogsUI {...integrationProps(createdAt)} />
      {includeProbe && <FormatterProbe value={createdAt} />}
    </UtilsProviders>
  </ThemeProvider>
)

const integrationRow = () => document.querySelector('[data-slot="integration-log-row"]')

describe('IntegrationLogs with the real Utils date provider', () => {
  beforeEach(() => {
    runtime.configs = { format_time: { value: '24' } }
    runtime.language = { code: 'en', loading: false }
  })

  it('renders the real UTC-to-local result and updates between configured 24/12-hour formats', () => {
    const utcInstant = new Date(Date.UTC(2026, 0, 2, 12, 34, 56))
    const expectedUtc24 = formatNativeLocal(utcInstant)
    const expectedLocal24 = '02 Jan 2026 12:34'
    const rendered = render(<Harness includeProbe />)

    expect(within(integrationRow()).getByText(expectedUtc24)).toBeInTheDocument()
    expect(screen.getByTestId('utc-date')).toHaveTextContent(expectedUtc24)
    expect(screen.getByTestId('local-date')).toHaveTextContent(expectedLocal24)

    if (process.env.TZ === 'America/Chicago') {
      expect(expectedUtc24).toBe('02 Jan 2026 06:34')
      expect(expectedUtc24).not.toBe(expectedLocal24)
    }

    runtime.configs = { format_time: { value: '12' } }
    rendered.rerender(<Harness includeProbe />)

    const expectedUtc12 = formatNativeLocal(utcInstant, true)
    const expectedLocal12 = '02 Jan 2026 12:34 PM'
    expect(within(integrationRow()).getByText(expectedUtc12)).toBeInTheDocument()
    expect(screen.getByTestId('utc-date')).toHaveTextContent(expectedUtc12)
    expect(screen.getByTestId('local-date')).toHaveTextContent(expectedLocal12)

    if (process.env.TZ === 'America/Chicago') {
      expect(expectedUtc12).toBe('02 Jan 2026 06:34 AM')
      expect(expectedUtc12).not.toBe(expectedLocal12)
    }
  })

  it('updates the mounted formatter when the language provider changes', () => {
    const rendered = render(<Harness createdAt='not-a-date' />)
    expect(within(integrationRow()).getByText('invalid format')).toBeInTheDocument()

    runtime.language = { code: 'es', loading: false }
    rendered.rerender(<Harness createdAt='not-a-date' />)

    expect(within(integrationRow()).getByText('formato inválido')).toBeInTheDocument()
    expect(within(integrationRow()).queryByText('invalid format')).not.toBeInTheDocument()
  })
})
