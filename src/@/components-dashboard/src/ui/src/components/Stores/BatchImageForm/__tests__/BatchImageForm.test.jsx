/* eslint-disable import/first */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// bugs E D16 and D21: the global `event` in handleSubmit, copy that was not translated, API errors that no one
// showed, and a drop zone that only the pointer could use
const DICTIONARY = {
  BATCH_IMAGES_ISSUES: 'Problemas con las imágenes:',
  UPLOAD_IMAGES_BATCH: 'Subir imágenes por lotes',
  PROFILE: 'Perfil',
  ERROR_UNKNOWN: 'Ha ocurrido un error',
  PRODUCT_NOT_FOUND: 'Producto no encontrado'
}

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (key, fallback) => DICTIONARY[key] ?? fallback],
  DragAndDrop: ({ children }) => <div>{children}</div>,
  BatchImageForm: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
vi.mock('../../../Shared', () => ({
  Alert: ({ open, title, content }) => (
    open ? <div role='alertdialog' aria-label={title}>{[].concat(content).join(' | ')}</div> : null
  )
}))

import { BatchImageForm } from '../index'

const idle = { photos: [], loading: false, result: { error: null }, API: false, endPoint: false }

const renderForm = (props = {}) => renderWithProviders(
  <BatchImageForm
    onClose={() => {}}
    products={[]}
    handleUploadImages={() => {}}
    cleanFormState={() => {}}
    updateProduct={() => {}}
    {...props}
    formState={{ ...idle, ...props.formState }}
  />
)

describe('BatchImageForm UI', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('D16a: Save takes the event from its click, not from the global, and does not submit the form', () => {
    vi.stubGlobal('event', undefined)
    const updateProduct = vi.fn()
    const { container } = renderForm({ updateProduct, formState: { photos: [{ name: 5, base64: 'data:' }] } })
    const onSubmit = vi.fn(e => e.preventDefault())
    container.querySelector('form').addEventListener('submit', onSubmit)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(updateProduct).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('D16b: translates the issues heading', () => {
    renderForm()
    expect(screen.getByText('Problemas con las imágenes:')).toBeInTheDocument()
    expect(screen.queryByText('Issues with images:')).not.toBeInTheDocument()
  })

  it('D16b/D16c: shows an API failure in the alert, translated, with a title that is not Profile', () => {
    renderForm({ formState: { result: { error: true, result: ['Product not found'] } } })
    const alert = screen.getByRole('alertdialog')
    expect(alert).toHaveTextContent('Producto no encontrado')
    expect(alert).toHaveAccessibleName('Subir imágenes por lotes')
    expect(screen.queryByLabelText('Perfil')).not.toBeInTheDocument()
  })

  it('D16c: an API failure that is a plain string or an Error shows its message', () => {
    renderForm({ formState: { result: { error: true, result: 'Product not found' } } })
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Producto no encontrado')
  })

  it('D16c: an API failure without a message shows the generic error', () => {
    renderForm({ formState: { result: { error: true, result: undefined } } })
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Ha ocurrido un error')
  })

  it('D16c: shows nothing when there is no failure', () => {
    renderForm({ formState: { result: { error: false, result: 'all product updated' } } })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('D21: the drop zone is a named button that the keyboard reaches and opens the file picker', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()
    const input = container.querySelector('input[type=file]')
    const pick = vi.spyOn(input, 'click')
    const zone = screen.getByRole('button', { name: 'Subir imágenes por lotes' })
    await user.tab()
    expect(zone).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(pick).toHaveBeenCalledTimes(1)
    await user.keyboard(' ')
    expect(pick).toHaveBeenCalledTimes(2)
  })

  it('D21: the drop zone still opens the file picker with the pointer', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()
    const pick = vi.spyOn(container.querySelector('input[type=file]'), 'click')
    await user.click(screen.getByRole('button', { name: 'Subir imágenes por lotes' }))
    expect(pick).toHaveBeenCalledTimes(1)
  })
})
