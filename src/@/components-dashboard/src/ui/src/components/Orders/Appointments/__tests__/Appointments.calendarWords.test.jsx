// redesign W1-7 (T1-7-4, W0-F-01): the words of the calendar come from Intl through the REAL UtilsProviders; the gutter follows format_time.
import React from 'react'
import fs from 'fs'
import path from 'path'
import { render } from '@testing-library/react'
import moment from 'moment'
import { Calendar, momentLocalizer, Views } from 'react-big-calendar'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ configs: {}, language: 'en' }))

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: mocks.configs }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: true, language: { code: mocks.language } }, (key, fallback) => fallback]
}))

import { UtilsProviders, useUtils } from '../../../../../../contexts/UtilsContext'
import { buildCalendarFormats, buildClock, buildTimeRange, isRtlLanguage, joinTimeRange, splitClock, uses24Hours } from '../calendarFormats'

const localizer = momentLocalizer(moment)
const DAY = new Date(2026, 9, 7, 15, 0, 0) // Wednesday 7 October 2026

const Probe = ({ view, is24Hours = true, language }) => {
  const [{ parseDate }] = useUtils()
  const formats = buildCalendarFormats({ parseDate, languageCode: language, is24Hours })
  return (
    <div style={{ height: 600 }}>
      <Calendar
        localizer={localizer}
        formats={formats}
        date={DAY}
        onNavigate={() => {}}
        view={view}
        onView={() => {}}
        views={['month', 'week', 'day']}
        events={[]}
        toolbar={false}
      />
    </div>
  )
}

const draw = (language, view, is24Hours) => {
  mocks.language = language
  const globalLocale = moment.locale()
  const result = render(<UtilsProviders><Probe view={view} is24Hours={is24Hours} language={language} /></UtilsProviders>)
  expect(moment.locale()).toBe(globalLocale) // the global moment locale is never touched
  return result
}
const headers = (container) => Array.from(container.querySelectorAll('.rbc-header')).map(node => node.textContent)
const gutter = (container) => Array.from(container.querySelectorAll('.rbc-time-gutter .rbc-label')).map(node => node.textContent)

describe('Appointments calendar words come from Intl', () => {
  beforeEach(() => { mocks.configs = { format_time: { value: '24' } } })

  it.each([
    ['es', 'lun', 'domingo', 'octubre de 2026'],
    ['de', 'Mo', 'Sonntag', 'Oktober 2026'],
    ['en', 'Mon', 'Sunday', 'October 2026']
  ])('writes the month view headers and the week in %s', (language, mondayStart, sundayLong) => {
    const { container } = draw(language, Views.MONTH, true)
    const first = headers(container)
    expect(first).toHaveLength(7)
    expect(first[0].toLowerCase()).toContain(sundayLong.slice(0, 2).toLowerCase()) // week starts on Sunday as in main
    expect(first[1].toLowerCase()).toContain(mondayStart.toLowerCase())
  })

  it('month labels come out in the user language, not in English', () => {
    const formats = (language) => {
      mocks.language = language
      let out
      const Grab = () => {
        const [{ parseDate }] = useUtils()
        out = buildCalendarFormats({ parseDate, languageCode: language, is24Hours: true })
        return null
      }
      render(<UtilsProviders><Grab /></UtilsProviders>)
      return out
    }
    expect(formats('es').monthHeaderFormat(DAY)).toMatch(/octubre/i)
    expect(formats('de').monthHeaderFormat(DAY)).toMatch(/Oktober/)
    expect(formats('ar').monthHeaderFormat(DAY)).toMatch(/أكتوبر/)
    expect(formats('en').monthHeaderFormat(DAY)).toBe('October 2026')
    // redesign C1a (W1-PC1-06): Intl writes the range in the natural order of the language: «4–10 de octubre», «October 4 – 10»
    const week = { start: new Date(2026, 9, 4), end: new Date(2026, 9, 10) }
    expect(formats('es').dayRangeHeaderFormat(week)).toMatch(/^4\s?–\s?10 de octubre$/)
    expect(formats('en').dayRangeHeaderFormat(week)).toMatch(/^October 4\s?–\s?10$/)
    expect(formats('en').dayRangeHeaderFormat({ start: new Date(2026, 9, 25), end: new Date(2026, 10, 1) })).toMatch(/^October 25\s?–\s?November 1$/)
    expect(formats('es').dayRangeHeaderFormat({ start: new Date(2026, 9, 25), end: new Date(2026, 10, 1) })).toMatch(/^25 de octubre\s?–\s?1 de noviembre$/)
    // the genitive beside a day (uk): «4–10 жовтня», not the nominative «жовтень»
    const uk = formats('uk').dayRangeHeaderFormat(week)
    expect(uk).toMatch(/жовтня/)
    expect(uk).not.toMatch(/жовтень/)
  })

  it('gutter hours are HH:mm with format_time 24 and hh:mm A otherwise', () => {
    const h24 = gutter(draw('en', Views.DAY, true).container)
    expect(h24).toContain('15:00')
    expect(h24.some(text => /AM|PM/.test(text))).toBe(false)
    document.body.innerHTML = ''
    const h12 = gutter(draw('en', Views.DAY, false).container)
    expect(h12).toContain('03:00 PM')
    expect(h12).toContain('12:00 AM')
    expect(h12.some(text => /^1[3-9]|^2\d/.test(text))).toBe(false)
  })
})

