// redesign 2.E: Product TimeField — a time of day or a duration in two native selects.
import React, { useState } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ConfigContext } from '../../../../../../contexts/ConfigContext'
import { TimeField } from '../TimeField'
import { TextField } from '../Field'

// Real Base UI, the real ConfigContext and the real hour-format values: the wrapper decides 12/24 h from them.
// jsdom has no layout, so sizes are the browser spec's job; these tests pin the wiring and the values.

const css = readFileSync(path.join(__dirname, '..', 'time-field.css'), 'utf8')

const TEXT = { hourLabel: 'Hours', minuteLabel: 'Minutes', hoursUnit: 'h', minutesUnit: 'min', amLabel: 'AM', pmLabel: 'PM' }

// `format` undefined = no provider at all
const renderWith = (ui, format) => {
  if (format === undefined) return render(ui)
  const value = [{ configs: { general_hour_format: { value: format } } }, async () => {}]
  return render(<ConfigContext.Provider value={value}>{ui}</ConfigContext.Provider>)
}

const field = (props = {}) => <TimeField label='Delivery time' {...TEXT} {...props} />

// «Delivery time Hours» with a visible label, «Hours» without one
const hourSelect = () => screen.getByRole('combobox', { name: /Hours$/ })
const minuteSelect = () => screen.getByRole('combobox', { name: /Minutes$/ })
const texts = select => Array.from(select.options).map(option => option.textContent)
const shown = select => select.selectedOptions[0].textContent

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, index) => from + index)
const pad = n => String(n).padStart(2, '0')
const hours12 = () => range(0, 23).map(h => (h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`))

afterEach(() => vi.restoreAllMocks())

describe('TimeField: duration, valueFormat hm (the saved "H:M")', () => {
  it.each([
    ['02:05', '2', '5', '05'],
    ['2:5', '2', '5', '05'],
    ['2:05', '2', '5', '05'],
    ['0:45', '0', '45', '45'],
    ['1:30:45', '1', '30', '30']
  ])('reads %s as hour %s and minute %s', (value, hour, minute, minuteText) => {
    renderWith(field({ value }))
    expect(hourSelect()).toHaveValue(hour)
    expect(shown(hourSelect())).toBe(hour)
    expect(minuteSelect()).toHaveValue(minute)
    expect(shown(minuteSelect())).toBe(minuteText)
  })

  it.each([[null], [undefined], [''], ['abc'], [':'], ['x:y']])('reads %j as 0:0', value => {
    renderWith(field({ value }))
    expect(hourSelect()).toHaveValue('0')
    expect(minuteSelect()).toHaveValue('0')
    expect(shown(minuteSelect())).toBe('00')
  })

  it('emits nothing on mount', () => {
    const onChange = vi.fn()
    renderWith(field({ value: '2:5', onChange }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('changing the minute keeps the hour and emits the unpadded string', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWith(field({ value: '02:05', onChange }))
    await user.selectOptions(minuteSelect(), '30')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('2:30')
  })

  it('changing the hour keeps the minute and emits the unpadded string', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWith(field({ value: '2:5', onChange }))
    await user.selectOptions(hourSelect(), '0')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('0:5')
  })

  it('controlled: shows the value it is given until the parent changes it', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWith(field({ value: '1:00', onChange }))
    await user.selectOptions(minuteSelect(), '15')
    expect(onChange).toHaveBeenCalledWith('1:15')
    expect(minuteSelect()).toHaveValue('0')
  })

  it('uncontrolled with defaultValue updates its own display after a change', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWith(field({ defaultValue: '1:00', onChange }))
    expect(hourSelect()).toHaveValue('1')
    await user.selectOptions(minuteSelect(), '15')
    expect(minuteSelect()).toHaveValue('15')
    expect(hourSelect()).toHaveValue('1')
    await user.selectOptions(hourSelect(), '3')
    expect(hourSelect()).toHaveValue('3')
    expect(minuteSelect()).toHaveValue('15')
    expect(onChange.mock.calls.map(call => call[0])).toEqual(['1:15', '3:15'])
  })

  it('a parent that keeps the value in state shows each change', async () => {
    const user = userEvent.setup()
    const Parent = () => {
      const [value, setValue] = useState('0:00')
      return field({ value, onChange: setValue })
    }
    renderWith(<Parent />)
    await user.selectOptions(hourSelect(), '4')
    await user.selectOptions(minuteSelect(), '20')
    expect(hourSelect()).toHaveValue('4')
    expect(minuteSelect()).toHaveValue('20')
  })
})

describe('TimeField: duration, valueFormat minutes (integer minutes)', () => {
  it('reads 90 as 1 h 30 and a numeric string the same way', () => {
    const { unmount } = renderWith(field({ value: 90, valueFormat: 'minutes' }))
    expect(hourSelect()).toHaveValue('1')
    expect(minuteSelect()).toHaveValue('30')
    unmount()
    renderWith(field({ value: '90', valueFormat: 'minutes' }))
    expect(hourSelect()).toHaveValue('1')
    expect(minuteSelect()).toHaveValue('30')
  })

  it.each([[null], [undefined], [''], ['abc'], [NaN]])('reads %j as 0 minutes', value => {
    renderWith(field({ value, valueFormat: 'minutes' }))
    expect(hourSelect()).toHaveValue('0')
    expect(minuteSelect()).toHaveValue('0')
  })

  it('emits a number: hour * 60 + minute', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWith(field({ value: 60, valueFormat: 'minutes', onChange }))
    expect(onChange).not.toHaveBeenCalled()
    await user.selectOptions(minuteSelect(), '45')
    expect(onChange).toHaveBeenLastCalledWith(105)
    await user.selectOptions(hourSelect(), '3')
    expect(onChange).toHaveBeenLastCalledWith(180)
    expect(typeof onChange.mock.lastCall[0]).toBe('number')
  })

  it('1500 minutes (25 h) is shown as an extra option and nothing is emitted', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWith(field({ value: 1500, valueFormat: 'minutes', onChange }))
    expect(hourSelect()).toHaveValue('25')
    expect(shown(hourSelect())).toBe('25')
    expect(texts(hourSelect())).toEqual([...range(0, 23).map(String), '25'])
    expect(minuteSelect()).toHaveValue('0')
    expect(onChange).not.toHaveBeenCalled()
    await user.selectOptions(minuteSelect(), '30')
    expect(onChange).toHaveBeenCalledWith(1530)
  })
})

describe('TimeField: values outside the range are shown, never changed', () => {
  it('hm "30:00" keeps 30 as the last hour option, selected', () => {
    const onChange = vi.fn()
    renderWith(field({ value: '30:00', onChange }))
    expect(hourSelect()).toHaveValue('30')
    expect(shown(hourSelect())).toBe('30')
    expect(hourSelect().options).toHaveLength(25)
    expect(hourSelect().options[24].value).toBe('30')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('hm "0:75" keeps 75 as the last minute option, selected, and the hour change keeps it', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWith(field({ value: '0:75', onChange }))
    expect(minuteSelect()).toHaveValue('75')
    expect(shown(minuteSelect())).toBe('75')
    expect(minuteSelect().options).toHaveLength(61)
    expect(onChange).not.toHaveBeenCalled()
    await user.selectOptions(hourSelect(), '1')
    expect(onChange).toHaveBeenCalledWith('1:75')
  })

  it('an in-range value adds no extra option', () => {
    renderWith(field({ value: '23:59' }))
    expect(hourSelect().options).toHaveLength(24)
    expect(minuteSelect().options).toHaveLength(60)
  })
})

describe('TimeField: option texts', () => {
  it('duration: hours "0".."23" without padding or leading space, minutes "00".."59"', () => {
    renderWith(field())
    expect(texts(hourSelect())).toEqual(range(0, 23).map(String))
    expect(texts(minuteSelect())).toEqual(range(0, 59).map(pad))
    for (const text of [...texts(hourSelect()), ...texts(minuteSelect())]) expect(text).toBe(text.trim())
  })

  it.each([['hh:mma'], ['hh:mm a'], ['HH:mm'], [undefined]])('duration never reads AM/PM (format %j)', format => {
    renderWith(field({ value: '14:30' }), format)
    expect(texts(hourSelect())).toEqual(range(0, 23).map(String))
    expect(document.body.textContent).not.toMatch(/AM|PM/)
  })

  it.each([['HH:mm'], [undefined]])('time, 24 h (format %j): "00".."23"', format => {
    renderWith(field({ mode: 'time' }), format)
    expect(texts(hourSelect())).toEqual(range(0, 23).map(pad))
    expect(texts(minuteSelect())).toEqual(range(0, 59).map(pad))
  })

  it.each([['hh:mma'], ['hh:mm a']])('time, 12 h (format %j): "12 AM".."11 PM", values 0-23', format => {
    renderWith(field({ mode: 'time' }), format)
    expect(texts(hourSelect())).toEqual(hours12())
    expect(Array.from(hourSelect().options).map(option => option.value)).toEqual(range(0, 23).map(String))
    for (const text of texts(hourSelect())) expect(text).toBe(text.trim())
  })

  it('time, 12 h: uses the AM and PM texts it is given', () => {
    renderWith(field({ mode: 'time', amLabel: 'a. m.', pmLabel: 'p. m.' }), 'hh:mma')
    expect(texts(hourSelect())[0]).toBe('12 a. m.')
    expect(texts(hourSelect())[13]).toBe('1 p. m.')
  })

  // batch O, row 12: the optional `is12Hours` wins over general_hour_format; without it nothing changes
  it.each([['HH:mm'], [undefined]])('is12Hours true: 12 h even when the project format is 24 h (format %j)', format => {
    renderWith(field({ mode: 'time', is12Hours: true }), format)
    expect(texts(hourSelect())).toEqual(hours12())
  })

  it.each([['hh:mma'], ['hh:mm a']])('is12Hours false: 24 h even when the project format is 12 h (format %j)', format => {
    renderWith(field({ mode: 'time', is12Hours: false }), format)
    expect(texts(hourSelect())).toEqual(range(0, 23).map(pad))
    expect(document.body.textContent).not.toMatch(/AM|PM/)
  })

  it.each([['hh:mma', hours12()], ['hh:mm a', hours12()], ['HH:mm', range(0, 23).map(pad)], [undefined, range(0, 23).map(pad)]])(
    'without is12Hours (or with undefined) the format is read as before (format %j)', (format, expected) => {
      renderWith(field({ mode: 'time' }), format)
      expect(texts(hourSelect())).toEqual(expected)
      document.body.innerHTML = ''
      renderWith(field({ mode: 'time', is12Hours: undefined }), format)
      expect(texts(hourSelect())).toEqual(expected)
    })

  it('is12Hours never turns a duration into AM/PM, and a 12 h time still needs its AM and PM texts', () => {
    renderWith(field({ value: '14:30', is12Hours: true }), 'HH:mm')
    expect(texts(hourSelect())).toEqual(range(0, 23).map(String))
    expect(document.body.textContent).not.toMatch(/AM|PM/)
  })

  it('is12Hours true on a time field needs amLabel and pmLabel like any 12 h time', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderWith(<TimeField label='Open' hourLabel='Hours' minuteLabel='Minutes' mode='time' is12Hours />, 'HH:mm')).toThrow('TimeField needs a amLabel')
  })

  it('is12Hours does not leak to the DOM', () => {
    const { container } = renderWith(field({ mode: 'time', is12Hours: true }), 'HH:mm')
    expect(container.innerHTML).not.toMatch(/is12hours/i)
  })
})

describe('TimeField: time mode', () => {
  it('reads and writes "H:M" on the 24-hour clock in 12 h display', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWith(field({ mode: 'time', value: '14:30', onChange }), 'hh:mma')
    expect(shown(hourSelect())).toBe('2 PM')
    expect(shown(minuteSelect())).toBe('30')
    await user.selectOptions(minuteSelect(), '45')
    expect(onChange).toHaveBeenLastCalledWith('14:45')
    await user.selectOptions(hourSelect(), '9')
    expect(onChange).toHaveBeenLastCalledWith('9:30')
  })

  it('paints a ":" separator between the selects (aria-hidden) and no unit', () => {
    renderWith(field({ mode: 'time' }), 'HH:mm')
    const group = screen.getByRole('group', { name: 'Delivery time' })
    expect(group).toHaveAttribute('data-mode', 'time')
    const separator = group.querySelector('.odc-time-field-separator')
    expect(separator).toHaveTextContent(':')
    expect(separator).toHaveAttribute('aria-hidden', 'true')
    expect(group.querySelector('.odc-time-field-unit')).toBeNull()
  })

  it('duration: units after each select (aria-hidden), no separator', () => {
    renderWith(field())
    const group = screen.getByRole('group', { name: 'Delivery time' })
    expect(group).toHaveAttribute('data-mode', 'duration')
    const units = Array.from(group.querySelectorAll('.odc-time-field-unit'))
    expect(units.map(unit => unit.textContent)).toEqual(['h', 'min'])
    for (const unit of units) expect(unit).toHaveAttribute('aria-hidden', 'true')
    expect(group.querySelector('.odc-time-field-separator')).toBeNull()
    expect(hourSelect().closest('.odc-time-field-part').nextElementSibling).toBe(units[0])
    expect(minuteSelect().closest('.odc-time-field-part').nextElementSibling).toBe(units[1])
  })

  it('duration is the default mode', () => {
    renderWith(field())
    expect(screen.getByRole('group', { name: 'Delivery time' })).toHaveAttribute('data-mode', 'duration')
  })
})

describe('TimeField: accessibility', () => {
  it('the group is named by the visible label and each select by its own name', () => {
    renderWith(field())
    const group = screen.getByRole('group', { name: 'Delivery time' })
    expect(group).toContainElement(hourSelect())
    expect(group).toContainElement(minuteSelect())
    expect(hourSelect().tagName).toBe('SELECT')
    expect(screen.getByRole('combobox', { name: 'Delivery time Hours' })).toBe(hourSelect())
    expect(screen.getByRole('combobox', { name: 'Delivery time Minutes' })).toBe(minuteSelect())
    expect(hourSelect()).toHaveAttribute('data-unit', 'hour')
    expect(minuteSelect()).toHaveAttribute('data-unit', 'minute')
  })

  it('without a visible label, aria-label names the group', () => {
    renderWith(<TimeField aria-label='Pickup time' {...TEXT} />)
    expect(screen.getByRole('group', { name: 'Pickup time' })).toBeInTheDocument()
    expect(document.querySelector('label')).toBeNull()
    expect(screen.getByRole('combobox', { name: 'Hours' })).toHaveAttribute('aria-label', 'Hours')
    expect(screen.getByRole('combobox', { name: 'Minutes' })).toHaveAttribute('aria-label', 'Minutes')
    expect(hourSelect()).not.toHaveAttribute('aria-labelledby')
  })

  it('an error is a role=alert and marks both selects invalid', () => {
    renderWith(field({ error: 'Choose a time' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a time')
    expect(hourSelect()).toHaveAttribute('aria-invalid', 'true')
    expect(minuteSelect()).toHaveAttribute('aria-invalid', 'true')
  })

  it('invalid without a message marks both selects, and a valid field marks neither', () => {
    const { unmount } = renderWith(field({ invalid: true }))
    expect(hourSelect()).toHaveAttribute('aria-invalid', 'true')
    expect(minuteSelect()).toHaveAttribute('aria-invalid', 'true')
    unmount()
    renderWith(field())
    expect(hourSelect()).not.toHaveAttribute('aria-invalid')
    expect(minuteSelect()).not.toHaveAttribute('aria-invalid')
  })

  it('required puts aria-required on both selects and the required text on the label', () => {
    renderWith(field({ required: true, requiredLabel: 'Required' }))
    expect(hourSelect()).toHaveAttribute('aria-required', 'true')
    expect(minuteSelect()).toHaveAttribute('aria-required', 'true')
    expect(document.querySelector('label')).toHaveTextContent('Required')
  })

  it('the hint describes both selects and the label points at the first', () => {
    renderWith(field({ hint: 'Time to deliver', id: 'delivery-time' }))
    expect(hourSelect()).toHaveAccessibleDescription('Time to deliver')
    expect(minuteSelect()).toHaveAccessibleDescription('Time to deliver')
    expect(hourSelect()).toHaveAttribute('id', 'delivery-time')
    expect(document.querySelector('label')).toHaveAttribute('for', 'delivery-time')
  })

  it('hint then error describe both selects, once each (Field does not duplicate tokens on the hour select)', () => {
    const { rerender } = renderWith(field({ hint: 'Time to deliver' }))
    rerender(field({ hint: 'Time to deliver', error: 'Choose a time' }))
    const hintId = document.querySelector('.odc-field-hint').id
    const errorId = document.querySelector('.odc-field-error').id
    for (const select of [hourSelect(), minuteSelect()]) {
      expect(select).toHaveAttribute('aria-describedby', `${hintId} ${errorId}`)
      const tokens = select.getAttribute('aria-describedby').split(' ')
      expect(new Set(tokens).size).toBe(tokens.length)
      expect(select).toHaveAccessibleDescription('Time to deliver Choose a time')
    }
  })

  it('a removed error leaves both selects described by the hint only', () => {
    const { rerender } = renderWith(field({ hint: 'Time to deliver', error: 'Choose a time' }))
    rerender(field({ hint: 'Time to deliver' }))
    const hintId = document.querySelector('.odc-field-hint').id
    expect(hourSelect()).toHaveAttribute('aria-describedby', hintId)
    expect(minuteSelect()).toHaveAttribute('aria-describedby', hintId)
  })

  it('no hint and no error: no aria-describedby on either select', () => {
    renderWith(field())
    expect(hourSelect()).not.toHaveAttribute('aria-describedby')
    expect(minuteSelect()).not.toHaveAttribute('aria-describedby')
  })

  it('the outer group does not take the field-input class (its 44px ::after would cover both selects)', () => {
    renderWith(field())
    const group = screen.getByRole('group', { name: 'Delivery time' })
    expect(group).not.toHaveClass('odc-field-input')
    expect(group.closest('.odc-field-control')).not.toHaveClass('odc-field-input')
  })

  it('name gives each select its own name', () => {
    renderWith(field({ name: 'delivery_time' }))
    expect(hourSelect()).toHaveAttribute('name', 'delivery_time-hour')
    expect(minuteSelect()).toHaveAttribute('name', 'delivery_time-minute')
  })

  it('without name the selects have none', () => {
    renderWith(field())
    expect(hourSelect()).not.toHaveAttribute('name')
    expect(minuteSelect()).not.toHaveAttribute('name')
  })

  it('forwards the ref to the hour select (as TextField forwards it to its control) and takes fieldClassName on the frame', () => {
    const ref = React.createRef()
    const { container } = renderWith(field({ ref, fieldClassName: 'mine' }))
    expect(ref.current).toBe(hourSelect())
    expect(container.querySelector('.odc-field')).toHaveClass('mine')
  })

  it('markup uses classes and no inline style; figures are in mono', () => {
    renderWith(field())
    for (const select of [hourSelect(), minuteSelect()]) {
      expect(select).toHaveClass('odc-time-field-select', 'odc-figure')
      expect(select.getAttribute('style')).toBeNull()
      expect(select.closest('.odc-time-field-part')).toHaveClass('odc-time-field-part')
    }
  })
})

describe('TimeField: it has no text of its own', () => {
  const failing = (props, message, format) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderWith(<TimeField label='Delivery time' {...props} />, format)).toThrow(message)
  }

  it('needs a label or an aria-label', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TimeField {...TEXT} />)).toThrow(/needs a label/)
  })

  it('throws for a missing hourLabel or minuteLabel', () => {
    failing({ ...TEXT, hourLabel: undefined }, 'TimeField needs a hourLabel')
    failing({ ...TEXT, minuteLabel: null }, 'TimeField needs a minuteLabel')
  })

  it('duration throws for a missing hoursUnit or minutesUnit', () => {
    failing({ ...TEXT, hoursUnit: undefined }, 'TimeField needs a hoursUnit')
    failing({ ...TEXT, minutesUnit: undefined }, 'TimeField needs a minutesUnit')
  })

  it('time in 12 h throws for a missing amLabel or pmLabel', () => {
    failing({ ...TEXT, mode: 'time', amLabel: undefined }, 'TimeField needs a amLabel', 'hh:mma')
    failing({ ...TEXT, mode: 'time', pmLabel: undefined }, 'TimeField needs a pmLabel', 'hh:mm a')
  })

  it('time in 24 h (or without a provider) does not need AM, PM or units', () => {
    const rest = { hourLabel: 'Hours', minuteLabel: 'Minutes', mode: 'time' }
    const { unmount } = renderWith(<TimeField label='Open' {...rest} />, 'HH:mm')
    expect(hourSelect()).toBeInTheDocument()
    unmount()
    renderWith(<TimeField label='Open' {...rest} />)
    expect(hourSelect()).toBeInTheDocument()
  })

  it('duration does not need AM or PM, even in a 12 h project', () => {
    renderWith(<TimeField label='Delivery time' hourLabel='Hours' minuteLabel='Minutes' hoursUnit='h' minutesUnit='min' />, 'hh:mma')
    expect(hourSelect()).toBeInTheDocument()
  })

  it('an empty string is a translation that paints empty, not a missing text', () => {
    renderWith(<TimeField label='Delivery time' hourLabel='' minuteLabel='' hoursUnit='' minutesUnit='' />)
    const selects = screen.getAllByRole('combobox')
    expect(selects).toHaveLength(2)
    const names = document.querySelectorAll('.odc-sr-only')
    expect(Array.from(names).filter(node => node.textContent === '')).toHaveLength(2)
    expect(document.querySelectorAll('.odc-time-field-unit')).toHaveLength(2)
    for (const unit of document.querySelectorAll('.odc-time-field-unit')) expect(unit.textContent).toBe('')
  })

  it('time in 12 h with empty AM and PM paints the hours with no suffix text', () => {
    renderWith(<TimeField label='Open' hourLabel='Hours' minuteLabel='Minutes' mode='time' amLabel='' pmLabel='' />, 'hh:mma')
    expect(texts(hourSelect())[0]).toBe('12')
    expect(texts(hourSelect())[13]).toBe('1')
  })
})

describe('TimeField: keyboard and disabled', () => {
  it('Tab goes hour, then minute', async () => {
    const user = userEvent.setup()
    renderWith(field())
    await user.tab()
    expect(hourSelect()).toHaveFocus()
    await user.tab()
    expect(minuteSelect()).toHaveFocus()
  })

  it('a press on the frame of a select (the 44px area on a phone) focuses that select', async () => {
    const user = userEvent.setup()
    renderWith(field())
    const part = minuteSelect().closest('.odc-time-field-part')
    // the touch criterion (e2e/touch-target.js) takes this frame only while it holds exactly one control.
    const parts = document.querySelectorAll('.odc-time-field-part')
    expect(parts).toHaveLength(2)
    parts.forEach(each => expect(each.querySelectorAll('input, select, textarea')).toHaveLength(1))
    await user.pointer({ keys: '[MouseLeft>]', target: part })
    expect(minuteSelect()).toHaveFocus()
  })

  // Android Chrome does not open the native picker on a programmatic focus(), so a press on the frame of a select
  // needed a second tap. On a coarse pointer the frame press also calls showPicker(); a mouse keeps the plain focus.
  describe('frame press opens the native picker on a coarse pointer', () => {
    const originalMatchMedia = window.matchMedia
    const setPointer = coarse => {
      window.matchMedia = vi.fn(query => ({
        matches: coarse && query === '(pointer: coarse)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    }
    const stubPicker = (implementation = () => {}) => {
      const showPicker = vi.fn(implementation)
      HTMLSelectElement.prototype.showPicker = showPicker
      HTMLInputElement.prototype.showPicker = showPicker
      return showPicker
    }
    afterEach(() => {
      window.matchMedia = originalMatchMedia
      delete HTMLSelectElement.prototype.showPicker
      delete HTMLInputElement.prototype.showPicker
    })

    it('coarse pointer: a press on the frame focuses the select and opens its picker once', async () => {
      setPointer(true)
      const showPicker = stubPicker()
      const user = userEvent.setup()
      renderWith(field())
      await user.pointer({ keys: '[MouseLeft>]', target: minuteSelect().closest('.odc-time-field-part') })
      expect(minuteSelect()).toHaveFocus()
      expect(showPicker).toHaveBeenCalledTimes(1)
      expect(showPicker.mock.contexts[0]).toBe(minuteSelect())
    })

    it('coarse pointer: a press on the select itself leaves the picker to the browser', async () => {
      setPointer(true)
      const showPicker = stubPicker()
      const user = userEvent.setup()
      renderWith(field())
      await user.pointer({ keys: '[MouseLeft>]', target: minuteSelect() })
      expect(showPicker).not.toHaveBeenCalled()
    })

    it('coarse pointer: showPicker throwing (no user gesture) does not break and the select keeps the focus', async () => {
      setPointer(true)
      const showPicker = stubPicker(() => { throw new DOMException('no gesture', 'NotAllowedError') })
      const user = userEvent.setup()
      renderWith(field())
      await user.pointer({ keys: '[MouseLeft>]', target: hourSelect().closest('.odc-time-field-part') })
      expect(showPicker).toHaveBeenCalledTimes(1)
      expect(hourSelect()).toHaveFocus()
    })

    it('coarse pointer: a browser without showPicker only focuses', async () => {
      setPointer(true)
      const user = userEvent.setup()
      renderWith(field())
      await user.pointer({ keys: '[MouseLeft>]', target: hourSelect().closest('.odc-time-field-part') })
      expect(hourSelect()).toHaveFocus()
    })

    it('fine pointer (mouse): a press on the frame only focuses, no picker', async () => {
      setPointer(false)
      const showPicker = stubPicker()
      const user = userEvent.setup()
      renderWith(field())
      await user.pointer({ keys: '[MouseLeft>]', target: minuteSelect().closest('.odc-time-field-part') })
      expect(minuteSelect()).toHaveFocus()
      expect(showPicker).not.toHaveBeenCalled()
    })

    it('no matchMedia at all: only focuses', async () => {
      window.matchMedia = undefined
      const showPicker = stubPicker()
      const user = userEvent.setup()
      renderWith(field())
      await user.pointer({ keys: '[MouseLeft>]', target: minuteSelect().closest('.odc-time-field-part') })
      expect(minuteSelect()).toHaveFocus()
      expect(showPicker).not.toHaveBeenCalled()
    })

    it('coarse pointer: an input control (TextField) never opens a picker', async () => {
      setPointer(true)
      const showPicker = stubPicker()
      const user = userEvent.setup()
      render(<TextField label='Name' />)
      const input = screen.getByRole('textbox', { name: 'Name' })
      await user.pointer({ keys: '[MouseLeft>]', target: input.closest('.odc-field-control') })
      expect(input).toHaveFocus()
      expect(showPicker).not.toHaveBeenCalled()
    })
  })

  it('user.selectOptions works on both selects', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWith(field({ defaultValue: '0:00', onChange }))
    await user.selectOptions(hourSelect(), '5')
    await user.selectOptions(minuteSelect(), '55')
    expect(onChange.mock.calls.map(call => call[0])).toEqual(['5:0', '5:55'])
  })

  it('disabled disables both selects and takes them out of the tab order', async () => {
    const user = userEvent.setup()
    renderWith(field({ disabled: true }))
    expect(hourSelect()).toBeDisabled()
    expect(minuteSelect()).toBeDisabled()
    await user.tab()
    expect(hourSelect()).not.toHaveFocus()
    expect(minuteSelect()).not.toHaveFocus()
  })
})

describe('TimeField: stylesheet', () => {
  const rules = text => text.replace(/\/\*[\s\S]*?\*\//g, '')

  it('the select is 32px, with the field border and the house focus ring', () => {
    expect(css).toMatch(/\.odc-time-field-select\s*\{[^}]*block-size: var\(--od-x-control-height\)/)
    expect(css).toMatch(/\.odc-time-field-select\s*\{[^}]*border: var\(--od-x-hairline\) solid var\(--od-x-field-border\)/)
    expect(css).toMatch(/\.odc-time-field-select:focus-visible\s*\{[^}]*outline: var\(--od-focus-ring-width\) solid var\(--od-focus-ring-color\)/)
    expect(css).toMatch(/\.odc-time-field-select:disabled/)
  })

  it('the phone block gives each part a 44px area (::after on the frame) and 16px text', () => {
    expect(css).toMatch(/@media \(pointer: coarse\), \(max-width: 767px\)\s*\{[^@]*\.odc-time-field-select \{ font-size: var\(--od-x-type-lead-size\)/)
    expect(css).toMatch(/\.odc-time-field-part\s*\{[^}]*position: relative;[^}]*isolation: isolate/)
    expect(css).toMatch(/\.odc-time-field-part::after\s*\{[^}]*inset: var\(--od-x-target-inset\)/)
    expect(css).toMatch(/\.odc-time-field-part::after\s*\{[^}]*z-index: calc\(var\(--od-x-layer-raised\) \* -1\)/)
  })

  it('the group is inline-flex with the parts at least 12px apart (--od-space-2 or more)', () => {
    expect(css).toMatch(/\.odc-time-field\s*\{[^}]*display: inline-flex/)
    expect(css).toMatch(/\.odc-time-field\s*\{[^}]*align-items: center/)
    expect(css).toMatch(/\.odc-time-field\s*\{[^}]*gap: var\(--od-space-[2-9]\)/)
  })

  it('units and separator read in the muted text role', () => {
    expect(css).toMatch(/\.odc-time-field-unit,\s*\.odc-time-field-separator\s*\{[^}]*color: var\(--od-text-muted\)/)
  })

  it('has no literal length outside a media prelude', () => {
    expect(rules(css).replace(/@media[^{]*/g, '')).not.toMatch(/\d(px|rem|em)\b/)
    expect(rules(css)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
