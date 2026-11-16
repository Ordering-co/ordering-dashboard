// redesign W0-2a (T0-4): ChecklistPopover and PopoverFoot have no text of their own. The texts arrive as props, and a
// text the case being drawn needs throws when it is missing, like the rest of Shared/Product.
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ChecklistPopover, PopoverFoot } from '../FilterPopover'

afterEach(() => document.getElementById('app-modals')?.remove())

const ITEMS = [{ id: 1, name: 'Ada Lovelace' }, { id: 2, name: 'Grace Hopper' }]
const LABELS = {
  searchLabel: 'Buscar',
  clearSearchLabel: 'Limpiar búsqueda',
  loadingLabel: 'Cargando...',
  noResultsLabel: 'Sin resultados',
  clearLabel: 'Limpiar'
}

const checklist = (props = {}) => (
  <ChecklistPopover label='Driver' items={ITEMS} selected={[]} onToggle={() => {}} onClear={() => {}} {...LABELS} {...props} />
)

const open = async (user) => {
  await user.click(screen.getByRole('button', { name: /^Driver/ }))
  return screen.findByRole('dialog', { name: 'Driver', hidden: true })
}

// The popup mounts only once the pill is pressed, so a missing text throws while the popup renders.
const opening = async (props) => {
  const user = userEvent.setup()
  render(checklist(props))
  await open(user)
}

describe('PopoverFoot', () => {
  it('draws the label it receives', () => {
    render(<PopoverFoot onClear={() => {}} clearLabel='Limpiar' />)
    expect(screen.getByRole('button', { name: 'Limpiar' })).toBeInTheDocument()
  })

  it('throws without its clearLabel', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<PopoverFoot onClear={() => {}} />)).toThrow('PopoverFoot needs a clearLabel')
    error.mockRestore()
  })
})

describe('ChecklistPopover labels', () => {
  it('names the search field and its clear button with the labels it receives', async () => {
    const user = userEvent.setup()
    render(checklist({ selected: [1] }))
    const popup = await open(user)
    const search = within(popup).getByRole('searchbox', { name: 'Buscar Driver', hidden: true })
    expect(search).toHaveAttribute('placeholder', 'Buscar')
    await user.type(search, 'Ada')
    expect(await within(popup).findByRole('button', { name: 'Limpiar búsqueda', hidden: true })).toBeInTheDocument()
    expect(within(popup).getByRole('button', { name: 'Limpiar', hidden: true })).toBeInTheDocument()
  })

  it('writes the no-results text when the search finds nothing, and the loading text while an empty list loads', async () => {
    const user = userEvent.setup()
    const { unmount } = render(checklist())
    const popup = await open(user)
    await user.type(within(popup).getByRole('searchbox', { hidden: true }), 'zzz')
    expect(await within(popup).findByText('Sin resultados')).toBeInTheDocument()
    unmount()
    document.getElementById('app-modals')?.remove()

    render(checklist({ items: [], loading: true }))
    const loadingPopup = await open(user)
    await waitFor(() => expect(within(loadingPopup).getByText('Cargando...')).toBeInTheDocument())
  })

  it.each([
    ['searchLabel', 'ChecklistPopover needs a searchLabel', {}],
    ['clearSearchLabel', 'ChecklistPopover needs a clearSearchLabel', {}],
    ['noResultsLabel', 'ChecklistPopover needs a noResultsLabel', { items: [] }],
    ['loadingLabel', 'ChecklistPopover needs a loadingLabel', { items: [], loading: true }],
    ['clearLabel', 'PopoverFoot needs a clearLabel', { selected: [1] }]
  ])('throws without its %s when the case that draws it is on screen', async (name, message, props) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(opening({ ...props, [name]: undefined })).rejects.toThrow(message)
    error.mockRestore()
  })

  it('does not ask for a text the case does not draw', async () => {
    // a list with rows, nothing picked, not loading: no loading text, no no-results text and no foot
    const user = userEvent.setup()
    render(checklist({ loadingLabel: undefined, noResultsLabel: undefined, clearLabel: undefined }))
    const popup = await open(user)
    expect(within(popup).getByRole('checkbox', { name: 'Ada Lovelace', hidden: true })).toBeInTheDocument()
  })
})

