import React, { useState } from 'react'
import { render, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { vi, it, expect, afterEach } from 'vitest'
import { ThemeProvider } from 'styled-components'
import theme from '~/theme.json'
import { HoursEditor } from './HoursEditor'
import { createDraft } from '../../../../../utils/storeOnboarding'

const stableSession = vi.hoisted(() => ({ auth: true }))
vi.mock('../../../../../index', async () => ({
  Popup: () => null,
  useSession: () => [stableSession, {}],
  useLanguage: () => [{}, (key, fallback) => fallback],
  useConfig: () => [{ configs: {} }, {}],
  useUtils: () => [{ parseDate: () => '' }],
  Schedule: (await import('../../../../../components/Schedule')).Schedule
}))
vi.mock('../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (key, fallback) => fallback] }))
afterEach(cleanup)

it('uses the real unchanged hours UI with named days and keyboard add/copy/time controls', async () => {
  let form
  const Harness = () => {
    const [current, setCurrent] = useState(createDraft('owner@example.com').form)
    form = current
    return <HoursEditor form={current} onChange={schedule => setCurrent(f => ({ ...f, schedule }))} />
  }
  const { container } = render(<ThemeProvider theme={theme}><Harness /></ThemeProvider>)
  await waitFor(() => expect(container.querySelector('input[aria-label=Sunday]')).toBeTruthy())
  fireEvent.click(container.querySelector('input[aria-label=Sunday]'))
  await waitFor(() => expect(form.schedule[0].enabled).toBe(true))
  const monday = container.querySelector('input[aria-label=Monday]').closest('.day-title').parentElement
  const controls = within(monday)
  // Merged from main into the redesign (2026-10-09): the redesign's Schedule already renders native, named buttons
  // (Shared/UI/Schedule, `data-schedule-action`), so add, copy and apply are real <button>s (keyboard by default) with
  // the branch's names; the same capabilities are asserted on them.
  const add = await controls.findByRole('button', { name: 'Add Schedule: Monday' })
  expect(add.tagName).toBe('BUTTON')
  fireEvent.click(add)
  await waitFor(() => expect(form.schedule[1].lapses).toHaveLength(2))
  fireEvent.click(controls.getByRole('button', { name: 'Copy times to: Monday' }))
  await waitFor(() => expect(controls.getByRole('button', { name: 'Tuesday' })).toBeTruthy())
  fireEvent.click(controls.getByRole('button', { name: 'Tuesday' }))
  await waitFor(() => expect(controls.getByRole('button', { name: 'Tuesday' })).toHaveAttribute('aria-pressed', 'true'))
  fireEvent.click(controls.getByRole('button', { name: 'Apply' }))
  await waitFor(() => expect(form.schedule[2]).toEqual(form.schedule[1]))
  const openingHour = controls.getByRole('button', { name: 'Monday, Opening time, Hour, 1' })
  fireEvent.keyDown(openingHour, { key: 'Enter' })
  await waitFor(() => expect(openingHour.getAttribute('aria-expanded')).toBe('true'))
}, 30000)

it('makes the day name clickable once and keeps a hidden single-period delete out of keyboard actions', async () => {
  let form
  const Harness = () => {
    const [current, setCurrent] = useState(createDraft('owner@example.com').form)
    form = current
    return <HoursEditor form={current} onChange={schedule => setCurrent(f => ({ ...f, schedule }))} />
  }
  const { container } = render(<ThemeProvider theme={theme}><Harness /></ThemeProvider>)
  await waitFor(() => expect(container.querySelector('input[aria-label=Sunday]')).toBeTruthy())
  const sunday = container.querySelector('input[aria-label=Sunday]')
  fireEvent.click(sunday.closest('.day-title').querySelector('h4'))
  await waitFor(() => expect(form.schedule[0].enabled).toBe(true))
  fireEvent.click(sunday)
  await waitFor(() => expect(form.schedule[0].enabled).toBe(false))
  const monday = container.querySelector('input[aria-label=Monday]').closest('.day-title').parentElement
  // Merged from main into the redesign (2026-10-09): the hidden single-period delete is kept out of keyboard actions by
  // the redesign's Schedule itself (its wrapper is aria-hidden and inert), not by the onboarding enhancer.
  const hiddenDelete = within(monday).getByRole('button', { name: 'Delete Schedule: Monday 1', hidden: true })
  const wrapper = hiddenDelete.closest('[data-slot=schedule-delete-wrapper]')
  expect(wrapper).toHaveAttribute('aria-hidden', 'true')
  expect(wrapper.hasAttribute('inert')).toBe(true)
  expect(within(monday).queryByRole('button', { name: 'Delete Schedule: Monday 1' })).toBeNull()
}, 30000)

it('keeps an open hours dropdown within the available scrolling pane', async () => {
  let outside = false
  const geometry = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    if (this.hasAttribute('data-onboarding-content')) return { top: 500, bottom: 667, left: 0, right: 320, width: 320, height: 167 }
    if (this.classList.contains('select')) return { top: outside ? 400 : 580, bottom: outside ? 444 : 624, left: 40, right: 160, width: 120, height: 44 }
    return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }
  })
  try {
    const { container } = render(<ThemeProvider theme={theme}><div data-onboarding-content><HoursEditor form={createDraft('owner@example.com').form} onChange={vi.fn()} /></div></ThemeProvider>)
    const opening = await within(container).findByRole('button', { name: 'Monday, Opening time, Hour, 1' })
    fireEvent.click(opening)
    await waitFor(() => expect(opening.parentElement.querySelector('.list').style.getPropertyValue('--onboarding-popover-top')).toBe('500px'))
    expect(opening.parentElement.querySelector('.list').style.getPropertyValue('--onboarding-popover-height')).toBe('72px')
    outside = true
    fireEvent.scroll(container.querySelector('[data-onboarding-content]'))
    await waitFor(() => expect(opening.getAttribute('aria-expanded')).toBe('false'))
    outside = false
    fireEvent.click(opening)
    await waitFor(() => expect(opening.getAttribute('aria-expanded')).toBe('true'))
  } finally { geometry.mockRestore() }
}, 30000)

