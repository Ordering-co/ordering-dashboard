/* eslint-disable import/first */
// redesign audit-4 (P3): the «Select …» placeholders of the filters sheet read in the subtle text colour,
// like «Any». jsdom does not apply the stylesheet, so the rule's selector is taken from the file and
// matched against the real pickers (FirstSelect and MultiSelect) the sheet is built from.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text]
}))

import { Select } from '../../../../styles/Select/FirstSelect'
import { MultiSelect } from '../../../../styles/MultiSelect'

const css = readFileSync(path.resolve(__dirname, '../orders-filter-group.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const currentTheme = createDashboardTheme(theme)
const options = [{ value: 1, content: <span>One</span>, name: 'One' }, { value: 2, content: <span>Two</span>, name: 'Two' }]

// The rule that sets the placeholder colour: every selector of its list, scoped to the sheet body.
const rule = css.match(/([^{}]*od-first-select-trigger\s*>\s*:not\([^{}]*)\{([^}]*)\}/)
const selectors = rule ? rule[1].split(/,\s*(?=\.odc-ofs-body)/).map(selector => selector.trim()) : []

const inSheet = node => (
  <ThemeProvider theme={currentTheme}><div className='odc-ofs-body'>{node}</div></ThemeProvider>
)
const matches = (container, element) => selectors.some(selector => element.matches(selector) && container.querySelector(selector) !== null)
const placeholder = text => <div data-testid='ph'>{text}</div>

describe('Filters sheet · «Select …» placeholders (audit 4)', () => {
  it('sets them in the subtle text colour through one rule on the sheet body', () => {
    expect(rule).not.toBeNull()
    expect(rule[2]).toMatch(/color:\s*var\(--od-x-text-subtle\)/)
    expect(selectors.every(selector => selector.startsWith('.odc-ofs-body '))).toBe(true)
  })

  it('reaches the empty state of a single picker and leaves its chosen value and chevron alone', () => {
    const empty = render(inSheet(<Select options={options} placeholder={placeholder('Select city')} noSelected={false} />))
    expect(matches(empty.container, empty.getByTestId('ph'))).toBe(true)
    expect(matches(empty.container, empty.container.querySelector('.od-first-select-chevron'))).toBe(false)
    empty.unmount()
    const chosen = render(inSheet(<Select options={options} defaultValue={1} placeholder={placeholder('Select city')} />))
    expect(chosen.queryByTestId('ph')).toBeNull()
    const header = chosen.container.querySelector('.od-first-select-header')
    expect(header).not.toBeNull()
    expect(matches(chosen.container, header)).toBe(false)
    expect(matches(chosen.container, header.firstElementChild)).toBe(false)
  })

  it('reaches the empty state of a multiple picker and leaves its chosen values and chevron alone', () => {
    const empty = render(inSheet(<MultiSelect options={options} defaultValue={[]} placeholder={placeholder('Select business')} />))
    expect(matches(empty.container, empty.getByTestId('ph'))).toBe(true)
    expect(matches(empty.container, empty.container.querySelector('.od-multi-select-chevron'))).toBe(false)
    empty.unmount()
    const chosen = render(inSheet(<MultiSelect options={options} defaultValue={[1]} placeholder={placeholder('Select business')} />))
    expect(chosen.queryByTestId('ph')).toBeNull()
    const header = chosen.container.querySelector('.od-multi-select-header')
    expect(header).not.toBeNull()
    expect(matches(chosen.container, header)).toBe(false)
  })

  it('stays literal-free: the colour is a token', () => {
    expect(rule[2]).not.toMatch(/#[0-9a-f]{3,8}\b|rgb|hsl/i)
  })
})