describe('Appointments clock', () => {
  // redesign C1a (W1-QC1-07): one rule, 12 h only with format_time '12'
  it('uses 24 hours unless the project says 12', () => {
    expect(uses24Hours({ format_time: { value: '12' } })).toBe(false)
    expect(uses24Hours({ format_time: { value: '24' } })).toBe(true)
    expect(uses24Hours({})).toBe(true)
    expect(uses24Hours(undefined)).toBe(true)
  })

  // redesign C1a (W1-QC1-12): the meridiem is Intl's of the language in the gutter too; digits stay Latin
  it.each([
    ['en', /^03:00 PM$/],
    ['es', /^03:00 p\.\s?m\.$/],
    ['ar', /^03:00 م$/]
  ])('writes the 12 h gutter in %s with its own meridiem', (language, expected) => {
    const gutter = (draw(language, Views.DAY, false).container.querySelectorAll('.rbc-time-gutter .rbc-label'))
    expect(Array.from(gutter).map(node => node.textContent).some(text => expected.test(text))).toBe(true)
  })
})

// redesign (decisions 4 and 6): the time range of an appointment, written with the single clock rule; in 12 h the first
// end drops its meridiem when both ends share it («04:00 – 04:30 AM»), and each end stays its own text for its own <bdi dir='ltr'>
describe('Appointments time range', () => {
  const parseDate = (value, { outputFormat } = {}) => moment(value).format(outputFormat || 'YYYY-MM-DD')
  const at = (hours, minutes) => new Date(2026, 9, 7, hours, minutes)
  const range = (options, from, to) => buildTimeRange({ parseDate, ...options })(from, to)

  it('writes 24 h ends with nothing to remove', () => {
    expect(range({ languageCode: 'en', is24Hours: true }, at(4, 0), at(4, 30))).toEqual({ start: '04:00', end: '04:30' })
    expect(range({ languageCode: 'en', is24Hours: true }, at(11, 30), at(12, 15))).toEqual({ start: '11:30', end: '12:15' })
  })

  it('drops the first meridiem in 12 h when both ends share it', () => {
    expect(range({ languageCode: 'en', is24Hours: false }, at(4, 0), at(4, 30))).toEqual({ start: '04:00', end: '04:30 AM' })
    expect(range({ languageCode: 'en', is24Hours: false }, at(15, 0), at(15, 45))).toEqual({ start: '03:00', end: '03:45 PM' })
  })

  it('keeps both meridiems in 12 h when they differ', () => {
    expect(range({ languageCode: 'en', is24Hours: false }, at(11, 30), at(12, 15))).toEqual({ start: '11:30 AM', end: '12:15 PM' })
  })

  it('uses the meridiem of Intl in the language, never the English one (es)', () => {
    const { start, end } = range({ languageCode: 'es', is24Hours: false }, at(15, 0), at(15, 30))
    expect(start).toBe('03:00')
    expect(end).toMatch(/^03:30 p\.\s?m\.$/)
    const mixed = range({ languageCode: 'es', is24Hours: false }, at(11, 30), at(12, 15))
    expect(mixed.start).toMatch(/^11:30 a\.\s?m\.$/)
    expect(mixed.end).toMatch(/^12:15 p\.\s?m\.$/)
    expect(`${start}${end}`).not.toMatch(/\b(AM|PM)\b/)
  })

  it('treats the Arabic meridiem as a suffix, and removes nothing if Intl writes it first', () => {
    const clock = buildClock({ parseDate, languageCode: 'ar', is24Hours: false })
    const from = clock(at(15, 0))
    const to = clock(at(15, 30))
    const { start, end } = range({ languageCode: 'ar', is24Hours: false }, at(15, 0), at(15, 30))
    const suffix = /\D*$/.exec(from)[0]
    expect(end).toBe(to)
    if (suffix.trim()) {
      expect(start).toBe(from.slice(0, from.length - suffix.length).trimEnd())
      expect(start).toBe('03:00')
    } else {
      expect(start).toBe(from) // a leading meridiem is not a suffix: both ends keep theirs
    }
  })

  it('joins the two ends with a spaced en dash for names and titles', () => {
    expect(joinTimeRange({ start: '04:00', end: '04:30 AM' })).toBe('04:00 – 04:30 AM')
  })

  it('does not use Intl.formatRange, whose thin spaces would break the single clock rule', () => {
    const { start, end } = range({ languageCode: 'en', is24Hours: false }, at(4, 0), at(4, 30))
    expect(`${start}${end}`).not.toMatch(/[\u2009\u202F]/)
  })
})

