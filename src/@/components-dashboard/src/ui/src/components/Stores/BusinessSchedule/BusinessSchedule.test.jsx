// redesign SL-F3 (C) + stores 5.4: BusinessSchedule uses the Product ScheduleEditor; outside the tutorial it saves through the SaveBar and the leave guard; the tutorial keeps its Skip and «Save and continue».
/* eslint-disable import/first */
import React from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'
import { LeaveGuardContext, useLeaveGuardHost } from '../../Shared/Product/LeaveGuard'

const runtime = vi.hoisted(() => ({ controller: null, configs: { general_hour_format: { value: 'HH:mm' } } }))

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  BusinessSchedule: ({ UIComponent, ...props }) => <UIComponent {...props} {...runtime.controller} />
}))
vi.mock('../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: runtime.configs }]
}))
vi.mock('../../../../../contexts/UtilsContext', () => ({
  useUtils: () => [{ parseDate: () => '' }]
}))

import { BusinessSchedule } from './index'

const lapse = (openHour, openMinute, closeHour, closeMinute) => ({
  open: { hour: openHour, minute: openMinute },
  close: { hour: closeHour, minute: closeMinute }
})
const week = () => Array.from({ length: 7 }, () => ({ enabled: true, lapses: [lapse(9, 0, 17, 0)] }))

const base = (controller) => ({
  formState: { loading: false, changes: {}, result: { error: false } },
  handleChangeScheduleState: vi.fn(),
  handleUpdateSchedule: vi.fn(),
  handleDiscardSchedule: vi.fn(),
  ...controller
})
// A controller with an unsaved schedule
const changed = (controller) => ({
  formState: { loading: false, changes: { schedule: week() }, result: { error: false } },
  ...controller
})

// Reads the leave-guard host the way the editor shell does: `hostRef.current.isDirty()`.
const GuardProbe = ({ hostRef, children }) => {
  const leave = useLeaveGuardHost()
  hostRef.current = leave
  return <LeaveGuardContext.Provider value={leave.context}>{children}</LeaveGuardContext.Provider>
}

const tree = ({ hostRef, ...props }) => {
  const page = (
    <ThemeProvider theme={createDashboardTheme(theme)}>
      <BusinessSchedule business={{ id: 7, schedule: week() }} {...props} />
    </ThemeProvider>
  )
  return hostRef ? <GuardProbe hostRef={hostRef}>{page}</GuardProbe> : page
}

const setup = ({ controller, ...props } = {}) => {
  runtime.controller = base(controller)
  const view = render(tree(props))
  // `rerender(controller)` swaps what the mocked controller hands to the UI (the saved schedule arriving, for example)
  const rerender = (next) => {
    runtime.controller = base(next)
    view.rerender(tree(props))
  }
  return { ...view, rerender, controller: runtime.controller }
}

beforeEach(() => {
  runtime.controller = null
  runtime.configs = { general_hour_format: { value: 'HH:mm' } }
})
afterEach(() => {
  vi.useRealTimers()
  document.getElementById('app-modals')?.remove()
})

