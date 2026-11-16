import React, { useState } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

// redesign W0-2e (T0-8): the alert dialog is a Product wrapper, so it has no text of its own.
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback]
}))

import { AlertDialog } from '../AlertDialog'

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

describe('Product AlertDialog (W0-2e)', () => {
  it.each(['closeLabel', 'confirmLabel'])('throws without a %s', (name) => {
    const props = { open: true, title: 'Order bill', content: 'Done', closeLabel: 'Close', confirmLabel: 'OK', onClose: () => {} }
    delete props[name]
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => render(<AlertDialog {...props} />)).toThrow(`AlertDialog needs a ${name}`)
    } finally {
      error.mockRestore()
    }
  })

  it('shows the title, the content and both buttons with the labels it is given', () => {
    render(
      <AlertDialog
        open
        title='Order bill'
        content={['First line', ['Second line']]}
        closeLabel='Close alert'
        confirmLabel='Got it'
        onClose={() => {}}
      />
    )
    // redesign W0-2 r2 (W0-Q1-10): the role is alertdialog
    expect(screen.getByRole('alertdialog', { name: 'Order bill' })).toBeInTheDocument()
    expect(screen.getByText('First line')).toBeInTheDocument()
    expect(screen.getByText('Second line')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close alert' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument()
  })

  it.each(['Close alert', 'Got it'])('calls onClose when %s is pressed', async (name) => {
    const onClose = vi.fn()
    render(
      <AlertDialog open title='Order bill' content='Done' closeLabel='Close alert' confirmLabel='Got it' onClose={onClose} />
    )
    await userEvent.setup().click(screen.getByRole('button', { name }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// redesign W0-2 r2 (W0-Q1-01): an empty label paints empty; only a missing one (undefined or null) throws.
describe('Product AlertDialog · labels (W0-Q1-01)', () => {
  const base = { title: 'Order bill', content: 'Done', closeLabel: 'Close', confirmLabel: 'OK', onClose: () => {} }

  it.each(['title', 'closeLabel', 'confirmLabel'])('paints with an empty %s, open or closed', (name) => {
    for (const open of [true, false]) {
      const { unmount } = render(<AlertDialog {...base} open={open} {...{ [name]: '' }} />)
      if (open) expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      unmount()
    }
  })

  it.each(['title', 'closeLabel', 'confirmLabel'])('still throws when %s is undefined or null', (name) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      for (const value of [undefined, null]) {
        expect(() => render(<AlertDialog {...base} open {...{ [name]: value }} />)).toThrow(`AlertDialog needs a ${name}`)
      }
    } finally {
      error.mockRestore()
    }
  })
})

// redesign W0-2 r2 (W0-Q1-10): an alertdialog described by its messages, as the legacy Alert was.
describe('Product AlertDialog · role and description (W0-Q1-10)', () => {
  it('is an alertdialog whose description is its messages', () => {
    render(
      <AlertDialog open title='Order bill' content={['First line', ['Second line']]} closeLabel='Close' confirmLabel='OK' onClose={() => {}} />
    )
    const dialog = screen.getByRole('alertdialog', { name: 'Order bill' })
    expect(dialog).toHaveAccessibleDescription('First line Second line')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('points at nothing when there is no message', () => {
    render(<AlertDialog open title='Order bill' content={[]} closeLabel='Close' confirmLabel='OK' onClose={() => {}} />)
    expect(screen.getByRole('alertdialog')).not.toHaveAttribute('aria-describedby')
  })
})

// redesign W0-2 r2 (W0-P1-05): the report endpoint's two keys have a text by default, as the Alert of main had.
describe('Product AlertDialog · messages the API sends as keys (W0-P1-05)', () => {
  it.each([
    ['ERROR_REPORT_VERY_LONG_PERIOD', 'Error report, very long period'],
    ['ERROR_REPORT_MAX_A_DAY_AS_PERIOD', 'Error report, max a day as period']
  ])('shows the text of %s when the project has no translation', (key, text) => {
    render(<AlertDialog open title='Export' content={[key]} closeLabel='Close' confirmLabel='OK' onClose={() => {}} />)
    expect(screen.getByText(text)).toBeInTheDocument()
    expect(screen.queryByText(key)).not.toBeInTheDocument()
  })

  it('leaves any other message as it is', () => {
    render(<AlertDialog open title='Export' content='Failed to fetch' closeLabel='Close' confirmLabel='OK' onClose={() => {}} />)
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument()
  })
})

// redesign W0-2 r2 (W0-Q1-06): the status select of the order foot is rebuilt when its change fails (a new trigger
// replaces the one that had the focus), so the focus has nowhere to go back to. `returnFocus` names where.
describe('Product AlertDialog · focus on close (W0-Q1-06)', () => {
  let api
  const Harness = ({ withReturnFocus = true, extra = null }) => {
    const [open, setOpen] = useState(false)
    const [version, setVersion] = useState(0)
    api = {
      rebuild: () => setVersion(v => v + 1),
      show: () => setOpen(true)
    }
    return (
      <>
        <div className='foot-selector'>
          <button key={version} type='button' aria-haspopup='listbox' data-version={version}>Order status</button>
        </div>
        {extra}
        <AlertDialog
          open={open}
          title='Order details'
          content='Failed to fetch'
          closeLabel='Close'
          confirmLabel='OK'
          returnFocus={withReturnFocus ? () => document.querySelector('.foot-selector [aria-haspopup="listbox"]') : undefined}
          onClose={() => setOpen(false)}
        />
      </>
    )
  }
  const failTheChange = async () => {
    screen.getByRole('button', { name: 'Order status' }).focus()
    act(() => { api.rebuild(); api.show() })
    await screen.findByRole('alertdialog', { name: 'Order details' })
  }
  const closers = {
    Escape: async (user) => { await user.keyboard('{Escape}') },
    OK: async (user) => { await user.click(screen.getByRole('button', { name: 'OK' })) },
    'the close button': async (user) => { await user.click(screen.getByRole('button', { name: 'Close' })) }
  }

  it.each(Object.keys(closers))('on %s the focus returns to the status select, the new one', async (way) => {
    const user = userEvent.setup()
    render(<Harness />)
    await failTheChange()
    await closers[way](user)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    const select = screen.getByRole('button', { name: 'Order status' })
    expect(select).toHaveAttribute('data-version', '1')
    await waitFor(() => expect(document.activeElement).toBe(select))
  })

  it('without returnFocus the focus is lost to <body> once the control is gone (the defect)', async () => {
    const user = userEvent.setup()
    render(<Harness withReturnFocus={false} />)
    await failTheChange()
    await user.click(screen.getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(document.activeElement).toBe(document.body)
  })

  it('an opener that is still in the page keeps the focus back, returnFocus or not', async () => {
    const user = userEvent.setup()
    render(<Harness extra={<button type='button'>Other control</button>} />)
    const other = screen.getByRole('button', { name: 'Other control' })
    other.focus()
    act(() => { api.show() })
    await screen.findByRole('alertdialog', { name: 'Order details' })
    await user.click(screen.getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await waitFor(() => expect(document.activeElement).toBe(other))
  })
})
