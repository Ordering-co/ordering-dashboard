/* eslint-disable import/first */
// redesign PE-B3 (decisions 5 and 7; PE-02, PE-18; defects D33, D37, D40, D42, D44): the General form of the advanced editor, with the fields of
// Product. The controller is replaced by a small host that keeps `formState.changes` the way K/EnterprisePromotionDetails does
// (handleChangeInput / handleChangeItem merge into it), so what the form STAGES is what is asserted. RecordPanel is not involved.
import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  configs: {},
  dictionary: {}
}))

vi.mock('../../../../../../index', async () => {
  const { DragAndDrop } = await import('../../../../../../components/DragAndDrop')
  const { ExamineClick } = await import('../../../../../../components/ExamineClick')
  return {
    DragAndDrop,
    ExamineClick,
    useLanguage: () => [{ language: { code: 'en' }, dictionary: {} }, (key, text) => mocks.dictionary[key] ?? text],
    useConfig: () => [{ configs: mocks.configs }],
    // the host's parseDate writes «YYYY-MM-DD HH:mm:ss» in the project format; here a readable stand-in
    useUtils: () => [{ parseDate: (value, { dateOnly } = {}) => `«${String(value).slice(0, dateOnly ? 10 : 16)}»` }]
  }
})

// The crop is the legacy ImageCrop, unchanged and with its own tests: a stub that crops to a known value
vi.mock('../../../Shared/UI/ImageCrop', () => ({
  ImageCrop: ({ photo, handleChangePhoto, onClose }) => (
    <div data-testid='crop' data-photo={photo}>
      <button type='button' onClick={() => { handleChangePhoto('data:image/png;base64,CROPPED'); onClose?.() }}>Crop</button>
    </div>
  )
}))

import { EnterprisePromotionGeneralDetails } from '..'

const ISO = /\d{4}-\d{2}-\d{2}/

