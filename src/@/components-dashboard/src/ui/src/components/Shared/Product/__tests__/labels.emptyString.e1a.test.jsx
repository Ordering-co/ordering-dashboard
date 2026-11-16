// redesign W0-2 r2 (W0-Q1-01): a project can translate a label to ''. The wrapper then paints
// it empty (as main does); only a label that is missing (undefined / null) is a programmer
// error and throws. Covers the label throws of Menu, SelectionBar, Dialog, ConfirmDialog,
// ActivityTimeline, DataTable and IconButton. Status.jsx has no label throw (its throws are
// the unknown family / SLA level, which do not change).
import React from 'react'
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Ellipsis } from '../../Icon'
import { ActivityTimeline } from '../ActivityTimeline'
import { IconButton } from '../Button'
import { DataTable } from '../DataTable'
import { ConfirmDialog, Dialog } from '../Dialog'
import { Menu } from '../Menu'
import { SelectionBar } from '../SelectionBar'

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

const COLUMNS = [{ id: 'number', header: 'Order', cell: row => row.number }]
const ROWS = [{ id: 'a', number: '#1' }]
const ITEMS = [{ id: 'e1', at: 'Oct 2', title: 'Order placed', details: <span>App</span> }]

const CASES = [
  {
    name: 'IconButton label',
    message: 'IconButton needs a label',
    mount: label => <IconButton icon={Ellipsis} label={label} />
  },
  {
    name: 'Menu label',
    message: 'Menu needs a label',
    mount: label => <Menu label={label} icon={Ellipsis} items={[{ key: 'a', label: 'One', onSelect: () => {} }]} />
  },
  {
    name: 'SelectionBar label',
    message: 'SelectionBar needs a label',
    mount: label => <SelectionBar label={label} clearLabel='Clear' countLabel='1 selected' onClear={() => {}} />
  },
  {
    name: 'SelectionBar clearLabel',
    message: 'SelectionBar needs a clearLabel',
    mount: label => <SelectionBar label='Bulk' clearLabel={label} countLabel='1 selected' onClear={() => {}} />
  },
  {
    name: 'Dialog title',
    message: 'Dialog needs a title',
    mount: label => <Dialog open onOpenChange={() => {}} title={label} closeLabel='Close'>body</Dialog>
  },
  {
    name: 'Dialog closeLabel',
    message: 'Dialog needs a closeLabel',
    mount: label => <Dialog open onOpenChange={() => {}} title='Edit' closeLabel={label}>body</Dialog>
  },
  ...['title', 'confirmLabel', 'cancelLabel', 'closeLabel'].map(prop => ({
    name: `ConfirmDialog ${prop}`,
    message: `ConfirmDialog needs a ${prop}`,
    mount: label => (
      <ConfirmDialog
        open
        title='Delete?'
        confirmLabel='Delete'
        cancelLabel='Keep'
        closeLabel='Close'
        onConfirm={() => {}}
        onCancel={() => {}}
        {...{ [prop]: label }}
      />
    )
  })),
  {
    name: 'ActivityTimeline label',
    message: 'ActivityTimeline needs a label',
    mount: label => <ActivityTimeline label={label} detailsLabel='Details' items={ITEMS} />
  },
  {
    name: 'ActivityTimeline detailsLabel (an item has details)',
    message: 'ActivityTimeline needs detailsLabel',
    mount: label => <ActivityTimeline label='Activity' detailsLabel={label} items={ITEMS} />
  },
  {
    name: 'DataTable label',
    message: 'DataTable needs a label',
    mount: label => <DataTable label={label} columns={COLUMNS} rows={ROWS} getRowId={row => row.id} />
  }
]

describe('empty-string labels (W0-Q1-01)', () => {
  it.each(CASES)('$name: paints without throwing when it is an empty string', ({ mount }) => {
    expect(() => render(mount(''))).not.toThrow()
  })

  it.each(CASES)('$name: still throws when it is missing (undefined)', ({ mount, message }) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(mount(undefined))).toThrow(message)
    console.error.mockRestore()
  })

  it.each(CASES)('$name: still throws when it is null', ({ mount, message }) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(mount(null))).toThrow(message)
    console.error.mockRestore()
  })
})