describe('BusinessSchedule on the Product ScheduleEditor (SL-F3 C)', () => {
  it('draws the Product editor with the store schedule and the texts of the existing keys', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'Schedule' })).toBeInTheDocument()
    expect(document.querySelector('[data-slot="schedule-editor"]')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-slot="schedule-day"]')).toHaveLength(7)
    expect(screen.getByRole('switch', { name: 'Schedule: Sunday' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('combobox', { name: 'Monday Open Hour 1' })).toHaveValue('9')
    expect(screen.getByRole('combobox', { name: 'Monday Close Hour 1' })).toHaveValue('17')
    expect(screen.getByRole('button', { name: 'Add hours: Monday' })).toHaveTextContent('Add hours')
    expect(screen.getByRole('button', { name: 'Copy hours to…: Monday' })).toBeInTheDocument()
    // The legacy editor is gone.
    expect(screen.queryByRole('checkbox', { name: 'Schedule: Sunday' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add Schedule: Sunday' })).not.toBeInTheDocument()
  })

  it('reports a changed schedule to the controller', async () => {
    const user = userEvent.setup()
    const { controller } = setup()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Monday Close Hour 1' }), '20')
    const next = controller.handleChangeScheduleState.mock.calls.at(-1)[0]
    expect(next[1].lapses[0]).toEqual(lapse(9, 0, 20, 0))
    expect(next[0].lapses[0]).toEqual(lapse(9, 0, 17, 0))
  })

  it('keeps the delete confirmation and the day switch working inside the page', async () => {
    const user = userEvent.setup()
    const { controller } = setup({ business: { id: 7, schedule: [{ enabled: true, lapses: [lapse(9, 0, 12, 0), lapse(13, 0, 17, 0)] }, ...week().slice(1)] } })
    await user.click(screen.getByRole('button', { name: 'Delete Schedule: Sunday 2' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Are you sure to delete this Schedule?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(controller.handleChangeScheduleState.mock.calls.at(-1)[0][0].lapses).toEqual([lapse(9, 0, 12, 0)])
    await user.click(screen.getByRole('switch', { name: 'Schedule: Monday' }))
    expect(controller.handleChangeScheduleState.mock.calls.at(-1)[0][1].enabled).toBe(false)
  })

  it('draws no bar without changes', () => {
    setup()
    expect(screen.queryByRole('group', { name: 'Save changes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Discard' })).not.toBeInTheDocument()
  })

  it('draws the sticky save bar after the editor, counting the schedule as one change', () => {
    setup({ controller: changed() })
    const bar = screen.getByRole('group', { name: 'Save changes' })
    // sticky comes from the bar's own stylesheet (save-bar.css), which vitest does not load
    expect(bar).toHaveClass('odc-savebar')
    expect(bar).toHaveTextContent('1 unsaved change')
    expect(bar).toHaveTextContent('Schedule')
    expect(within(bar).getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(within(bar).getByRole('button', { name: 'Discard' })).toBeEnabled()
    expect(bar.compareDocumentPosition(document.querySelector('[data-slot="schedule-editor"]')) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
  })

  it('saves with Save once there are changes', async () => {
    const user = userEvent.setup()
    const { controller } = setup({ controller: changed({ handleUpdateSchedule: vi.fn().mockResolvedValue({ ok: true }) }) })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(controller.handleUpdateSchedule).toHaveBeenCalledTimes(1)
  })

  it('Save in the editor asks for the failure to stay inline: handleUpdateSchedule({ inlineError: true, silentSuccess: true })', async () => {
    const user = userEvent.setup()
    const { controller } = setup({ controller: changed({ handleUpdateSchedule: vi.fn().mockResolvedValue({ ok: true }) }) })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(controller.handleUpdateSchedule).toHaveBeenCalledTimes(1)
    expect(controller.handleUpdateSchedule).toHaveBeenCalledWith({ inlineError: true, silentSuccess: true })
  })

  it('says Saved for a moment after a good save, once the changes are gone', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { rerender } = setup({ controller: changed({ handleUpdateSchedule: vi.fn().mockResolvedValue({ ok: true }) }) })
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    rerender({}) // the controller cleared `changes`
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
    act(() => { vi.advanceTimersByTime(2600) })
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('does not say Saved when the save failed', async () => {
    const user = userEvent.setup()
    setup({ controller: changed({ handleUpdateSchedule: vi.fn().mockResolvedValue({ ok: false, error: ['x'] }) }) })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('blocks the buttons while it saves', () => {
    setup({ controller: changed({ formState: { loading: true, changes: { schedule: week() }, result: { error: false } } }) })
    expect(screen.getByRole('button', { name: 'Discard' })).toBeDisabled()
    expect(screen.getByRole('group', { name: 'Save changes' })).toHaveAttribute('data-saving')
  })

  it('does not save again while it is saving', async () => {
    const user = userEvent.setup()
    const { controller } = setup({ controller: changed({ formState: { loading: true, changes: { schedule: week() }, result: { error: false } } }) })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(controller.handleUpdateSchedule).not.toHaveBeenCalled()
  })

  it('Discard asks the controller to drop the changes and the editor goes back to the saved schedule', async () => {
    const user = userEvent.setup()
    const { controller } = setup({ controller: changed() })
    const close = screen.getByRole('combobox', { name: 'Monday Close Hour 1' })
    await user.selectOptions(close, '20')
    expect(screen.getByRole('combobox', { name: 'Monday Close Hour 1' })).toHaveValue('20')
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(controller.handleDiscardSchedule).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('combobox', { name: 'Monday Close Hour 1' })).toHaveValue('17')
  })

  it('shows the error and retries with Retry', async () => {
    const user = userEvent.setup()
    const { controller } = setup({
      controller: changed({
        formState: { loading: false, changes: { schedule: week() }, result: { error: true, result: ['Store is closed'] } }
      })
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Store is closed')
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(controller.handleUpdateSchedule).toHaveBeenCalledTimes(1)
  })

  it('falls back to the generic message when the error has no text', () => {
    setup({ controller: changed({ formState: { loading: false, changes: { schedule: week() }, result: { error: true, result: [] } } }) })
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't save the change.")
  })

  it('registers in the leave guard: dirty with changes, clean without them', () => {
    const hostRef = { current: null }
    setup({ hostRef, controller: changed() })
    expect(hostRef.current.isDirty()).toBe(true)
    cleanup()
    setup({ hostRef })
    expect(hostRef.current.isDirty()).toBe(false)
  })

  it('has no Skip outside the tutorial', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
  })
})

// main the opening-hours behaviour main's BusinessSchedule.index.test.jsx (horario, 8 cases) protected through
// the legacy Select-based editor. «renders the persisted schedule with Save disabled and performs no request» is not
// ported on its own: it is already covered above by «draws the Product editor with the store schedule…» (the right
// initial hour/minute values) and «draws no bar without changes» (no bar, no request). The real `C/components/Schedule`
// controller runs underneath here too (only the outer business controller is mocked, see the top of this file), so these
// cases exercise the same `scheduleRef`/`commitSchedule` fix the legacy editor used, through the redesigned
// native selects instead of the legacy `.select`/`.option` DOM.
describe('main schedule regressions ported from main', () => {
  const dismissAlert = async (user, message) => {
    await screen.findByText(message)
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  }

  // main: "applies hour then minute selections to opening and closing times in 24h format"
  it('applies hour then minute selections to open and close, leaving the business prop untouched', async () => {
    const user = userEvent.setup()
    const business = { id: 7, schedule: week() }
    const snapshot = JSON.parse(JSON.stringify(business.schedule))
    const { controller } = setup({ business })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Monday Open Hour 1' }), '14')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Monday Open Minute 1' }), '30')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Monday Close Hour 1' }), '19')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Monday Close Minute 1' }), '20')

    const next = controller.handleChangeScheduleState.mock.calls.at(-1)[0]
    expect(next[1].lapses[0]).toEqual(lapse(14, 30, 19, 20))
    expect(business.schedule).toEqual(snapshot)
  })

  // main: "shows 12h labels while persisting 24h values"
  it('shows 12h labels on the selects while the controller keeps 24h values', async () => {
    runtime.configs = { general_hour_format: { value: 'hh:mm A' } }
    const user = userEvent.setup()
    const { controller } = setup()
    const openHour = () => screen.getByRole('combobox', { name: 'Monday Open Hour 1' })

    expect(openHour().selectedOptions[0]).toHaveTextContent('9 AM')
    await user.selectOptions(openHour(), '14')
    expect(openHour()).toHaveValue('14')
    expect(openHour().selectedOptions[0]).toHaveTextContent('2 PM')

    const next = controller.handleChangeScheduleState.mock.calls.at(-1)[0]
    expect(next[1].lapses[0].open.hour).toBe(14)
  })

  // main: "keeps the persisted non-default hour on a minute-only change"
  it('a minute-only change keeps the persisted hour', async () => {
    const user = userEvent.setup()
    const business = { id: 7, schedule: [{ enabled: true, lapses: [lapse(13, 15, 18, 45)] }, ...week().slice(1)] }
    const { controller } = setup({ business })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sunday Open Minute 1' }), '45')
    expect(screen.getByRole('combobox', { name: 'Sunday Open Hour 1' })).toHaveValue('13')

    const next = controller.handleChangeScheduleState.mock.calls.at(-1)[0]
    expect(next[0].lapses[0]).toEqual(lapse(13, 45, 18, 45))
  })

  // main: "enabling an unrelated day preserves every persisted time"
  it('enabling a disabled day preserves every day\'s own persisted times', async () => {
    const user = userEvent.setup()
    const business = {
      id: 7,
      schedule: [
        { enabled: true, lapses: [lapse(13, 15, 18, 45)] },
        { enabled: true, lapses: [lapse(9, 0, 12, 0), lapse(14, 0, 20, 0)] },
        { enabled: false, lapses: [lapse(8, 0, 22, 30)] },
        ...week().slice(3)
      ]
    }
    const { controller } = setup({ business })

    await user.click(screen.getByRole('switch', { name: 'Schedule: Tuesday' }))

    const next = controller.handleChangeScheduleState.mock.calls.at(-1)[0]
    expect(next[0]).toEqual({ enabled: true, lapses: [lapse(13, 15, 18, 45)] })
    expect(next[1]).toEqual({ enabled: true, lapses: [lapse(9, 0, 12, 0), lapse(14, 0, 20, 0)] })
    expect(next[2]).toEqual({ enabled: true, lapses: [lapse(8, 0, 22, 30)] })
  })

  // main: "accepts the 00 and 59 boundary values"
  it('accepts the 00 and 59 boundary values', async () => {
    const user = userEvent.setup()
    const { controller } = setup()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Monday Open Hour 1' }), '0')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Monday Open Minute 1' }), '0')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Monday Close Minute 1' }), '59')
    expect(screen.getByRole('combobox', { name: 'Monday Open Hour 1' })).toHaveValue('0')
    expect(screen.getByRole('combobox', { name: 'Monday Close Minute 1' })).toHaveValue('59')

    const next = controller.handleChangeScheduleState.mock.calls.at(-1)[0]
    expect(next[1].lapses[0]).toEqual(lapse(0, 0, 17, 59))
  })

  // main: "rejects invalid end and overlapping times and still accepts the next valid selection"
  it('rejects an invalid end time and an overlap, then accepts the next valid selection', async () => {
    const user = userEvent.setup()
    const business = {
      id: 7,
      schedule: [
        { enabled: true, lapses: [lapse(13, 15, 18, 45)] },
        { enabled: true, lapses: [lapse(9, 0, 12, 0), lapse(14, 0, 20, 0)] },
        ...week().slice(2)
      ]
    }
    setup({ business })
    const sundayClose = () => screen.getByRole('combobox', { name: 'Sunday Close Hour 1' })
    const mondayClose = () => screen.getByRole('combobox', { name: 'Monday Close Hour 1' })

    await user.selectOptions(sundayClose(), '10')
    await dismissAlert(user, 'Choose an end time later than the start time.')
    expect(sundayClose()).toHaveValue('18')

    await user.selectOptions(mondayClose(), '15')
    await dismissAlert(user, 'There is an schedule conflict')
    expect(mondayClose()).toHaveValue('12')

    await user.selectOptions(sundayClose(), '19')
    expect(sundayClose()).toHaveValue('19')
    await user.selectOptions(mondayClose(), '13')
    expect(mondayClose()).toHaveValue('13')
  })

  // main: "adds a lapse in the free slot and edits its hour then minutes"
  // «Add hours» inserts the free slot straight into the lapses (sorted by open time); there is no separate manual-entry
  // row to apply, so the new lapse shows up right away as lapse 2, with its own numbered selects.
  it('adds a lapse in the free slot and edits its hour then minutes', async () => {
    const user = userEvent.setup()
    const business = { id: 7, schedule: [{ enabled: true, lapses: [lapse(9, 0, 12, 0), lapse(14, 0, 20, 0)] }, ...week().slice(1)] }
    const { controller } = setup({ business })

    await user.click(screen.getByRole('button', { name: 'Add hours: Sunday' }))
    expect(screen.getByRole('combobox', { name: 'Sunday Open Hour 2' })).toHaveValue('12')
    expect(screen.getByRole('combobox', { name: 'Sunday Open Minute 2' })).toHaveValue('1')
    expect(screen.getByRole('combobox', { name: 'Sunday Close Hour 2' })).toHaveValue('13')
    expect(screen.getByRole('combobox', { name: 'Sunday Close Minute 2' })).toHaveValue('59')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sunday Open Hour 2' }), '13')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sunday Open Minute 2' }), '30')

    const next = controller.handleChangeScheduleState.mock.calls.at(-1)[0]
    expect(next[0].lapses).toEqual([
      lapse(9, 0, 12, 0),
      lapse(13, 30, 13, 59),
      lapse(14, 0, 20, 0)
    ])
  })
})
