/* eslint-disable import/first */
// redesign stores 3.C: the mappings of a multiple importer are a list of Product buttons; one mapping opens as a level of
// the Importers panel («Edit mapping» / «Add mapping»), no longer in a SideBar. Changing from one mapping to another with one open goes
// through the leave guard.
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({ dirty: false, forms: [] }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text]
}))

// The form of a mapping has its own tests. Here it is a stand-in that shows what it was given and can be dirty.
vi.mock('../../ImporterForm', async () => {
  const { useLeaveGuard } = await import('../../../Shared/Product/LeaveGuard')
  return {
    ImporterForm: (props) => {
      mockState.forms.push(props)
      useLeaveGuard({ dirty: () => mockState.dirty, save: () => ({ ok: true }), discard: () => {} })
      return (
        <div data-testid='mapping-form' data-is-mapping={props.isMapping ? 'yes' : 'no'} data-default={props.defaultImporter ? 'yes' : 'no'}>
          <span data-testid='mapping-type'>{props.selectedImporter?.type ?? 'none'}</span>
          <button type='button' onClick={() => props.handleCustomEditImporter({ mapping: '{"business_id":5}' })}>Stand-in save edit</button>
          <button type='button' onClick={() => props.handleCustomAddImporter({ type: 'sync_categories', mapping: '{"category_id":2}' })}>Stand-in save add</button>
        </div>
      )
    }
  }
})

import { ChildMapplingList } from '../index'
import { ImportersPane, ImportersStack } from '../../ImportersButton/ImportersPanes'
import { useLeaveGuard } from '../../../Shared/Product/LeaveGuard'

const mappings = [
  { type: 'sync_businesses', business_id: 1 },
  { type: 'sync_products', product_id: 2 }
]

const draw = (props = {}) => {
  const all = { mappingList: mappings, handleUpdateMultipleMapping: vi.fn(), setOpenMappingDetails: vi.fn(), ...props }
  const utils = render(
    <ImportersStack rootTitle='Importers'>
      <ChildMapplingList {...all} />
    </ImportersStack>
  )
  return { props: all, ...utils }
}

beforeEach(() => {
  mockState.dirty = false
  mockState.forms = []
})

describe('the list', () => {
  it('is one button per mapping, named like before, with a chevron', () => {
    draw()
    const rows = screen.getAllByRole('button', { name: /^(Businesses|Products)$/ })
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row).toHaveAttribute('type', 'button')
      expect(row.querySelector('svg')).not.toBeNull()
      expect(row).not.toHaveAttribute('aria-current')
    }
  })

  it('draws no list for an empty importer but still offers Add type mapping', () => {
    draw({ mappingList: [] })
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add type mapping' })).toHaveAttribute('data-variant', 'link')
  })

  it('a default importer has no Add type mapping', () => {
    draw({ defaultImporter: true })
    expect(screen.queryByRole('button', { name: 'Add type mapping' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^(Businesses|Products)$/ })).toHaveLength(2)
  })
})

