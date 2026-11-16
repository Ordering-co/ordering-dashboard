/* eslint-disable import/first */
// redesign stores 3.C: the importer form is a level of the Importers panel (ImportersPane), not a SideBar. It does what it
// did (same fields, same conditions, same controller calls) in the Product expression: no title of its own (the level says it),
// Product fields, a Save button at the foot, an inline error, and the leave guard for unsaved work.
import React, { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  ImporterForm: () => null
}))
// the multiple importer's list of mappings has its own tests
vi.mock('../../ChildMapplingList', () => ({
  ChildMapplingList: (props) => (
    <div data-testid='child-mapping-list' data-default={props.defaultImporter ? 'yes' : 'no'} data-count={(props.mappingList || []).length} />
  )
}))

import { ImporterFormUI } from '../index'
import { ImportersPane, ImportersStack } from '../../ImportersButton/ImportersPanes'

const editing = { id: 7, name: 'Menu sync', slug: 'menu_sync', type: 'sync_products', mapping: {} }
const defaultOne = { id: 3, name: 'Businesses', slug: 'sync_businesses_default', type: 'sync_businesses', mapping: {} }

const handlers = () => ({
  handleChangeInput: vi.fn(),
  handleChangeSelect: vi.fn(),
  handleChangeMappingInput: vi.fn(),
  handleCreateImporter: vi.fn(),
  handleEditState: vi.fn(),
  editImporter: vi.fn(),
  addNewField: vi.fn(),
  removeField: vi.fn(),
  addNewMetaField: vi.fn(),
  removeMetaField: vi.fn(),
  clearImorterForm: vi.fn(),
  setIsEdit: vi.fn(),
  downloadCSV: vi.fn(),
  handleUpdateMultipleMapping: vi.fn(),
  onClose: vi.fn()
})

const baseProps = (extra = {}) => ({
  ...handlers(),
  formState: { loading: false, changes: { type: 'sync_businesses' }, result: { error: false } },
  selectedImporter: {},
  editState: {},
  mappingState: {},
  fieldList: {},
  metafieldList: {},
  ...extra
})

// the controller answers an edit with its state: the importer that came in sets the type the form shows
const draw = (extra = {}) => {
  const props = baseProps(extra)
  const utils = render(<ImporterFormUI {...props} />)
  return { props, ...utils, redraw: (next) => utils.rerender(<ImporterFormUI {...props} {...next} />) }
}

// the add rows of Fields and MetaFields have a «Name» and a «Value» input of their own (name="key" and name="value"): `label` is the form's
const label = (text) => screen.queryAllByLabelText(text).find(node => node.name !== 'key' && node.name !== 'value') ?? null

describe('no title of its own', () => {
  it.each([
    ['create', {}],
    ['edit', { selectedImporter: editing }],
    ['advanced options', { isAdvanedOptions: true, selectedImporter: editing }],
    ['a mapping with a headerTitle', { isMapping: true, headerTitle: 'Edit mapping' }]
  ])('%s draws no heading (the level names it)', (_name, extra) => {
    draw(extra)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.queryByText('Edit mapping')).not.toBeInTheDocument()
  })
})