// the redesign's Schedule (`od-schedule-*`, Shared/UI/schedule.css) collided with the frame's old 110px day
// column: the day name broke mid-word («Tuesda / y»), «Unavailable» sat above the row and «+» / copy stacked. jsdom has no
// layout, so these read the rules the frame actually injects for the real Schedule markup.
const frameCss = container => {
  const frame = container.querySelector('fieldset')
  const own = [...frame.classList]
  const css = [...document.querySelectorAll('style')].map(style => style.textContent || [...(style.sheet?.cssRules || [])].map(rule => rule.cssText).join('')).join('').replace(/\s*([{}:;,])\s*/g, '$1').replace(/\s+/g, ' ')
  return { frame, css, rule: selector => own.map(name => new RegExp(`\\.${name}(?:\\.${name})? ${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{([^}]*)\\}`, 'g')).flatMap(re => [...css.matchAll(re)].map(match => match[1])) }
}

it('does not force a narrow day column or let the day name break mid-word', async () => {
  const { container } = render(<ThemeProvider theme={theme}><HoursEditor form={createDraft('owner@example.com').form} onChange={vi.fn()} /></ThemeProvider>)
  await waitFor(() => expect(container.querySelector('input[aria-label=Sunday]')).toBeTruthy())
  const { rule } = frameCss(container)
  expect(container.querySelector('.od-schedule-day-title h4')).toBeTruthy()
  expect(rule('.day-title').length).toBeGreaterThan(0) // the helper does read the frame's rules
  expect(rule('.day-title').join(';')).not.toMatch(/flex:0 0 110px/)
  expect(rule('.day-title h4').join(';')).toMatch(/overflow-wrap:normal/)
  expect(rule('.day-title h4').join(';')).toMatch(/word-break:normal/)
})

it('keeps add and copy in one row at the end of the day and centres the row', async () => {
  const { container } = render(<ThemeProvider theme={theme}><HoursEditor form={createDraft('owner@example.com').form} onChange={vi.fn()} /></ThemeProvider>)
  await waitFor(() => expect(container.querySelector('input[aria-label=Sunday]')).toBeTruthy())
  const { rule } = frameCss(container)
  const actions = container.querySelector('.od-schedule-actions')
  // the shared stylesheet scopes `.od-schedule-actions` to `.od-ui`, which this element does not carry
  expect(actions.classList.contains('od-ui')).toBe(false)
  expect(rule('.od-schedule-actions').join(';')).toMatch(/display:flex/)
  expect(rule('.od-schedule-actions').join(';')).toMatch(/align-items:center/)
  expect(rule('.od-schedule-actions').join(';')).toMatch(/margin-inline-start:auto/)
  expect(rule('.od-schedule-actions .od-icon-button').join(';')).toMatch(/min-width:44px/)
  expect(rule('.od-schedule-actions .od-icon-button').join(';')).toMatch(/min-height:44px/)
  expect(rule('.day-selector').join(';')).toMatch(/align-items:center/)
  expect(within(container).getByRole('button', { name: 'Add Schedule: Monday' })).toBeTruthy()
  expect(within(container).getByRole('button', { name: 'Copy times to: Monday' })).toBeTruthy()
})
