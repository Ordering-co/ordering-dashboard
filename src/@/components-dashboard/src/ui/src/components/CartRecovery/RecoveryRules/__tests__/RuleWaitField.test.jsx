/* eslint-disable import/first */
// redesign RA-B3 (decision 4; M-RA11): the wait of a rule as an amount and a unit. The real Product NumberField and SegmentedControl and
// the real helpers of C/utils/recoveryRules.js (RA-B1) are under test; only the language is simulated (English, the fallback text).
import React, { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {}, language: { code: 'en' } }, (_key, text) => text]
}))

import { formatWait } from '../../../../../../utils/recoveryRules'
import { RuleWaitField } from '../RuleWaitField'

afterEach(cleanup)

const amountInput = () => screen.getByRole('textbox', { name: 'Send after' })
const unit = (name) => screen.getByRole('button', { name })
const pressedUnit = () => ['Seconds', 'Minutes', 'Hours', 'Days'].filter(name => unit(name).getAttribute('aria-pressed') === 'true')

// The page owns the seconds (a controlled host), as RulePanel does
const Host = ({ initial, spy, ...props }) => {
  const [seconds, setSeconds] = useState(initial)
  return (
    <RuleWaitField
      seconds={seconds}
      onChange={(next) => { spy?.(next); setSeconds(next) }}
      {...props}
    />
  )
}

describe('RuleWaitField — what it shows (decision 4)', () => {
  it('opens a wait of 260 seconds as 260 Seconds, the largest unit that is exact', () => {
    render(<RuleWaitField seconds={260} onChange={() => {}} />)
    expect(amountInput()).toHaveValue('260')
    expect(pressedUnit()).toEqual(['Seconds'])
  })

  it('opens 7200 as 2 Hours and 172800 as 2 Days', () => {
    const { unmount } = render(<RuleWaitField seconds={7200} onChange={() => {}} />)
    expect(amountInput()).toHaveValue('2')
    expect(pressedUnit()).toEqual(['Hours'])
    unmount()
    render(<RuleWaitField seconds={172800} onChange={() => {}} />)
    expect(amountInput()).toHaveValue('2')
    expect(pressedUnit()).toEqual(['Days'])
  })

  // redesign RA-I2 (live check): no wait, no equivalence line
  it('opens an empty wait empty, in Minutes, and writes no equivalence yet', () => {
    render(<RuleWaitField seconds={null} onChange={() => {}} />)
    expect(amountInput()).toHaveValue('')
    expect(pressedUnit()).toEqual(['Minutes'])
    expect(screen.queryByText(/after the customer last opened the cart/)).not.toBeInTheDocument()
  })

  it('always writes the equivalence under the field, with the figure in a node of its own', () => {
    render(<RuleWaitField seconds={260} onChange={() => {}} />)
    const line = screen.getByText(/after the customer last opened the cart/)
    expect(line).toHaveTextContent(`= ${formatWait(260, 'en')} after the customer last opened the cart`)
    const figure = line.querySelector('.odc-figure')
    expect(figure).not.toBeNull()
    expect(figure).toHaveTextContent(formatWait(260, 'en'))
  })

  it('names the group «Send after» and the four units', () => {
    render(<RuleWaitField seconds={260} onChange={() => {}} />)
    expect(screen.getByText('Send after')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Send after' })).toBeInTheDocument()
    for (const name of ['Seconds', 'Minutes', 'Hours', 'Days']) expect(unit(name)).toBeInTheDocument()
  })
})

describe('RuleWaitField — what it reports', () => {
  it('changing the unit keeps the number and reports the new seconds', async () => {
    const spy = vi.fn()
    render(<Host initial={7200} spy={spy} />)
    await userEvent.setup().click(unit('Minutes'))
    expect(spy).toHaveBeenLastCalledWith(120) // 2 minutes
    expect(amountInput()).toHaveValue('2')
    expect(pressedUnit()).toEqual(['Minutes'])
  })

  it('the equivalence follows the unit', async () => {
    render(<Host initial={7200} />)
    await userEvent.setup().click(unit('Days'))
    expect(screen.getByText(/after the customer last opened the cart/)).toHaveTextContent(`= ${formatWait(172800, 'en')} after`)
  })

  it('typing an amount reports it in seconds of the chosen unit', async () => {
    const spy = vi.fn()
    render(<Host initial={null} spy={spy} />)
    const user = userEvent.setup()
    await user.type(amountInput(), '30')
    expect(spy).toHaveBeenLastCalledWith(1800) // 30 Minutes
    await user.click(unit('Hours'))
    expect(spy).toHaveBeenLastCalledWith(108000) // 30 hours: the unit changed, the number stayed
  })

  it('an emptied field reports null, never 0', async () => {
    const spy = vi.fn()
    render(<Host initial={260} spy={spy} />)
    await userEvent.setup().clear(amountInput())
    expect(spy).toHaveBeenLastCalledWith(null)
  })

  it('a controlled echo does not re-split what the person is typing (120 seconds stays Seconds)', async () => {
    render(<Host initial={null} />)
    const user = userEvent.setup()
    await user.click(unit('Seconds'))
    await user.type(amountInput(), '120')
    expect(amountInput()).toHaveValue('120')
    expect(pressedUnit()).toEqual(['Seconds'])
  })

  it('a change of `seconds` from outside is split again (the rule was reloaded)', () => {
    const { rerender } = render(<RuleWaitField seconds={260} onChange={() => {}} />)
    rerender(<RuleWaitField seconds={172800} onChange={() => {}} />)
    expect(amountInput()).toHaveValue('2')
    expect(pressedUnit()).toEqual(['Days'])
  })

  it('zero is a value (allowed by the host), and it reports 0', async () => {
    const spy = vi.fn()
    render(<Host initial={260} spy={spy} allowZero />)
    const user = userEvent.setup()
    await user.clear(amountInput())
    await user.type(amountInput(), '0')
    expect(spy).toHaveBeenLastCalledWith(0)
  })
})

describe('RuleWaitField — the host\'s error and the disabled state', () => {
  it('draws the error under the field and marks the number invalid', () => {
    render(<RuleWaitField seconds={0} allowZero={false} error='Wait at least 1 second.' onChange={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Wait at least 1 second.')
    expect(amountInput()).toHaveAttribute('aria-invalid', 'true')
  })

  it('has no alert without an error', () => {
    render(<RuleWaitField seconds={260} onChange={() => {}} />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(amountInput()).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('disables the number and every unit', () => {
    render(<RuleWaitField seconds={260} disabled onChange={() => {}} />)
    expect(amountInput()).toBeDisabled()
    for (const name of ['Seconds', 'Minutes', 'Hours', 'Days']) expect(unit(name)).toBeDisabled()
  })
})