describe('fields by type (the same conditions as before)', () => {
  it('a store importer asks the business ids only', () => {
    draw()
    expect(label('Business ID')).toBeInTheDocument()
    expect(label('External business ID')).toBeInTheDocument()
    expect(label('Category ID')).not.toBeInTheDocument()
    expect(label('Product ID')).not.toBeInTheDocument()
    expect(label('Extra ID')).not.toBeInTheDocument()
  })

  it('a product importer (3) asks business, category (with its parent) and product ids, and none of the extra ones', () => {
    draw({ selectedImporter: editing })
    for (const name of ['Business ID', 'External business ID', 'Category ID', 'External category ID', 'External parent category ID', 'Product ID', 'External product ID']) {
      expect(label(name), name).toBeInTheDocument()
    }
    for (const name of ['Extra ID', 'External extra ID', 'Extra option ID', 'External extra option ID', 'Extra option suboption ID', 'External extra option suboption ID']) {
      expect(label(name), name).not.toBeInTheDocument()
    }
  })

  it('a multiple importer (8) has no mapping ids, no fields and shows the list of mappings', () => {
    draw({ selectedImporter: { ...editing, type: 'sync_multiple', mapping: [{ type: 'sync_products' }] }, editState: { mapping: [{ type: 'sync_products' }] } })
    expect(label('Business ID')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Fields' })).not.toBeInTheDocument()
    expect(screen.getByTestId('child-mapping-list')).toHaveAttribute('data-count', '1')
  })

  it('the advanced options of an extras importer hide the mapping ids and the metafields', () => {
    draw({ isAdvanedOptions: true, selectedImporter: { ...editing, type: 'sync_extras' } })
    expect(label('Business ID')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'MetaFields' })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Fields' })).toBeInTheDocument()
    // advanced options show the name and slug but do not rename the importer
    expect(label('Name')).toBeDisabled()
    expect(label('Slug')).toBeDisabled()
  })

  it('a mapping (isMapping) has the type and ids but not the name and slug', () => {
    draw({ isMapping: true })
    expect(label('Name')).not.toBeInTheDocument()
    expect(label('Slug')).not.toBeInTheDocument()
    expect(label('Type')).toBeInTheDocument()
    expect(label('Business ID')).toBeInTheDocument()
  })

  it('typing a mapping id reports it to the controller by name and value; only digits are accepted', async () => {
    const { props } = draw()
    await userEvent.type(label('Business ID'), '4a2')
    const calls = props.handleChangeMappingInput.mock.calls.map(([event]) => event.target)
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.every(target => target.name === 'business_id')).toBe(true)
    expect(calls[calls.length - 1].value).toMatch(/^\d+$/)
  })

  it('the mapping ids show the controller state', () => {
    draw({ mappingState: { business_id: 12, external_business_id: 99 } })
    expect(label('Business ID')).toHaveValue(12)
    expect(label('External business ID')).toHaveValue(99)
  })
})

describe('name, slug and type', () => {
  it('Name and Slug report to handleChangeInput; the slug refuses spaces', async () => {
    const { props } = draw()
    await userEvent.type(label('Name'), 'Menu')
    expect(props.handleChangeInput).toHaveBeenCalled()
    expect(props.handleChangeInput.mock.calls.at(-1)[0].target).toEqual({ name: 'name', value: 'Menu' })
    await userEvent.type(label('Slug'), 'a b')
    expect(label('Slug')).toHaveValue('ab')
    expect(props.handleChangeInput.mock.calls.at(-1)[0].target).toEqual({ name: 'slug', value: 'ab' })
  })

  it('the type is a select of the 8 types and tells the controller the sync name', async () => {
    const { props } = draw()
    const select = label('Type')
    expect(select.tagName).toBe('SELECT')
    expect(within(select).getAllByRole('option').map(option => option.textContent)).toEqual([
      'Store', 'Category', 'Product', 'Extra products', 'Extras', 'Extra options', 'extra option suboptions', 'Multiple'
    ])
    await userEvent.selectOptions(select, 'Category')
    expect(props.handleChangeSelect).toHaveBeenLastCalledWith('type', 'sync_categories')
    expect(label('Category ID')).toBeInTheDocument()
  })

  it('a default importer shows its type read-only, not a select', () => {
    draw({ selectedImporter: defaultOne })
    const type = label('Type')
    expect(type.tagName).toBe('INPUT')
    expect(type).toHaveValue('Store')
    expect(type).toHaveAttribute('readonly')
  })
})

describe('the save button', () => {
  it('says Add importer when creating and Save when editing', () => {
    const first = draw()
    expect(screen.getByRole('button', { name: 'Add importer' })).toBeInTheDocument()
    first.unmount()
    draw({ selectedImporter: editing })
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add importer' })).not.toBeInTheDocument()
  })

  it('is disabled while `changes` has one key and calls the controller with two or more', async () => {
    const { props, redraw } = draw()
    expect(screen.getByRole('button', { name: 'Add importer' })).toBeDisabled()
    redraw({ formState: { loading: false, changes: { type: 'sync_businesses', name: 'x' }, result: { error: false } } })
    const button = screen.getByRole('button', { name: 'Add importer' })
    expect(button).toBeEnabled()
    await userEvent.click(button)
    expect(props.handleCreateImporter).toHaveBeenCalledTimes(1)
    expect(props.editImporter).not.toHaveBeenCalled()
  })

  it('edits through editImporter', async () => {
    const { props } = draw({ selectedImporter: editing, formState: { loading: false, changes: { type: 'sync_products', name: 'x' }, result: { error: false } } })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(props.editImporter).toHaveBeenCalledTimes(1)
    expect(props.handleCreateImporter).not.toHaveBeenCalled()
  })

  it('is busy while the controller loads and does not fire again', async () => {
    const { props } = draw({ selectedImporter: editing, formState: { loading: true, changes: { type: 'sync_products', name: 'x' }, result: { error: false } } })
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    expect(props.editImporter).not.toHaveBeenCalled()
  })

  it('a default importer has no save button and its mapping block is disabled', () => {
    draw({ selectedImporter: defaultOne, formState: { loading: false, changes: { type: 'sync_businesses', name: 'x' }, result: { error: false } } })
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add importer' })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Mapping' })).toBeDisabled()
    expect(label('Business ID')).toBeDisabled()
    expect(screen.getByRole('group', { name: 'Fields' })).toBeDisabled()
    expect(screen.getByRole('group', { name: 'MetaFields' })).toBeDisabled()
  })

  it('a default importer given by prop (a mapping of a default multiple importer) is read-only too', () => {
    draw({ isMapping: true, defaultImporter: true })
    expect(screen.queryByRole('button', { name: 'Add importer' })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Mapping' })).toBeDisabled()
  })
})

