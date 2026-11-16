// redesign W0-2 r2 (W0-Q1-02): when a step fails, the control that had the focus is unmounted by the fallback and the focus fell
// to <body>. `focusOnError` (a ref, or a function that returns the element) says where it goes at that moment.
import React, { createRef, useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { StepBoundary } from '../StepBoundary'

// A step with a control: pressing it makes the next render throw, the way «By products» does in the wizard.
const Step = () => {
  const [broken, setBroken] = useState(false)
  if (broken) throw new TypeError('The step failed')
  return <button type='button' onClick={() => setBroken(true)}>By products</button>
}

let consoleError
// redesign tramo B r4 (W0-PB3-01): a boundary reports what it catches with window.reportError (jsdom has none: without a stub the report is an uncaught error)
beforeEach(() => { window.reportError = vi.fn() })
afterEach(() => { delete window.reportError })

beforeEach(() => { consoleError = vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => consoleError.mockRestore())

const fallback = ({ reset }) => <div role='alert'>Step failed <button type='button' onClick={reset}>Try again</button></div>

const setup = (boundaryProps = {}) => render(
  <div>
    <h3 tabIndex={-1} data-testid='title'>Step title</h3>
    <input aria-label='Elsewhere' />
    <StepBoundary fallback={fallback} {...boundaryProps}><Step /></StepBoundary>
  </div>
)

describe('StepBoundary · focus when the error appears (W0-Q1-02)', () => {
  it('moves the focus to the element a ref points at, never to <body>', async () => {
    const user = userEvent.setup()
    const target = createRef()
    render(
      <div>
        <h3 ref={target} tabIndex={-1}>Step title</h3>
        <StepBoundary fallback={fallback} focusOnError={target}><Step /></StepBoundary>
      </div>
    )
    await user.click(screen.getByRole('button', { name: 'By products' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(document.activeElement).not.toBe(document.body)
    expect(screen.getByRole('heading', { name: 'Step title' })).toHaveFocus()
  })

  it('moves the focus to what a function returns', async () => {
    const user = userEvent.setup()
    setup({ focusOnError: () => screen.getByTestId('title') })
    await user.click(screen.getByRole('button', { name: 'By products' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByTestId('title')).toHaveFocus()
  })

  it('may point at the fallback\'s own action, which exists when the boundary asks', async () => {
    const user = userEvent.setup()
    setup({ focusOnError: () => screen.getByRole('button', { name: 'Try again' }) })
    await user.click(screen.getByRole('button', { name: 'By products' }))
    expect(screen.getByRole('button', { name: 'Try again' })).toHaveFocus()
  })

  it('does not take a focus that is still somewhere live', async () => {
    const user = userEvent.setup()
    const view = setup({ focusOnError: () => screen.getByTestId('title') })
    // the focus is on a control outside the boundary when the step fails: the error comes from a re-render, not from a click
    const elsewhere = screen.getByRole('textbox', { name: 'Elsewhere' })
    const step = screen.getByRole('button', { name: 'By products' })
    step.focus()
    elsewhere.focus()
    await user.click(elsewhere)
    // arm the failure without moving the focus
    step.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await screen.findByRole('alert')
    expect(elsewhere).toHaveFocus()
    view.unmount()
  })

  it('does nothing when the target is missing or there is no focusOnError (the boundary keeps its old behaviour)', async () => {
    const user = userEvent.setup()
    const first = setup({ focusOnError: () => null })
    await user.click(screen.getByRole('button', { name: 'By products' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    first.unmount()
    setup()
    await user.click(screen.getByRole('button', { name: 'By products' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('does not run on a retry that fails again or when the error clears (that is focusOnReset)', async () => {
    const user = userEvent.setup()
    const onError = vi.fn(() => screen.getByTestId('title'))
    setup({ focusOnError: onError })
    await user.click(screen.getByRole('button', { name: 'By products' }))
    expect(onError).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onError).toHaveBeenCalledTimes(1)
  })
})
