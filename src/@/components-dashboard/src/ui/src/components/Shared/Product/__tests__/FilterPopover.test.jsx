/* eslint-disable import/first */
// redesign bi FB2 (D6, auditor 6): two opt-in props of FilterPopover. `defaultOpen` opens the popover when it mounts (the Country
// pill of the business reports opens on load in a project with several countries, as `main`'s modal did) and `children` may be
// a function `({ close }) => node` (a popover whose body closes it: Time zone on choosing, Country on «Filter»). Without them
// nothing changes: the existing FilterPopover suites stay as they are.
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { FilterPopover } from '../FilterPopover'

afterEach(() => document.getElementById('app-modals')?.remove())

// The exit transition of the overlay takes a moment in jsdom: wait for it with room to spare.
const EXIT = { timeout: 4000 }

const pill = () => screen.getByRole('button', { name: /^Country/ })
const popup = () => screen.queryByRole('dialog', { name: 'Country' })

describe('FilterPopover · defaultOpen (FB2)', () => {
  it('is closed on mount by default', () => {
    render(<FilterPopover label='Country'><p>Body</p></FilterPopover>)
    expect(popup()).toBeNull()
    expect(pill()).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens on mount with defaultOpen, and the pill says so', async () => {
    render(<FilterPopover label='Country' defaultOpen><p>Body</p></FilterPopover>)
    expect(await screen.findByRole('dialog', { name: 'Country' })).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
    expect(pill()).toHaveAttribute('aria-expanded', 'true')
  })

  it('an Escape closes a popover that opened on mount, like any other', async () => {
    const user = userEvent.setup()
    render(<FilterPopover label='Country' defaultOpen><p>Body</p></FilterPopover>)
    await screen.findByRole('dialog', { name: 'Country' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(popup()).toBeNull(), EXIT)
    expect(pill()).toHaveAttribute('aria-expanded', 'false')
  })

  it('defaultOpen is only read on mount: closing it does not open it again on a render', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<FilterPopover label='Country' defaultOpen><p>Body</p></FilterPopover>)
    await screen.findByRole('dialog', { name: 'Country' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(popup()).toBeNull(), EXIT)
    rerender(<FilterPopover label='Country' defaultOpen><p>Body again</p></FilterPopover>)
    expect(popup()).toBeNull()
  })
})

describe('FilterPopover · children as a function (FB2)', () => {
  it('a node child is painted as it always was', async () => {
    const user = userEvent.setup()
    render(<FilterPopover label='Country'><p>Node body</p></FilterPopover>)
    await user.click(pill())
    expect(await screen.findByText('Node body')).toBeInTheDocument()
  })

  it('a function child is called with { close } and its result is the body', async () => {
    const user = userEvent.setup()
    const body = vi.fn(({ close }) => <button type='button' onClick={close}>Pick</button>)
    render(<FilterPopover label='Country'>{body}</FilterPopover>)
    expect(body).not.toHaveBeenCalled()
    await user.click(pill())
    expect(await screen.findByRole('button', { name: 'Pick' })).toBeInTheDocument()
    expect(body).toHaveBeenCalledWith(expect.objectContaining({ close: expect.any(Function) }))
  })

  it('close() closes the popover and gives the focus back to the pill', async () => {
    const user = userEvent.setup()
    render(
      <FilterPopover label='Country'>
        {({ close }) => <button type='button' onClick={close}>Pick</button>}
      </FilterPopover>
    )
    await user.click(pill())
    await user.click(await screen.findByRole('button', { name: 'Pick' }))
    await waitFor(() => expect(popup()).toBeNull(), EXIT)
    await waitFor(() => expect(pill()).toHaveFocus(), EXIT)
    expect(pill()).toHaveAttribute('aria-expanded', 'false')
  })

  it('close() works on a popover that opened on mount, and it can be opened again afterwards', async () => {
    const user = userEvent.setup()
    render(
      <FilterPopover label='Country' defaultOpen>
        {({ close }) => <button type='button' onClick={close}>Pick</button>}
      </FilterPopover>
    )
    await user.click(await screen.findByRole('button', { name: 'Pick' }))
    await waitFor(() => expect(popup()).toBeNull(), EXIT)
    await user.click(pill())
    expect(await screen.findByRole('dialog', { name: 'Country' })).toBeInTheDocument()
  })
})