describe('fields and metafields', () => {
  it('each field has a remove button named after it that calls removeField(name)', async () => {
    const { props } = draw({ fieldList: { sku: 3, barcode: 4 } })
    const group = screen.getByRole('group', { name: 'Fields' })
    expect(within(group).getByText('sku')).toBeInTheDocument()
    await userEvent.click(within(group).getByRole('button', { name: 'Remove barcode' }))
    expect(props.removeField).toHaveBeenCalledWith('barcode')
    expect(props.removeMetaField).not.toHaveBeenCalled()
  })

  it('each metafield has a remove button that calls removeMetaField(name)', async () => {
    const { props } = draw({ metafieldList: { color: 9 } })
    const group = screen.getByRole('group', { name: 'MetaFields' })
    await userEvent.click(within(group).getByRole('button', { name: 'Remove color' }))
    expect(props.removeMetaField).toHaveBeenCalledWith('color')
    expect(props.removeField).not.toHaveBeenCalled()
  })

  it('adds a field with its name and number, and the row is cleared', async () => {
    const { props } = draw()
    const group = screen.getByRole('group', { name: 'Fields' })
    await userEvent.type(within(group).getByLabelText('Name'), 'sku')
    await userEvent.type(within(group).getByLabelText('Value'), '5')
    await userEvent.click(within(group).getByRole('button', { name: 'Add field' }))
    await waitFor(() => expect(props.addNewField).toHaveBeenCalledWith('sku', '5'))
    expect(props.addNewMetaField).not.toHaveBeenCalled()
    await waitFor(() => expect(within(group).getByLabelText('Name')).toHaveValue(''))
    expect(within(group).getByLabelText('Value')).toHaveValue(null)
  })

  it('adds a metafield through addNewMetaField', async () => {
    const { props } = draw()
    const group = screen.getByRole('group', { name: 'MetaFields' })
    await userEvent.type(within(group).getByLabelText('Name'), 'color')
    await userEvent.type(within(group).getByLabelText('Value'), '2')
    await userEvent.click(within(group).getByRole('button', { name: 'Add metafield' }))
    await waitFor(() => expect(props.addNewMetaField).toHaveBeenCalledWith('color', '2'))
    expect(props.addNewField).not.toHaveBeenCalled()
  })

  it('does not add an empty row', async () => {
    const { props } = draw()
    const group = screen.getByRole('group', { name: 'Fields' })
    expect(within(group).getByRole('button', { name: 'Add field' })).toBeDisabled()
    await userEvent.type(within(group).getByLabelText('Name'), 'sku')
    expect(within(group).getByRole('button', { name: 'Add field' })).toBeDisabled()
    expect(props.addNewField).not.toHaveBeenCalled()
  })

  it('removing never submits the add row (every button that is not Add is type=button)', async () => {
    const { props } = draw({ fieldList: { sku: 3 } })
    await userEvent.click(screen.getByRole('button', { name: 'Remove sku' }))
    expect(props.removeField).toHaveBeenCalledTimes(1)
    expect(props.addNewField).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Remove sku' })).toHaveAttribute('type', 'button')
    expect(screen.getAllByRole('button', { name: /^Add (field|metafield)$/ }).every(button => button.getAttribute('type') === 'submit')).toBe(true)
  })
})

describe('CSV file example', () => {
  it('is a link-style button with the file name that downloads the example', async () => {
    const { props } = draw({ selectedImporter: editing, editState: { type: 'sync_products' } })
    expect(screen.getByText('CSV file example')).toBeInTheDocument()
    const link = screen.getByRole('button', { name: /sync_products\.csv/ })
    expect(link).toHaveAttribute('type', 'button')
    expect(link).toHaveAttribute('data-variant', 'link')
    await userEvent.click(link)
    expect(props.downloadCSV).toHaveBeenCalledTimes(1)
  })

  it('is not offered when creating, or inside a mapping', () => {
    draw()
    expect(screen.queryByText('CSV file example')).not.toBeInTheDocument()
  })
})

