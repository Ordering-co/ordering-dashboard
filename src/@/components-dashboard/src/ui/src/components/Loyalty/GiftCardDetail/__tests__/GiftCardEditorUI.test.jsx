/* eslint-disable import/first */
// redesign GC-C (; D6 | GC-06, GC-08, GC-09, GC-12, GC-13, GC-17, GC-18): the card of a gift card for sale on Product.
// The controller (PlatformProductDetail, lote A) is a stateful stand-in with the same contract: `formState {loading, error, changes}`,
// `handleChangeItem`, and `handleUpdateProduct / handleAddProduct / handleDeleteProduct` that answer `{ ok, result | error }`. The Product
// wrappers (AsyncSwitch, Menu, ConfirmDialog, ImageField, TextField, NumberField, InlineNotice, Button) are the real ones.
// Covered: the switch saves at once with `{ silent: true }` and goes back if it fails; delete asks first and Cancel deletes nothing;
// Name and Amount are validated on Save with the error in their own field and the focus on the first; Save and Add go through `t()`;
// the error of a failed save shows in the notice, translated; the image accepts png and jpeg up to 2 MB and says why not; the form
// tells the host whether it holds unsaved changes.
import React from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const ctl = vi.hoisted(() => ({ dict: {}, update: null, add: null, del: null, onDirtyChange: null }))

const translate = vi.hoisted(() => (key, fallback) => (key in ctl.dict ? ctl.dict[key] : fallback))

const mockModule = vi.hoisted(() => async () => {
  const ReactModule = await import('react')
  return {
    useLanguage: () => [{}, (key, fallback) => (key in ctl.dict ? ctl.dict[key] : fallback)],
    useUtils: () => [{ optimizeImage: url => url }],
    PlatformProductDetail: ({ UIComponent, ...props }) => {
      const [formState, setFormState] = ReactModule.useState({ loading: false, error: null, changes: {} })
      const handleChangeItem = (changes) => setFormState(prev => ({ ...prev, changes: { ...prev.changes, ...changes } }))
      return ReactModule.createElement(UIComponent, {
        ...props,
        formState,
        handleChangeItem,
        handleChangeInput: vi.fn(),
        handlechangeImage: ctl.changeImage,
        handleUpdateProduct: ctl.update,
        handleAddProduct: ctl.add,
        handleDeleteProduct: ctl.del
      })
    }
  }
})
vi.mock('../../../../../../index', mockModule)
vi.mock('~components', mockModule)
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, translate]
}))
// The legacy cropper needs the session and the API; its contract is what ImageField hands it: `handleChangePhoto(photo)` and `onClose()`
vi.mock('../../../Shared/UI/ImageCrop', async () => {
  const ReactModule = await import('react')
  return {
    ImageCrop: ({ handleChangePhoto, onClose }) => ReactModule.createElement(
      'div',
      null,
      ReactModule.createElement('button', { type: 'button', onClick: () => { handleChangePhoto('data:image/png;base64,CROPPED'); onClose() } }, 'Confirm crop'),
      ReactModule.createElement('button', { type: 'button', onClick: () => onClose() }, 'Cancel crop')
    )
  }
})

import { GiftCardEditor } from '../index'

const CARD = { id: 7, name: 'Birthday', price: 25, enabled: false, image: null }

const renderEditor = (product = CARD, extra = {}) => renderWithProviders(
  <GiftCardEditor product={product} onClose={vi.fn()} handleSuccessAddProduct={vi.fn()} handleSuccessUpdateProduct={vi.fn()} handleSuccessDeleteProduct={vi.fn()} {...extra} />
)

