/* eslint-disable import/first */
// redesign DG-B5 (M-DG15): the add form reports its changes to the page, which guards a discard against the defaults
import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from 'styled-components'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useConfig: () => [{ configs: {} }],
  useSession: () => [{ user: { level: 0 } }],
  DriversGroupDetails: ({ UIComponent, changes, ...props }) => <UIComponent {...props} changesState={changes} actionState={{}} />
}))
vi.mock('../../../Shared', () => ({ Alert: () => null }))
vi.mock('../GeneralForm', () => ({ GeneralForm: () => null }))
vi.mock('../BusinessesForm', () => ({ BusinessesForm: () => null }))
vi.mock('../PaymethodsForm', () => ({ PaymethodsForm: () => null }))
vi.mock('../AdvancedLogisticsForm', () => ({ AdvancedLogisticsForm: () => null }))
vi.mock('../ScheduleForm', () => ({ ScheduleForm: () => null }))
vi.mock('../../../../styles', () => ({ Button: ({ children, ...props }) => <button {...props}>{children}</button> }))

import { DriversGroupAddForm } from '..'

const wrap = node => <ThemeProvider theme={createDashboardTheme(theme)}>{node}</ThemeProvider>

describe('DriversGroupAddForm onChangesStateChange (opt-in)', () => {
  it('reports the starting changes and every change after', () => {
    const report = vi.fn()
    const defaults = { type: 0, enabled: true }
    const { rerender } = render(wrap(<DriversGroupAddForm changes={defaults} onChangesStateChange={report} />))
    expect(report).toHaveBeenLastCalledWith(defaults)
    const typed = { ...defaults, name: 'North' }
    rerender(wrap(<DriversGroupAddForm changes={typed} onChangesStateChange={report} />))
    expect(report).toHaveBeenLastCalledWith(typed)
  })

  it('without the prop it renders as before', () => {
    expect(() => render(wrap(<DriversGroupAddForm changes={{ type: 0 }} />))).not.toThrow()
  })
})