// redesign stores 3.A: `onApply` + `applyLabel` are an opt-in draft mode. Without them a tick calls `onToggle`
// at once, as every other consumer (/orders, /deliveries, BI) expects.
describe('ChecklistPopover draft mode (onApply)', () => {
  const THREE = [{ id: 1, name: 'Ada Lovelace' }, { id: 2, name: 'Grace Hopper' }, { id: 3, name: 'Alan Turing' }]
  const box = (popup, name) => within(popup).getByRole('checkbox', { name, hidden: true })
  const applyButton = popup => within(popup).queryByRole('button', { name: 'Aplicar', hidden: true })
  const dialogGone = () => waitFor(() => expect(screen.queryByRole('dialog', { name: 'Driver', hidden: true })).not.toBeInTheDocument())

  it('without onApply a tick calls onToggle at once and there is no Apply button', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(checklist({ items: THREE, onToggle, applyLabel: 'Aplicar' }))
    const popup = await open(user)
    expect(applyButton(popup)).not.toBeInTheDocument()
    await user.click(box(popup, 'Ada Lovelace'))
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onToggle).toHaveBeenCalledWith(1)
  })

  it('with onApply the ticks only draft, and Apply calls onApply once with the drafted ids and closes', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    const onApply = vi.fn()
    render(checklist({ items: THREE, onToggle, onApply, applyLabel: 'Aplicar' }))
    const popup = await open(user)
    await user.click(box(popup, 'Ada Lovelace'))
    await user.click(box(popup, 'Grace Hopper'))
    await user.click(box(popup, 'Alan Turing'))
    expect(box(popup, 'Ada Lovelace')).toHaveAttribute('aria-checked', 'true')
    expect(onToggle).not.toHaveBeenCalled()
    expect(onApply).not.toHaveBeenCalled()
    await user.click(applyButton(popup))
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply).toHaveBeenCalledWith([1, 2, 3])
    expect(onToggle).not.toHaveBeenCalled()
    await dialogGone()
  })

  it('un-ticking an applied id drops it from the drafted ids', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    render(checklist({ items: THREE, selected: [1, 2], onApply, applyLabel: 'Aplicar' }))
    const popup = await open(user)
    expect(box(popup, 'Ada Lovelace')).toHaveAttribute('aria-checked', 'true')
    await user.click(box(popup, 'Ada Lovelace'))
    await user.click(applyButton(popup))
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply).toHaveBeenCalledWith([2])
  })

  it('Apply with no change only closes: onApply is not called, in any order of the same ids', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    render(checklist({ items: THREE, selected: [2, 1], onApply, applyLabel: 'Aplicar' }))
    const popup = await open(user)
    await user.click(box(popup, 'Ada Lovelace')) // off
    await user.click(box(popup, 'Ada Lovelace')) // and on again: the draft is [2, 1] in another order
    await user.click(applyButton(popup))
    expect(onApply).not.toHaveBeenCalled()
    await dialogGone()
  })

  it('Escape after ticking calls nothing, and reopening shows the applied selection again', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    const onApply = vi.fn()
    render(checklist({ items: THREE, selected: [1], onToggle, onApply, applyLabel: 'Aplicar' }))
    const popup = await open(user)
    await user.click(box(popup, 'Grace Hopper'))
    expect(box(popup, 'Grace Hopper')).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{Escape}')
    await dialogGone()
    expect(onToggle).not.toHaveBeenCalled()
    expect(onApply).not.toHaveBeenCalled()
    const again = await open(user)
    expect(box(again, 'Ada Lovelace')).toHaveAttribute('aria-checked', 'true')
    expect(box(again, 'Grace Hopper')).toHaveAttribute('aria-checked', 'false')
  })

  it('«Clear» still calls onClear at once, and empties the draft', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    const onApply = vi.fn()
    render(checklist({ items: THREE, selected: [1], onClear, onApply, applyLabel: 'Aplicar' }))
    const popup = await open(user)
    await user.click(box(popup, 'Grace Hopper'))
    await user.click(within(popup).getByRole('button', { name: 'Limpiar', hidden: true }))
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onApply).not.toHaveBeenCalled()
    expect(box(popup, 'Ada Lovelace')).toHaveAttribute('aria-checked', 'false')
    expect(box(popup, 'Grace Hopper')).toHaveAttribute('aria-checked', 'false')
  })

  it('throws without its applyLabel when onApply is given', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(opening({ onApply: () => {}, applyLabel: undefined })).rejects.toThrow('ChecklistPopover needs an applyLabel')
    error.mockRestore()
  })
})