describe('error', () => {
  it('shows the controller error inline, closable', async () => {
    draw({ formState: { loading: false, changes: { type: 'sync_businesses', name: 'x' }, result: { error: true, result: ['Slug already taken', 'Name is required'] } } })
    const notice = screen.getByRole('alert')
    expect(notice).toHaveTextContent('Slug already taken')
    expect(notice).toHaveTextContent('Name is required')
    expect(notice).toHaveAttribute('data-tone', 'danger')
    await userEvent.click(within(notice).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('a new error opens the notice again', async () => {
    const first = { loading: false, changes: { type: 'sync_businesses', name: 'x' }, result: { error: true, result: ['one'] } }
    const { redraw } = draw({ formState: first })
    await userEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Close' }))
    redraw({ formState: { ...first, result: { error: true, result: ['two'] } } })
    expect(screen.getByRole('alert')).toHaveTextContent('two')
  })

  it('shows no notice without an error', () => {
    draw()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('closes the level through onClose when the controller answers with a saved importer', () => {
    const { props, redraw } = draw()
    expect(props.onClose).not.toHaveBeenCalled()
    redraw({ formState: { loading: false, changes: {}, result: { error: false, result: { id: 11 } } } })
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})

describe('leave guard (unsaved work)', () => {
  // A level around the form, a controller stand-in that keeps `changes`, and a way to answer the save.
  const Level = ({ spies, answer, extra = {}, initial = { type: 'sync_businesses' } }) => {
    const [open, setOpen] = useState(true)
    const [changes, setChanges] = useState(initial)
    const [result, setResult] = useState({ error: false })
    // the owner keeps the importer in state: its identity only changes when another importer is opened
    const [selectedImporter] = useState(extra.selectedImporter ?? {})
    const props = baseProps({
      ...extra,
      selectedImporter,
      formState: { loading: false, changes, result },
      handleChangeInput: (event) => setChanges(current => ({ ...current, [event.target.name]: event.target.value })),
      handleChangeMappingInput: (event) => setChanges(current => ({ ...current, mapping: JSON.stringify({ [event.target.name]: event.target.value }) })),
      handleCreateImporter: () => { spies.create(); answer?.(setResult) },
      editImporter: () => { spies.edit(); answer?.(setResult) }
    })
    return (
      <ImportersStack rootTitle='Importers'>
        <p>list</p>
        {open && (
          <ImportersPane title='Add importer' onBack={() => setOpen(false)}>
            <ImporterFormUI {...props} />
          </ImportersPane>
        )}
      </ImportersStack>
    )
  }

  let spies
  const drawLevel = async (props) => {
    const utils = render(<Level spies={spies} {...props} />)
    await screen.findByRole('heading', { name: 'Add importer' })
    return utils
  }
  const back = () => userEvent.click(screen.getByRole('button', { name: 'Close Add importer' }))

  beforeEach(() => { spies = { create: vi.fn(), edit: vi.fn() } })

  it('closes at once when nothing was typed', async () => {
    await drawLevel()
    await back()
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Add importer' })).not.toBeInTheDocument())
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('an edit opens with name, type and mapping in `changes` and closes at once: only the user makes it dirty', async () => {
    await drawLevel({
      extra: { selectedImporter: editing },
      initial: { name: 'Menu sync', type: 'sync_products', mapping: '{}' }
    })
    await back()
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Add importer' })).not.toBeInTheDocument())
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('asks when `changes` has two keys or more after the user typed; Keep editing stays', async () => {
    await drawLevel()
    await userEvent.type(label('Name'), 'Menu')
    await back()
    expect(await screen.findByRole('alertdialog', { name: 'Save your changes?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Add importer' })).toBeInTheDocument()
    expect(label('Name')).toHaveValue('Menu')
  })

  it('Discard closes the level without saving', async () => {
    await drawLevel()
    await userEvent.type(label('Name'), 'Menu')
    await back()
    await userEvent.click(await screen.findByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Add importer' })).not.toBeInTheDocument())
    expect(spies.create).not.toHaveBeenCalled()
  })

  it('a default importer cannot be saved, so it never asks', async () => {
    await drawLevel({ extra: { selectedImporter: defaultOne }, initial: { name: 'x', type: 'sync_businesses' } })
    await back()
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Add importer' })).not.toBeInTheDocument())
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('Save and continue runs the same submit and goes on when the controller answers without error', async () => {
    await drawLevel({ answer: (setResult) => setResult({ error: false, result: {} }) })
    await userEvent.type(label('Name'), 'Menu')
    await back()
    await userEvent.click(await screen.findByRole('button', { name: 'Save and continue' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Add importer' })).not.toBeInTheDocument())
    expect(spies.create).toHaveBeenCalledTimes(1)
  })

  it('Save and continue stays, with the error shown, when the controller answers with an error', async () => {
    await drawLevel({ answer: (setResult) => setResult({ error: true, result: ['Slug already taken'] }) })
    await userEvent.type(label('Name'), 'Menu')
    await back()
    await userEvent.click(await screen.findByRole('button', { name: 'Save and continue' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Add importer' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Slug already taken')
  })

  it('a mapping saves through the custom handler: the controller answers nothing, so it goes on at once', async () => {
    await drawLevel({ extra: { isMapping: true, handleCustomAddImporter: vi.fn() } })
    await userEvent.type(label('Business ID'), '3')
    await back()
    await userEvent.click(await screen.findByRole('button', { name: 'Save and continue' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Add importer' })).not.toBeInTheDocument())
    expect(spies.create).toHaveBeenCalledTimes(1)
  })
})

// review (3.C): fixes from the fresh review of the lot
describe('review fixes', () => {
  it('a new mapping says Add (as main did), not Add importer', () => {
    draw({ isMapping: true, selectedImporter: {} })
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add importer' })).not.toBeInTheDocument()
  })

  it('the Type select keeps «Multiple» after the controller resets #importer-form from the DOM', async () => {
    const multiple = { id: 9, name: 'Multi', slug: 'multi', type: 'sync_multiple', mapping: [] }
    const { container } = draw({ selectedImporter: multiple, editState: multiple })
    const select = container.querySelector('select[name=type]')
    await waitFor(() => expect(select.value).toBe('8'))
    container.querySelector('#importer-form').reset()
    expect(select.value).not.toBe('8') // the reset put the HTML default back
    await waitFor(() => expect(select.value).toBe('8'))
  })
})

// bugs E row 7: «Import Users» (`sync_users`) is not one of the 8 types of the select. It showed «Store» and the form told
// the controller `type: sync_businesses`, so saving it changed its type. Now its own type is the selected option and nothing else is sent.
describe('an importer whose type is not one of the 8 (row 7)', () => {
  const users = { id: 11, name: 'Import Users', slug: 'import_users', type: 'sync_users', mapping: {} }

  it('shows its own type selected, not Store, and never tells the controller another type', async () => {
    const { props } = draw({ selectedImporter: users, editState: users })
    const select = label('Type')
    await waitFor(() => expect(select.selectedOptions[0].textContent).toBe('Users'))
    expect(props.handleChangeSelect).not.toHaveBeenCalledWith('type', 'sync_businesses')
    expect(within(select).getAllByRole('option')).toHaveLength(9)
  })

  it('an unknown type without a name of its own shows its sync name', async () => {
    const other = { ...users, type: 'sync_external_orders' }
    draw({ selectedImporter: other, editState: other })
    await waitFor(() => expect(label('Type').selectedOptions[0].textContent).toBe('sync_external_orders'))
  })

  it('editing an importer of a known type does not send Store first', () => {
    const { props } = draw({ selectedImporter: editing })
    expect(props.handleChangeSelect).not.toHaveBeenCalledWith('type', 'sync_businesses')
    expect(props.handleChangeSelect).toHaveBeenCalledWith('type', 'sync_products')
  })

  it('a new importer still has only the 8 types and starts on Store', () => {
    const { props } = draw()
    expect(within(label('Type')).getAllByRole('option')).toHaveLength(8)
    expect(props.handleChangeSelect).toHaveBeenLastCalledWith('type', 'sync_businesses')
  })
})

// bugs E row 8a: changing Type makes the controller reset #importer-form from the DOM (to clear the mapping ids), which
// blanked Name and Slug on screen while `changes` still had them. They stay on screen now.
describe('changing Type keeps Name and Slug (row 8a)', () => {
  it('keeps what was typed after the controller resets the form', async () => {
    const { props } = draw()
    props.handleChangeSelect.mockImplementation(() => { document.getElementById('importer-form')?.reset() })
    await userEvent.type(label('Name'), 'Menu')
    await userEvent.type(label('Slug'), 'menu')
    await userEvent.selectOptions(label('Type'), 'Category')
    await waitFor(() => expect(label('Type')).toHaveValue('2'))
    await waitFor(() => expect(label('Name')).toHaveValue('Menu'))
    expect(label('Slug')).toHaveValue('menu')
  })
})
