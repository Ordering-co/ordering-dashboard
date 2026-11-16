// redesign W0-2c (D-23): «Try again» of a fallback calls `reset()`, which unmounts the fallback where the focus was, and the
// focus fell to <body>. When the error clears and nothing owns the focus, `focusOnReset` says where it goes (the step title or
// the control the step came from). A focus the operator already moved is never taken.
import React, { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { StepBoundary } from '../StepBoundary'

const Bomb = ({ armed }) => {
  if (armed) throw new TypeError('The step failed')
  return <p>Fine</p>
}

let consoleError
// redesign tramo B r4 (W0-PB3-01): a boundary reports what it catches with window.reportError (jsdom has none: without a stub the report is an uncaught error)
beforeEach(() => { window.reportError = vi.fn() })
afterEach(() => { delete window.reportError })

beforeEach(() => { consoleError = vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => consoleError.mockRestore())

const fallback = ({ reset }) => <button type='button' onClick={reset}>Try again</button>

const setup = (boundaryProps = {}) => {
  const state = { armed: true }
  const Probe = () => <Bomb armed={state.armed} />
  const ui = (props = {}) => (
    <div>
      <h3 tabIndex={-1} data-testid='title'>Step title</h3>
      <input aria-label='Elsewhere' />
      <StepBoundary fallback={fallback} {...boundaryProps} {...props}><Probe /></StepBoundary>
    </div>
  )
  const view = render(ui())
  return { state, view, ui }
}

describe('StepBoundary · focus after «Try again» (D-23)', () => {
  it('moves the focus to the element a ref points at, never to <body>', async () => {
    const target = createRef()
    const user = userEvent.setup()
    const state = { armed: true }
    const Probe = () => <Bomb armed={state.armed} />
    render(
      <div>
        <h3 ref={target} tabIndex={-1}>Step title</h3>
        <StepBoundary fallback={fallback} focusOnReset={target}><Probe /></StepBoundary>
      </div>
    )
    state.armed = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('Fine')).toBeInTheDocument()
    expect(document.activeElement).not.toBe(document.body)
    expect(screen.getByRole('heading', { name: 'Step title' })).toHaveFocus()
  })

  it('moves the focus to what a function returns', async () => {
    const user = userEvent.setup()
    const { state } = setup({ focusOnReset: () => screen.getByTestId('title') })
    state.armed = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('Fine')).toBeInTheDocument()
    expect(screen.getByTestId('title')).toHaveFocus()
  })

  it('the focus cannot stay in <body> after the retry', async () => {
    const user = userEvent.setup()
    const { state } = setup({ focusOnReset: () => screen.getByTestId('title') })
    state.armed = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(document.activeElement).not.toBe(document.body)
  })

  it('also does it when the boundary resets itself because resetKey changed', () => {
    const { state, view, ui } = setup({ resetKey: 'a', focusOnReset: () => screen.getByTestId('title') })
    screen.getByRole('button', { name: 'Try again' }).focus()
    state.armed = false
    view.rerender(ui({ resetKey: 'b' }))
    expect(screen.getByText('Fine')).toBeInTheDocument()
    expect(screen.getByTestId('title')).toHaveFocus()
  })

  it('does not take a focus the operator already moved', async () => {
    const user = userEvent.setup()
    const { state, view, ui } = setup({ resetKey: 'a', focusOnReset: () => screen.getByTestId('title') })
    await user.click(screen.getByRole('textbox', { name: 'Elsewhere' }))
    state.armed = false
    view.rerender(ui({ resetKey: 'b' }))
    expect(screen.getByText('Fine')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Elsewhere' })).toHaveFocus()
  })

  it('does nothing when the target is missing or there is no focusOnReset (the boundary keeps its old behaviour)', async () => {
    const user = userEvent.setup()
    const first = setup({ focusOnReset: () => null })
    first.state.armed = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('Fine')).toBeInTheDocument()
    first.view.unmount()
    const second = setup()
    second.state.armed = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('Fine')).toBeInTheDocument()
  })
})
