/* eslint-disable import/first */
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// redesign stores 2.F
// The real Product pieces (RadioGroup, DatePicker, TimeField, Button, InlineNotice) with the real Config and Utils contexts.
// The zone is New York and the clock is fixed, so the UTC strings are the same on every machine.
vi.mock('~components', async () => {
  const { useConfig } = await import('../../../../../../contexts/ConfigContext')
  const { useLanguage } = await import('../../../../../../contexts/LanguageContext')
  const { useUtils } = await import('../../../../../../contexts/UtilsContext')
  return { useConfig, useLanguage, useUtils }
})

import { ConfigContext } from '../../../../../../contexts/ConfigContext'
import { UtilsProviders } from '../../../../../../contexts/UtilsContext'
import { SnoozeComponent } from '../index'
import { addHoursToApi, defaultUntil, formatApiUtc, isFutureUntil, localDayOf, parseApiUtc, untilToApi, zonedDayOf, zonedStampOf } from '../utils'

// 2026-10-10 12:20 in New York (EDT, UTC-4)
const NOW = '2026-10-10T16:20:00Z'
const NOW_PLUS_2H = '2026-10-10 18:20:00'

const stubMatchMedia = () => {
  window.matchMedia = vi.fn((query) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
}

const deferred = () => {
  let finish
  const promise = new Promise(resolve => { finish = resolve })
  return { promise, resolve: finish }
}

const renderSnooze = (over = {}, configs = {}) => {
  const props = {
    dataState: { id: 42, snooze_until: null },
    handleUpdate: vi.fn(async () => ({ ok: true })),
    setFormState: vi.fn(),
    handleChangeFormState: vi.fn(),
    formState: { changes: {} },
    onClose: vi.fn(),
    ...over
  }
  const view = render(
    <ConfigContext.Provider value={[{ configs }, async () => {}]}>
      <UtilsProviders>
        <SnoozeComponent {...props} />
      </UtilsProviders>
    </ConfigContext.Provider>
  )
  return { ...view, props }
}

const choose = async (user, name) => user.click(screen.getByRole('radio', { name }))
const primary = () => screen.getByRole('button', { name: /^(Snooze|End snooze)$/ })

const originalTZ = process.env.TZ

beforeEach(() => {
  process.env.TZ = 'America/New_York'
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(NOW) })
  expect(new Date(NOW).getTimezoneOffset()).toBe(240)
  stubMatchMedia()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete window.matchMedia
  document.getElementById('app-modals')?.remove()
  if (originalTZ === undefined) delete process.env.TZ
  else process.env.TZ = originalTZ
})

