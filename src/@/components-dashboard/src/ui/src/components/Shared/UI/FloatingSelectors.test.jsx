/* eslint-disable import/first */
import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const runtime = vi.hoisted(() => ({ level: 0 }))

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: runtime.level } }]
}))

vi.mock('react-popper', () => ({
  usePopper: () => ({
    attributes: { popper: { 'data-popper-placement': 'bottom-end' } },
    styles: { popper: { position: 'fixed' } },
    update: vi.fn()
  })
}))

vi.mock('react-color', () => ({
  SketchPicker: ({ color, onChange, styles }) => (
    <div
      data-testid='sketch-picker'
      data-color={color}
      data-default-hue={styles.default.hue.height}
      data-disabled-hue={styles.disableAlpha.hue.height}
    >
      <button type='button' onClick={() => typeof onChange === 'function' && onChange({ hex: '#aa0000' })}>First color</button>
      <button type='button' onClick={() => typeof onChange === 'function' && onChange({ hex: '#00aa00' })}>Last color</button>
    </div>
  )
}))

vi.mock('react-date-range', () => ({
  Calendar: ({ ariaLabels, date, minDate, onChange }) => (
    <div
      data-testid='single-widget'
      data-date={date?.toISOString()}
      data-min={minDate?.toISOString()}
      data-month-label={ariaLabels.monthPicker}
      data-year-label={ariaLabels.yearPicker}
      data-prev-label={ariaLabels.prevButton}
      data-next-label={ariaLabels.nextButton}
    >
      <button type='button' onClick={() => onChange(new Date(2024, 5, 18, 0, 0, 0))}>Choose single</button>
    </div>
  ),
  DateRange: ({ ariaLabels, minDate, onChange, ranges }) => (
    <div
      data-testid='range-widget'
      data-start={ranges[0].startDate?.toISOString()}
      data-min={minDate?.toISOString()}
      data-start-label={ariaLabels.dateInput.selection.startDate}
      data-end-label={ariaLabels.dateInput.selection.endDate}
    >
      <button
        type='button'
        onClick={() => onChange({
          selection: {
            startDate: new Date(2024, 5, 18, 0, 0, 0),
            endDate: new Date(2024, 5, 19, 0, 0, 0),
            key: 'selection'
          }
        })}
      >
        Choose range
      </button>
    </div>
  )
}))

import { ColorPicker } from './ColorPicker'
import { ColumnAllowSettingPopover } from './ColumnAllowSettingPopover'
import { LearnDropDown } from './LearnDropDown'
import { RangeCalendar } from './RangeCalendar'
import * as colorStyles from './color-picker-styles'
import * as columnStyles from './column-allow-setting-popover-styles'
import * as learnStyles from './learn-drop-down-styles'
import * as rangeStyles from './range-calendar-styles'
// Copy decision 4 (user, 2026-10-06): shared labels in sentence case; only the names these tests look up changed.

const currentTheme = createDashboardTheme(theme)
const renderWithTheme = content => render(<ThemeProvider theme={currentTheme}>{content}</ThemeProvider>)