const stubMatchMedia = () => {
  window.matchMedia = vi.fn((query) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
}

let spies

// The host keeps the staged changes like the controller does
const Host = ({ promotion = {}, isAddMode = false, initialChanges = {}, actionState = { loading: false, error: null } }) => {
  const [changes, setChanges] = useState(initialChanges)
  const handleChangeItem = (patch) => {
    spies.handleChangeItem(patch)
    setChanges(current => ({ ...current, ...patch }))
  }
  const handleChangeInput = (event) => {
    spies.handleChangeInput(event)
    setChanges(current => ({ ...current, [event.target.name]: event.target.value }))
  }
  return (
    <EnterprisePromotionGeneralDetails
      isAddMode={isAddMode}
      promotionState={{ promotion, loading: false, error: null }}
      formState={{ loading: false, changes }}
      actionState={actionState}
      handleChangeImage={spies.handleChangeImage}
      handleChangeInput={handleChangeInput}
      handleChangeItem={handleChangeItem}
      handleUpdateClick={spies.handleUpdateClick}
      handleAddPromotion={spies.handleAddPromotion}
    />
  )
}

const record = {
  id: 5,
  name: 'Weekend 15%',
  description: 'Fifteen percent off',
  label: 'Weekend',
  start: '2026-08-15 00:00:00',
  end: '2026-08-20 23:59:59',
  order_priority: 0,
  stackable: false
}

const dayButton = (dialog, day) => dialog.querySelector(`[data-day="${day}"]`)

beforeEach(() => {
  stubMatchMedia()
  mocks.configs = { dates_general_format: { value: 'DD/MM/YYYY HH:mm' } }
  mocks.dictionary = {}
  spies = {
    handleChangeItem: vi.fn(),
    handleChangeInput: vi.fn(),
    handleChangeImage: vi.fn(),
    handleUpdateClick: vi.fn(),
    handleAddPromotion: vi.fn()
  }
})
afterEach(() => {
  cleanup()
  delete window.matchMedia
  document.getElementById('app-modals')?.remove()
})

describe('General · name (D40)', () => {
  it('is a required field with a name; an empty name is refused INLINE under the field, not in a modal titled «Profile»', async () => {
    const user = userEvent.setup()
    render(<Host isAddMode initialChanges={{ enabled: true }} />)
    const name = screen.getByRole('textbox', { name: /^Name/ })
    expect(name).toHaveAttribute('aria-required', 'true')
    expect(screen.getByText('Required')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(spies.handleAddPromotion).not.toHaveBeenCalled()
    const message = await screen.findByText('The name is required.')
    expect(message.closest('[role="alert"]')).not.toBeNull()
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveAccessibleDescription('The name is required.')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByText('Profile')).toBeNull()
  })

  it('typing stages {name} through handleChangeInput with an event-like target, and the message goes away', async () => {
    const user = userEvent.setup()
    render(<Host isAddMode initialChanges={{ enabled: true }} />)
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await screen.findByText('The name is required.')

    await user.type(screen.getByRole('textbox', { name: /^Name/ }), 'S')

    expect(spies.handleChangeInput).toHaveBeenLastCalledWith({ target: { name: 'name', value: 'S' } })
    await waitFor(() => expect(screen.queryByText('The name is required.')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(spies.handleAddPromotion).toHaveBeenCalledTimes(1)
  })

  it('the description and the label stage through handleChangeInput too; the description is named «Description»', async () => {
    const user = userEvent.setup()
    render(<Host promotion={record} />)
    await user.type(screen.getByRole('textbox', { name: 'Description' }), '!')
    expect(spies.handleChangeInput).toHaveBeenLastCalledWith({ target: { name: 'description', value: 'Fifteen percent off!' } })
    await user.type(screen.getByRole('textbox', { name: 'Label' }), '!')
    expect(spies.handleChangeInput).toHaveBeenLastCalledWith({ target: { name: 'label', value: 'Weekend!' } })
  })
})

describe('General · submit (the rule of main)', () => {
  it('says Save and is disabled until something is staged or while it saves; Save calls handleUpdateClick', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Host promotion={record} />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Label' }), '!')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(spies.handleUpdateClick).toHaveBeenCalledTimes(1)
    expect(spies.handleAddPromotion).not.toHaveBeenCalled()
    unmount()

    render(<Host promotion={record} initialChanges={{ label: 'x' }} actionState={{ loading: true, error: null }} />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('says Add in add mode and calls handleAddPromotion', async () => {
    const user = userEvent.setup()
    render(<Host isAddMode initialChanges={{ enabled: true, name: 'Spring' }} />)
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(spies.handleAddPromotion).toHaveBeenCalledTimes(1)
    expect(spies.handleUpdateClick).not.toHaveBeenCalled()
  })
})

// (tanda Y review, findings 3 and 5): the advanced form, as Quick offers (693, 694)
describe('General · tanda Y: stored stamps and the date labels', () => {
  it('shows the stamps of a stored description as dates, and stages nothing until the person types', () => {
    render(<Host promotion={{ ...record, description: 'Customers get 15% off, from 2026-09-01T16:57 to 2026-09-30T23:59.' }} />)
    const field = screen.getByRole('textbox', { name: 'Description' })
    expect(field.value).not.toMatch(/\d{4}-\d{2}-\d{2}T/)
    expect(field.value).toBe('Customers get 15% off, from «2026-09-01 16:57» to «2026-09-30».')
    expect(spies.handleChangeInput).not.toHaveBeenCalled()
  })

  it('a description the person edited is shown as staged', () => {
    render(<Host promotion={{ ...record, description: 'from 2026-09-01T16:57' }} initialChanges={{ description: 'My words 2026-01-01T10:00' }} />)
    expect(screen.getByRole('textbox', { name: 'Description' }).value).toBe('My words 2026-01-01T10:00')
  })

  it('says «Start date» even when the live dictionary has «Start Date» for START_DATE', () => {
    mocks.dictionary = { START_DATE: 'Start Date' }
    render(<Host promotion={record} />)
    expect(screen.getByRole('combobox', { name: /Start date/ })).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('Start Date')
  })
})

describe('General · dates (PE-02, PE-18; decision 13)', () => {
  it('shows start and end in the project format, never ISO', () => {
    render(<Host promotion={record} />)
    const start = screen.getByRole('combobox', { name: /Start date/ })
    const end = screen.getByRole('combobox', { name: /End date/ })
    expect(start).toHaveTextContent('15/08/2026')
    expect(end).toHaveTextContent('20/08/2026')
    expect(document.body.textContent).not.toMatch(ISO)
  })

  it('with no project format it writes a readable default, never ISO', () => {
    mocks.configs = {}
    render(<Host promotion={record} />)
    expect(screen.getByRole('combobox', { name: /Start date/ })).toHaveTextContent('15 Aug 2026')
    expect(document.body.textContent).not.toMatch(ISO)
  })

  it('an offer with no end shows an empty end field, and no 1970 anywhere', () => {
    render(<Host promotion={{ ...record, end: null }} />)
    const end = screen.getByRole('combobox', { name: /End date/ })
    expect(end).toHaveAttribute('data-empty')
    expect(document.body.textContent).not.toMatch(/1970/)
  })

  it('a new offer has both fields empty', () => {
    render(<Host isAddMode initialChanges={{ enabled: true }} />)
    expect(screen.getByRole('combobox', { name: /Start date/ })).toHaveAttribute('data-empty')
    expect(screen.getByRole('combobox', { name: /End date/ })).toHaveAttribute('data-empty')
  })

  it('picking an end day stages ONLY the end, as that day at 23:59:59', async () => {
    const user = userEvent.setup()
    render(<Host promotion={{ ...record, end: '2026-08-20 23:59:59' }} />)
    await user.click(screen.getByRole('combobox', { name: /End date/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(dayButton(dialog, '2026-08-25'))
    expect(spies.handleChangeItem).toHaveBeenCalledTimes(1)
    expect(spies.handleChangeItem).toHaveBeenCalledWith({ end: '2026-08-25 23:59:59' })
    expect(screen.getByRole('combobox', { name: /End date/ })).toHaveTextContent('25/08/2026')
  })

  it('picking a start day stages ONLY the start, as that day at 00:00:00', async () => {
    const user = userEvent.setup()
    render(<Host promotion={record} />)
    await user.click(screen.getByRole('combobox', { name: /Start date/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(dayButton(dialog, '2026-08-10'))
    expect(spies.handleChangeItem).toHaveBeenCalledTimes(1)
    expect(spies.handleChangeItem).toHaveBeenCalledWith({ start: '2026-08-10 00:00:00' })
  })

  it('the end cannot be before the start and the start cannot be after the end', async () => {
    const user = userEvent.setup()
    render(<Host promotion={record} />)
    await user.click(screen.getByRole('combobox', { name: /End date/ }))
    const endDialog = await screen.findByRole('dialog')
    expect(dayButton(endDialog, '2026-08-14')).toHaveAttribute('aria-disabled', 'true')
    expect(dayButton(endDialog, '2026-08-16')).not.toHaveAttribute('aria-disabled', 'true')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    await user.click(screen.getByRole('combobox', { name: /Start date/ }))
    const startDialog = await screen.findByRole('dialog')
    expect(dayButton(startDialog, '2026-08-21')).toHaveAttribute('aria-disabled', 'true')
    expect(dayButton(startDialog, '2026-08-19')).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('the end can be emptied: it stages end: null and shows the empty field', async () => {
    const user = userEvent.setup()
    render(<Host promotion={record} />)
    await user.click(screen.getByRole('combobox', { name: /End date/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Clear' }))
    expect(spies.handleChangeItem).toHaveBeenCalledWith({ end: null })
    expect(screen.getByRole('combobox', { name: /End date/ })).toHaveAttribute('data-empty')
  })

  it('the start has no «Clear»: an offer always has a start', async () => {
    const user = userEvent.setup()
    render(<Host promotion={record} />)
    await user.click(screen.getByRole('combobox', { name: /Start date/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByRole('button', { name: 'Clear' })).toBeNull()
  })
})

describe('General · order priority and stackable (D33, D37)', () => {
  it('is a named radiogroup of four options and stages the NUMBER', async () => {
    const user = userEvent.setup()
    render(<Host promotion={record} />)
    const group = screen.getByRole('radiogroup', { name: 'Order priority' })
    expect(within(group).getAllByRole('radio').map(radio => radio.textContent)).toEqual(['Urgent', 'High', 'Normal', 'Low'])
    expect(within(group).getByRole('radio', { name: 'Normal' })).toHaveAttribute('aria-checked', 'true')

    await user.click(within(group).getByRole('radio', { name: 'Urgent' }))
    expect(spies.handleChangeItem).toHaveBeenLastCalledWith({ order_priority: 2 })
    expect(typeof spies.handleChangeItem.mock.calls.at(-1)[0].order_priority).toBe('number')
    await user.click(within(group).getByRole('radio', { name: 'Low' }))
    expect(spies.handleChangeItem).toHaveBeenLastCalledWith({ order_priority: -1 })
    expect(within(group).getByRole('radio', { name: 'Low' })).toHaveAttribute('aria-checked', 'true')
  })

  it('an offer with no priority has none chosen', () => {
    render(<Host promotion={{ ...record, order_priority: undefined }} />)
    const group = screen.getByRole('radiogroup', { name: 'Order priority' })
    within(group).getAllByRole('radio').forEach(radio => expect(radio).toHaveAttribute('aria-checked', 'false'))
  })

  it('«Allow to combine offer» is a switch named by its own visible text; it stages {stackable}', async () => {
    const user = userEvent.setup()
    render(<Host promotion={record} />)
    const stackable = screen.getByRole('switch', { name: 'Allow to combine offer (discount/coupon) with others?' })
    expect(stackable).toHaveAttribute('aria-checked', 'false')
    await user.click(stackable)
    expect(spies.handleChangeItem).toHaveBeenLastCalledWith({ stackable: true })
    expect(stackable).toHaveAttribute('aria-checked', 'true')
  })
})

describe('General · image (D41; inventory F1)', () => {
  const fileInput = (container) => container.querySelector('input[type="file"]')
  const upload = (container, file) => fireEvent.change(fileInput(container), { target: { files: [file] } })

  it('the image area is a named button; the preview is decorative', () => {
    const { container } = render(<Host promotion={{ ...record, image: 'https://img.test/a.png' }} />)
    const area = screen.getByRole('button', { name: /Image/ })
    expect(area).toHaveAccessibleName(/Drag and drop/)
    const preview = container.querySelector('img')
    expect(preview).toHaveAttribute('alt', '')
    expect(preview).toHaveAttribute('src', 'https://img.test/a.png')
    expect(container.querySelector('img[alt="user image"]')).toBeNull()
  })

  it('a file that is not an image is refused with the same message, in a Product alert', async () => {
    const { container } = render(<Host promotion={record} />)
    upload(container, new File(['x'], 'notes.pdf', { type: 'application/pdf' }))
    const alert = await screen.findByRole('alertdialog')
    expect(alert).toHaveTextContent('Only images can be accepted')
    expect(spies.handleChangeImage).not.toHaveBeenCalled()
  })

  it('an image over 2 MB is refused with the same message', async () => {
    const { container } = render(<Host promotion={record} />)
    const big = new File(['x'], 'big.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 3 * 1024 * 1024 })
    upload(container, big)
    const alert = await screen.findByRole('alertdialog')
    expect(alert).toHaveTextContent('The maximum image size is 2 megabytes')
    expect(spies.handleChangeImage).not.toHaveBeenCalled()
  })

  it('a valid image goes to handleChangeImage first, then opens the crop', async () => {
    const { container } = render(<Host promotion={record} />)
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    upload(container, file)
    expect(spies.handleChangeImage).toHaveBeenCalledWith(file)
    const dialog = await screen.findByRole('dialog', { name: 'Image crop' })
    await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Crop' }))
    expect(spies.handleChangeItem).toHaveBeenLastCalledWith({ image: 'data:image/png;base64,CROPPED' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Image crop' })).toBeNull())
  })

  it('dropping an image does the same as picking it', async () => {
    const { container } = render(<Host promotion={record} />)
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const zone = container.querySelector('.odc-promo-drop')
    fireEvent.drop(zone, { dataTransfer: { files: [file] } })
    expect(spies.handleChangeImage).toHaveBeenCalledWith(file)
    expect(await screen.findByRole('dialog', { name: 'Image crop' })).toBeInTheDocument()
  })
})