// redesign bugs H (W1-QC2-04): the pieces of a clock text for a right-to-left language
describe('Appointments clock parts', () => {
  it('cuts a clock at its digits, with the meridiem on either side', () => {
    expect(splitClock('03:00 م')).toEqual({ before: '', time: '03:00', after: ' م' })
    expect(splitClock('م 03:00')).toEqual({ before: 'م ', time: '03:00', after: '' })
    expect(splitClock('15:30')).toEqual({ before: '', time: '15:30', after: '' })
    expect(splitClock('03:30 p. m.')).toEqual({ before: '', time: '03:30', after: ' p. m.' })
    expect(splitClock('no clock')).toBeNull()
    expect(splitClock('')).toBeNull()
  })

  it('knows which languages are right to left, the flag of the language winning when it is there', () => {
    ;['ar', 'ar-EG', 'he', 'fa', 'ur'].forEach(code => expect(isRtlLanguage(code)).toBe(true))
    ;['en', 'es', 'el', 'pt-BR', '', undefined].forEach(code => expect(isRtlLanguage(code)).toBe(false))
    expect(isRtlLanguage('en', true)).toBe(true)
    expect(isRtlLanguage('ar', false)).toBe(false)
  })
})

describe('Appointments calendar wiring', () => {
  const dir = path.resolve(__dirname, '..')
  const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8')
  it('does not load the dragAndDrop sheet and passes the Intl formats', () => {
    expect(source).not.toMatch(/^import .*dragAndDrop/m)
    expect(source).toMatch(/formats=\{formats\}/)
  })
  // redesign C1a (W1-QC1-02, -05, -09): the keyboard, the week and day headers and the month's event rows go through rbc's own hooks
  it('wires the keyboard and the accessible parts of the calendar through rbc components, not patches', () => {
    expect(source).toMatch(/onKeyPressEvent=\{handleEventKeyPress\}/)
    expect(source).toMatch(/month: \{ event: MonthEventComponent, weekWrapper: MonthEventRows \}/)
    expect(source).toMatch(/week: \{ header: TimeGridDayHeader \}/)
    expect(source).toMatch(/day: \{ header: TimeGridDayHeader \}/)
    // redesign (decision 1): the plural title as the menu and ⌘K, and no «Calendar» crumb under it (was W1-PC1-04)
    expect(source).toMatch(/title=\{t\('APPOINTMENTS', 'Appointments'\)\}/)
    expect(source).not.toMatch(/description=\{isEnabledAppointmentsFeature \? t\('CALENDAR', 'Calendar'\)/)
  })
  // redesign C1a (W1-QC1-04, W1-PC1-01, W1-D-21): the thirds and halves are for phones (width), the touch targets follow the pointer
  // redesign (decision 5): week and day fill the height left and scroll their hours inside rbc's .rbc-time-content (measured
  // live: the week opens at 04:00 with scrollTop 240 at 1440); without it the 24 hours grew the page and there was nothing to scroll
  it('bounds the time grid so its hours scroll inside it', () => {
    const all = fs.readFileSync(path.join(dir, 'styles.js'), 'utf8')
    const styles = all.slice(all.indexOf('export const CalendarWrapper'), all.indexOf('export const CalendarHeaderContainer'))
    expect(styles).toMatch(/&:has\(\.rbc-time-view\) \{\s*flex: 1 1 0;\s*min-block-size: 0;\s*\}/)
    expect(styles).toMatch(/\.rbc-calendar:has\(\.rbc-time-view\) \{\s*flex: 1 1 0;\s*\}/)
  })
  it('keeps the grid in thirds under the width of a phone only, and the touch targets under the coarse pointer', () => {
    const all = fs.readFileSync(path.join(dir, 'styles.js'), 'utf8')
    const styles = all.slice(all.indexOf('export const CalendarWrapper'), all.indexOf('export const CalendarHeaderContainer'))
    const blockOf = (opening) => {
      const start = styles.indexOf(opening)
      expect(start, opening).toBeGreaterThan(-1)
      let depth = 0
      for (let i = styles.indexOf('{', start); i < styles.length; i += 1) {
        if (styles[i] === '{') depth += 1
        if (styles[i] === '}') depth -= 1
        if (depth === 0) return styles.slice(start, i + 1)
      }
      return ''
    }
    const coarse = blockOf('@media (pointer: coarse), (max-width: 767px)')
    // redesign (n.º 29, W1-D-21): the thirds and halves start under 600px; 600 to 767 shows the seven days as 768 and up does
    const phone = blockOf('@media (max-width: 599px) {')
    expect(coarse).not.toMatch(/cqw/)
    expect(coarse).toContain('--od-x-target-coarse')
    expect(phone).toContain('100cqw * 7 / 3')
    expect(phone).toContain('100cqw * 7 / 2')
    // no widening is left under the old 767px phone query: every cqw rule lives in the 599px block
    expect(styles.match(/@media \(max-width: 767px\) \{[^@]*cqw/g)).toBeNull()
    expect(styles.match(/min-width:\s*calc\(100cqw/g)).toHaveLength(2)
    // (n.º 29): from 600 to 767 main's 728px minimum is lifted, so the seven days fit the page
    expect(blockOf('@media (min-width: 600px) and (max-width: 767px) {')).toMatch(/min-width:\s*0;/)
  })
  // redesign C1a (W1-QC1-01): rbc measures a dummy event, so the month's event has one height for the dummy and the real ones
  it('gives the month event one block size, and the month row room for two slots', () => {
    const styles = fs.readFileSync(path.join(dir, 'styles.js'), 'utf8')
    expect(styles).toMatch(/\.rbc-month-view \.rbc-event \{\s*block-size: var\(--appointments-month-event-size\);/)
    expect(styles).toMatch(/--appointments-month-event-size: calc\(18px \+ 15px \+ 2 \* 2px \+ 2 \* 1px\)/)
  })
  it('keeps the overrides of rbc under the class of the container, with tokens for colours', () => {
    const styles = fs.readFileSync(path.join(dir, 'styles.js'), 'utf8')
    expect(styles).toMatch(/CalendarWrapper = styled\.div\.attrs\(\{ className: CALENDAR_CLASS \}\)/)
    const block = styles.slice(styles.indexOf('export const CalendarWrapper'), styles.indexOf('export const CalendarHeaderContainer'))
    expect(block).toContain('var(--od-border)')
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,6}\b/)
  })
})
