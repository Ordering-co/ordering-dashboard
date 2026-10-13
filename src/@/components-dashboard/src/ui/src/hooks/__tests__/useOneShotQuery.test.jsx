import React from 'react'
import { act, render } from '@testing-library/react'
import { MemoryRouter, useHistory } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useOpenFromQuery } from '../useOneShotQuery'

let history
const Probe = ({ open, ready = true, accept }) => {
  history = useHistory()
  useOpenFromQuery('add', open, { ready, accept })
  return null
}

const renderAt = (entry, props) => render(
  <MemoryRouter initialEntries={[entry]}>
    <Probe {...props} />
  </MemoryRouter>
)

describe('useOpenFromQuery', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('opens once and removes the param from the address bar', () => {
    window.history.replaceState(null, '', '/users/customers?add=1&page=2')
    const open = vi.fn()
    const { rerender } = renderAt('/users/customers?add=1&page=2', { open })
    rerender(<MemoryRouter initialEntries={['/users/customers?add=1&page=2']}><Probe open={open} /></MemoryRouter>)
    expect(open).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledWith('1')
    expect(window.location.search).toBe('?page=2')
  })

  it('waits until the page is ready', () => {
    const open = vi.fn()
    const { rerender } = renderAt('/x?add=1', { open, ready: false })
    expect(open).not.toHaveBeenCalled()
    rerender(<MemoryRouter initialEntries={['/x?add=1']}><Probe open={open} ready /></MemoryRouter>)
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('ignores unknown values and opens again on a new navigation', () => {
    const open = vi.fn()
    renderAt('/x?add=nope', { open, accept: value => value === 'custom_order' })
    expect(open).not.toHaveBeenCalled()
    act(() => { history.push('/x?add=custom_order') })
    expect(open).toHaveBeenCalledWith('custom_order')
  })

  it('does nothing without the param', () => {
    const open = vi.fn()
    renderAt('/x', { open })
    expect(open).not.toHaveBeenCalled()
  })
})
