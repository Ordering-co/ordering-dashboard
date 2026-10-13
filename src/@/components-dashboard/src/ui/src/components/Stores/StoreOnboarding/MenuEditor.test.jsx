import React from 'react'
import { act, render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ThemeProvider } from 'styled-components'
import theme from '~/theme.json'
import { applyMenuChange } from '../../../../../utils/storeOnboarding'
import { MenuEditor } from './MenuEditor'
import { BusinessProductAddFormUI } from '../BusinessProductAddForm'
import { BusinessProductsCategoyInfo } from '../BusinessProductsCategoyInfo'
vi.mock('../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (_, fallback) => fallback] }))
vi.mock('../../../../../contexts/ConfigContext', () => ({ useConfig: () => [{ configs: { appointments: { value: true }, use_parent_category: { value: '1' } } }] }))
vi.mock('../../Shared', () => ({
  Alert: ({ open, content }) => open ? <div role='alert'>{content}</div> : null,
  Confirm: () => null,
  Modal: ({ open, children }) => open ? <div role='dialog'>{children}</div> : null,
  ImageCrop: ({ handleChangePhoto }) => <button onClick={() => handleChangePhoto('data:image/png;base64,Y3JvcHBlZA==')}>Crop</button>,
  ColorPicker: () => null
}))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const categories = [{ key: 'c', name: 'Food', products: [{ key: 'p', name: 'Pizza', price: 0 }] }]
const mount = (onChange = vi.fn().mockResolvedValue(true)) => render(<ThemeProvider theme={theme}><MenuEditor categories={categories} mode='manual' onChange={onChange} onEditingChange={vi.fn()} /></ThemeProvider>)
const readerStub = () => {
  const readers = []
  vi.stubGlobal('FileReader', class { constructor () { this.readyState = 1; this.abort = vi.fn(); readers.push(this) } readAsDataURL () {} })
  return readers
}
it.each([['Food', 'header', 0], ['Food', 'image', 1], ['Pizza', 'images', 0]])('uses the native %s form and saves the confirmed %s crop', async (name, field, inputIndex) => {
  const readers = readerStub(); const onChange = vi.fn().mockResolvedValue(true)
  const view = mount(onChange)
  fireEvent.click(screen.getByRole('button', { name: `Edit ${name}` }))
  if (name === 'Pizza') expect(screen.getByPlaceholderText('Write price')).toHaveValue(0)
  expect(screen.queryByText('Ribbon')).toBeNull()
  const inputs = view.container.querySelectorAll('input[type=file]')
  fireEvent.change(inputs[inputIndex], { target: { files: [new File(['png'], 'menu.png', { type: 'image/png' })] } })
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  act(() => { readers[0].result = 'data:image/png;base64,b3JpZ2luYWw='; readers[0].onload() })
  fireEvent.click(screen.getByRole('button', { name: 'Crop' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ patch: expect.objectContaining({ [field]: 'data:image/png;base64,Y3JvcHBlZA==' }) })))
  await waitFor(() => expect(screen.getByRole('button', { name: `Edit ${name}` })).toBeVisible())
})
it('retains unsaved values on failed persistence and cancel does not publish them', async () => {
  const onChange = vi.fn().mockResolvedValue(false); mount(onChange)
  fireEvent.click(screen.getByRole('button', { name: 'Edit Pizza' }))
  fireEvent.change(screen.getByPlaceholderText('Write a name'), { target: { value: 'New pizza' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByRole('alert')
  expect(screen.getByPlaceholderText('Write a name')).toHaveValue('New pizza')
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.getByText('Pizza')).toBeVisible()
  expect(onChange).toHaveBeenCalledTimes(1)
})
it('cancels a pending native file read without changing the saved menu', () => {
  const readers = readerStub(); const onChange = vi.fn(); const view = mount(onChange)
  fireEvent.click(screen.getByRole('button', { name: 'Edit Pizza' }))
  fireEvent.change(view.container.querySelector('input[type=file]'), { target: { files: [new File(['png'], 'menu.png', { type: 'image/png' })] } })
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  act(() => { readers[0].result = 'data:image/png;base64,b2xk'; readers[0].onload() })
  expect(readers[0].abort).toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(onChange).not.toHaveBeenCalled()
})
it('preserves existing native form options and raw image callbacks when draft mode is omitted', () => {
  const readers = readerStub(); const raw = vi.fn()
  const props = { formState: { changes: { name: 'Existing', price: 1 }, result: { error: false } }, handleChangeItem: vi.fn(), handleChangeInput: vi.fn(), handlechangeImage: raw, handleUpdateClick: vi.fn() }
  const view = render(<ThemeProvider theme={theme}><BusinessProductAddFormUI {...props} /></ThemeProvider>)
  expect(screen.getByText('New product')).toBeTruthy()
  expect(screen.getByText('Type')).toBeTruthy()
  const file = new File(['png'], 'product.png', { type: 'image/png' })
  fireEvent.change(view.container.querySelector('input[type=file]'), { target: { files: [file] } })
  expect(raw).toHaveBeenCalledWith(file)
  expect(readers).toHaveLength(1)
  view.unmount()
  render(<ThemeProvider theme={theme}><BusinessProductsCategoyInfo {...props} isAddMode parentCategories={[]} /></ThemeProvider>)
  expect(screen.getByText('Ribbon')).toBeTruthy()
})

it('requires saving a real first category before asking for its first product', async () => {
  const onChange = vi.fn().mockResolvedValue(true)
  render(<ThemeProvider theme={theme}><MenuEditor categories={[]} mode='manual' onChange={onChange} onEditingChange={vi.fn()} /></ThemeProvider>)
  expect(screen.getByPlaceholderText('Enter a category name')).toBeVisible()
  expect(screen.queryByText('Category name 1')).toBeNull()
  expect(screen.queryByText('Product name 1')).toBeNull()
  expect(screen.queryByRole('button', { name: /Add product/ })).toBeNull()
  fireEvent.change(screen.getByPlaceholderText('Enter a category name'), { target: { value: 'Desserts' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(screen.getByPlaceholderText('Write a name')).toBeVisible())
  expect(onChange.mock.calls[0][0]).toMatchObject({ kind: 'category', isNew: true, patch: { name: 'Desserts' } })
  expect(screen.getByPlaceholderText('Write a name')).toHaveValue('')
})
it('keeps the category form until its save succeeds', async () => {
  const onChange = vi.fn().mockResolvedValue(false)
  render(<ThemeProvider theme={theme}><MenuEditor categories={[]} mode='manual' onChange={onChange} onEditingChange={vi.fn()} /></ThemeProvider>)
  fireEvent.change(screen.getByPlaceholderText('Enter a category name'), { target: { value: 'Desserts' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByRole('alert')
  expect(screen.getByPlaceholderText('Enter a category name')).toHaveValue('Desserts')
  expect(screen.queryByPlaceholderText('Write a name')).toBeNull()
})

it('creates a category and then its product without ever inserting placeholder rows', async () => {
  const Harness = () => {
    const [rows, setRows] = React.useState([])
    return <MenuEditor categories={rows} mode='manual' onEditingChange={vi.fn()} onChange={async change => { setRows(current => applyMenuChange({ menuMode: 'manual', categories: current }, change)); return true }} />
  }
  render(<ThemeProvider theme={theme}><Harness /></ThemeProvider>)
  fireEvent.change(screen.getByPlaceholderText('Enter a category name'), { target: { value: 'Desserts' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByPlaceholderText('Write a name')
  fireEvent.change(screen.getByPlaceholderText('Write a name'), { target: { value: 'Cheesecake' } })
  fireEvent.change(screen.getByPlaceholderText('Write price'), { target: { value: '5' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByRole('button', { name: 'Edit Cheesecake' })
  expect(screen.getByRole('heading', { name: 'Desserts' })).toBeVisible()
  expect(screen.getByText('Cheesecake')).toBeVisible()
  expect(screen.queryByText('Product name 1')).toBeNull()
  const actions = screen.getAllByRole('button').filter(button => /Add category|Add product/.test(button.textContent))
  expect(actions.map(button => button.textContent)).toEqual(['+ Add category', '+ Add product'])
})
it('does not allow products under an unnamed legacy category after cancelling its repair', () => {
  const legacy = [{ key: 'c', name: '', products: [{ key: 'p', name: 'Existing product', price: '10' }] }]
  render(<ThemeProvider theme={theme}><MenuEditor categories={legacy} mode='manual' onChange={vi.fn()} onEditingChange={vi.fn()} /></ThemeProvider>)
  expect(screen.getByPlaceholderText('Enter a category name')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.getByRole('button', { name: '+ Add product' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Edit Existing product' })).toBeDisabled()
  expect(screen.getByText('Existing product')).toBeVisible()
})