beforeEach(() => {
  ctl.dict = {}
  ctl.update = vi.fn(async () => ({ ok: true, result: CARD }))
  ctl.add = vi.fn(async () => ({ ok: true, result: { id: 8 } }))
  ctl.del = vi.fn(async () => ({ ok: true }))
  ctl.changeImage = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

const nameInput = () => screen.getByRole('textbox', { name: /Name/ })
const amountInput = () => screen.getByRole('textbox', { name: /Amount/ })

describe('GiftCardEditor · the Enabled switch (GC-12)', () => {
  it('saves at once, only the switch, and does not touch the unsaved form', async () => {
    renderEditor()
    await userEvent.click(screen.getByRole('switch', { name: 'Enabled' }))
    expect(ctl.update).toHaveBeenCalledTimes(1)
    expect(ctl.update).toHaveBeenCalledWith({ enabled: true }, { silent: true })
  })

  it('goes back and says why when the save fails', async () => {
    ctl.update = vi.fn(async () => ({ ok: false, error: ['Not allowed'] }))
    renderEditor()
    const toggle = screen.getByRole('switch', { name: 'Enabled' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(toggle)
    expect(await screen.findByText('Not allowed')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Enabled' })).toHaveAttribute('aria-checked', 'false')
  })

  it('says it in its own words when the error has no text', async () => {
    ctl.update = vi.fn(async () => ({ ok: false, error: [] }))
    renderEditor()
    await userEvent.click(screen.getByRole('switch', { name: 'Enabled' }))
    expect(await screen.findByText("The gift card didn't change. Try again.")).toBeInTheDocument()
  })

  it('is not offered on a card that does not exist yet', () => {
    renderEditor({})
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument()
  })
})

describe('GiftCardEditor · delete (GC-11, GC-18)', () => {
  const openDelete = async () => {
    await userEvent.click(screen.getByRole('button', { name: 'More actions' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    return screen.findByRole('alertdialog')
  }

  it('asks first, with the name, and Cancel deletes nothing', async () => {
    renderEditor()
    const dialog = await openDelete()
    expect(within(dialog).getByText('Delete Birthday?')).toBeInTheDocument()
    expect(within(dialog).getByText("This can't be undone.")).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(ctl.del).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  // redesign GC-D (R4): the dialog hands the focus back to the menu item that opened it, which is gone (the menu closed), and the sheet
  // ends up taking it to its first «Close». Cancelling, or a refusal, leaves the person on «More actions», where they were.
  it('Cancel puts the focus back on «More actions» (R4)', async () => {
    renderEditor()
    const dialog = await openDelete()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: 'More actions' })).toHaveFocus())
  })

  it('Escape puts the focus back on «More actions» too (R4)', async () => {
    renderEditor()
    await openDelete()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByRole('button', { name: 'More actions' })).toHaveFocus())
  })

  it('a refusal closes the dialog, shows why and puts the focus back on «More actions» (R4)', async () => {
    ctl.del = vi.fn(async () => ({ ok: false, error: ['Gift card in use'] }))
    renderEditor()
    const dialog = await openDelete()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Gift card in use')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: 'More actions' })).toHaveFocus())
  })

  it('deletes once confirmed', async () => {
    renderEditor()
    const dialog = await openDelete()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(ctl.del).toHaveBeenCalledTimes(1)
    expect(ctl.del).toHaveBeenCalledWith({ silent: true })
  })

  it('shows why when the API refuses', async () => {
    ctl.del = vi.fn(async () => ({ ok: false, error: ['Gift card in use'] }))
    renderEditor()
    const dialog = await openDelete()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Gift card in use')).toBeInTheDocument()
  })
})

describe('GiftCardEditor · validation and save (GC-06, GC-08, GC-09, GC-13)', () => {
  it('Save is off until something changes, and Save and Add are translated', async () => {
    ctl.dict = { SAVE: 'Guardar', ADD: 'Añadir' }
    const view = renderEditor()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
    view.unmount()
    renderEditor({})
    expect(screen.getByRole('button', { name: 'Añadir' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('a name left empty is an error in its own field, with the visible name, and the focus goes there', async () => {
    ctl.dict = { VALIDATION_ERROR_REQUIRED: '_attribute_ is required' }
    renderEditor()
    await userEvent.clear(nameInput())
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const error = await screen.findByText('Name is required')
    expect(error.closest('[role="alert"]')).not.toBeNull()
    expect(nameInput()).toHaveAttribute('aria-invalid', 'true')
    expect(nameInput()).toHaveFocus()
    expect(screen.queryByText(/\bname\b is required/)).not.toBeInTheDocument()
    expect(ctl.update).not.toHaveBeenCalled()
  })

  it('an empty amount is an error in its field', async () => {
    renderEditor()
    await userEvent.clear(amountInput())
    await userEvent.type(nameInput(), ' plus')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Value is required')).toBeInTheDocument()
    expect(amountInput()).toHaveAttribute('aria-invalid', 'true')
    expect(amountInput()).toHaveFocus()
    expect(nameInput()).not.toHaveAttribute('aria-invalid', 'true')
    expect(ctl.update).not.toHaveBeenCalled()
  })

  it('the error leaves the field as soon as it is corrected', async () => {
    renderEditor()
    await userEvent.clear(nameInput())
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Value is required')).toBeInTheDocument()
    await userEvent.type(nameInput(), 'Anniversary')
    await waitFor(() => expect(screen.queryByText('Value is required')).not.toBeInTheDocument())
  })

  it('saves an existing card with update, silent', async () => {
    renderEditor()
    await userEvent.type(nameInput(), ' 2')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(ctl.update).toHaveBeenCalledTimes(1))
    expect(ctl.update).toHaveBeenCalledWith(undefined, { silent: true })
    expect(ctl.add).not.toHaveBeenCalled()
  })

  it('adds a new card as a gift_card, silent', async () => {
    renderEditor({})
    await userEvent.type(nameInput(), 'Welcome')
    await userEvent.type(amountInput(), '15')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(ctl.add).toHaveBeenCalledTimes(1))
    expect(ctl.add).toHaveBeenCalledWith('gift_card', { silent: true })
    expect(ctl.update).not.toHaveBeenCalled()
  })

  it('the error of a failed save shows in the notice above the foot, translated', async () => {
    ctl.dict = { SERVER_SAID_NO: 'El servidor dijo que no' }
    ctl.update = vi.fn(async () => ({ ok: false, error: ['Server said no'] }))
    renderEditor()
    await userEvent.type(nameInput(), ' 2')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const notice = await screen.findByText('El servidor dijo que no')
    expect(notice.closest('[role="alert"]')).not.toBeNull()
    expect(screen.queryByText('Server said no')).not.toBeInTheDocument()
  })

  it('the error of a failed save with no text says it in its own words', async () => {
    ctl.add = vi.fn(async () => ({ ok: false, error: [] }))
    renderEditor({})
    await userEvent.type(nameInput(), 'Welcome')
    await userEvent.type(amountInput(), '15')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText("The gift card wasn't saved. Try again.")).toBeInTheDocument()
  })
})

describe('GiftCardEditor · the image (GC-17)', () => {
  const fileInput = () => document.querySelector('input[type="file"]')
  const pick = (file) => fireEvent.change(fileInput(), { target: { files: [file] } })
  const sized = (type, megabytes) => new File([new Uint8Array(Math.round(megabytes * 1024 * 1024))], 'card', { type })

  it('only png and jpeg are accepted', async () => {
    renderEditor()
    pick(sized('image/gif', 0.01))
    expect(await screen.findByText('Only images can be accepted')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Image crop' })).not.toBeInTheDocument()
  })

  it('a text file is not an image', async () => {
    renderEditor()
    pick(sized('text/plain', 0.01))
    expect(await screen.findByText('Only images can be accepted')).toBeInTheDocument()
  })

  it('more than 2 MB is refused with the reason, in the field', async () => {
    renderEditor()
    pick(sized('image/png', 3))
    const message = await screen.findByText('The maximum image size is 2 megabytes')
    expect(message.closest('[role="alert"]')).not.toBeNull()
  })

  it('a png under 2 MB passes the check and goes on to the crop', async () => {
    renderEditor()
    pick(sized('image/png', 0.5))
    await screen.findByRole('dialog', { name: 'Image crop' })
    expect(screen.queryByText('Only images can be accepted')).not.toBeInTheDocument()
    expect(screen.queryByText('The maximum image size is 2 megabytes')).not.toBeInTheDocument()
  })

  it('cancelling the crop changes nothing: `main` saved the original here', async () => {
    const onDirtyChange = vi.fn()
    renderEditor(CARD, { onDirtyChange })
    pick(sized('image/jpeg', 0.5))
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel crop' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Image crop' })).not.toBeInTheDocument())
    expect(ctl.changeImage).not.toHaveBeenCalled()
    expect(onDirtyChange).not.toHaveBeenCalledWith(true)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('a confirmed crop is the only thing that sets the image, and it needs saving', async () => {
    const onDirtyChange = vi.fn()
    renderEditor(CARD, { onDirtyChange })
    pick(sized('image/png', 0.5))
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm crop' }))
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true))
    expect(screen.getByRole('img', { name: 'Birthday' })).toHaveAttribute('src', 'data:image/png;base64,CROPPED')
    expect(ctl.changeImage).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })
})

describe('GiftCardEditor · unsaved changes (decision 17)', () => {
  it('tells the host when the form differs from the stored card, and when it is back', async () => {
    const onDirtyChange = vi.fn()
    renderEditor(CARD, { onDirtyChange })
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    await userEvent.type(nameInput(), 'X')
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true))
    await userEvent.type(nameInput(), '{Backspace}')
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false))
  })

  it('typing an amount counts, and so does leaving the card dirty when it goes away', async () => {
    const onDirtyChange = vi.fn()
    const view = renderEditor(CARD, { onDirtyChange })
    await userEvent.clear(amountInput())
    await userEvent.type(amountInput(), '30')
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true))
    view.unmount()
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })
})
