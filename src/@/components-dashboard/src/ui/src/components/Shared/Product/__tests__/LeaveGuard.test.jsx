import React, { useState } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LeaveDialog,
  LeaveGuardContext,
  useLeaveGuard,
  useLeaveGuardHost,
  useNestedLeaveGuard,
  useRequestLeave
} from '../LeaveGuard'
import { SplitView } from '../SplitView'

// redesign stores 2.A (decision 4): the leave-guard contract (host + form + dialog).

const LABELS = {
  title: 'Leave this page?',
  keepLabel: 'Keep editing',
  saveLabel: 'Save changes',
  discardLabel: 'Discard changes',
  closeLabel: 'Close confirmation'
}

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

let host

const Host = ({ children }) => {
  host = useLeaveGuardHost()
  return (
    <LeaveGuardContext.Provider value={host.context}>
      {children}
      <LeaveDialog {...host.dialog} {...LABELS} description={`${host.dialog.count} unsaved`} />
    </LeaveGuardContext.Provider>
  )
}

const Form = ({ name = 'Form', dirty = true, count, save = vi.fn(), discard = vi.fn(), registerCloseGuard }) => {
  useLeaveGuard({ dirty, count, save, discard, registerCloseGuard })
  return <input aria-label={name} />
}

const leave = (proceed, onCancel) => {
  let result
  act(() => { result = host.requestLeave(proceed, onCancel) })
  return result
}

const dialogButtons = async () => {
  const dialog = await screen.findByRole('alertdialog')
  return [...dialog.querySelector('.odc-overlay-foot').querySelectorAll('button')]
}

const closed = () => waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())

