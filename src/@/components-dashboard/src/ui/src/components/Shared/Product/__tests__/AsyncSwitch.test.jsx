/* eslint-disable import/first */
// redesign 2.G: the switch that saves at once, promoted from the store list (StoreRowSwitch, M-12). It is
// controlled by the stored value, busy while `onToggle` runs, and when the save fails (`{ ok: false, error }` or a throw) it
// goes back to the stored value and says why, with the API message translated. It has no text of its own.
import React, { useState } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const DICTIONARY = { INTERNAL_ERROR: 'Error interno' }
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ dictionary: DICTIONARY }, (key, fallback) => DICTIONARY[key] ?? fallback]
}))

import { AsyncSwitch } from '../AsyncSwitch'

// The stored value lives in the consumer, as a controller's record does: it changes only when the save succeeds.
const Host = ({ initial = true, result, gate, saves = [], ...props }) => {
  const [stored, setStored] = useState(initial)
  const onToggle = async (next) => {
    saves.push(next)
    if (gate) await gate
    const outcome = typeof result === 'function' ? result() : result
    if (!(outcome && outcome.ok === false)) setStored(next)
    return outcome
  }
  return <AsyncSwitch checked={stored} onToggle={onToggle} label='Accept orders' failureText="We couldn't save the change." {...props} />
}

const silence = () => vi.spyOn(console, 'error').mockImplementation(() => {})

