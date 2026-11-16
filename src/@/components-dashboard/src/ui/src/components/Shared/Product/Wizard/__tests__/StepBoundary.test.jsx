import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { StepBoundary } from '../StepBoundary'

const Bomb = ({ armed }) => {
  if (armed) throw new TypeError("Cannot read properties of undefined (reading 'maps')")
  return <p>Fine</p>
}

let consoleError
// redesign tramo B r4 (W0-PB3-01): a boundary reports what it catches with window.reportError (jsdom has none: without a stub the report is an uncaught error)
beforeEach(() => { window.reportError = vi.fn() })
afterEach(() => { delete window.reportError })

beforeEach(() => { consoleError = vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => consoleError.mockRestore())

describe('StepBoundary', () => {
  it('draws its children when nothing fails', () => {
    render(<StepBoundary fallback={<p>Broken</p>}><Bomb /></StepBoundary>)
    expect(screen.getByText('Fine')).toBeInTheDocument()
  })

  it('draws the fallback node in place of a child that throws and tells the caller', () => {
    const onError = vi.fn()
    render(<div><p>Outside</p><StepBoundary fallback={<p>Broken</p>} onError={onError}><Bomb armed /></StepBoundary></div>)
    expect(screen.getByText('Broken')).toBeInTheDocument()
    expect(screen.getByText('Outside')).toBeInTheDocument()
    expect(onError).toHaveBeenCalledWith(expect.any(TypeError), expect.anything())
  })

  it('a function fallback gets the error and a reset that draws the children again', async () => {
    let armed = true
    const Probe = () => <Bomb armed={armed} />
    render(
      <StepBoundary fallback={({ error, reset }) => <button type='button' onClick={reset}>Retry: {error.name}</button>}>
        <Probe />
      </StepBoundary>
    )
    armed = false
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry: TypeError' }))
    expect(screen.getByText('Fine')).toBeInTheDocument()
  })

  it('tries again by itself when resetKey changes', () => {
    let armed = true
    const Probe = () => <Bomb armed={armed} />
    const { rerender } = render(<StepBoundary resetKey='a' fallback={<p>Broken</p>}><Probe /></StepBoundary>)
    expect(screen.getByText('Broken')).toBeInTheDocument()
    armed = false
    rerender(<StepBoundary resetKey='a' fallback={<p>Broken</p>}><Probe /></StepBoundary>)
    expect(screen.getByText('Broken')).toBeInTheDocument()
    rerender(<StepBoundary resetKey='b' fallback={<p>Broken</p>}><Probe /></StepBoundary>)
    expect(screen.getByText('Fine')).toBeInTheDocument()
  })
})
