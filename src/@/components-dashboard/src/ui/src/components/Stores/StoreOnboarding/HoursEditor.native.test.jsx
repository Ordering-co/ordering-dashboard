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
  const add = await controls.findByRole('button', { name: 'Add Schedule Monday' })
  expect(add.getAttribute('tabindex')).toBe('0')
  fireEvent.keyDown(add, { key: 'Enter' })
  await waitFor(() => expect(form.schedule[1].lapses).toHaveLength(2))
  fireEvent.keyDown(controls.getByRole('button', { name: 'Monday, Copy times to' }), { key: 'Enter' })
  await waitFor(() => expect(controls.getByRole('button', { name: 'Copy times to Tuesday' })).toBeTruthy())
  fireEvent.keyDown(controls.getByRole('button', { name: 'Copy times to Tuesday' }), { key: ' ' })
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
  expect(within(monday).getByRole('button', { name: 'Delete Schedule Monday', hidden: true })).toHaveAttribute('aria-disabled', 'true')
  expect(monday.querySelector('[data-onboarding-hidden=true]')).toBeTruthy()
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
