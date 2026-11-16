import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { ColumnAllowSettingPopover } from './ColumnAllowSettingPopover'

const options = [
  { value: 'status', content: 'Status' },
  { value: 'customer', content: 'Customer name and contact details' },
  { value: 'driver', content: 'Driver' },
  { value: 'total', content: 'Total' }
]

const renderPopover = (props = {}) => render(
  <ThemeProvider theme={createDashboardTheme(theme)}>
    <ColumnAllowSettingPopover
      optionsDefault={options}
      allowColumns={{ status: true, customer: false, driver: true, total: false }}
      handleChangeAllowColumns={vi.fn()}
      {...props}
    />
  </ThemeProvider>
)

const openPanel = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Manage columns' }))
  return screen.getByRole('group', { name: 'Manage columns' })
}

describe('ColumnAllowSettingPopover open panel', () => {
  it('lists every column as its own pressable row, in order', () => {
    const onChange = vi.fn()
    renderPopover({ handleChangeAllowColumns: onChange })
    const panel = openPanel()

    expect(screen.getByRole('button', { name: 'Manage columns', expanded: true })).toBeTruthy()
    const rows = within(panel).getAllByRole('button')
    expect(rows.map(row => row.textContent)).toEqual(options.map(option => option.content))
    expect(rows.map(row => row.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'true', 'false'])
    rows.forEach(row => expect(row.parentElement).toBe(rows[0].parentElement))

    fireEvent.click(rows[1])
    expect(onChange).toHaveBeenCalledWith('customer')
  })

  it('reads the nested visable map used by the Orders table', () => {
    renderPopover({
      isOrder: true,
      allowColumns: { status: { visable: true }, customer: { visable: false }, driver: {}, total: { visable: true } }
    })
    const rows = within(openPanel()).getAllByRole('button')
    expect(rows.map(row => row.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'true'])
  })

  it('does not force a size or clip the panel with inline styles', () => {
    const { container } = renderPopover()
    const panel = openPanel()

    // A forced min-width wins over the content size, and an overflow clip on the
    // host box hides or crops whatever hangs off it.
    expect(panel.style.minWidth).toBe('')
    expect(panel.style.width).toBe('')
    expect(panel.style.height).toBe('')
    expect(panel.style.display).toBe('block')
    const host = container.querySelector('[data-slot="column-allow-setting-popover"]')
    expect(host.style.overflow).toBe('')
    expect(host.contains(panel)).toBe(true)
  })

  it('computes viewport coordinates because the stylesheet pins the panel to fixed', () => {
    renderPopover()
    expect(openPanel().style.position).toBe('fixed')
  })

  it('stays hidden until opened and closes on Escape returning focus to the trigger', () => {
    const { container } = renderPopover()
    const panel = container.querySelector('[role="group"]')
    const trigger = screen.getByRole('button', { name: 'Manage columns' })
    expect(panel.style.display).toBe('none')
    fireEvent.click(trigger)
    expect(panel.style.display).toBe('block')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(panel.style.display).toBe('none')
    expect(document.activeElement).toBe(trigger)
  })

  it('uses a custom string title as the accessible name and shows it', () => {
    renderPopover({ title: 'Flat columns' })
    fireEvent.click(screen.getByRole('button', { name: 'Flat columns' }))
    expect(within(screen.getByRole('group', { name: 'Flat columns' })).getByText('Flat columns')).toBeTruthy()
  })
})

describe('ColumnAllowSettingPopover stylesheet', () => {
  // Vitest runs with `css: false`, so the cascade cannot be measured here. The
  // browser spec (e2e/brand-system-app/orders-columns-popover.spec.js) measures the
  // real panel; this guards the source rules it depends on.
  const css = readFileSync(resolve(__dirname, 'column-allow-setting-popover.css'), 'utf8')
  const rule = selector => {
    const start = css.indexOf(`${selector} {`)
    expect(start, `${selector} rule exists`).toBeGreaterThan(-1)
    return css.slice(start, css.indexOf('}', start))
  }

  it('keeps rows in normal flow against host `button` descendant rules', () => {
    const reset = rule('.od-ui.od-column-popover-item')
    expect(reset).toMatch(/position:\s*static/)
    expect(reset).toMatch(/transform:\s*none/)
    expect(reset).toMatch(/z-index:\s*auto/)
    expect(reset).toMatch(/justify-content:\s*flex-start/)
  })

  it('sizes the panel to its content and does not inherit nowrap from a table header', () => {
    const panel = rule('.od-ui:where(.od-column-popover-panel)')
    expect(panel).toMatch(/width:\s*max-content/)
    expect(panel).toMatch(/white-space:\s*normal/)
    expect(panel).toMatch(/overflow-y:\s*auto/)
    expect(panel).not.toMatch(/min-width/)
  })
})