afterEach(() => {
  runtime.level = 0
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('C4 shared floating selectors', () => {
  it('keeps ColorPicker debounce, default sync, disabled toggle and scoped Escape', () => {
    vi.useFakeTimers()
    const onChangeColor = vi.fn()
    const parentDismiss = vi.fn()
    document.addEventListener('keydown', parentDismiss, true)
    const rendered = renderWithTheme(<ColorPicker defaultColor='#112233' onChangeColor={onChangeColor} />)

    const trigger = screen.getByRole('button', { name: 'Select color' })
    expect(trigger).toHaveAttribute('type', 'button')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('sketch-picker')).toHaveAttribute('data-color', '#112233')
    expect(screen.getByTestId('sketch-picker')).toHaveAttribute('data-default-hue', 'var(--od-color-picker-slider-height)')
    expect(screen.getByTestId('sketch-picker')).toHaveAttribute('data-disabled-hue', 'var(--od-color-picker-slider-height)')
    fireEvent.click(screen.getByRole('button', { name: 'First color' }))
    act(() => vi.advanceTimersByTime(400))
    fireEvent.click(screen.getByRole('button', { name: 'Last color' }))
    act(() => vi.advanceTimersByTime(749))
    expect(onChangeColor).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onChangeColor).toHaveBeenCalledOnce()
    expect(onChangeColor).toHaveBeenCalledWith('#00aa00')

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Select color' }), { key: 'Escape', code: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Select color' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(parentDismiss).not.toHaveBeenCalled()
    document.removeEventListener('keydown', parentDismiss, true)

    // redesign bugs F row 43: disabling never opens the picker by itself (it used to toggle it open on every change of
    // isDisabled); the three rerenders below used to expect «open, open, closed» and now expect «closed» every time.
    rendered.rerender(<ThemeProvider theme={currentTheme}><ColorPicker defaultColor='#663399' isDisabled onChangeColor={onChangeColor} /></ThemeProvider>)
    expect(screen.queryByRole('dialog', { name: 'Select color' })).not.toBeInTheDocument()
    rendered.rerender(<ThemeProvider theme={currentTheme}><ColorPicker defaultColor='#663399' isDisabled={false} onChangeColor={onChangeColor} /></ThemeProvider>)
    expect(screen.queryByRole('dialog', { name: 'Select color' })).not.toBeInTheDocument()
    rendered.rerender(<ThemeProvider theme={currentTheme}><ColorPicker defaultColor='#663399' isDisabled onChangeColor={onChangeColor} /></ThemeProvider>)
    expect(screen.queryByRole('dialog', { name: 'Select color' })).not.toBeInTheDocument()
  })

  // redesign bugs F row 43: isDisabled used to toggle the picker open on mount and on every change.
  it('ColorPicker mounted disabled stays closed and becoming disabled closes an open picker', () => {
    const rendered = renderWithTheme(<ColorPicker defaultColor='#112233' isDisabled onChangeColor={vi.fn()} />)
    expect(screen.queryByRole('dialog', { name: 'Select color' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select color' })).toHaveAttribute('aria-expanded', 'false')
    rendered.rerender(<ThemeProvider theme={currentTheme}><ColorPicker defaultColor='#112233' isDisabled={false} onChangeColor={vi.fn()} /></ThemeProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Select color' }))
    expect(screen.getByRole('dialog', { name: 'Select color' })).toBeInTheDocument()
    rendered.rerender(<ThemeProvider theme={currentTheme}><ColorPicker defaultColor='#112233' isDisabled onChangeColor={vi.fn()} /></ThemeProvider>)
    expect(screen.queryByRole('dialog', { name: 'Select color' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select color' })).toHaveAttribute('aria-expanded', 'false')
  })

  // a Save pressed within 750 ms of picking saved the old color and still said «Settings updated». The picked color is
  // handed over as soon as the pointer or the focus goes outside the picker (before the Save click runs) and when it closes. An
  // unmount still cancels it: Discard remounts the field to drop a pending color (Stores/BusinessBrandGENDetail, auditor 14).
  describe('ColorPicker hands over a pending color', () => {
    const mountWithSave = (onChangeColor, onSave = vi.fn()) => {
      const rendered = renderWithTheme(
        <div>
          <ColorPicker defaultColor='#112233' onChangeColor={onChangeColor} />
          <button type='button' onClick={onSave}>Save</button>
        </div>
      )
      fireEvent.click(screen.getByRole('button', { name: 'Select color' }))
      fireEvent.click(screen.getByRole('button', { name: 'Last color' }))
      return rendered
    }

    it('a pointer press outside hands it over before the click, once', () => {
      vi.useFakeTimers()
      const onChangeColor = vi.fn()
      const onSave = vi.fn(() => expect(onChangeColor).toHaveBeenCalledWith('#00aa00'))
      mountWithSave(onChangeColor, onSave)
      expect(onChangeColor).not.toHaveBeenCalled()
      const save = screen.getByRole('button', { name: 'Save' })
      fireEvent.pointerDown(save)
      expect(onChangeColor).toHaveBeenCalledOnce()
      fireEvent.click(save)
      expect(onSave).toHaveBeenCalledOnce()
      act(() => vi.advanceTimersByTime(1000))
      expect(onChangeColor).toHaveBeenCalledOnce()
    })

    it('moving the focus outside (Tab to Save) hands it over', () => {
      vi.useFakeTimers()
      const onChangeColor = vi.fn()
      mountWithSave(onChangeColor)
      act(() => screen.getByRole('button', { name: 'Save' }).focus())
      expect(onChangeColor).toHaveBeenCalledWith('#00aa00')
    })

    it('a press inside the picker keeps waiting (a drag goes on)', () => {
      vi.useFakeTimers()
      const onChangeColor = vi.fn()
      mountWithSave(onChangeColor)
      fireEvent.pointerDown(screen.getByTestId('sketch-picker'))
      expect(onChangeColor).not.toHaveBeenCalled()
      act(() => vi.advanceTimersByTime(750))
      expect(onChangeColor).toHaveBeenCalledOnce()
    })

    it('closing with Escape hands it over', () => {
      vi.useFakeTimers()
      const onChangeColor = vi.fn()
      mountWithSave(onChangeColor)
      fireEvent.keyDown(screen.getByRole('dialog', { name: 'Select color' }), { key: 'Escape', code: 'Escape' })
      expect(onChangeColor).toHaveBeenCalledWith('#00aa00')
    })

    it('an unmount still cancels it (Discard remounts the field)', () => {
      vi.useFakeTimers()
      const onChangeColor = vi.fn()
      const rendered = mountWithSave(onChangeColor)
      rendered.unmount()
      act(() => vi.advanceTimersByTime(1000))
      expect(onChangeColor).not.toHaveBeenCalled()
    })
  })

  it('keeps ColumnAllowSettingPopover local, scalar and map-compatible with no-submit actions', () => {
    const handleChangeAllowColumns = vi.fn()
    const onOpenChange = vi.fn()
    const submit = vi.fn(event => event.preventDefault())
    const parentDismiss = vi.fn()
    document.addEventListener('keydown', parentDismiss, true)
    renderWithTheme(
      <form onSubmit={submit}>
        <ColumnAllowSettingPopover
          title='Flat columns'
          optionsDefault={[{ value: 'name', content: 'Name column' }, { value: 'email', content: 'Email column' }]}
          allowColumns={{ name: true, email: false }}
          handleChangeAllowColumns={handleChangeAllowColumns}
          open
          onOpenChange={onOpenChange}
        />
      </form>
    )

    const trigger = screen.getByRole('button', { name: 'Flat columns' })
    expect(trigger).toHaveAttribute('type', 'button')
    expect(screen.getByText('Flat columns')).not.toBeVisible()
    fireEvent.click(trigger)
    expect(screen.getByText('Flat columns')).toBeVisible()
    expect(trigger).not.toHaveAttribute('aria-haspopup')
    expect(screen.getByRole('group', { name: 'Flat columns' })).toHaveAttribute('id', trigger.getAttribute('aria-controls'))
    expect(onOpenChange).not.toHaveBeenCalled()
    const name = screen.getByRole('button', { name: 'Name column' })
    const email = screen.getByRole('button', { name: 'Email column' })
    expect(name).toHaveAttribute('aria-pressed', 'true')
    expect(email).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(email)
    expect(handleChangeAllowColumns).toHaveBeenCalledOnce()
    expect(handleChangeAllowColumns).toHaveBeenCalledWith('email')
    expect(submit).not.toHaveBeenCalled()

    fireEvent.keyDown(name, { key: 'Escape', code: 'Escape' })
    expect(screen.getByText('Flat columns')).not.toBeVisible()
    expect(trigger).toHaveFocus()
    expect(parentDismiss).not.toHaveBeenCalled()
    document.removeEventListener('keydown', parentDismiss, true)
  })

  it('keeps the nested visable spelling and one scalar callback', () => {
    const handleChangeAllowColumns = vi.fn()
    renderWithTheme(
      <ColumnAllowSettingPopover
        title={<strong>Order columns</strong>}
        optionsDefault={[{ value: 'name', content: 'Name column' }]}
        allowColumns={{ name: { visable: true, width: 180 } }}
        handleChangeAllowColumns={handleChangeAllowColumns}
        isOrder
      />
    )

    const trigger = screen.getByRole('button', { name: 'Manage columns' })
    fireEvent.click(trigger)
    expect(screen.getByRole('group', { name: 'Manage columns' })).toContainElement(screen.getByText('Order columns'))
    const option = screen.getByRole('button', { name: 'Name column' })
    expect(option).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(option)
    expect(handleChangeAllowColumns).toHaveBeenCalledWith('name')
  })

  // redesign audit-4: Learn is a menu of links (Product Menu): the trigger opens a `menu` of `menuitem`s,
  // not a listbox of options. The freeze-at-mount and URL lookup behaviour is the same.
  it('freezes LearnDropDown labels at mount while resolving the current URL', async () => {
    const user = userEvent.setup()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const initial = [{ value: 'launch', name: 'Launch guide', url: 'https://help.ordering.co/launch' }]
    const updated = [{ value: 'launch', name: 'Updated launch guide', url: 'https://help.ordering.co/launch-updated' }]
    const rendered = renderWithTheme(<LearnDropDown learnOptions={initial} />)

    const trigger = screen.getByRole('button', { name: 'Learn' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    rendered.rerender(<ThemeProvider theme={currentTheme}><LearnDropDown learnOptions={updated} /></ThemeProvider>)
    await user.click(trigger)
    expect(await screen.findByRole('menuitem', { name: 'Launch guide' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Updated launch guide' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Launch guide' }))
    expect(open).toHaveBeenCalledWith('https://help.ordering.co/launch-updated', '_blank', 'noopener,noreferrer')
    expect(trigger).toHaveAccessibleName('Learn')
  })

  it('keeps LearnDropDown gated to nonempty level-zero sessions', () => {
    const rendered = renderWithTheme(<LearnDropDown learnOptions={[]} />)
    expect(rendered.container).toBeEmptyDOMElement()
    runtime.level = 2
    rendered.rerender(
      <ThemeProvider theme={currentTheme}>
        <LearnDropDown learnOptions={[{ value: 'launch', name: 'Launch guide' }]} />
      </ThemeProvider>
    )
    expect(rendered.container).toBeEmptyDOMElement()
  })

  it('keeps RangeCalendar single, timed and range payloads with form-safe scoped Escape', () => {
    const single = vi.fn()
    const submit = vi.fn(event => event.preventDefault())
    const parentDismiss = vi.fn()
    document.addEventListener('keydown', parentDismiss, true)
    const rendered = renderWithTheme(
      <form onSubmit={submit}>
        <RangeCalendar
          isSingleDate
          defaultValue='2024-06-15T12:00:00'
          minDate={new Date(2024, 5, 10, 12, 0, 0)}
          handleChangeDate={single}
        />
      </form>
    )

    const trigger = screen.getByRole('button', { name: '15 Jun, 2024' })
    expect(trigger).toHaveAttribute('type', 'button')
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Select a date' })
    expect(within(dialog).getByTestId('single-widget')).toHaveAttribute('data-min', new Date(2024, 5, 10, 12, 0, 0).toISOString())
    expect(within(dialog).getByTestId('single-widget')).toHaveAttribute('data-month-label', 'Month')
    expect(within(dialog).getByTestId('single-widget')).toHaveAttribute('data-year-label', 'Year')
    expect(within(dialog).getByTestId('single-widget')).toHaveAttribute('data-prev-label', 'Previous month')
    expect(within(dialog).getByTestId('single-widget')).toHaveAttribute('data-next-label', 'Next month')
    const originalInnerWidth = window.innerWidth
    const originalScrollX = window.scrollX
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 })
    dialog.getBoundingClientRect = () => ({ bottom: 400, height: 300, left: 40, right: 350, top: 100, width: 310, x: 40, y: 100, toJSON: () => ({}) })
    fireEvent(window, new Event('resize'))
    expect(dialog.style.left).toBe('-30px')
    expect(dialog.style.right).toBe('auto')

    Object.defineProperty(window, 'scrollX', { configurable: true, value: -31 })
    dialog.getBoundingClientRect = () => ({ bottom: 400, height: 300, left: 0, right: 310, top: 100, width: 310, x: 0, y: 100, toJSON: () => ({}) })
    fireEvent(window, new Event('resize'))
    expect(dialog.style.left).toBe('31px')
    expect(dialog.style.right).toBe('auto')
    Object.defineProperty(window, 'scrollX', { configurable: true, value: originalScrollX })
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Choose single' }))
    expect(single).toHaveBeenCalledWith('2024-06-18')
    expect(submit).not.toHaveBeenCalled()
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Select a date' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(parentDismiss).not.toHaveBeenCalled()
    document.removeEventListener('keydown', parentDismiss, true)

    const timed = vi.fn()
    rendered.rerender(
      <ThemeProvider theme={currentTheme}>
        <RangeCalendar isSingleDate withTime defaultValue='2024-06-16T12:34:56' handleChangeDate={timed} />
      </ThemeProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: '16 Jun, 2024' }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose single' }))
    expect(timed).toHaveBeenCalledWith('2024-06-18 00:00:00')
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Select a date' }), { key: 'Escape', code: 'Escape' })

    const range = vi.fn()
    rendered.rerender(
      <ThemeProvider theme={currentTheme}>
        <RangeCalendar defaultValue={{ from: '2024-06-10T12:00:00', to: '2024-06-12T12:00:00' }} handleChangeDate={range} />
      </ThemeProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: '10 - 12 Jun, 2024' }))
    expect(screen.getByTestId('range-widget')).toHaveAttribute('data-start-label', 'Start date')
    expect(screen.getByTestId('range-widget')).toHaveAttribute('data-end-label', 'End date')
    fireEvent.click(screen.getByRole('button', { name: 'Choose range' }))
    expect(range).toHaveBeenCalledWith('2024-06-18', '2024-06-19')
  })

  it('keeps every legacy style export as an extensible styled identity', () => {
    for (const component of [
      colorStyles.Container,
      colorStyles.ColorWrapper,
      colorStyles.ColorBox,
      colorStyles.ColorPickerWrapper,
      columnStyles.HeaderItem,
      columnStyles.PopoverBody,
      columnStyles.PopoverList,
      columnStyles.AllowItem,
      columnStyles.Title,
      learnStyles.LearnDropDownContainer,
      learnStyles.DropDownWrapper,
      learnStyles.Option,
      rangeStyles.Container,
      rangeStyles.CalendarWrapper
    ]) {
      expect(typeof component.styledComponentId).toBe('string')
    }
  })
})
