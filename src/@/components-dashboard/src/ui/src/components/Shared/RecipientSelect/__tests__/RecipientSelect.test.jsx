// redesign (K-1; Sponsor of stores 5.14): RecipientSelect on P/SelectField. The legacy contract stays (level 0 only,
// «Inherit» is null in and out, value > defaultValue > «Business»/«Inherit», a pick shows without the owner, disabled) and the
// visible label now names the select.
/* eslint-disable import/first */
import React, { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ level: 0 }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: runtime.level } }]
}))

import { RecipientSelect } from '..'

beforeEach(() => { runtime.level = 0 })
afterEach(() => document.getElementById('app-modals')?.remove())

const trigger = () => screen.getByRole('combobox')
const pick = async (user, name) => {
  await user.click(trigger())
  await user.click(await screen.findByRole('option', { name, hidden: true }))
}

describe('RecipientSelect', () => {
  it('is named by its visible label and the value: «Recipient Business» by default', () => {
    render(<RecipientSelect onChange={() => {}} />)
    expect(trigger()).toHaveAccessibleName('Recipient Business')
    expect(document.querySelector('.odc-field-label')).toHaveTextContent('Recipient')
  })

  it('names the sponsor select «Sponsor» (stores 5.14), not by its value', () => {
    render(<RecipientSelect labelKey='SPONSOR' labelFallback='Sponsor' value='platform' onChange={() => {}} />)
    expect(trigger()).toHaveAccessibleName('Sponsor Platform')
  })

  it('offers Business and Platform, and Inherit first with showInherit', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<RecipientSelect onChange={() => {}} />)
    await user.click(trigger())
    expect((await screen.findAllByRole('option', { hidden: true })).map(option => option.textContent)).toEqual(['Business', 'Platform'])
    unmount()
    document.getElementById('app-modals')?.remove()
    render(<RecipientSelect showInherit onChange={() => {}} />)
    await user.click(trigger())
    expect((await screen.findAllByRole('option', { hidden: true })).map(option => option.textContent)).toEqual(['Inherit', 'Business', 'Platform'])
  })

  it('sends the same values as before: «business», «platform», and null for «Inherit»', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<RecipientSelect showInherit value='business' onChange={onChange} />)
    await pick(user, 'Platform')
    expect(onChange).toHaveBeenLastCalledWith('platform')
    await waitFor(() => expect(trigger()).toHaveAttribute('aria-expanded', 'false'))
    await pick(user, 'Inherit')
    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(onChange.mock.calls).toEqual([['platform'], [null]])
  })

  it('shows «Inherit» for a null value and value wins over defaultValue', () => {
    const { rerender } = render(<RecipientSelect showInherit value={null} onChange={() => {}} />)
    expect(trigger()).toHaveAccessibleName('Recipient Inherit')
    rerender(<RecipientSelect value='platform' defaultValue='business' onChange={() => {}} />)
    expect(trigger()).toHaveAccessibleName('Recipient Platform')
    rerender(<RecipientSelect defaultValue='platform' onChange={() => {}} />)
    expect(trigger()).toHaveAccessibleName('Recipient Platform')
  })

  it('shows a pick at once when the owner does not hand the value back, and a new value from the owner wins', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<RecipientSelect value='business' onChange={() => {}} />)
    await pick(user, 'Platform')
    await waitFor(() => expect(trigger()).toHaveAccessibleName('Recipient Platform'))
    rerender(<RecipientSelect value='platform' onChange={() => {}} />)
    rerender(<RecipientSelect value='business' onChange={() => {}} />)
    expect(trigger()).toHaveAccessibleName('Recipient Business')
  })

  it('follows a controlled owner', async () => {
    const user = userEvent.setup()
    const Owner = () => {
      const [recipient, setRecipient] = useState(null)
      return <><RecipientSelect showInherit value={recipient} onChange={setRecipient} /><output>{String(recipient)}</output></>
    }
    render(<Owner />)
    await pick(user, 'Business')
    expect(document.querySelector('output')).toHaveTextContent('business')
    expect(trigger()).toHaveAccessibleName('Recipient Business')
  })

  it('is disabled with disabled', () => {
    render(<RecipientSelect disabled defaultValue='platform' onChange={() => {}} />)
    expect(trigger()).toBeDisabled()
  })

  it('renders nothing for a user who is not level 0', () => {
    runtime.level = 2
    const { container } = render(<RecipientSelect onChange={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
