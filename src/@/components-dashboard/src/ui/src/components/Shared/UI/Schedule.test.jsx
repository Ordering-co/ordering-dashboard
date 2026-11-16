/* eslint-disable import/first */
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const runtime = vi.hoisted(() => ({
  controllerProps: null,
  hourFormat: 'HH:mm',
  parseDate: null
}))

vi.mock('../../../../../index', () => ({
  Schedule: ({ UIComponent, ...props }) => {
    runtime.controllerProps = { ...props, UIComponent }
    return <UIComponent {...props} />
  },
  useConfig: () => [{ configs: { general_hour_format: { value: runtime.hourFormat } } }],
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useUtils: () => [{ parseDate: (...args) => runtime.parseDate(...args) }]
}))

vi.mock('../../../styles/Select', () => ({
  Select: props => (
    <button
      type='button'
      data-testid='schedule-time-select'
      data-options={props.options.length}
      data-option-zero={props.options[0]?.content?.props?.children}
      data-option-thirteen={props.options[13]?.content?.props?.children}
      data-value={props.defaultValue}
      onClick={() => props.onChange(7)}
    >
      {props.defaultValue}
    </button>
  )
}))

vi.mock('../Confirm', () => ({
  Alert: props => props.open
    ? (
      <div role='alertdialog' data-testid='schedule-alert'>
        <span>{props.content?.join(' ')}</span>
        <button type='button' onClick={props.onAccept}>{props.acceptText}</button>
      </div>
      )
    : null,
  Confirm: props => props.open
    ? (
      <div role='dialog' data-testid='schedule-confirm'>
        <span>{props.content}</span>
        <button type='button' onClick={props.onAccept}>{props.acceptText}</button>
        <button type='button' onClick={props.onCancel}>Cancel confirm</button>
      </div>
      )
    : null
}))

import { Schedule } from './Schedule'
import { ScheduleCopyTimes } from './ScheduleCopyTimes'

const lightTheme = createDashboardTheme(theme)
const rtlDarkTheme = { ...createDashboardTheme(theme, { mode: 'dark' }), rtl: true }
const renderWithTheme = (content, currentTheme = lightTheme) => render(
  <ThemeProvider theme={currentTheme}>{content}</ThemeProvider>
)

const lapse = (openHour, openMinute, closeHour, closeMinute) => ({
  open: { hour: openHour, minute: openMinute },
  close: { hour: closeHour, minute: closeMinute }
})

const scheduleState = () => [
  { enabled: true, lapses: [lapse(9, 0, 10, 0), lapse(12, 0, 13, 0)] },
  { enabled: true, lapses: [lapse(8, 30, 9, 30)] },
  { enabled: false, lapses: [lapse(9, 0, 10, 0)] },
  { enabled: true, lapses: [lapse(9, 0, 10, 0)] },
  { enabled: true, lapses: [lapse(9, 0, 10, 0)] },
  { enabled: true, lapses: [lapse(9, 0, 10, 0)] },
  { enabled: true, lapses: [lapse(9, 0, 10, 0)] }
]

const createScheduleProps = overrides => ({
  addScheduleTime: lapse(14, 15, 15, 45),
  cleanSelectedCopyDays: vi.fn(),
  handleAddSchedule: vi.fn(),
  handleApplyScheduleCopyTimes: vi.fn(),
  handleChangeAddScheduleTime: vi.fn(),
  handleChangeScheduleTime: vi.fn(),
  handleDeleteSchedule: vi.fn(),
  handleEnabledSchedule: vi.fn(),
  handleOpenAddSchedule: vi.fn(),
  handleSelectCopyTimes: vi.fn(),
  isConflict: false,
  isShowDate: false,
  isTimeChangeError: false,
  openAddSchedule: Array(7).fill(false),
  scheduleState: scheduleState(),
  selectedCopyDays: [],
  setIsConflict: vi.fn(),
  setIsTimeChangeError: vi.fn(),
  ...overrides
})