describe('Product AsyncSwitch — its names', () => {
  it('throws without a label or children, as Switch does', () => {
    const error = silence()
    try {
      expect(() => render(<AsyncSwitch checked onToggle={() => {}} failureText='Failed' />)).toThrow('Switch needs a label')
    } finally {
      error.mockRestore()
    }
  })

  it('throws without a failureText, since it has no text of its own', () => {
    const error = silence()
    try {
      expect(() => render(<AsyncSwitch checked onToggle={() => {}} label='Accept orders' />)).toThrow('AsyncSwitch needs a failureText')
    } finally {
      error.mockRestore()
    }
  })

  it('takes an empty failureText as a translation that paints empty (W0-Q1-01)', async () => {
    render(<Host failureText='' result={{ ok: false }} />)
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Accept orders' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/^$/)
  })

  it('names itself with visible text when it has children, and the whole text toggles', async () => {
    render(<Host label={undefined}>Notify the driver by SMS</Host>)
    const toggle = screen.getByRole('switch', { name: 'Notify the driver by SMS' })
    await userEvent.setup().click(screen.getByText('Notify the driver by SMS'))
    await waitFor(() => expect(toggle).not.toBeChecked())
  })

  it('passes other props to the switch (an aria-label beside visible text)', () => {
    render(<Host aria-label='Enable Sample Burgers'>Enable</Host>)
    expect(screen.getByRole('switch', { name: 'Enable Sample Burgers' })).toHaveTextContent('Enable')
  })

  it('forwards tone to the switch root (stores 3.B, )', () => {
    const { rerender } = render(<Host tone='neutral' />)
    expect(screen.getByRole('switch', { name: 'Accept orders' })).toHaveAttribute('data-tone', 'neutral')
    rerender(<Host />)
    expect(screen.getByRole('switch', { name: 'Accept orders' })).not.toHaveAttribute('data-tone')
  })

  it('keeps the props the save owns: a consumer onCheckedChange, readOnly and data-busy change nothing', async () => {
    const onCheckedChange = vi.fn()
    const saves = []
    render(<Host saves={saves} data-busy='' readOnly onCheckedChange={onCheckedChange} className='host-switch' />)
    const toggle = screen.getByRole('switch', { name: 'Accept orders' })
    expect(toggle).not.toHaveAttribute('aria-busy')
    expect(toggle.closest('.odc-async-switch')).toHaveClass('host-switch')
    await userEvent.setup().click(toggle)
    await waitFor(() => expect(toggle).not.toBeChecked())
    expect(saves).toEqual([false])
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  // AB-S02 (of ): a consumer that saves the same record from another control (a list row and the panel header)
  // says so with `busy` (or aria-busy). The switch used to drop it: it looked idle and took presses while the other save ran.
  it('respects a busy the consumer gives: busy, aria-busy, and presses ignored (no save is started)', async () => {
    const saves = []
    const { rerender } = render(<Host saves={saves} busy />)
    const toggle = screen.getByRole('switch', { name: 'Accept orders' })
    expect(toggle).toHaveAttribute('aria-busy', 'true')
    expect(toggle).toHaveAttribute('data-busy')
    expect(toggle).toBeChecked()
    await userEvent.setup().click(toggle)
    expect(saves).toEqual([])
    expect(toggle).toBeChecked()
    rerender(<Host saves={saves} />)
    expect(toggle).not.toHaveAttribute('aria-busy')
    await userEvent.setup().click(toggle)
    await waitFor(() => expect(toggle).not.toBeChecked())
    expect(saves).toEqual([false])
  })

  it('reads a consumer aria-busy as busy, except an explicit false; the default is idle', () => {
    const { rerender } = render(<Host aria-busy='true' />)
    const toggle = screen.getByRole('switch', { name: 'Accept orders' })
    expect(toggle).toHaveAttribute('aria-busy', 'true')
    rerender(<Host aria-busy='false' />)
    expect(toggle).not.toHaveAttribute('aria-busy')
    rerender(<Host />)
    expect(toggle).not.toHaveAttribute('aria-busy')
    expect(toggle).not.toHaveAttribute('data-busy')
  })

  it('passes disabled to the switch (a consumer disabled stays)', () => {
    render(<Host disabled />)
    expect(screen.getByRole('switch', { name: 'Accept orders' })).toBeDisabled()
  })

  it('stays busy while its own save runs even when the consumer busy ends in between', async () => {
    const user = userEvent.setup()
    let release
    const gate = new Promise(resolve => { release = resolve })
    const { rerender } = render(<Host gate={gate} result={{ ok: true }} busy={false} />)
    const toggle = screen.getByRole('switch', { name: 'Accept orders' })
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-busy', 'true')
    rerender(<Host gate={gate} result={{ ok: true }} busy />)
    rerender(<Host gate={gate} result={{ ok: true }} busy={false} />)
    expect(toggle).toHaveAttribute('aria-busy', 'true')
    await act(async () => { release() })
    await waitFor(() => expect(toggle).not.toHaveAttribute('aria-busy'))
  })
})

describe('Product AsyncSwitch — saving', () => {
  it('shows the stored value and calls onToggle with the next one', async () => {
    const saves = []
    render(<Host saves={saves} />)
    const toggle = screen.getByRole('switch', { name: 'Accept orders' })
    expect(toggle).toBeChecked()
    await userEvent.setup().click(toggle)
    await waitFor(() => expect(toggle).not.toBeChecked())
    expect(saves).toEqual([false])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('is busy while it saves, shows the value being saved, and ignores a second press', async () => {
    const user = userEvent.setup()
    const saves = []
    let release
    const gate = new Promise(resolve => { release = resolve })
    render(<Host saves={saves} gate={gate} result={{ ok: true }} />)
    const toggle = screen.getByRole('switch', { name: 'Accept orders' })
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-busy', 'true')
    expect(toggle).not.toBeChecked()
    await user.click(toggle)
    expect(saves).toHaveLength(1)
    await act(async () => { release() })
    await waitFor(() => expect(toggle).not.toHaveAttribute('aria-busy'))
    expect(toggle).not.toBeChecked()
  })

  it('reads an onToggle that returns nothing, or a plain value, as a success', async () => {
    render(<AsyncSwitch checked onToggle={() => undefined} label='Accept orders' failureText='Failed' />)
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Accept orders' }))
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Accept orders' })).not.toHaveAttribute('aria-busy'))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('Product AsyncSwitch — M-12: a save that fails', () => {
  it('goes back to the stored value and says why, translated by the API message key', async () => {
    render(<Host result={{ ok: false, error: ['Internal error'] }} />)
    const toggle = screen.getByRole('switch', { name: 'Accept orders' })
    await userEvent.setup().click(toggle)
    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent('Error interno')
    expect(toggle).toBeChecked()
    expect(toggle).not.toHaveAttribute('aria-busy')
    expect(notice.closest('.odc-async-switch')).toHaveAttribute('data-failed')
  })

  it('reads the message of an error object, and says failureText when the error has no text', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Host result={{ ok: false, error: { message: 'Network down' } }} />)
    await user.click(screen.getByRole('switch', { name: 'Accept orders' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Network down')
    unmount()

    render(<Host result={{ ok: false }} />)
    await user.click(screen.getByRole('switch', { name: 'Accept orders' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't save the change.")
  })

  it('treats a throw as a failure', async () => {
    render(<Host result={() => { throw new Error('Boom') }} />)
    const toggle = screen.getByRole('switch', { name: 'Accept orders' })
    await userEvent.setup().click(toggle)
    expect(await screen.findByRole('alert')).toHaveTextContent('Boom')
    expect(toggle).toBeChecked()
  })

  it('clears the notice on a new attempt', async () => {
    const user = userEvent.setup()
    let outcome = { ok: false, error: ['Not allowed'] }
    render(<Host result={() => outcome} />)
    const toggle = screen.getByRole('switch', { name: 'Accept orders' })
    await user.click(toggle)
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed')
    outcome = { ok: true }
    await user.click(toggle)
    await waitFor(() => expect(toggle).not.toBeChecked())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(toggle.closest('.odc-async-switch')).not.toHaveAttribute('data-failed')
  })

  it('does nothing after it is gone (a disabled store leaves the Active tab with its row)', async () => {
    const error = vi.spyOn(console, 'error')
    let release
    const gate = new Promise(resolve => { release = resolve })
    const { unmount } = render(<Host gate={gate} result={{ ok: false, error: ['Late'] }} />)
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Accept orders' }))
    unmount()
    await act(async () => { release() })
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })
})

// (7, R1-05 of ): the notice is about the value that was stored when the save failed. When that value
// changes from outside (the group's header switch saves it, a refresh brings it), the notice is old and goes; the same value
// coming back later does not bring it back. A consumer that flips its value during the save and puts it back keeps it.
describe('Product AsyncSwitch — confirmChange (redesign )', () => {
  const press = async (user) => {
    const toggle = screen.getByRole('switch', { name: 'Accept orders' })
    await user.click(toggle)
    return toggle
  }

  it('without the prop a press saves at once, as before', async () => {
    const saves = []
    render(<Host saves={saves} />)
    const toggle = await press(userEvent.setup())
    await waitFor(() => expect(toggle).not.toBeChecked())
    expect(saves).toEqual([false])
  })

  it('a «no» saves nothing: the switch keeps the stored value, is not busy, and shows no notice', async () => {
    const saves = []
    const confirmChange = vi.fn().mockReturnValue(false)
    render(<Host saves={saves} confirmChange={confirmChange} />)
    const toggle = await press(userEvent.setup())
    expect(confirmChange).toHaveBeenCalledWith(false)
    expect(saves).toEqual([])
    expect(toggle).toBeChecked()
    expect(toggle).not.toHaveAttribute('aria-busy')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a «yes» (a promise too) runs the normal flow: onToggle(next), busy, then the stored value', async () => {
    const saves = []
    const confirmChange = vi.fn().mockResolvedValue(true)
    render(<Host saves={saves} confirmChange={confirmChange} />)
    const toggle = await press(userEvent.setup())
    await waitFor(() => expect(toggle).not.toBeChecked())
    expect(confirmChange).toHaveBeenCalledWith(false)
    expect(saves).toEqual([false])
    expect(toggle).not.toHaveAttribute('aria-busy')
  })

  it('a «yes» whose save fails goes back to the stored value and says why, as any save', async () => {
    const confirmChange = vi.fn().mockResolvedValue(true)
    render(<Host confirmChange={confirmChange} result={{ ok: false, error: ['Nope'] }} />)
    const toggle = await press(userEvent.setup())
    expect(await screen.findByRole('alert')).toHaveTextContent('Nope')
    expect(toggle).toBeChecked()
  })

  it('while the question is open the switch shows the stored value, is not busy, and a second press is ignored', async () => {
    const user = userEvent.setup()
    const saves = []
    let answer
    const confirmChange = vi.fn(() => new Promise(resolve => { answer = resolve }))
    render(<Host saves={saves} confirmChange={confirmChange} />)
    const toggle = await press(user)
    expect(toggle).toBeChecked()
    expect(toggle).not.toHaveAttribute('aria-busy')
    await user.click(toggle)
    expect(confirmChange).toHaveBeenCalledTimes(1)
    await act(async () => { answer(true) })
    await waitFor(() => expect(toggle).not.toBeChecked())
    expect(saves).toEqual([false])
  })

  it('a throw in confirmChange counts as «no»', async () => {
    const saves = []
    render(<Host saves={saves} confirmChange={() => { throw new Error('boom') }} />)
    const toggle = await press(userEvent.setup())
    expect(saves).toEqual([])
    expect(toggle).toBeChecked()
    expect(toggle).not.toHaveAttribute('aria-busy')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a rejected promise counts as «no» too, and the switch can be pressed again', async () => {
    const user = userEvent.setup()
    const saves = []
    const confirmChange = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(true)
    render(<Host saves={saves} confirmChange={confirmChange} />)
    const toggle = await press(user)
    await waitFor(() => expect(confirmChange).toHaveBeenCalledTimes(1))
    expect(saves).toEqual([])
    await user.click(toggle)
    await waitFor(() => expect(toggle).not.toBeChecked())
    expect(saves).toEqual([false])
  })

  it('a «no» leaves an existing failure notice as it was', async () => {
    const user = userEvent.setup()
    const confirmChange = vi.fn().mockResolvedValueOnce(true).mockResolvedValue(false)
    render(<Host confirmChange={confirmChange} result={{ ok: false, error: ['Not allowed'] }} />)
    const toggle = await press(user)
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed')
    await user.click(toggle)
    await waitFor(() => expect(confirmChange).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('alert')).toHaveTextContent('Not allowed')
    expect(toggle).toBeChecked()
  })

  it('does nothing if it is gone before the answer', async () => {
    const saves = []
    let answer
    const confirmChange = () => new Promise(resolve => { answer = resolve })
    const { unmount } = render(<Host saves={saves} confirmChange={confirmChange} />)
    await press(userEvent.setup())
    unmount()
    await act(async () => { answer(true) })
    expect(saves).toEqual([])
  })
})

describe('Product AsyncSwitch — a stored value that changes from outside', () => {
  const failThenRerender = async (props = {}) => {
    const onToggle = vi.fn(async () => ({ ok: false, error: ['Not allowed'] }))
    const view = render(<AsyncSwitch checked={false} onToggle={onToggle} label='Accept orders' failureText='Failed' {...props} />)
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Accept orders' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed')
    const rerender = (checked) => view.rerender(<AsyncSwitch checked={checked} onToggle={onToggle} label='Accept orders' failureText='Failed' {...props} />)
    return { rerender, toggle: screen.getByRole('switch', { name: 'Accept orders' }) }
  }

  it('clears the notice when checked changes from outside after a failure', async () => {
    const { rerender, toggle } = await failThenRerender()
    rerender(true)
    expect(toggle).toBeChecked()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(toggle.closest('.odc-async-switch')).not.toHaveAttribute('data-failed')
  })

  it('does not bring the notice back when the old value returns', async () => {
    const { rerender } = await failThenRerender()
    rerender(true)
    rerender(false)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps the notice while the stored value stays the same (a rerender is not a change)', async () => {
    const { rerender } = await failThenRerender()
    rerender(false)
    expect(screen.getByRole('alert')).toHaveTextContent('Not allowed')
  })

  it('keeps the notice when the consumer flips its value during the save and puts it back with the failure', async () => {
    const Optimistic = () => {
      const [stored, setStored] = useState(false)
      const onToggle = async (next) => {
        setStored(next)
        await Promise.resolve()
        setStored(!next)
        return { ok: false, error: ['Not allowed'] }
      }
      return <AsyncSwitch checked={stored} onToggle={onToggle} label='Accept orders' failureText='Failed' />
    }
    render(<Optimistic />)
    const toggle = screen.getByRole('switch', { name: 'Accept orders' })
    await userEvent.setup().click(toggle)
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed')
    expect(toggle).not.toBeChecked()
  })
})

// R1-4 (of ) and AB-S04 (of ): the notice of a failed save widened its wrapper (a 260px notice in a
// shrink-to-fit box). In a card's actions or a panel header, where the switch sits in a row with siblings, that moved the switch
// toward the start and pushed the title of the header; it also overflowed a narrow header. There the notice is out of the flow,
// under the switch, so it asks for no room; in a form it stays in the flow and pushes what is below, as before.
// in a table cell the hanging notice fell on the next row (or on the row above, from the last one); it takes a line of
// its own at the foot of its row instead, which every cell of the row keeps free (e2e/brand-system-app/async-switch-failure.spec.js
// measures it with the overlap probe).
// jsdom has no layout: this reads the CSS, as touch.w07fix does.
describe('async-switch.css · the notice asks for no room where the switch sits in a row', () => {
  const css = readFileSync(path.join(__dirname, '..', 'async-switch.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({ selector: selector.trim(), body }))
  const rule = (match) => rules.find(({ selector }) => match.test(selector))

  it('puts the notice out of the flow, under the switch, in a card and a panel header', () => {
    const out = rule(/odc-order-card[\s\S]*odc-record-head[\s\S]*\.odc-async-switch-notice$/)
    expect(out, 'a scoped rule for the notice').toBeDefined()
    expect(out.selector).not.toMatch(/odc-table/)
    expect(out.body).toMatch(/position:\s*absolute/)
    expect(out.body).toMatch(/inset-block-start:\s*100%/)
    expect(out.body).toMatch(/inset-inline-end:\s*0/)
    expect(out.body).toMatch(/inline-size:\s*max-content/)
    // the notice's own gutter margin (.odc-notice) would set it 24px in from the switch's edge
    expect(out.body).toMatch(/margin-inline:\s*0/)
  })

  // review of in a phone card the switch is at the START of its row (RecordCard actions), so the notice hung toward the
  // start from its end left the screen (-185 -> 75 at 390); there it hangs from the switch's start, as the base drew it (40 -> 300)
  it('hangs it from the start of the switch in a card, where the switch starts the row', () => {
    const card = rule(/odc-order-card[^,]*\.odc-async-switch-notice$/)
    expect(card, 'a card rule for the notice').toBeDefined()
    expect(card.body).toMatch(/inset-inline-start:\s*0/)
    expect(card.body).toMatch(/inset-inline-end:\s*auto/)
  })

  it('anchors it to the switch wrapper in those places', () => {
    const anchor = rule(/odc-order-card[\s\S]*odc-record-head[\s\S]*\.odc-async-switch$/)
    expect(anchor, 'a scoped rule for the wrapper').toBeDefined()
    expect(anchor.selector).not.toMatch(/odc-table/)
    expect(anchor.body).toMatch(/position:\s*relative/)
  })

  it('keeps the notice in the flow by default (a form pushes what is below it), and lets it break to fit', () => {
    const base = rules.find(({ selector }) => selector === '.odc-async-switch-notice')
    expect(base.body).not.toMatch(/position:\s*absolute/)
    expect(base.body).toMatch(/overflow-wrap:\s*anywhere/)
  })

  it('never lets the floating notice be wider than the room there is, with tokens only', () => {
    const out = rule(/odc-order-card[\s\S]*\.odc-async-switch-notice$/)
    expect(out.body).toMatch(/max-inline-size:\s*min\(var\(--od-x-popover\),\s*calc\(100cqw\s*-\s*var\(--od-space-5\)\)\)/)
    expect(out.body).not.toMatch(/\d+px/)
  })

  it('in a table, gives the notice a line of its own at the foot of its row, which every cell of the row keeps free', () => {
    const row = rule(/^\.odc-table tbody tr:has\(\.odc-async-switch\[data-failed\]\)$/)
    expect(row, 'the failed row is the containing block').toBeDefined()
    expect(row.body).toMatch(/position:\s*relative/)
    const cells = rule(/^\.odc-table tbody tr:has\(\.odc-async-switch\[data-failed\]\) > /)
    expect(cells, 'every cell of the failed row').toBeDefined()
    expect(cells.body).toMatch(/padding-block-end:\s*calc\(var\(--od-x-control-height-sm\)\s*\+\s*var\(--od-space-2\)\)/)
    const notice = rule(/odc-table td\)? \.odc-async-switch-notice$/)
    expect(notice, 'the notice in a cell').toBeDefined()
    expect(notice.body).toMatch(/position:\s*absolute/)
    expect(notice.body).toMatch(/inset-block-end:/)
    expect(notice.body).toMatch(/inset-inline:/)
    // as tall as the band the cells keep, on one line
    expect(notice.body).toMatch(/block-size:\s*var\(--od-x-control-height-sm\)/)
    expect(notice.body).toMatch(/white-space:\s*nowrap/)
    expect(notice.body).not.toMatch(/\d+px/)
    // the notice no longer hangs out of its row, up or down
    expect(rule(/tbody tr:last-child[\s\S]*\.odc-async-switch-notice$/)).toBeUndefined()
  })
})
