/* eslint-disable import/first */
// redesign stores 5.2 (; decisions 5, D4–D7; G2-11, G2-12, G2-41): the Categories (business types) of a store on P/SectionSplit.
// Covered: one row per type with a checkbox named by the type; a tick saves at once through `handleUpdateBusinessClick` with
// `keepPendingChanges` and goes back (with the reason) when the save fails; a store keeps at least one type; level 0 opens a type's
// detail (button named «<name>, View details») and adds one, level 2 sees the list and the checkboxes only; the URL follows the open
// detail and the deep link `?business_type=` (an id that is gone says so); «⋯ More actions» only for a saved type; the search ignores
// accents. The detail form has its own tests: here it is a stand-in that only publishes `deleteRef` like the real one.
import React, { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const probe = vi.hoisted(() => ({ user: { level: 0 }, hideToast: () => {} }))

const mockModule = vi.hoisted(() => () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useSession: () => [{ user: probe.user }],
  useToast: () => [{}, { showToast: () => {}, hideToast: () => probe.hideToast() }]
}))
vi.mock('../../../../../../index', mockModule)
// `~components` and the relative index are the same module: both mocks must say the same
vi.mock('~components', mockModule)
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1440, height: 900 }) }))
vi.mock('../../BusinessTypeDetail', async () => {
  const ReactModule = await import('react')
  return {
    BusinessTypeDetail: ({ businessType, deleteRef }) => {
      ReactModule.useEffect(() => {
        deleteRef.current = businessType ? () => {} : null
        return () => { deleteRef.current = null }
      })
      return ReactModule.createElement('div', { 'data-testid': 'detail', 'data-type': businessType ? businessType.id : 'new' })
    }
  }
})

import { BusinessTypes } from '../index'

const PIZZA = { id: 1, name: 'Pizza' }
const CAFE = { id: 2, name: 'Café' }
const SUSHI = { id: 3, name: 'Sushi' }
const ALL = [PIZZA, CAFE, SUSHI]

// The editor's part: the store's types change only when the save answers ok.
const Harness = ({ storeTypes = [PIZZA, CAFE], types = ALL, answer = () => ({ ok: true }), spy }) => {
  const [business, setBusiness] = useState({ id: 2, name: 'Fast Bite', types: storeTypes })
  const handleUpdateBusinessClick = async (changes, options) => {
    spy?.(changes, options)
    const result = await answer()
    if (result.ok) setBusiness(prev => ({ ...prev, types: types.filter(type => changes.types.includes(type.id)) }))
    return result
  }
  return (
    <BusinessTypes
      business={business}
      businessTypes={types}
      setBusinessTypes={() => {}}
      handleUpdateBusinessClick={handleUpdateBusinessClick}
      setIsExtendExtraOpen={() => {}}
    />
  )
}

const goTo = (search = '') => window.history.replaceState(null, '', `/stores/list?id=2&tab=categories${search}`)
const param = () => new URLSearchParams(window.location.search).get('business_type')
const list = () => screen.getByRole('list', { name: 'Categories' })
const rowNames = () => within(list()).getAllByRole('listitem').map(item => item.textContent)

