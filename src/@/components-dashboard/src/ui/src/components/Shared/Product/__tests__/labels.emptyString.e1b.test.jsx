// redesign W0-2 r2 (W0-Q1-01, E1b): a wrapper throws when its name or label is MISSING (undefined or null: a programmer
// error the tests catch) and never when it is an empty string (a project's empty translation paints empty, as in main).
import React from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SegmentedControl } from '../SegmentedControl'
import { ColumnManager } from '../ColumnManager'
import { Tabs } from '../Tabs'
import { Sheet } from '../Sheet'
import { OrderRoute } from '../OrderRoute'
import { FilterBar, FilterChips, FilterPill, SearchField } from '../FilterBar'
import { SplitView } from '../SplitView'

beforeEach(() => {
  // useWidthQuery in SplitView needs matchMedia; jsdom has none.
  window.matchMedia = query => ({
    media: query,
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {}
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  delete window.matchMedia
  document.getElementById('app-modals')?.remove()
})

const noop = () => {}
const COLUMNS = [
  { id: 'order', label: 'Order', visible: true, locked: true },
  { id: 'driver', label: 'Driver', visible: true }
]
const STEPS = [
  { key: 'placed', label: 'Placed', state: 'done', at: '15:51' },
  { key: 'ready', label: 'Ready', state: 'next', at: null }
]
const ITEMS = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]
const OPTIONS = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]

// Every label-ish prop a wrapper takes, filled; each case swaps one for '' / undefined / null.
const FULL = {
  SegmentedControl: { label: 'Show', value: 'a', onValueChange: noop, options: OPTIONS },
  ColumnManager: {
    columns: COLUMNS,
    onChange: noop,
    onReset: noop,
    triggerLabel: 'Columns',
    title: 'Table columns',
    resetLabel: 'Reset',
    lockedNote: 'Always shown',
    widthHiddenNote: 'Hidden at this width',
    moveUpLabel: label => `Move ${label} up`,
    moveDownLabel: label => `Move ${label} down`
  },
  Tabs: { label: 'Orders', value: 'a', onValueChange: noop, items: ITEMS },
  Sheet: { open: true, onOpenChange: noop, title: 'Details', closeLabel: 'Close' },
  OrderRoute: { steps: STEPS, label: 'Order progress', describeStep: step => step.label },
  FilterBar: { label: 'Filters', search: <span>x</span> },
  SearchField: { value: '', onChange: noop, label: 'Search', clearLabel: 'Clear' },
  FilterPill: { label: 'Status', onClick: noop },
  FilterChips: { label: 'Active filters', chips: [{ key: 'k', label: 'Open', removeLabel: 'Remove Open' }], clearAllLabel: 'Clear all', onClearAll: noop },
  SplitView: { open: false, onClose: noop, list: <p>list</p>, panel: <p>panel</p>, panelLabel: 'Order details', resizeLabel: 'Resize', storageKey: undefined }
}

const COMPONENTS = {
  SegmentedControl,
  ColumnManager,
  Tabs,
  Sheet,
  OrderRoute,
  FilterBar,
  SearchField,
  FilterPill,
  FilterChips,
  SplitView
}

// [wrapper, label prop]. OrderRoute's describeStep and ColumnManager's moveUpLabel/moveDownLabel are functions: their contract
// (a function or an Error) does not change, and is not part of this class.
const LABEL_PROPS = [
  ['SegmentedControl', 'label'],
  ['ColumnManager', 'triggerLabel'],
  ['ColumnManager', 'title'],
  ['ColumnManager', 'resetLabel'],
  ['ColumnManager', 'lockedNote'],
  ['ColumnManager', 'widthHiddenNote'],
  ['Tabs', 'label'],
  ['Sheet', 'title'],
  ['Sheet', 'closeLabel'],
  ['OrderRoute', 'label'],
  ['FilterBar', 'label'],
  ['SearchField', 'label'],
  ['SearchField', 'clearLabel'],
  ['FilterPill', 'label'],
  ['FilterChips', 'label'],
  ['SplitView', 'panelLabel'],
  ['SplitView', 'resizeLabel']
]

const mount = (name, prop, value) => {
  const Component = COMPONENTS[name]
  return render(<Component {...FULL[name]} {...{ [prop]: value }} />)
}

describe('Product labels: an empty string paints, a missing label throws (W0-Q1-01)', () => {
  it.each(LABEL_PROPS)('%s with %s = \'\' renders without throwing', (name, prop) => {
    expect(() => mount(name, prop, '')).not.toThrow()
  })

  it.each(LABEL_PROPS)('%s with %s = undefined still throws', (name, prop) => {
    expect(() => mount(name, prop, undefined)).toThrow(new RegExp(`${name} needs (a |an )?${prop === 'label' ? 'label' : prop}`))
  })

  it.each(LABEL_PROPS)('%s with %s = null still throws', (name, prop) => {
    expect(() => mount(name, prop, null)).toThrow(new RegExp(`${name} needs`))
  })

  it('does not change the throws that are not about a label', () => {
    expect(() => render(<SegmentedControl label='Show' value='a' onValueChange={noop} options={[1, 2, 3, 4, 5].map(n => ({ value: String(n), label: String(n) }))} />))
      .toThrow(/at most 4/i)
    expect(() => mount('OrderRoute', 'describeStep', undefined)).toThrow('OrderRoute needs describeStep')
    expect(() => mount('ColumnManager', 'moveUpLabel', undefined)).toThrow('ColumnManager needs moveUpLabel(label)')
    expect(() => render(<FilterBar label='Filters' search={<span>x</span>} />)).not.toThrow()
  })

  it('FilterBar overflowLabel is a function: its contract does not change', () => {
    expect(() => render(<FilterBar label='Filters' search={<span>x</span>} overflowLabel={n => `+${n}`} />)).not.toThrow()
  })
})