describe('LeaveGuard host', () => {
  it('with nothing dirty it proceeds synchronously, draws no dialog and answers false', () => {
    const proceed = vi.fn()
    render(<Host><Form dirty={false} /></Host>)
    expect(host.isDirty()).toBe(false)
    expect(leave(proceed)).toBe(false)
    expect(proceed).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('with no form registered it proceeds too', () => {
    const proceed = vi.fn()
    render(<Host />)
    expect(leave(proceed)).toBe(false)
    expect(proceed).toHaveBeenCalledTimes(1)
  })

  it('when a form is dirty it opens the three-way dialog, keeps proceed pending and answers true', async () => {
    const proceed = vi.fn()
    render(<Host><Form /></Host>)
    expect(host.isDirty()).toBe(true)
    expect(leave(proceed)).toBe(true)
    expect(proceed).not.toHaveBeenCalled()
    const buttons = await dialogButtons()
    expect(buttons.map(button => button.textContent)).toEqual(['Keep editing', 'Save changes', 'Discard changes'])
    expect(screen.getByRole('alertdialog')).toHaveAccessibleName('Leave this page?')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Keep editing' })).toHaveFocus())
  })

  it('ignores a new request while the dialog is open (answers true, keeps the first)', async () => {
    const first = vi.fn()
    const second = vi.fn()
    const user = userEvent.setup()
    render(<Host><Form /></Host>)
    leave(first)
    await dialogButtons()
    expect(leave(second)).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
  })

  it('Keep editing calls onCancel, closes, and neither proceeds nor discards', async () => {
    const user = userEvent.setup()
    const proceed = vi.fn()
    const onCancel = vi.fn()
    const discard = vi.fn()
    render(<Host><Form discard={discard} /></Host>)
    leave(proceed, onCancel)
    await user.click(await screen.findByRole('button', { name: 'Keep editing' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(proceed).not.toHaveBeenCalled()
    expect(discard).not.toHaveBeenCalled()
    await closed()
  })

  it('Escape is Keep editing, and works without an onCancel', async () => {
    const user = userEvent.setup()
    const proceed = vi.fn()
    render(<Host><Form /></Host>)
    leave(proceed)
    await screen.findByRole('alertdialog')
    await user.keyboard('{Escape}')
    await closed()
    expect(proceed).not.toHaveBeenCalled()
  })

  it('Discard discards every dirty form and then proceeds', async () => {
    const user = userEvent.setup()
    const calls = []
    render(
      <Host>
        <Form name='A' discard={() => calls.push('discard A')} />
        <Form name='B' dirty={false} discard={() => calls.push('discard B')} />
        <Form name='C' discard={() => calls.push('discard C')} />
      </Host>
    )
    leave(() => calls.push('proceed'))
    await user.click(await screen.findByRole('button', { name: 'Discard changes' }))
    expect(calls).toEqual(['discard A', 'discard C', 'proceed'])
    await closed()
  })

  it('Save saves every dirty form in order and then proceeds', async () => {
    const user = userEvent.setup()
    const calls = []
    const onCancel = vi.fn()
    render(
      <Host>
        <Form name='A' save={async () => { calls.push('save A'); return { ok: true } }} />
        <Form name='B' dirty={false} save={() => calls.push('save B')} />
        <Form name='C' save={() => { calls.push('save C') }} />
      </Host>
    )
    leave(() => calls.push('proceed'), onCancel)
    await user.click(await screen.findByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(calls).toEqual(['save A', 'save C', 'proceed']))
    expect(onCancel).not.toHaveBeenCalled()
    await closed()
  })

  it('shows the spinner on Save and blocks the rest while saving', async () => {
    const user = userEvent.setup()
    let finish
    const save = () => new Promise(resolve => { finish = resolve })
    const proceed = vi.fn()
    render(<Host><Form save={save} /></Host>)
    leave(proceed)
    await user.click(await screen.findByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(host.dialog.saving).toBe(true))
    const [keep, saveButton, discard] = await dialogButtons()
    expect(saveButton).toHaveAttribute('aria-busy', 'true')
    expect(keep).toBeDisabled()
    expect(discard).toBeDisabled()
    expect(proceed).not.toHaveBeenCalled()
    await act(async () => { finish({ ok: true }) })
    expect(proceed).toHaveBeenCalledTimes(1)
    expect(host.dialog.saving).toBe(false)
    await closed()
  })

  it.each([
    ['{ ok: false }', () => ({ ok: false })],
    ['false', () => false],
    ['a rejection', () => Promise.reject(new Error('boom'))],
    ['a throw', () => { throw new Error('boom') }]
  ])('a save that fails with %s does not proceed: it closes and calls onCancel', async (_, save) => {
    const user = userEvent.setup()
    const proceed = vi.fn()
    const onCancel = vi.fn()
    render(<Host><Form save={save} /></Host>)
    leave(proceed, onCancel)
    await user.click(await screen.findByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1))
    expect(proceed).not.toHaveBeenCalled()
    expect(host.dialog.saving).toBe(false)
    await closed()
  })

  it('stops at the first failed form (the next one is not saved)', async () => {
    const user = userEvent.setup()
    const second = vi.fn()
    const onCancel = vi.fn()
    render(<Host><Form name='A' save={() => ({ ok: false })} /><Form name='B' save={second} /></Host>)
    leave(vi.fn(), onCancel)
    await user.click(await screen.findByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1))
    expect(second).not.toHaveBeenCalled()
  })

  it('sums the count of the dirty forms (default 1 each) and ignores the clean ones', async () => {
    render(
      <Host>
        <Form name='A' count={2} />
        <Form name='B' count={3} />
        <Form name='C' />
        <Form name='D' dirty={false} count={9} />
      </Host>
    )
    leave(vi.fn())
    await screen.findByRole('alertdialog')
    expect(host.dialog.count).toBe(6)
    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription('6 unsaved')
  })

  it('reads the latest props of a form without registering again', async () => {
    const user = userEvent.setup()
    const proceed = vi.fn()
    const Toggle = () => {
      const [dirty, setDirty] = useState(false)
      return (
        <>
          <button type='button' onClick={() => setDirty(true)}>Edit</button>
          <Form dirty={dirty} />
        </>
      )
    }
    render(<Host><Toggle /></Host>)
    expect(host.isDirty()).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(host.isDirty()).toBe(true)
    expect(leave(proceed)).toBe(true)
  })

  it('a form that unmounts leaves the host: nothing dirty, it proceeds again', () => {
    const proceed = vi.fn()
    const view = render(<Host><Form /></Host>)
    expect(host.isDirty()).toBe(true)
    view.rerender(<Host />)
    expect(host.isDirty()).toBe(false)
    expect(leave(proceed)).toBe(false)
    expect(proceed).toHaveBeenCalledTimes(1)
  })

  it('exposes a stable context object', () => {
    const view = render(<Host />)
    const first = host.context
    view.rerender(<Host />)
    expect(host.context).toBe(first)
    expect(host.requestLeave).toBe(first.requestLeave)
  })

  it('does not proceed or set state when the host goes away while saving', async () => {
    const user = userEvent.setup()
    let finish
    const proceed = vi.fn()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const view = render(<Host><Form save={() => new Promise(resolve => { finish = resolve })} /></Host>)
    leave(proceed)
    await user.click(await screen.findByRole('button', { name: 'Save changes' }))
    view.unmount()
    await act(async () => { finish({ ok: true }) })
    expect(proceed).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })
})

describe('useLeaveGuard — close guard', () => {
  const guardHarness = () => {
    const guards = new Set()
    const unregister = vi.fn()
    const registerCloseGuard = vi.fn(guard => {
      guards.add(guard)
      return () => { guards.delete(guard); unregister() }
    })
    return { guards, unregister, registerCloseGuard }
  }

  it('registers a close guard that answers false when the form is clean', () => {
    const { guards, registerCloseGuard } = guardHarness()
    const proceed = vi.fn()
    render(<Host><Form dirty={false} registerCloseGuard={registerCloseGuard} /></Host>)
    expect(guards.size).toBe(1)
    expect([...guards][0](proceed)).toBe(false)
    expect(proceed).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('answers true and asks when the form is dirty; Discard then runs the close', async () => {
    const user = userEvent.setup()
    const { guards, registerCloseGuard } = guardHarness()
    const proceed = vi.fn()
    const discard = vi.fn()
    render(<Host><Form discard={discard} registerCloseGuard={registerCloseGuard} /></Host>)
    let answer
    act(() => { answer = [...guards][0](proceed) })
    expect(answer).toBe(true)
    expect(proceed).not.toHaveBeenCalled()
    await user.click(await screen.findByRole('button', { name: 'Discard changes' }))
    expect(discard).toHaveBeenCalledTimes(1)
    expect(proceed).toHaveBeenCalledTimes(1)
  })

  it('answers false without a host (nothing can ask)', () => {
    const { guards, registerCloseGuard } = guardHarness()
    render(<Form registerCloseGuard={registerCloseGuard} />)
    expect([...guards][0](vi.fn())).toBe(false)
  })

  it('registers once and unregisters on unmount, in the host too', () => {
    const { guards, unregister, registerCloseGuard } = guardHarness()
    const view = render(<Host><Form registerCloseGuard={registerCloseGuard} /></Host>)
    view.rerender(<Host><Form registerCloseGuard={registerCloseGuard} dirty={false} count={4} /></Host>)
    expect(registerCloseGuard).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(unregister).toHaveBeenCalledTimes(1)
    expect(guards.size).toBe(0)
  })

  it('is a no-op without a host and outside a SplitView', () => {
    expect(() => render(<Form />)).not.toThrow()
  })

  describe('inside a real SplitView', () => {
    beforeEach(() => {
      window.matchMedia = query => ({
        media: query,
        matches: query.split(/\s+and\s+/).every(part => {
          const [, kind, value] = part.match(/\(\s*(min|max)-width:\s*(\d+)px\s*\)/) || []
          if (kind === 'min') return Number(value) <= window.innerWidth
          if (kind === 'max') return Number(value) >= window.innerWidth
          return false
        }),
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {}
      })
      window.innerWidth = 1400
    })
    afterEach(() => {
      delete window.matchMedia
      window.localStorage.clear()
    })

    const Page = ({ dirty, discard = vi.fn(), onClose }) => {
      const [open, setOpen] = useState(true)
      return (
        <Host>
          <SplitView
            open={open}
            onClose={() => { onClose(); setOpen(false) }}
            panelLabel='Store details'
            resizeLabel='Resize the details panel'
            list={<p>List</p>}
            panel={<Form dirty={dirty} discard={discard} />}
          />
        </Host>
      )
    }

    it('asks before the panel closes with Escape while the form is dirty', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      const discard = vi.fn()
      render(<Page dirty discard={discard} onClose={onClose} />)
      await user.click(screen.getByLabelText('Form'))
      await user.keyboard('{Escape}')
      await user.keyboard('{Escape}')
      await screen.findByRole('alertdialog')
      expect(onClose).not.toHaveBeenCalled()
      await user.click(screen.getByRole('button', { name: 'Discard changes' }))
      expect(discard).toHaveBeenCalledTimes(1)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('closes as always when the form is clean', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<Page dirty={false} onClose={onClose} />)
      await user.click(screen.getByLabelText('Form'))
      await user.keyboard('{Escape}')
      await user.keyboard('{Escape}')
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('alertdialog')).toBeNull()
    })
  })
})

// redesign stores 2.A: a nested piece with its own question (P/SectionSplit, 2.B) answers first
describe('useNestedLeaveGuard', () => {
  const Nested = ({ requestLeave }) => {
    useNestedLeaveGuard(requestLeave)
    return null
  }

  it('a nested guard that lets go hands over to the host, which then asks about its own forms', async () => {
    const nestedLeave = vi.fn(proceed => proceed())
    const proceed = vi.fn()
    render(<Host><Nested requestLeave={nestedLeave} /><Form /></Host>)
    expect(leave(proceed)).toBe(true)
    expect(nestedLeave).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(proceed).not.toHaveBeenCalled()
  })

  it('a nested guard that keeps the user ends the way out: no host question, no proceed', () => {
    const nestedLeave = vi.fn(() => true)
    const proceed = vi.fn()
    render(<Host><Nested requestLeave={nestedLeave} /><Form /></Host>)
    expect(leave(proceed)).toBe(true)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(proceed).not.toHaveBeenCalled()
  })

  it('a nested guard that asks and lets go later goes on to the host; all clean proceeds once', () => {
    let later
    const nestedLeave = vi.fn(go => { later = go; return true })
    const proceed = vi.fn()
    render(<Host><Nested requestLeave={nestedLeave} /><Form dirty={false} /></Host>)
    expect(leave(proceed)).toBe(true)
    expect(proceed).not.toHaveBeenCalled()
    act(() => later())
    expect(proceed).toHaveBeenCalledTimes(1)
  })

  it('without nested guards and nothing dirty it proceeds at once; it unregisters on unmount', () => {
    const nestedLeave = vi.fn(() => true)
    const proceed = vi.fn()
    const { rerender } = render(<Host><Nested requestLeave={nestedLeave} /></Host>)
    rerender(<Host />)
    expect(leave(proceed)).toBe(false)
    expect(proceed).toHaveBeenCalledTimes(1)
    expect(nestedLeave).not.toHaveBeenCalled()
  })

  it('is a no-op without a host', () => {
    expect(() => render(<Nested requestLeave={vi.fn()} />)).not.toThrow()
  })
})

// redesign stores 2.A: fixes of the phase 3 review
describe('LeaveGuard host · review fixes', () => {
  it('a second way out while the question is open gets its onCancel at once (F3-R6)', async () => {
    render(<Host><Form /></Host>)
    const firstCancel = vi.fn()
    const secondCancel = vi.fn()
    const secondProceed = vi.fn()
    leave(vi.fn(), firstCancel)
    await screen.findByRole('alertdialog')
    expect(leave(secondProceed, secondCancel)).toBe(true)
    expect(secondCancel).toHaveBeenCalledTimes(1)
    expect(secondProceed).not.toHaveBeenCalled()
    expect(firstCancel).not.toHaveBeenCalled()
  })

  it('a nested guard gets the onCancel of the way out (F3-R6)', () => {
    const Nested = () => { useNestedLeaveGuard((proceed, onCancel) => onCancel?.()); return null }
    const onCancel = vi.fn()
    render(<Host><Nested /><Form /></Host>)
    leave(vi.fn(), onCancel)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('the close of a SplitView panel asks about its own form only (F3-R6)', async () => {
    const user = userEvent.setup()
    const panelDiscard = vi.fn()
    const otherDiscard = vi.fn()
    const guards = []
    const registerCloseGuard = guard => { guards.push(guard); return () => {} }
    render(
      <Host>
        <Form name='Panel' count={2} discard={panelDiscard} registerCloseGuard={registerCloseGuard} />
        <Form name='Other' count={5} discard={otherDiscard} />
      </Host>
    )
    const proceed = vi.fn()
    act(() => { guards[0](proceed) })
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('2 unsaved')
    await user.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(panelDiscard).toHaveBeenCalledTimes(1)
    expect(otherDiscard).not.toHaveBeenCalled()
    expect(proceed).toHaveBeenCalledTimes(1)
  })

  it('LeaveDialog hands `returnFocus` (else `fallbackFocus`) to the dialog\'s final focus (F3-R2/R4)', async () => {
    const user = userEvent.setup()
    const target = React.createRef()
    const Page = () => {
      const h = useLeaveGuardHost()
      host = h
      return (
        <LeaveGuardContext.Provider value={h.context}>
          <div ref={target} tabIndex={-1} data-testid='panel'>
            <Form />
          </div>
          <LeaveDialog {...h.dialog} {...LABELS} description='x' fallbackFocus={target} />
        </LeaveGuardContext.Provider>
      )
    }
    render(<Page />)
    act(() => screen.getByTestId('panel').focus())
    leave(vi.fn())
    await user.click(await screen.findByRole('button', { name: 'Keep editing' }))
    await closed()
    await waitFor(() => expect(screen.getByTestId('panel')).toHaveFocus())
  })
})

describe('LeaveGuard · (N-03, N-04)', () => {
  it('N-03: «Keep editing» after a way out that left the focus on <body> gives it back to the field the user was in', async () => {
    const user = userEvent.setup()
    render(<Host><Form name='Hours' /></Host>)
    await user.click(screen.getByLabelText('Hours'))
    // a click on the scrim or on an empty zone of the page: the field blurs and nothing else takes the focus
    act(() => screen.getByLabelText('Hours').blur())
    expect(document.body).toHaveFocus()
    leave(vi.fn())
    await user.click(await screen.findByRole('button', { name: 'Keep editing' }))
    await closed()
    await waitFor(() => expect(screen.getByLabelText('Hours')).toHaveFocus())
  })

  // redesign bugs F row 21 (R-7 of 2.B): the first Escape in a SectionSplit field hands the focus to the detail (a
  // tabIndex -1 container); «Keep editing» went back to that container, and the next Tab landed on its first control
  it('row 21: «Keep editing» after the focus moved from a field to its tabIndex -1 container gives it back to the field', async () => {
    const user = userEvent.setup()
    render(<Host><div tabIndex={-1} data-testid='detail'><button type='button'>Share with</button><Form name='Name' /></div></Host>)
    await user.click(screen.getByLabelText('Name'))
    act(() => screen.getByTestId('detail').focus())
    leave(vi.fn())
    await user.click(await screen.findByRole('button', { name: 'Keep editing' }))
    await closed()
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveFocus())
  })

  it('row 21: a container that never held the field keeps the focus itself (the field is elsewhere)', async () => {
    const user = userEvent.setup()
    render(<Host><Form name='Name' /><div tabIndex={-1} data-testid='other'><button type='button'>Other</button></div></Host>)
    await user.click(screen.getByLabelText('Name'))
    act(() => screen.getByTestId('other').focus())
    leave(vi.fn())
    await user.click(await screen.findByRole('button', { name: 'Keep editing' }))
    await closed()
    await waitFor(() => expect(screen.getByTestId('other')).toHaveFocus())
  })

  it('N-03: a remembered field that left the page is not focused (nothing to go back to: the dialog\'s own rule)', async () => {
    const user = userEvent.setup()
    const Page = ({ show }) => <Host><Form name='Stay' />{show && <input aria-label='Gone' />}</Host>
    const { rerender } = render(<Page show />)
    await user.click(screen.getByLabelText('Gone'))
    rerender(<Page show={false} />)
    leave(vi.fn())
    await user.click(await screen.findByRole('button', { name: 'Keep editing' }))
    await closed()
    expect(screen.queryByLabelText('Gone')).toBeNull()
    expect(document.activeElement?.closest('[role="alertdialog"]')).toBeNull()
  })

  it('N-04: `label` names the form with unsaved changes, and the host hands the labels of the dirty ones to the dialog', async () => {
    const user = userEvent.setup()
    const Labelled = ({ label, dirty = true }) => {
      useLeaveGuard({ dirty, label, save: vi.fn(), discard: vi.fn() })
      return null
    }
    const Page = () => {
      host = useLeaveGuardHost()
      return (
        <LeaveGuardContext.Provider value={host.context}>
          <Labelled label='Hours' />
          <Labelled label='Hours' />
          <Labelled label='Delivery' dirty={false} />
          <Labelled />
          <LeaveDialog {...host.dialog} {...LABELS} description={`Unsaved in ${host.dialog.labels.join(', ')}`} />
        </LeaveGuardContext.Provider>
      )
    }
    render(<Page />)
    expect(host.dialog.labels).toEqual([])
    leave(vi.fn())
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Unsaved in Hours')
    expect(host.dialog.labels).toEqual(['Hours'])
    await user.click(screen.getByRole('button', { name: 'Keep editing' }))
    await closed()
  })

  it('N-04: without `label` the dialog is as it was (no labels)', async () => {
    render(<Host><Form /></Host>)
    leave(vi.fn())
    await screen.findByRole('alertdialog')
    expect(host.dialog.labels).toEqual([])
  })
})

describe('useRequestLeave', () => {
  const Probe = ({ proceed, onCancel, out }) => {
    const requestLeave = useRequestLeave()
    out.current = () => requestLeave(proceed, onCancel)
    return null
  }

  it('without a host it just proceeds and answers false', () => {
    const proceed = vi.fn()
    const out = { current: null }
    render(<Probe proceed={proceed} out={out} />)
    expect(out.current()).toBe(false)
    expect(proceed).toHaveBeenCalledTimes(1)
  })

  it('with a host it asks through it', async () => {
    const proceed = vi.fn()
    const onCancel = vi.fn()
    const out = { current: null }
    const user = userEvent.setup()
    render(<Host><Form /><Probe proceed={proceed} onCancel={onCancel} out={out} /></Host>)
    let answer
    act(() => { answer = out.current() })
    expect(answer).toBe(true)
    expect(proceed).not.toHaveBeenCalled()
    await user.click(await screen.findByRole('button', { name: 'Keep editing' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

describe('LeaveDialog', () => {
  const props = { open: true, onKeep: vi.fn(), onDiscard: vi.fn(), onSave: vi.fn(), ...LABELS }

  it('is a danger ConfirmDialog: Discard is the confirm action, Save the middle one', async () => {
    const user = userEvent.setup()
    const onKeep = vi.fn()
    const onSave = vi.fn()
    const onDiscard = vi.fn()
    render(<LeaveDialog {...props} onKeep={onKeep} onSave={onSave} onDiscard={onDiscard} description='Your edits are not saved.' className='mine' />)
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveClass('mine')
    expect(dialog).toHaveAccessibleDescription('Your edits are not saved.')
    expect(screen.getByRole('button', { name: 'Discard changes' })).toHaveAttribute('data-variant', 'danger')
    expect(screen.getByRole('button', { name: 'Save changes' })).toHaveAttribute('data-variant', 'secondary')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await user.click(screen.getByRole('button', { name: 'Discard changes' }))
    await user.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(onKeep).toHaveBeenCalledTimes(1)
  })

  it('the close button and the scrim are Keep editing', async () => {
    const user = userEvent.setup()
    const onKeep = vi.fn()
    render(<LeaveDialog {...props} onKeep={onKeep} />)
    await user.click(await screen.findByRole('button', { name: 'Close confirmation' }))
    await user.click(document.querySelector('.odc-overlay-backdrop'))
    expect(onKeep).toHaveBeenCalledTimes(2)
  })

  it('saving puts the spinner on Save and disables Keep editing and Discard', async () => {
    render(<LeaveDialog {...props} saving />)
    const save = await screen.findByRole('button', { name: 'Save changes' })
    expect(save).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Keep editing' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Discard changes' })).toBeDisabled()
  })

  it.each(['title', 'keepLabel', 'saveLabel', 'discardLabel', 'closeLabel'])('throws without %s (an empty one paints empty)', name => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<LeaveDialog {...props} {...{ [name]: undefined }} />)).toThrow(new RegExp(name))
    expect(() => render(<LeaveDialog {...props} {...{ [name]: null }} />)).toThrow(new RegExp(name))
    error.mockRestore()
  })

  it('an empty label is a translation, not a missing one', async () => {
    render(<LeaveDialog {...props} saveLabel='' />)
    await screen.findByRole('alertdialog')
  })
})
