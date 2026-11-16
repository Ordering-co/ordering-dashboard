import React, { useState } from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { LeaveGuardContext, useLeaveGuard, useLeaveGuardHost } from '../LeaveGuard'

// redesign (bugs H): the host exposes a reactive `dirty` boolean (new API; `isDirty()` stays a function over refs). A page
// passes it as `active` to useRouteLeaveGuard, which has to re-render the moment unsaved work appears or goes.

let host
const seen = []

const Host = ({ children }) => {
  host = useLeaveGuardHost()
  seen.push(host.dirty)
  return <LeaveGuardContext.Provider value={host.context}>{children}</LeaveGuardContext.Provider>
}

const Field = ({ name = 'Field', label }) => {
  const [value, setValue] = useState('')
  useLeaveGuard({ dirty: value !== '', label, save: vi.fn(), discard: () => setValue('') })
  return <input aria-label={name} value={value} onChange={event => setValue(event.target.value)} />
}

describe('LeaveGuard host · reactive dirty', () => {
  it('starts false', () => {
    render(<Host><Field /></Host>)
    expect(host.dirty).toBe(false)
    expect(host.isDirty()).toBe(false)
  })

  it('flips true when a guarded field becomes dirty and false when it is clean again', async () => {
    const user = userEvent.setup()
    render(<Host><Field /></Host>)
    await user.type(screen.getByLabelText('Field'), 'a')
    expect(host.dirty).toBe(true)
    expect(host.isDirty()).toBe(true)
    await user.clear(screen.getByLabelText('Field'))
    expect(host.dirty).toBe(false)
  })

  it('stays true while any of several forms is dirty', async () => {
    const user = userEvent.setup()
    render(<Host><Field name='One' /><Field name='Two' /></Host>)
    await user.type(screen.getByLabelText('One'), 'a')
    await user.type(screen.getByLabelText('Two'), 'b')
    await user.clear(screen.getByLabelText('One'))
    expect(host.dirty).toBe(true)
    await user.clear(screen.getByLabelText('Two'))
    expect(host.dirty).toBe(false)
  })

  it('goes false when the dirty form unmounts', async () => {
    const user = userEvent.setup()
    const Page = () => {
      const [shown, setShown] = useState(true)
      return (
        <Host>
          {shown && <Field />}
          <button type='button' onClick={() => setShown(false)}>remove</button>
        </Host>
      )
    }
    render(<Page />)
    await user.type(screen.getByLabelText('Field'), 'a')
    expect(host.dirty).toBe(true)
    await user.click(screen.getByRole('button', { name: 'remove' }))
    expect(host.dirty).toBe(false)
  })

  it('goes false after Discard cleans the form', async () => {
    const user = userEvent.setup()
    render(<Host><Field /></Host>)
    await user.type(screen.getByLabelText('Field'), 'a')
    expect(host.dirty).toBe(true)
    act(() => { host.requestLeave(vi.fn()) })
    act(() => { host.dialog.onDiscard() })
    expect(host.dirty).toBe(false)
  })
})