beforeEach(() => {
  probe.user = { level: 0 }
  goTo()
})

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('BusinessTypes', () => {
  it('lists every type of the project with a checkbox named by the type, ticked for the ones the store has', () => {
    render(<Harness />)
    expect(within(list()).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByRole('checkbox', { name: 'Pizza' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('checkbox', { name: 'Café' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('checkbox', { name: 'Sushi' }).getAttribute('aria-checked')).toBe('false')
  })

  it('ticking saves at once with { types } and keepPendingChanges, and the tick stays', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    await user.click(screen.getByRole('checkbox', { name: 'Sushi' }))
    expect(spy).toHaveBeenCalledWith({ types: [1, 2, 3] }, { keepPendingChanges: true })
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Sushi' }).getAttribute('aria-checked')).toBe('true'))
    expect(screen.queryByText(/was not changed/)).toBeNull()
  })

  // redesign stores 5.2 (5.2-01): an answer that carries the types in another shape (the ids as a string) does not untick
  it('keeps the ticks when the saved store carries its types in another shape', async () => {
    const user = userEvent.setup()
    const Odd = () => {
      const [business, setBusiness] = useState({ id: 2, name: 'Fast Bite', types: [PIZZA, CAFE] })
      return (
        <BusinessTypes
          business={business}
          businessTypes={ALL}
          setBusinessTypes={() => {}}
          handleUpdateBusinessClick={async (changes) => {
            setBusiness(prev => ({ ...prev, types: JSON.stringify(changes.types) }))
            return { ok: true }
          }}
          setIsExtendExtraOpen={() => {}}
        />
      )
    }
    render(<Odd />)
    await user.click(screen.getByRole('checkbox', { name: 'Sushi' }))
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Sushi' }).getAttribute('aria-checked')).toBe('true'))
    expect(screen.getByRole('checkbox', { name: 'Pizza' }).getAttribute('aria-checked')).toBe('true')
  })

  it('unticking a type saves the rest', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    await user.click(screen.getByRole('checkbox', { name: 'Pizza' }))
    expect(spy).toHaveBeenCalledWith({ types: [2] }, { keepPendingChanges: true })
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Pizza' }).getAttribute('aria-checked')).toBe('false'))
  })

  it('goes back and says which type and why when the save fails', async () => {
    const user = userEvent.setup()
    render(<Harness answer={() => ({ ok: false, error: ['Nope'] })} />)
    await user.click(screen.getByRole('checkbox', { name: 'Sushi' }))
    const notice = await screen.findByText(/Sushi was not changed/)
    expect(notice.textContent).toContain('Nope')
    expect(screen.getByRole('checkbox', { name: 'Sushi' }).getAttribute('aria-checked')).toBe('false')
  })

  // redesign stores 5.18: the controller shows no toast with keepPendingChanges, so the section no longer hides one (it
  // would hide someone else's)
  it('leaves the toasts alone whether the save fails or works', async () => {
    const user = userEvent.setup()
    const hide = vi.fn()
    probe.hideToast = hide
    const { unmount } = render(<Harness />)
    await user.click(screen.getByRole('checkbox', { name: 'Sushi' }))
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Sushi' }).getAttribute('aria-checked')).toBe('true'))
    expect(hide).not.toHaveBeenCalled()
    unmount()
    render(<Harness answer={() => ({ ok: false, error: ['Nope'] })} />)
    await user.click(screen.getByRole('checkbox', { name: 'Sushi' }))
    await screen.findByText(/Sushi was not changed/)
    expect(hide).not.toHaveBeenCalled()
    probe.hideToast = () => {}
  })

  it('goes back with a generic reason when the save throws', async () => {
    const user = userEvent.setup()
    render(<Harness answer={() => { throw new Error('Network down') }} />)
    await user.click(screen.getByRole('checkbox', { name: 'Sushi' }))
    expect((await screen.findByText(/Sushi was not changed/)).textContent).toContain('Network down')
    expect(screen.getByRole('checkbox', { name: 'Sushi' }).getAttribute('aria-checked')).toBe('false')
  })

  it('does not save, and says why, when the last ticked type is unticked', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(<Harness storeTypes={[PIZZA]} spy={spy} />)
    await user.click(screen.getByRole('checkbox', { name: 'Pizza' }))
    expect(spy).not.toHaveBeenCalled()
    expect(screen.getByText('A store needs at least one category.')).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Pizza' }).getAttribute('aria-checked')).toBe('true')
  })

  describe('level 0', () => {
    it('sees the name as a button named «<name>, View details» and «Add new business category»', () => {
      render(<Harness />)
      const open = screen.getByRole('button', { name: 'Pizza, View details' })
      expect(open.tagName).toBe('BUTTON')
      expect(screen.getByRole('button', { name: 'Add new business category' })).toBeTruthy()
    })

    it('opens a type: writes business_type=<id> to the URL and shows the detail titled with the name', async () => {
      const user = userEvent.setup()
      render(<Harness />)
      expect(screen.queryByTestId('detail')).toBeNull()
      await user.click(screen.getByRole('button', { name: 'Café, View details' }))
      const detail = await screen.findByRole('region', { name: 'Café' })
      expect(within(detail).getByTestId('detail').getAttribute('data-type')).toBe('2')
      expect(param()).toBe('2')
      expect(window.location.search).toContain('tab=categories')
    })

    it('«Add new business category» opens «New business category» and writes business_type=new', async () => {
      const user = userEvent.setup()
      render(<Harness />)
      await user.click(screen.getByRole('button', { name: 'Add new business category' }))
      const detail = await screen.findByRole('region', { name: 'New business category' })
      expect(within(detail).getByTestId('detail').getAttribute('data-type')).toBe('new')
      expect(param()).toBe('new')
    })

    it('closing the detail removes the param', async () => {
      const user = userEvent.setup()
      render(<Harness />)
      await user.click(screen.getByRole('button', { name: 'Pizza, View details' }))
      const detail = await screen.findByRole('region', { name: 'Pizza' })
      await user.click(within(detail).getByRole('button', { name: 'Close' }))
      await waitFor(() => expect(screen.queryByRole('region', { name: 'Pizza' })).toBeNull())
      expect(param()).toBeNull()
      expect(window.location.search).toContain('tab=categories')
    })

    it('has the «⋯ More actions» menu only for a saved type, not for a new one', async () => {
      const user = userEvent.setup()
      render(<Harness />)
      await user.click(screen.getByRole('button', { name: 'Add new business category' }))
      await screen.findByRole('region', { name: 'New business category' })
      expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
      await user.click(screen.getByRole('button', { name: 'Pizza, View details' }))
      await screen.findByRole('region', { name: 'Pizza' })
      expect(screen.getByRole('button', { name: 'More actions' })).toBeTruthy()
    })
  })

  describe('level 2', () => {
    beforeEach(() => { probe.user = { level: 2 } })

    it('sees the list and the checkboxes, with plain names and no way to open or add', () => {
      render(<Harness />)
      expect(screen.queryByRole('button', { name: /View details/ })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Add new business category' })).toBeNull()
      expect(within(list()).getByText('Pizza').tagName).toBe('SPAN')
      expect(screen.getByRole('checkbox', { name: 'Pizza' })).toBeTruthy()
    })

    it('does not open a deep link', () => {
      goTo('&business_type=1')
      render(<Harness />)
      expect(screen.queryByRole('region')).toBeNull()
    })
  })

  describe('deep link ?business_type=', () => {
    it('opens an existing type', async () => {
      goTo('&business_type=3')
      render(<Harness />)
      const detail = await screen.findByRole('region', { name: 'Sushi' })
      expect(within(detail).getByTestId('detail').getAttribute('data-type')).toBe('3')
      expect(param()).toBe('3')
    })

    it('opens the new one with business_type=new', async () => {
      goTo('&business_type=new')
      render(<Harness />)
      expect(await screen.findByRole('region', { name: 'New business category' })).toBeTruthy()
    })

    it('opens nothing for an id that is not in the project, removes the param and says so', async () => {
      goTo('&business_type=999')
      render(<Harness />)
      expect(await screen.findByText('This category no longer exists.')).toBeTruthy()
      expect(screen.queryByRole('region')).toBeNull()
      expect(param()).toBeNull()
      expect(window.location.search).toContain('tab=categories')
    })
  })

  describe('search', () => {
    it('filters the rows ignoring accents and case', async () => {
      const user = userEvent.setup()
      render(<Harness />)
      await user.type(screen.getByRole('searchbox'), 'CAFE')
      expect(rowNames()).toHaveLength(1)
      expect(rowNames()[0]).toContain('Café')
      await user.clear(screen.getByRole('searchbox'))
      expect(rowNames()).toHaveLength(3)
    })

    it('says so when nothing matches', async () => {
      const user = userEvent.setup()
      render(<Harness />)
      await user.type(screen.getByRole('searchbox'), 'zzz')
      expect(screen.getByText('No results found')).toBeTruthy()
      expect(screen.queryByRole('list', { name: 'Categories' })).toBeNull()
    })
  })
})