beforeEach(() => {
  runtime.controllerProps = null
  runtime.hourFormat = 'HH:mm'
  runtime.parseDate = vi.fn(() => '2026-09-14')
})

describe('L2d-C8 Schedule', () => {
  it('keeps controller wiring, numeric time payloads, enable payloads, and 24h/12h option refs', () => {
    const props = createScheduleProps({ scheduleMarker: 'forwarded' })
    const rendered = renderWithTheme(<Schedule {...props} />)
    rendered.rerender(<ThemeProvider theme={lightTheme}><Schedule {...props} /></ThemeProvider>)

    expect(runtime.controllerProps.scheduleMarker).toBe('forwarded')
    expect(runtime.controllerProps.UIComponent).toEqual(expect.any(Function))
    const root = document.querySelector('[data-slot="schedule"]')
    expect(root).toHaveAttribute('dir', 'ltr')
    expect(document.querySelector('[data-slot="schedule-day"][data-day="0"]')).toBeInTheDocument()
    expect(document.querySelector('[data-slot="schedule-lapse"][data-lapse="1"]')).toBeInTheDocument()

    const openHour = screen.getByRole('group', { name: 'Sunday Open Hour 1' })
    const hourSelect = within(openHour).getByTestId('schedule-time-select')
    expect(openHour).toHaveAttribute('data-boundary', 'open')
    expect(openHour).toHaveAttribute('data-unit', 'hour')
    expect(hourSelect).toHaveAttribute('data-options', '24')
    expect(hourSelect).toHaveAttribute('data-option-zero', '00')
    expect(hourSelect).toHaveAttribute('data-option-thirteen', '13')
    fireEvent.click(hourSelect)
    expect(props.handleChangeScheduleTime).toHaveBeenCalledWith(7, 0, 0, true, 'hour')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Schedule: Sunday' }))
    expect(props.handleEnabledSchedule).toHaveBeenCalledWith(0, false)

    runtime.hourFormat = 'hh:mm A'
    rendered.rerender(<ThemeProvider theme={lightTheme}><Schedule {...props} /></ThemeProvider>)
    rendered.rerender(<ThemeProvider theme={lightTheme}><Schedule {...props} /></ThemeProvider>)
    const twelveHour = within(screen.getByRole('group', { name: 'Sunday Open Hour 1' })).getByTestId('schedule-time-select')
    expect(twelveHour).toHaveAttribute('data-option-zero', '12 AM')
    expect(twelveHour).toHaveAttribute('data-option-thirteen', '1 PM')
    expect(within(screen.getByRole('group', { name: 'Sunday Open Minute 1' })).getByTestId('schedule-time-select')).toHaveAttribute('data-options', '60')
  })

  it('keeps disableSchedule selectors editable while hiding enable and action controls', () => {
    const props = createScheduleProps({ disableSchedule: true, isShowDate: true })
    const rendered = renderWithTheme(<Schedule {...props} />, rtlDarkTheme)
    rendered.rerender(<ThemeProvider theme={rtlDarkTheme}><Schedule {...props} /></ThemeProvider>)

    const root = document.querySelector('[data-slot="schedule"]')
    expect(root).toHaveAttribute('dir', 'rtl')
    expect(getComputedStyle(root).getPropertyValue('--od-entity-selector-surface')).toBe(rtlDarkTheme.ordering.semantic.surface.default)
    expect(screen.queryByRole('checkbox', { name: 'Schedule: Sunday' })).not.toBeInTheDocument()
    expect(document.querySelectorAll('[data-schedule-action]')).toHaveLength(0)
    const openMinute = within(screen.getByRole('group', { name: 'Sunday Open Minute 1' })).getByTestId('schedule-time-select')
    fireEvent.click(openMinute)
    expect(props.handleChangeScheduleTime).toHaveBeenCalledWith(7, 0, 0, true, 'minute')
    expect(runtime.parseDate).toHaveBeenCalledWith(expect.any(Date), { outputFormat: 'YYYY-MM-DD' })
    expect(screen.getAllByText('2026-09-14')).toHaveLength(7)
  })

  it('keeps manual-add, delete-confirm, conflict-alert, and unavailable branches distinct', async () => {
    const props = createScheduleProps({
      isConflict: true,
      openAddSchedule: [true, false, false, false, false, false, false]
    })
    const rendered = renderWithTheme(<Schedule {...props} />)
    rendered.rerender(<ThemeProvider theme={lightTheme}><Schedule {...props} /></ThemeProvider>)

    expect(screen.getByText('Unavailable')).toBeInTheDocument()
    const manualOpenHour = screen.getByRole('group', { name: 'Sunday Open Hour' })
    expect(manualOpenHour).toHaveAttribute('data-lapse', 'manual')
    fireEvent.click(within(manualOpenHour).getByTestId('schedule-time-select'))
    expect(props.handleChangeAddScheduleTime).toHaveBeenCalledWith(7, true, 'hour')
    fireEvent.click(screen.getByRole('button', { name: 'Apply Schedule: Sunday' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Schedule: Sunday' }))
    expect(props.handleAddSchedule).toHaveBeenCalledWith(0)
    expect(props.handleOpenAddSchedule).toHaveBeenCalledWith(null)

    fireEvent.click(screen.getByRole('button', { name: 'Delete Schedule: Sunday 1' }))
    const confirm = screen.getByTestId('schedule-confirm')
    expect(confirm).toHaveTextContent('Are you sure to delete this Schedule?')
    fireEvent.click(within(confirm).getByRole('button', { name: 'Accept' }))
    expect(props.handleDeleteSchedule).toHaveBeenCalledWith(0, 0)

    const alert = await screen.findByTestId('schedule-alert')
    expect(alert).toHaveTextContent('There is an schedule conflict')
    fireEvent.click(within(alert).getByRole('button', { name: 'Accept' }))
    expect(props.setIsConflict).toHaveBeenCalledWith(false)
    expect(props.setIsTimeChangeError).toHaveBeenCalledWith(false)

    rendered.rerender(
      <ThemeProvider theme={lightTheme}>
        <Schedule {...props} isConflict={false} isTimeChangeError />
      </ThemeProvider>
    )
    expect(await screen.findByTestId('schedule-alert')).toHaveTextContent('Choose an end time later than the start time.')
  })

  it('keeps ordinary add and copy actions named and form-safe', async () => {
    const user = userEvent.setup()
    const props = createScheduleProps()
    renderWithTheme(
      <form>
        <Schedule {...props} />
      </form>
    )

    const add = screen.getByRole('button', { name: 'Add Schedule: Sunday' })
    const copy = screen.getByRole('button', { name: 'Copy times to: Sunday' })
    expect(add).toHaveAttribute('type', 'button')
    expect(copy).toHaveAttribute('type', 'button')
    await user.click(add)
    expect(props.handleAddSchedule).toHaveBeenCalledWith(0)
    await user.click(copy)
    expect(await screen.findByRole('dialog', { name: 'Copy times to' })).toBeInTheDocument()
    expect(props.cleanSelectedCopyDays).toHaveBeenCalledOnce()
  })

  // P-T1: schedule.css styled the actions container as `.od-ui:where(.od-schedule-actions)` but the container never got
  // `od-ui`, so none of its rules applied and the add and copy buttons stacked in a column.
  it('applies the schedule.css rules to the actions container so add and copy sit in one row', () => {
    renderWithTheme(<Schedule {...createScheduleProps()} />)
    const css = readFileSync(path.join(__dirname, 'schedule.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    const rules = [...css.matchAll(/([^{}@][^{}]*)\{([^{}]*)\}/g)].map(([, selector, body]) => ({ selectors: selector.split(','), body }))
    const matching = (element) => rules
      .filter(rule => rule.selectors.some(selector => { try { return element.matches(selector.trim()) } catch (_) { return false } }))
      .map(rule => rule.body)
      .join(';')

    const actions = document.querySelector('[data-day="0"] .od-schedule-actions')
    expect(actions).toBeInTheDocument()
    expect(within(actions).getByRole('button', { name: 'Add Schedule: Sunday' })).toBeInTheDocument()
    expect(within(actions).getByRole('button', { name: 'Copy times to: Sunday' })).toBeInTheDocument()
    const body = matching(actions)
    expect(body).toMatch(/@apply[^;]*\bod-flex\b[^;]*\bod-items-center\b|display:\s*flex/)
    expect(body).toMatch(/margin-inline-start:\s*auto/)
    // its buttons keep the governed touch target
    expect(matching(within(actions).getByRole('button', { name: 'Add Schedule: Sunday' }))).toMatch(/min-height:\s*var\(--od-entity-selector-touch-target\)/)
  })
})

describe('L2d-C8 ScheduleCopyTimes', () => {
  const createCopyProps = overrides => ({
    cleanSelectedCopyDays: vi.fn(),
    daysOfWeekIndex: 0,
    disabled: false,
    handleApplyScheduleCopyTimes: vi.fn(),
    handleSelectDays: vi.fn(),
    label: 'Copy times to: Sunday',
    onClick: vi.fn(),
    onClose: vi.fn(),
    open: true,
    selectedCopyDays: [],
    ...overrides
  })

  it('cleans on open, disables the checked source, selects destinations, then applies before closing', async () => {
    const user = userEvent.setup()
    const props = createCopyProps()
    const rendered = renderWithTheme(<ScheduleCopyTimes {...props} />)

    expect(props.cleanSelectedCopyDays).toHaveBeenCalledOnce()
    const trigger = screen.getByRole('button', { name: 'Copy times to: Sunday' })
    const dialog = screen.getByRole('dialog', { name: 'Copy times to' })
    expect(trigger).toHaveAttribute('aria-controls', dialog.id)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(dialog).toHaveAttribute('data-slot', 'schedule-copy-popover')
    expect(dialog.querySelectorAll('.od-schedule-copy-day')).toHaveLength(7)
    const source = within(dialog).getByRole('button', { name: 'Sunday' })
    const monday = within(dialog).getByRole('button', { name: 'Monday' })
    expect(source).toBeDisabled()
    expect(source).toHaveAttribute('aria-pressed', 'true')
    expect(source).toHaveAttribute('data-copy-source', '')
    await user.click(source)
    expect(props.handleSelectDays).not.toHaveBeenCalled()
    await user.click(monday)
    expect(props.handleSelectDays).toHaveBeenCalledWith(1)

    rendered.rerender(
      <ThemeProvider theme={lightTheme}>
        <ScheduleCopyTimes {...props} selectedCopyDays={[1]} />
      </ThemeProvider>
    )
    expect(screen.getByRole('button', { name: 'Monday' })).toHaveAttribute('aria-pressed', 'true')
    const apply = screen.getByRole('button', { name: 'Apply' })
    expect(apply).toHaveAttribute('type', 'button')
    await user.click(apply)
    expect(props.handleApplyScheduleCopyTimes).toHaveBeenCalledWith(0)
    expect(props.onClose).toHaveBeenCalledOnce()
    expect(props.handleApplyScheduleCopyTimes.mock.invocationCallOrder[0]).toBeLessThan(props.onClose.mock.invocationCallOrder[0])
  })

  it('closes only its popup on captured Escape, restores trigger focus, and handles outside mouseup', () => {
    const props = createCopyProps()
    const parentEscape = vi.fn()
    document.addEventListener('keydown', parentEscape, true)
    renderWithTheme(<ScheduleCopyTimes {...props} />)

    const trigger = screen.getByRole('button', { name: 'Copy times to: Sunday' })
    const dialog = screen.getByRole('dialog', { name: 'Copy times to' })
    fireEvent.keyDown(dialog, { key: 'Escape', keyCode: 27 })
    expect(props.onClose).toHaveBeenCalledOnce()
    expect(parentEscape).not.toHaveBeenCalled()
    expect(trigger).toHaveFocus()
    document.removeEventListener('keydown', parentEscape, true)

    props.onClose.mockClear()
    fireEvent.mouseUp(dialog)
    expect(props.onClose).not.toHaveBeenCalled()
    fireEvent.mouseUp(document.body)
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('keeps closed and disabled copy triggers inert while reopening clears selection again', async () => {
    const user = userEvent.setup()
    const props = createCopyProps({ disabled: true, open: false })
    const rendered = renderWithTheme(<ScheduleCopyTimes {...props} />)
    const trigger = screen.getByRole('button', { name: 'Copy times to: Sunday' })
    expect(trigger).toBeDisabled()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).not.toHaveAttribute('aria-controls')
    await user.click(trigger)
    expect(props.onClick).not.toHaveBeenCalled()
    expect(props.cleanSelectedCopyDays).not.toHaveBeenCalled()

    rendered.rerender(
      <ThemeProvider theme={lightTheme}>
        <ScheduleCopyTimes {...props} disabled={false} open />
      </ThemeProvider>
    )
    await waitFor(() => expect(props.cleanSelectedCopyDays).toHaveBeenCalledOnce())
  })

  it('clamps right and left overflow from physical bounds independently of RTL', () => {
    const originalInnerWidth = window.innerWidth
    const originalScrollX = window.scrollX
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 })
    const props = createCopyProps()
    const rendered = renderWithTheme(<ScheduleCopyTimes {...props} />, rtlDarkTheme)
    const dialog = screen.getByRole('dialog', { name: 'Copy times to' })
    Object.defineProperty(dialog, 'offsetLeft', { configurable: true, value: 0 })
    Object.defineProperty(dialog, 'offsetWidth', { configurable: true, value: 250 })

    Object.defineProperty(window, 'scrollX', { configurable: true, value: 100 })
    dialog.getBoundingClientRect = () => ({
      bottom: 400,
      height: 300,
      left: 10,
      right: 260,
      top: 100,
      width: 250,
      x: 10,
      y: 100,
      toJSON: () => ({})
    })
    fireEvent(window, new Event('resize'))
    expect(dialog.style.left).toBe('')
    expect(dialog.style.right).toBe('')

    Object.defineProperty(window, 'scrollX', { configurable: true, value: -31 })
    dialog.getBoundingClientRect = () => ({
      bottom: 400,
      height: 300,
      left: 0,
      right: 250,
      top: 100,
      width: 250,
      x: 0,
      y: 100,
      toJSON: () => ({})
    })
    fireEvent(window, new Event('resize'))
    expect(dialog.style.left).toBe('31px')
    expect(dialog.style.right).toBe('auto')

    Object.defineProperty(window, 'scrollX', { configurable: true, value: 0 })
    dialog.getBoundingClientRect = () => ({
      bottom: 400,
      height: 300,
      left: 251,
      right: 501,
      top: 100,
      width: 250,
      x: 251,
      y: 100,
      toJSON: () => ({})
    })
    fireEvent(window, new Event('resize'))
    expect(dialog.style.left).toBe('-181px')
    expect(dialog.style.right).toBe('auto')

    rendered.rerender(<ThemeProvider theme={lightTheme}><ScheduleCopyTimes {...props} /></ThemeProvider>)
    dialog.getBoundingClientRect = () => ({
      bottom: 400,
      height: 300,
      left: -60,
      right: 190,
      top: 100,
      width: 250,
      x: -60,
      y: 100,
      toJSON: () => ({})
    })
    fireEvent(window, new Event('resize'))
    expect(dialog.style.left).toBe('60px')
    expect(dialog.style.right).toBe('auto')
    Object.defineProperty(window, 'scrollX', { configurable: true, value: originalScrollX })
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth })
  })
})