describe('SnoozeComponent · the body of the dialog', () => {
  it('names the options «Snooze for», lists Off and the durations, has no heading and preselects nothing', () => {
    renderSnooze({ dataState: { id: 42, snooze_until: '2026-10-11 22:50:00' } })
    const group = screen.getByRole('radiogroup', { name: 'Snooze for' })
    const names = within(group).getAllByRole('radio').map(radio => radio.getAttribute('aria-checked'))
    expect(within(group).getAllByRole('radio')).toHaveLength(7)
    expect(names.every(checked => checked === 'false')).toBe(true)
    ;['Off', '1 hour', '2 hours', '4 hours', '6 hours', '12 hours', 'Until…'].forEach(name => {
      expect(within(group).getByRole('radio', { name: new RegExp(`^${name}`) })).toBeInTheDocument()
    })
    expect(screen.queryByRole('heading')).toBeNull()
  })

  // J2 row 14 (stores-2-f-snooze D2): «Off» only when there is a snooze to end. A saved entity that is not snoozed has nothing to
  // turn off; as a field of a form (hideButtons, or an entity not created yet) it stays, to take back a value chosen before saving.
  it('a saved entity with no snooze (none, or one in the past) does not offer «Off»', () => {
    renderSnooze()
    expect(screen.getAllByRole('radio')).toHaveLength(6)
    expect(screen.queryByRole('radio', { name: /^Off/ })).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('keeps «Off» as a field of a form and for an entity that does not exist yet, snoozed or not', () => {
    const { unmount } = renderSnooze({ hideButtons: true })
    expect(screen.getByRole('radio', { name: /^Off/ })).toBeInTheDocument()
    unmount()
    renderSnooze({ dataState: {} })
    expect(screen.getByRole('radio', { name: /^Off/ })).toBeInTheDocument()
  })

  it('says when each duration ends, in the project time, and the day too when it is another day', () => {
    renderSnooze()
    expect(screen.getByRole('radio', { name: /^1 hour/ })).toHaveAccessibleDescription('until 13:20')
    expect(screen.getByRole('radio', { name: /^2 hours/ })).toHaveAccessibleDescription('until 14:20')
    expect(screen.getByRole('radio', { name: /^6 hours/ })).toHaveAccessibleDescription('until 18:20')
    const twelve = screen.getByRole('radio', { name: /^12 hours/ }).getAttribute('aria-describedby')
    const text = document.getElementById(twelve).textContent
    expect(text).toMatch(/^until .+00:20$/)
    expect(text).not.toBe('until 00:20')
  })

  it('writes the end of a duration in 12 hours when the project asks for it', () => {
    renderSnooze({}, { general_hour_format: { value: 'hh:mm a' }, format_time: { value: '12' } })
    expect(screen.getByRole('radio', { name: /^2 hours/ })).toHaveAccessibleDescription('until 02:20 PM')
  })

  // batch O, row 12: the hours of the options (parseDate, `format_time`) and the «Until…» selector (TimeField, which read
  // `general_hour_format` alone) used two different settings, so one dialog could say «until 02:20 PM» and offer a 24 h selector.
  // Snooze passes `is12Hours` from `format_time`, so both read the same one.
  describe('one hour format for the options and the selector (row 12)', () => {
    const hourText = () => screen.getByRole('combobox', { name: /Hours$/ }).selectedOptions[0].textContent
    const hourOptions = () => Array.from(screen.getByRole('combobox', { name: /Hours$/ }).options).map(option => option.textContent)

    it('format_time 12 with a general_hour_format that has no hh:mm: options and selector are both in 12 h', () => {
      renderSnooze({}, { general_hour_format: { value: 'HH:mm' }, format_time: { value: '12' } })
      expect(screen.getByRole('radio', { name: /^2 hours/ })).toHaveAccessibleDescription('until 02:20 PM')
      expect(hourText()).toBe('1 PM')
      expect(hourOptions()).toHaveLength(24)
      expect(hourOptions()[0]).toBe('12 AM')
      expect(hourOptions()[23]).toBe('11 PM')
    })

    it('format_time 24 with a general_hour_format that has hh:mm: options and selector are both in 24 h', () => {
      renderSnooze({}, { general_hour_format: { value: 'hh:mm a' }, format_time: { value: '24' } })
      expect(screen.getByRole('radio', { name: /^2 hours/ })).toHaveAccessibleDescription('until 14:20')
      expect(hourText()).toBe('13')
      expect(hourOptions()[0]).toBe('00')
      expect(hourOptions()[23]).toBe('23')
      expect(hourOptions().join(' ')).not.toMatch(/AM|PM/)
    })

    it('without format_time the project is in 24 h, even when general_hour_format has hh:mm', () => {
      renderSnooze({}, { general_hour_format: { value: 'hh:mm a' } })
      expect(screen.getByRole('radio', { name: /^2 hours/ })).toHaveAccessibleDescription('until 14:20')
      expect(hourText()).toBe('13')
    })

    it('the 12 h selector still sends the same instant: 1 PM to 6 PM tomorrow in New York is 22:00 UTC', async () => {
      const user = userEvent.setup()
      const { props } = renderSnooze({}, { general_hour_format: { value: 'HH:mm' }, format_time: { value: '12' } })
      await user.selectOptions(screen.getByRole('combobox', { name: /Hours$/ }), '18')
      await user.click(primary())
      await waitFor(() => expect(props.onClose).toHaveBeenCalled())
      expect(props.handleUpdate).toHaveBeenCalledWith({ snooze_until: '2026-10-11 22:00:00' }, { keepPendingChanges: true })
    })
  })

  it('recomputes the ends every minute and clears the interval on unmount', () => {
    const set = vi.spyOn(globalThis, 'setInterval')
    const clear = vi.spyOn(globalThis, 'clearInterval')
    const { unmount } = renderSnooze()
    const call = set.mock.calls.find(([, delay]) => delay === 60000)
    expect(call).toBeTruthy()
    vi.setSystemTime(new Date('2026-10-10T16:21:30Z'))
    act(() => { call[0]() })
    expect(screen.getByRole('radio', { name: /^1 hour/ })).toHaveAccessibleDescription('until 13:21')
    unmount()
    expect(clear).toHaveBeenCalled()
  })
})

describe('SnoozeComponent · status', () => {
  it('reads a future snooze_until as UTC and shows it in the project format, never ISO', () => {
    renderSnooze({ dataState: { id: 42, snooze_until: '2026-10-11 22:50:00' } })
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/^Snoozed until .*18:50$/)
    expect(status.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('shows nothing for a past or an empty snooze_until', () => {
    const { unmount } = renderSnooze({ dataState: { id: 42, snooze_until: '2026-10-10 16:19:59' } })
    expect(screen.queryByRole('status')).toBeNull()
    unmount()
    renderSnooze({ dataState: { id: 42, snooze_until: null } })
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('SnoozeComponent · saving an existing entity', () => {
  it('sends only snooze_until, keeps the pending changes, touches no form prop and closes on ok', async () => {
    const user = userEvent.setup()
    const { props } = renderSnooze()
    await choose(user, /^2 hours/)
    await user.click(primary())
    await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1))
    expect(props.handleUpdate).toHaveBeenCalledTimes(1)
    expect(props.handleUpdate).toHaveBeenCalledWith({ snooze_until: NOW_PLUS_2H }, { keepPendingChanges: true })
    expect(props.setFormState).not.toHaveBeenCalled()
    expect(props.handleChangeFormState).not.toHaveBeenCalled()
  })

  it('does the same with isAutomaticUpdate', async () => {
    const user = userEvent.setup()
    const { props } = renderSnooze({ isAutomaticUpdate: true })
    await choose(user, /^1 hour/)
    await user.click(primary())
    await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1))
    expect(props.handleUpdate).toHaveBeenCalledWith({ snooze_until: '2026-10-10 17:20:00' }, { keepPendingChanges: true })
    expect(props.setFormState).not.toHaveBeenCalled()
  })

  it('computes now + N hours when the primary is pressed, not when the option is chosen', async () => {
    const user = userEvent.setup()
    const { props } = renderSnooze()
    await choose(user, /^2 hours/)
    vi.setSystemTime(new Date('2026-10-10T16:50:00Z'))
    await user.click(primary())
    await waitFor(() => expect(props.handleUpdate).toHaveBeenCalled())
    expect(props.handleUpdate.mock.calls[0][0]).toEqual({ snooze_until: '2026-10-10 18:50:00' })
  })

  it('Off sends null and the primary reads «End snooze»', async () => {
    const user = userEvent.setup()
    const { props } = renderSnooze({ dataState: { id: 42, snooze_until: '2026-10-11 22:50:00' } })
    await choose(user, /^Off/)
    expect(screen.getByRole('button', { name: 'End snooze' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'End snooze' }))
    await waitFor(() => expect(props.onClose).toHaveBeenCalled())
    expect(props.handleUpdate).toHaveBeenCalledWith({ snooze_until: null }, { keepPendingChanges: true })
  })

  it('keeps the primary disabled until something is chosen; Cancel closes', async () => {
    const user = userEvent.setup()
    const { props } = renderSnooze()
    expect(primary()).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
    expect(props.handleUpdate).not.toHaveBeenCalled()
    await choose(user, /^4 hours/)
    expect(primary()).toBeEnabled()
  })

  it('is busy while it waits, not disabled, and a second click makes no second request', async () => {
    const user = userEvent.setup()
    const pending = deferred()
    const { props } = renderSnooze({ handleUpdate: vi.fn(() => pending.promise) })
    await choose(user, /^2 hours/)
    await user.click(primary())
    expect(primary()).toHaveAttribute('aria-busy', 'true')
    expect(primary()).not.toBeDisabled()
    expect(primary()).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
    await user.click(primary())
    expect(props.handleUpdate).toHaveBeenCalledTimes(1)
    await act(async () => { pending.resolve({ ok: true }) })
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('stays open with the choice, the focus and the translated API message when the save fails', async () => {
    const user = userEvent.setup()
    const { props } = renderSnooze({ handleUpdate: vi.fn(async () => ({ ok: false, error: ['Business not found'] })) })
    await choose(user, /^2 hours/)
    await user.click(primary())
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The snooze was not saved. Business not found')
    expect(props.onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('radio', { name: /^2 hours/ })).toHaveAttribute('aria-checked', 'true')
    expect(primary()).toHaveFocus()
    expect(primary()).not.toHaveAttribute('aria-busy')
    expect(primary()).toBeEnabled()
  })

  it.each([
    ['undefined', async () => undefined],
    ['a rejection', async () => { throw new Error('Network Error') }],
    ['ok: false without a message', async () => ({ ok: false })]
  ])('stays open with the generic alert when the controller answers %s', async (_name, handleUpdate) => {
    const user = userEvent.setup()
    const { props } = renderSnooze({ handleUpdate: vi.fn(handleUpdate) })
    await choose(user, /^2 hours/)
    await user.click(primary())
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('The snooze was not saved.')
    expect(props.onClose).not.toHaveBeenCalled()
    expect(primary()).toHaveFocus()
  })

  it('does not set state after it unmounted mid-request', async () => {
    const user = userEvent.setup()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const pending = deferred()
    const { props, unmount } = renderSnooze({ handleUpdate: vi.fn(() => pending.promise) })
    await choose(user, /^2 hours/)
    await user.click(primary())
    unmount()
    await act(async () => { pending.resolve({ ok: false, error: 'x' }) })
    expect(props.onClose).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })
})

describe('SnoozeComponent · Until…', () => {
  const pickDay = async (user, day) => {
    await user.click(screen.getByRole('combobox', { name: /^Date/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(dialog.querySelector(`[data-day="${day}"]`))
  }
  const pickHour = (user, hour) => user.selectOptions(screen.getByRole('combobox', { name: /Hours$/ }), String(hour))

  it('starts tomorrow at the next full hour, does not select «Until…» and keeps the primary disabled', () => {
    renderSnooze()
    expect(screen.getByRole('combobox', { name: /Hours$/ })).toHaveValue('13')
    expect(screen.getByRole('combobox', { name: /Minutes$/ })).toHaveValue('0')
    expect(screen.getByRole('radio', { name: /^Until…/ })).toHaveAttribute('aria-checked', 'false')
    expect(primary()).toBeDisabled()
  })

  it('changing the time selects «Until…» and sends that local time as UTC', async () => {
    const user = userEvent.setup()
    const { props } = renderSnooze()
    await pickHour(user, 18)
    expect(screen.getByRole('radio', { name: /^Until…/ })).toHaveAttribute('aria-checked', 'true')
    await user.click(primary())
    await waitFor(() => expect(props.onClose).toHaveBeenCalled())
    // tomorrow, Oct 11, 18:00 EDT
    expect(props.handleUpdate).toHaveBeenCalledWith({ snooze_until: '2026-10-11 22:00:00' }, { keepPendingChanges: true })
  })

  it('changing the day selects «Until…» too, and the day and the time are both sent', async () => {
    const user = userEvent.setup()
    const { props } = renderSnooze()
    await pickDay(user, '2026-10-14')
    expect(screen.getByRole('radio', { name: /^Until…/ })).toHaveAttribute('aria-checked', 'true')
    await pickHour(user, 9)
    await user.selectOptions(screen.getByRole('combobox', { name: /Minutes$/ }), '30')
    await user.click(primary())
    await waitFor(() => expect(props.onClose).toHaveBeenCalled())
    expect(props.handleUpdate).toHaveBeenCalledWith({ snooze_until: '2026-10-14 13:30:00' }, { keepPendingChanges: true })
  })

  it('offers no day before today', async () => {
    const user = userEvent.setup()
    renderSnooze()
    await user.click(screen.getByRole('combobox', { name: /^Date/ }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.querySelector('[data-day="2026-10-09"]')).toHaveAttribute('aria-disabled', 'true')
    expect(dialog.querySelector('[data-day="2026-10-10"]')).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('a past date and time shows the error on the time and disables the primary', async () => {
    const user = userEvent.setup()
    const { props } = renderSnooze()
    await pickDay(user, '2026-10-10')
    await pickHour(user, 8)
    expect(screen.getByText('Choose a time in the future.')).toBeInTheDocument()
    expect(primary()).toBeDisabled()
    await pickHour(user, 15)
    expect(screen.queryByText('Choose a time in the future.')).toBeNull()
    expect(primary()).toBeEnabled()
    expect(props.handleUpdate).not.toHaveBeenCalled()
  })
})

describe('SnoozeComponent · a field of someone else\'s form (hideButtons)', () => {
  it('draws no buttons and writes a duration at once, without a request', async () => {
    const user = userEvent.setup()
    const { props } = renderSnooze({ hideButtons: true })
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Snooze$/ })).toBeNull()
    await choose(user, /^1 hour/)
    expect(props.handleChangeFormState).toHaveBeenCalledWith({ snooze_until: '2026-10-10 17:20:00' })
    expect(props.handleUpdate).not.toHaveBeenCalled()
    expect(props.onClose).not.toHaveBeenCalled()
    const update = props.setFormState.mock.calls[0][0]
    expect(update({ changes: { name: 'x' }, other: 1 })).toEqual({ changes: { name: 'x', snooze_until: '2026-10-10 17:20:00' }, other: 1 })
  })

  it('writes Off as null and a complete future «Until…», and nothing for a past one', async () => {
    const user = userEvent.setup()
    const { props } = renderSnooze({ hideButtons: true })
    await choose(user, /^Off/)
    expect(props.handleChangeFormState).toHaveBeenLastCalledWith({ snooze_until: null })
    props.handleChangeFormState.mockClear()
    props.setFormState.mockClear()
    await user.selectOptions(screen.getByRole('combobox', { name: /Hours$/ }), '18')
    expect(props.handleChangeFormState).toHaveBeenCalledWith({ snooze_until: '2026-10-11 22:00:00' })
    props.handleChangeFormState.mockClear()
    props.setFormState.mockClear()
    await user.click(screen.getByRole('combobox', { name: /^Date/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(dialog.querySelector('[data-day="2026-10-10"]'))
    await waitFor(() => expect(props.handleChangeFormState).toHaveBeenCalledWith({ snooze_until: '2026-10-10 22:00:00' }))
    props.handleChangeFormState.mockClear()
    props.setFormState.mockClear()
    await user.selectOptions(screen.getByRole('combobox', { name: /Hours$/ }), '8')
    expect(props.handleChangeFormState).not.toHaveBeenCalled()
    expect(props.setFormState).not.toHaveBeenCalled()
  })

  it('works with only handleChangeFormState or only setFormState, as the consumers pass them', async () => {
    const user = userEvent.setup()
    const only = renderSnooze({ hideButtons: true, setFormState: undefined })
    await choose(user, /^2 hours/)
    expect(only.props.handleChangeFormState).toHaveBeenCalledWith({ snooze_until: NOW_PLUS_2H })
    only.unmount()
    const other = renderSnooze({ hideButtons: true, handleChangeFormState: undefined })
    await choose(user, /^2 hours/)
    expect(other.props.setFormState).toHaveBeenCalledTimes(1)
  })
})

describe('SnoozeComponent · an entity that does not exist yet', () => {
  it('writes through the form props when the primary is pressed, makes no request and closes', async () => {
    const user = userEvent.setup()
    const { props } = renderSnooze({ dataState: {} })
    await choose(user, /^2 hours/)
    expect(props.handleChangeFormState).not.toHaveBeenCalled()
    expect(props.setFormState).not.toHaveBeenCalled()
    await user.click(primary())
    expect(props.handleChangeFormState).toHaveBeenCalledWith({ snooze_until: NOW_PLUS_2H })
    expect(props.setFormState).toHaveBeenCalledTimes(1)
    expect(props.handleUpdate).not.toHaveBeenCalled()
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('works without a dataState at all', async () => {
    const user = userEvent.setup()
    const { props } = renderSnooze({ dataState: undefined })
    await choose(user, /^Off/)
    await user.click(screen.getByRole('button', { name: 'End snooze' }))
    expect(props.handleChangeFormState).toHaveBeenCalledWith({ snooze_until: null })
    expect(props.handleUpdate).not.toHaveBeenCalled()
  })
})

describe('snooze utils · UTC by parts', () => {
  it('reads the API value as UTC whatever the zone, and rejects what is not a date', () => {
    expect(parseApiUtc('2026-10-11 22:50:00')).toBe(Date.UTC(2026, 9, 11, 22, 50, 0))
    expect(parseApiUtc('2026-10-11 22:50')).toBe(Date.UTC(2026, 9, 11, 22, 50, 0))
    expect(parseApiUtc('')).toBeNull()
    expect(parseApiUtc(null)).toBeNull()
    expect(parseApiUtc('soon')).toBeNull()
  })

  it('writes UTC by parts as YYYY-MM-DD HH:mm:ss', () => {
    expect(formatApiUtc(new Date(Date.UTC(2026, 0, 2, 3, 4, 5)))).toBe('2026-01-02 03:04:05')
    expect(addHoursToApi(Date.parse(NOW), 12)).toBe('2026-10-11 04:20:00')
  })

  it('composes a local day and time and converts it to UTC (DST included)', () => {
    expect(untilToApi('2026-10-11', '18:0')).toBe('2026-10-11 22:00:00')
    expect(untilToApi('2026-11-02', '18:30')).toBe('2026-11-02 23:30:00') // EST after the clock change
    expect(untilToApi(null, '18:0')).toBeNull()
  })

  it('knows today, the default Until… and what is in the future', () => {
    expect(localDayOf(new Date(Date.parse(NOW)))).toBe('2026-10-10')
    expect(defaultUntil(Date.parse(NOW))).toEqual({ day: '2026-10-11', time: '13:0' })
    expect(defaultUntil(Date.parse('2026-10-11T03:30:00Z'))).toEqual({ day: '2026-10-12', time: '0:0' }) // 23:30 on Oct 10, local: tomorrow's next full hour is already Oct 12
    expect(isFutureUntil('2026-10-10', '12:21', Date.parse(NOW))).toBe(true)
    expect(isFutureUntil('2026-10-10', '12:20', Date.parse(NOW))).toBe(false)
    expect(isFutureUntil(null, '12:21', Date.parse(NOW))).toBe(false)
  })
})

// redesign bugs C: the store editor's dialog reads and writes the times in the store's zone (the Overview's), and says
// which one. The browser here is in New York (12:20 EDT); the store is in Bogotá (UTC-5, no DST): 11:20 there.
describe('SnoozeComponent · in the store\'s time zone (timeZone)', () => {
  const BOGOTA = 'America/Bogota'
  const pickHour = (user, hour) => user.selectOptions(screen.getByRole('combobox', { name: /Hours$/ }), String(hour))

  it('names the zone the times are in', () => {
    renderSnooze({ timeZone: BOGOTA })
    expect(screen.getByText("Times are in the store's time zone (America/Bogota).")).toBeInTheDocument()
  })

  it('says when each duration ends in the store\'s clock', () => {
    renderSnooze({ timeZone: BOGOTA })
    expect(screen.getByRole('radio', { name: /^1 hour/ })).toHaveAccessibleDescription('until 12:20')
    expect(screen.getByRole('radio', { name: /^2 hours/ })).toHaveAccessibleDescription('until 13:20')
  })

  it('reads the current snooze in the store\'s clock', () => {
    renderSnooze({ timeZone: BOGOTA, dataState: { id: 42, snooze_until: '2026-10-11 22:50:00' } })
    expect(screen.getByRole('status')).toHaveTextContent(/^Snoozed until .*17:50$/)
  })

  it('«Until…» starts tomorrow at the next full hour of the store and sends the store\'s time as UTC', async () => {
    const user = userEvent.setup()
    const { props } = renderSnooze({ timeZone: BOGOTA })
    expect(screen.getByRole('combobox', { name: /Hours$/ })).toHaveValue('12')
    await pickHour(user, 18)
    await user.click(primary())
    await waitFor(() => expect(props.onClose).toHaveBeenCalled())
    // tomorrow, Oct 11, 18:00 in Bogotá = 23:00 UTC (the browser's 18:00 would be 22:00 UTC)
    expect(props.handleUpdate).toHaveBeenCalledWith({ snooze_until: '2026-10-11 23:00:00' }, { keepPendingChanges: true })
  })

  it('a time already past in the store\'s clock is refused, one still to come is not', async () => {
    const user = userEvent.setup()
    renderSnooze({ timeZone: BOGOTA })
    await user.click(screen.getByRole('combobox', { name: /^Date/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(dialog.querySelector('[data-day="2026-10-10"]'))
    // 11:00 is past in Bogotá (11:20) though not 12:00 in New York; 12:00 is still to come there
    await pickHour(user, 11)
    expect(screen.getByText('Choose a time in the future.')).toBeInTheDocument()
    await pickHour(user, 12)
    expect(screen.queryByText('Choose a time in the future.')).toBeNull()
  })

  it('an unknown zone falls back to the browser\'s clock and names none', () => {
    renderSnooze({ timeZone: 'Mars/Olympus' })
    expect(screen.getByRole('radio', { name: /^2 hours/ })).toHaveAccessibleDescription('until 14:20')
    expect(screen.queryByText(/store's time zone/)).toBeNull()
  })

  it('without timeZone nothing changes (products, options, zones, categories)', () => {
    renderSnooze()
    expect(screen.getByRole('radio', { name: /^2 hours/ })).toHaveAccessibleDescription('until 14:20')
    expect(screen.queryByText(/store's time zone/)).toBeNull()
  })

  it('the zoned helpers: wall clock, day, instant (DST included) and the default «Until…»', () => {
    const now = Date.parse(NOW)
    expect(zonedStampOf(now, BOGOTA)).toBe('2026-10-10 11:20:00')
    expect(zonedDayOf(now, BOGOTA)).toBe('2026-10-10')
    expect(zonedDayOf(Date.parse('2026-10-11T03:00:00Z'), BOGOTA)).toBe('2026-10-10')
    expect(untilToApi('2026-10-11', '18:0', BOGOTA)).toBe('2026-10-11 23:00:00')
    // Madrid leaves summer time on Oct 25, 2026: 10:00 is UTC+2 the day before and UTC+1 the day after
    expect(untilToApi('2026-10-24', '10:0', 'Europe/Madrid')).toBe('2026-10-24 08:00:00')
    expect(untilToApi('2026-10-26', '10:0', 'Europe/Madrid')).toBe('2026-10-26 09:00:00')
    expect(defaultUntil(now, BOGOTA)).toEqual({ day: '2026-10-11', time: '12:0' })
    expect(isFutureUntil('2026-10-10', '11:0', now, BOGOTA)).toBe(false)
    expect(isFutureUntil('2026-10-10', '12:0', now, BOGOTA)).toBe(true)
  })
})

describe('SnoozeComponent · the source', () => {
  const dir = path.join(__dirname, '..')
  const source = ['index.js', 'utils.js'].map(file => readFileSync(path.join(dir, file), 'utf8')).join('\n')

  it('uses none of the legacy pieces and no ISO helper', () => {
    ;['styled-components', 'react-datepicker', 'react-date-range', "from 'moment'", 'react-bootstrap-icons', './styles', 'toISOString'].forEach(word => {
      expect(source).not.toContain(word)
    })
  })

  it('styles itself with tokens only', () => {
    const css = readFileSync(path.join(dir, 'snooze.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*/g, '')
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(css).not.toMatch(/\d(px|rem|em)\b/)
    expect(css).toContain('odc-snooze')
  })
})