describe('a mapping as a level', () => {
  it('a row opens «Edit mapping» with the form of that mapping, and marks the row', async () => {
    const { props } = draw()
    await userEvent.click(screen.getByRole('button', { name: 'Products' }))
    expect(await screen.findByRole('heading', { name: 'Edit mapping' })).toBeInTheDocument()
    expect(screen.getByTestId('mapping-form')).toHaveAttribute('data-is-mapping', 'yes')
    expect(screen.getByTestId('mapping-type')).toHaveTextContent('sync_products')
    expect(screen.getByRole('button', { name: 'Products' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Businesses' })).not.toHaveAttribute('aria-current')
    expect(props.setOpenMappingDetails).toHaveBeenCalledWith(true)
    expect(mockState.forms.at(-1).selectedImporter).toEqual({ type: 'sync_products', mapping: mappings[1] })
  })

  it('Add type mapping opens «Add mapping» with an empty mapping and no row marked', async () => {
    draw()
    await userEvent.click(screen.getByRole('button', { name: 'Add type mapping' }))
    expect(await screen.findByRole('heading', { name: 'Add mapping' })).toBeInTheDocument()
    expect(screen.getByTestId('mapping-type')).toHaveTextContent('none')
    expect(mockState.forms.at(-1).selectedImporter).toEqual({})
    expect(screen.queryByRole('heading', { name: 'Edit mapping' })).not.toBeInTheDocument()
    for (const row of screen.getAllByRole('button', { name: /^(Businesses|Products)$/ })) expect(row).not.toHaveAttribute('aria-current')
  })

  it('the way back of the level closes it and tells the owner', async () => {
    const { props } = draw()
    await userEvent.click(screen.getByRole('button', { name: 'Businesses' }))
    await screen.findByRole('heading', { name: 'Edit mapping' })
    await userEvent.click(screen.getByRole('button', { name: 'Close Edit mapping' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit mapping' })).not.toBeInTheDocument())
    expect(props.setOpenMappingDetails).toHaveBeenLastCalledWith(false)
    expect(screen.getByRole('button', { name: 'Businesses' })).not.toHaveAttribute('aria-current')
  })

  it('does not rebuild the selected importer when the list re-renders (the form would lose what was typed)', async () => {
    const { props, rerender } = draw()
    await userEvent.click(screen.getByRole('button', { name: 'Businesses' }))
    await screen.findByRole('heading', { name: 'Edit mapping' })
    const before = mockState.forms.at(-1).selectedImporter
    rerender(
      <ImportersStack rootTitle='Importers'>
        <ChildMapplingList {...props} mappingList={[...mappings]} />
      </ImportersStack>
    )
    expect(mockState.forms.at(-1).selectedImporter).toBe(before)
  })

  it('works without setOpenMappingDetails', async () => {
    draw({ setOpenMappingDetails: undefined })
    await userEvent.click(screen.getByRole('button', { name: 'Businesses' }))
    expect(await screen.findByRole('heading', { name: 'Edit mapping' })).toBeInTheDocument()
  })

  it('the default flag reaches the form of the mapping', async () => {
    draw({ defaultImporter: true })
    await userEvent.click(screen.getByRole('button', { name: 'Businesses' }))
    await screen.findByRole('heading', { name: 'Edit mapping' })
    expect(screen.getByTestId('mapping-form')).toHaveAttribute('data-default', 'yes')
  })
})

describe('saving a mapping (the same logic as before)', () => {
  it('an edited mapping replaces its place in the list, closes the level and updates the importer', async () => {
    const { props } = draw()
    await userEvent.click(screen.getByRole('button', { name: 'Products' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Stand-in save edit' }))
    expect(props.handleUpdateMultipleMapping).toHaveBeenCalledWith([mappings[0], { business_id: 5 }])
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit mapping' })).not.toBeInTheDocument())
  })

  it('a new mapping is appended with its type', async () => {
    const { props } = draw()
    await userEvent.click(screen.getByRole('button', { name: 'Add type mapping' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Stand-in save add' }))
    expect(props.handleUpdateMultipleMapping).toHaveBeenCalledWith([...mappings, { category_id: 2, type: 'sync_categories' }])
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Add mapping' })).not.toBeInTheDocument())
  })
})

describe('leave guard', () => {
  it('changing to another mapping with a clean one open just changes', async () => {
    draw()
    await userEvent.click(screen.getByRole('button', { name: 'Businesses' }))
    await screen.findByRole('heading', { name: 'Edit mapping' })
    await userEvent.click(screen.getByRole('button', { name: 'Products' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Products' })).toHaveAttribute('aria-current', 'true'))
    expect(screen.getByTestId('mapping-type')).toHaveTextContent('sync_products')
  })

  it('changing with unsaved work asks first; Keep editing stays on the mapping, Discard changes', async () => {
    draw()
    await userEvent.click(screen.getByRole('button', { name: 'Businesses' }))
    await screen.findByRole('heading', { name: 'Edit mapping' })
    mockState.dirty = true

    await userEvent.click(screen.getByRole('button', { name: 'Products' }))
    expect(await screen.findByRole('alertdialog', { name: 'Save your changes?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Businesses' })).toHaveAttribute('aria-current', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'Products' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Products' })).toHaveAttribute('aria-current', 'true'))
  })

  it('Add type mapping with unsaved work in the open mapping asks too', async () => {
    draw()
    await userEvent.click(screen.getByRole('button', { name: 'Businesses' }))
    await screen.findByRole('heading', { name: 'Edit mapping' })
    mockState.dirty = true
    await userEvent.click(screen.getByRole('button', { name: 'Add type mapping' }))
    expect(await screen.findByRole('alertdialog', { name: 'Save your changes?' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Add mapping' })).not.toBeInTheDocument()
  })

  it('the importer form around the list does not make a mapping change ask: only the open mapping does', async () => {
    const Outer = () => {
      useLeaveGuard({ dirty: true, save: () => ({ ok: true }), discard: () => {} })
      return <ChildMapplingList mappingList={mappings} handleUpdateMultipleMapping={vi.fn()} setOpenMappingDetails={vi.fn()} />
    }
    render(
      <ImportersStack rootTitle='Importers'>
        <ImportersPane title='Edit importer' onBack={() => {}}>
          <Outer />
        </ImportersPane>
      </ImportersStack>
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Businesses' }))
    await screen.findByRole('heading', { name: 'Edit mapping' })
    await userEvent.click(screen.getByRole('button', { name: 'Products' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Products' })).toHaveAttribute('aria-current', 'true'))
  })

  it('leaving the level that holds the list asks about the open mapping too', async () => {
    const onBack = vi.fn()
    render(
      <ImportersStack rootTitle='Importers'>
        <ImportersPane title='Edit importer' onBack={onBack}>
          <ChildMapplingList mappingList={mappings} handleUpdateMultipleMapping={vi.fn()} setOpenMappingDetails={vi.fn()} />
        </ImportersPane>
      </ImportersStack>
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Businesses' }))
    await screen.findByRole('heading', { name: 'Edit mapping' })
    mockState.dirty = true
    await userEvent.click(screen.getByRole('button', { name: 'Close Edit importer' }))
    expect(await screen.findByRole('alertdialog', { name: 'Save your changes?' })).toBeInTheDocument()
    expect(onBack).not.toHaveBeenCalled()
  })
})
