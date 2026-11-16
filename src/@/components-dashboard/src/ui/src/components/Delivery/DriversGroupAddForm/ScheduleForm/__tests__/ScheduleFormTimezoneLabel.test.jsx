/* eslint-disable import/first */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

vi.mock('../../../../Shared', () => ({ Schedule: () => null }))

import { ScheduleForm } from '..'
import { FirstSelect } from '../../../../Shared/UI/FirstSelect'

const renderForm = (props = {}) => render(
  <ThemeProvider theme={createDashboardTheme(theme)}>
    <ScheduleForm
      isScheduleEnabled
      driversGroupState={{ driversGroup: { timezone: 'America/New_York', schedule: [] } }}
      changesState={{}}
      handleChangesState={vi.fn()}
      handleChangeScheduleEnabled={vi.fn()}
      handleChangeScheduleState={vi.fn()}
      {...props}
    />
  </ThemeProvider>
)

describe('ScheduleForm timezone label', () => {
  it('names the timezone selector trigger from its label plus the chosen value', () => {
    renderForm()
    const trigger = screen.getByLabelText('Timezone America/New_York')
    expect(trigger).toHaveAttribute('role', 'button')
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
    expect(trigger).toHaveAttribute('id', 'drivers-group-timezone')
    expect(trigger).toHaveAttribute('aria-labelledby', 'drivers-group-timezone-label drivers-group-timezone')
    expect(screen.getByRole('button', { name: 'Timezone America/New_York' })).toBe(trigger)
  })

  it('names it from the label plus the placeholder when no timezone is chosen', () => {
    renderForm({ driversGroupState: { driversGroup: { schedule: [] } } })
    expect(screen.getByRole('button', { name: 'Timezone Select a timezone' })).toHaveAttribute('aria-haspopup', 'listbox')
  })

  it('leaves id and aria-labelledby off the FirstSelect trigger when they are not passed', () => {
    render(
      <ThemeProvider theme={createDashboardTheme(theme)}>
        <FirstSelect placeholder='Plain' options={[]} onChange={vi.fn()} />
      </ThemeProvider>
    )
    const trigger = screen.getByRole('button', { name: 'Plain' })
    expect(trigger).not.toHaveAttribute('id')
    expect(trigger).not.toHaveAttribute('aria-labelledby')
  })
})
