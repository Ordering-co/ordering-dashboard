/* eslint-disable import/first */
// redesign W0-7 (T0-28b): ImageField is the Product frame around the legacy ImageCrop. The piece is simulated here
// (cropperjs needs a canvas): the stand-in records the props it receives and, on «Crop», calls
// `handleChangePhoto(photo)` and then `onClose()`, the way the real one does. What the tests pin is that the wrapper
// hands it exactly the props the legacy consumers hand it, forwards what it emits untouched, and frames it.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

const seen = vi.hoisted(() => ({ props: [] }))

vi.mock('../../UI/ImageCrop', () => ({
  ImageCrop: props => {
    seen.props.push(props)
    return (
      <div data-testid='image-crop' data-photo={props.photo}>
        <button
          type='button'
          onClick={() => {
            props.handleChangePhoto('https://cdn.example.test/cropped.png')
            props.onClose && props.onClose()
          }}
        >
          Crop
        </button>
      </div>
    )
  }
}))

import { ImageField } from '../ImageField'

const CSS = readFileSync(path.resolve(__dirname, '../legacy-fields.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

const NAMES = {
  label: 'Logo',
  changeLabel: 'Change logo of Burger Hub',
  changeText: 'Change',
  removeLabel: 'Remove logo of Burger Hub',
  removeText: 'Remove',
  cropTitle: 'Image crop',
  closeLabel: 'Close'
}

const renderField = (props = {}) => render(<ImageField {...NAMES} {...props} />)
const png = () => new File(['pixels'], 'logo.png', { type: 'image/png' })
const fileInput = container => container.querySelector('input[type="file"]')

afterEach(() => {
  seen.props.length = 0
  document.getElementById('app-modals')?.remove()
})

describe('ImageField · name and frame', () => {
  it.each(['label', 'changeLabel', 'cropTitle', 'closeLabel'])('throws without a %s', (name) => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const props = { ...NAMES }
    delete props[name]
    expect(() => render(<ImageField {...props} />)).toThrow(`ImageField needs a ${name}`)
    expect(() => render(<ImageField {...props} {...{ [name]: null }} />)).toThrow(`ImageField needs a ${name}`)
    spy.mockRestore()
  })

  it('throws without a removeLabel when there is an onRemove, and without a requiredLabel when required', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { removeLabel, ...rest } = NAMES
    expect(() => render(<ImageField {...rest} onRemove={() => {}} />)).toThrow('ImageField needs a removeLabel')
    expect(() => render(<ImageField {...NAMES} required />)).toThrow('ImageField needs a requiredLabel')
    spy.mockRestore()
  })

  it('paints empty names instead of throwing', () => {
    const { container } = renderField({ label: '', changeLabel: '', changeText: '' })
    expect(container.querySelector('.odc-legacy-field-label-text')).toHaveTextContent('')
  })

  it('names the group with the visible label and shows the preview of the value', () => {
    renderField({ value: 'https://cdn.example.test/logo.png', previewAlt: 'Current logo' })
    expect(screen.getByRole('group', { name: 'Logo' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Current logo' })).toHaveAttribute('src', 'https://cdn.example.test/logo.png')
  })

  it('shows an empty placeholder with no image role when there is no value', () => {
    const { container } = renderField()
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('.odc-image-field-empty')).toHaveAttribute('aria-hidden', 'true')
  })

  it('names Change and Remove with the object while showing the short words', () => {
    renderField({ value: 'https://cdn.example.test/logo.png', onRemove: () => {} })
    const change = screen.getByRole('button', { name: 'Change logo of Burger Hub' })
    expect(change).toHaveTextContent('Change')
    const remove = screen.getByRole('button', { name: 'Remove logo of Burger Hub' })
    expect(remove).toHaveTextContent('Remove')
  })

  it('shows the label as the visible text when no short word is given', () => {
    const { changeText, removeText, ...names } = NAMES
    render(<ImageField {...names} value='x.png' onRemove={() => {}} />)
    expect(screen.getByRole('button', { name: 'Change logo of Burger Hub' })).toHaveTextContent('Change logo of Burger Hub')
  })

  it('offers Remove only with a value and an onRemove, and calls it with no arguments', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    const { rerender } = renderField({ onRemove })
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull()
    rerender(<ImageField {...NAMES} value='x.png' />)
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull()
    rerender(<ImageField {...NAMES} value='x.png' onRemove={onRemove} />)
    await user.click(screen.getByRole('button', { name: 'Remove logo of Burger Hub' }))
    expect(onRemove).toHaveBeenCalledOnce()
    expect(onRemove).toHaveBeenCalledWith()
  })

  it('links the hint to the group and to the Change button', () => {
    renderField({ hint: 'PNG or JPG, up to 2 MB' })
    const hint = screen.getByText('PNG or JPG, up to 2 MB')
    expect(screen.getByRole('group')).toHaveAttribute('aria-describedby', hint.id)
    expect(screen.getByRole('button', { name: 'Change logo of Burger Hub' })).toHaveAttribute('aria-describedby', hint.id)
  })

  it('shows an error as an alert, linked and marked invalid in data-*', () => {
    const { container } = renderField({ hint: 'Hint text', error: 'The image is required' })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('The image is required')
    expect(screen.getByRole('group').getAttribute('aria-describedby').split(' ')).toContain(alert.id)
    expect(screen.getByRole('button', { name: 'Change logo of Burger Hub' }).getAttribute('aria-describedby').split(' ')).toContain(alert.id)
    expect(container.querySelector('.odc-image-field')).toHaveAttribute('data-invalid')
  })

  it('has no alert and no data-invalid without an error', () => {
    const { container } = renderField({ error: '' })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(container.querySelector('[data-invalid]')).toBeNull()
  })

  it('marks required with text the group name carries', () => {
    const { container } = renderField({ required: true, requiredLabel: 'Required' })
    expect(screen.getByRole('group', { name: /Logo\s+Required/ })).toBeInTheDocument()
    expect(container.querySelector('.odc-image-field')).toHaveAttribute('data-required')
  })

  it('disables Change, Remove and the file input, and marks the root', () => {
    const { container } = renderField({ disabled: true, value: 'x.png', onRemove: () => {} })
    expect(container.querySelector('.odc-image-field')).toHaveAttribute('data-disabled')
    expect(screen.getByRole('button', { name: 'Change logo of Burger Hub' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove logo of Burger Hub' })).toBeDisabled()
    expect(fileInput(container)).toBeDisabled()
  })
})

describe('ImageField · parity with the legacy ImageCrop', () => {
  it('opens the crop in a named dialog with the data URL of the picked file and the same props the consumers pass', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { container } = renderField({ onChange, aspectRatio: 16 / 9, showAspectRatioBox: true, useCloudinaryUrl: true, themeId: 7 })
    await user.upload(fileInput(container), png())

    const dialog = await screen.findByRole('dialog', { name: 'Image crop' })
    expect(dialog).toContainElement(screen.getByTestId('image-crop'))
    const received = seen.props.at(-1)
    expect(received.photo).toMatch(/^data:image\/png;base64,/)
    expect(received.handleChangePhoto).toBe(onChange)
    expect(received.aspectRatio).toBe(16 / 9)
    expect(received.showAspectRatioBox).toBe(true)
    expect(received.useCloudinaryUrl).toBe(true)
    expect(received.themeId).toBe(7)
    expect(typeof received.onClose).toBe('function')
    expect(Object.keys(received).sort()).toEqual(['aspectRatio', 'handleChangePhoto', 'onClose', 'photo', 'showAspectRatioBox', 'themeId', 'useCloudinaryUrl'])
  })

  it('forwards the cropped photo untouched, closes the dialog and returns the focus to Change', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { container } = renderField({ onChange })
    // As in a browser: the focus is on Change when the chooser opens and stays there while the file is read.
    await user.click(screen.getByRole('button', { name: 'Change logo of Burger Hub' }))
    fireEvent.change(fileInput(container), { target: { files: [png()] } })
    await screen.findByRole('dialog', { name: 'Image crop' })

    await user.click(screen.getByRole('button', { name: 'Crop' }))
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith('https://cdn.example.test/cropped.png')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Change logo of Burger Hub' })).toHaveFocus())
  })

  it('leaves the value alone: the preview shows what the parent passes back, not what was cropped', async () => {
    const user = userEvent.setup()
    const { container } = renderField({ value: 'https://cdn.example.test/old.png', onChange: vi.fn() })
    await user.upload(fileInput(container), png())
    await screen.findByRole('dialog', { name: 'Image crop' })
    await user.click(screen.getByRole('button', { name: 'Crop' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(container.querySelector('.odc-image-field-img')).toHaveAttribute('src', 'https://cdn.example.test/old.png')
  })

  it('closes from its close button without calling onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { container } = renderField({ onChange })
    await user.upload(fileInput(container), png())
    await screen.findByRole('dialog', { name: 'Image crop' })
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(onChange).not.toHaveBeenCalled()
  })

  it('stops before the crop when validateFile returns false, and passes it the file', async () => {
    const user = userEvent.setup()
    const validateFile = vi.fn(() => false)
    const { container } = renderField({ validateFile })
    const file = png()
    await user.upload(fileInput(container), file)
    expect(validateFile).toHaveBeenCalledWith(file)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(seen.props).toHaveLength(0)
  })

  it('opens the file chooser from Change', async () => {
    const user = userEvent.setup()
    const { container } = renderField()
    const click = vi.spyOn(fileInput(container), 'click').mockImplementation(() => {})
    await user.click(screen.getByRole('button', { name: 'Change logo of Burger Hub' }))
    expect(click).toHaveBeenCalledOnce()
  })

  it('accepts the same image types the legacy screens accept, and a consumer can narrow them', () => {
    const { container, rerender } = renderField()
    expect(fileInput(container)).toHaveAttribute('accept', 'image/png, image/jpeg, image/jpg')
    rerender(<ImageField {...NAMES} accept='image/png' />)
    expect(fileInput(container)).toHaveAttribute('accept', 'image/png')
  })
})

describe('ImageField · keyboard and frame styles', () => {
  it('reaches Change and Remove with Tab, in that order', async () => {
    const user = userEvent.setup()
    renderField({ value: 'x.png', onRemove: () => {} })
    await user.tab()
    expect(screen.getByRole('button', { name: 'Change logo of Burger Hub' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Remove logo of Burger Hub' })).toHaveFocus()
  })

  it('keeps the file input out of the tab order and the accessibility tree', () => {
    const { container } = renderField()
    const input = fileInput(container)
    expect(input).toHaveAttribute('tabindex', '-1')
    expect(input).toHaveAttribute('aria-hidden', 'true')
    expect(input).toHaveAttribute('hidden')
  })

  it('sizes the preview from tokens and fits the image without cropping it', () => {
    const preview = CSS.slice(CSS.indexOf('.odc-image-field-preview {'))
    expect(preview).toContain('inline-size: calc(var(--od-x-control-height) * 4)')
    expect(CSS).toMatch(/\.odc-image-field-img \{[^}]*object-fit: contain/)
  })
})

// AB-S03/AB-S01: the preview followed a fixed 4:3 box whatever `aspectRatio` the consumer asked the crop for (a 1440:300 banner
// showed as a 4:3 frame). With a usable `aspectRatio` the preview box takes that proportion; without one it is exactly the old box.
describe('ImageField · the preview follows aspectRatio', () => {
  const previewOf = container => container.querySelector('.odc-image-field-preview')

  it('draws the preview in the proportion asked for', () => {
    const { container } = renderField({ aspectRatio: 1440 / 300 })
    const preview = previewOf(container)
    expect(preview).toHaveAttribute('data-ratio', '')
    expect(preview.style.getPropertyValue('--odc-image-ratio')).toBe('4.8')
  })

  it('a square ratio is a square box', () => {
    const { container } = renderField({ aspectRatio: 1 })
    expect(previewOf(container).style.getPropertyValue('--odc-image-ratio')).toBe('1')
  })

  it.each([undefined, null, 0, -1, NaN, Infinity, 'wide', ''])('keeps the 4:3 box with aspectRatio %s', (aspectRatio) => {
    const { container } = renderField({ aspectRatio })
    const preview = previewOf(container)
    expect(preview).not.toHaveAttribute('data-ratio')
    expect(preview.style.getPropertyValue('--odc-image-ratio')).toBe('')
  })

  it('the CSS turns the ratio into the box without leaving the row nor growing past the old height', () => {
    const rule = CSS.slice(CSS.indexOf('.odc-image-field-preview[data-ratio] {'))
    const body = rule.slice(rule.indexOf('{') + 1, rule.indexOf('}'))
    expect(body).toContain('aspect-ratio: var(--odc-image-ratio)')
    expect(body).toMatch(/block-size:\s*auto/)
    expect(body).toMatch(/inline-size:\s*min\(\s*100%,/)
    expect(body).toContain('var(--odc-image-ratio)')
  })
})

// redesign stores 5.1a (G2-26): OPT-IN drop. With `droppable` a file dropped on the preview goes through the same flow
// as a picked one (validateFile, then the crop); several files are refused with `tooManyFilesText` as the field's error. Without
// `droppable` the field ignores drops, as before.
describe('ImageField · droppable (opt-in)', () => {
  const drop = (target, files) => {
    fireEvent.dragOver(target, { dataTransfer: { files, types: ['Files'] } })
    fireEvent.drop(target, { dataTransfer: { files, types: ['Files'] } })
  }

  it('throws without tooManyFilesText when droppable', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderField({ droppable: true })).toThrow('ImageField needs a tooManyFilesText')
    spy.mockRestore()
  })

  it('a dropped file is validated and opens the crop; the cropped result reaches onChange', async () => {
    const onChange = vi.fn()
    const validateFile = vi.fn(() => true)
    const { container } = renderField({ droppable: true, tooManyFilesText: 'Drop one image at a time', onChange, validateFile })
    drop(container.querySelector('.odc-image-field-preview'), [png()])
    expect(validateFile).toHaveBeenCalledTimes(1)
    await screen.findByTestId('image-crop')
    await userEvent.click(screen.getByRole('button', { name: 'Crop' }))
    expect(onChange).toHaveBeenCalledWith('https://cdn.example.test/cropped.png')
  })

  it('several dropped files are refused with the message as the field error, and nothing is cropped', () => {
    const onChange = vi.fn()
    const validateFile = vi.fn(() => true)
    const { container } = renderField({ droppable: true, tooManyFilesText: 'Drop one image at a time', onChange, validateFile })
    drop(container.querySelector('.odc-image-field-preview'), [png(), png()])
    expect(screen.getByRole('alert')).toHaveTextContent('Drop one image at a time')
    expect(validateFile).not.toHaveBeenCalled()
    expect(screen.queryByTestId('image-crop')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('the next pick clears the several-files message', async () => {
    const { container } = renderField({ droppable: true, tooManyFilesText: 'Drop one image at a time', onChange: vi.fn() })
    drop(container.querySelector('.odc-image-field-preview'), [png(), png()])
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.change(fileInput(container), { target: { files: [png()] } })
    await waitFor(() => expect(screen.queryByText('Drop one image at a time')).toBeNull())
  })

  it('a disabled field ignores drops', () => {
    const validateFile = vi.fn(() => true)
    const { container } = renderField({ droppable: true, tooManyFilesText: 'Drop one image at a time', disabled: true, validateFile })
    drop(container.querySelector('.odc-image-field-preview'), [png()])
    expect(validateFile).not.toHaveBeenCalled()
  })

  it('without droppable a drop does nothing', () => {
    const validateFile = vi.fn(() => true)
    const { container } = renderField({ validateFile })
    drop(container.querySelector('.odc-image-field-preview'), [png()])
    expect(validateFile).not.toHaveBeenCalled()
  })
})

describe('ImageField · droppable, review r1 (F2, F5)', () => {
  const drop = (target, files) => {
    fireEvent.dragOver(target, { dataTransfer: { files, types: ['Files'] } })
    fireEvent.drop(target, { dataTransfer: { files, types: ['Files'] } })
  }

  it('a drop on the Change button or the label is taken by the field, not left to the browser', () => {
    const validateFile = vi.fn(() => true)
    renderField({ droppable: true, tooManyFilesText: 'Drop one image at a time', validateFile })
    const button = screen.getByRole('button', { name: NAMES.changeLabel })
    const over = fireEvent.dragOver(button, { dataTransfer: { files: [png()], types: ['Files'] } })
    expect(over).toBe(false) // default prevented: the browser does not open the file
    drop(screen.getByText('Logo'), [png()])
    expect(validateFile).toHaveBeenCalledTimes(1)
  })

  it('a drop puts the focus on Change, so closing the crop gives it back there', async () => {
    const { container } = renderField({ droppable: true, tooManyFilesText: 'Drop one image at a time', onChange: vi.fn() })
    drop(container.querySelector('.odc-image-field-preview'), [png()])
    expect(screen.getByRole('button', { name: NAMES.changeLabel })).toHaveFocus()
  })
})

// redesign stores 5.14 (S-11): OPT-IN `crop={false}`. A picked or dropped file goes through `validateFile` and is handed
// straight to `onChange` as a data URL, with no Dialog and no ImageCrop; the crop names (`cropTitle`, `closeLabel`) are not needed.
// Without the prop (or with `crop`) the field is exactly as before.
describe('ImageField · crop={false} (opt-in)', () => {
  const { cropTitle, closeLabel, ...NO_CROP_NAMES } = NAMES
  const renderPlain = (props = {}) => render(<ImageField {...NO_CROP_NAMES} crop={false} {...props} />)
  const drop = (target, files) => {
    fireEvent.dragOver(target, { dataTransfer: { files, types: ['Files'] } })
    fireEvent.drop(target, { dataTransfer: { files, types: ['Files'] } })
  }

  it('hands a picked file to onChange as a data URL, without opening the crop', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { container } = renderPlain({ onChange })
    await user.upload(fileInput(container), png())
    await waitFor(() => expect(onChange).toHaveBeenCalledOnce())
    expect(onChange.mock.calls[0][0]).toMatch(/^data:image\/png;base64,/)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(seen.props).toHaveLength(0)
  })

  it('validates the file first, and a refused file reaches nothing', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const validateFile = vi.fn(() => false)
    const { container } = renderPlain({ onChange, validateFile })
    const file = png()
    await user.upload(fileInput(container), file)
    expect(validateFile).toHaveBeenCalledWith(file)
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('a dropped file takes the same short way', async () => {
    const onChange = vi.fn()
    const { container } = renderPlain({ droppable: true, tooManyFilesText: 'Drop one image at a time', onChange })
    drop(container.querySelector('.odc-image-field-preview'), [png()])
    await waitFor(() => expect(onChange).toHaveBeenCalledOnce())
    expect(onChange.mock.calls[0][0]).toMatch(/^data:image\/png;base64,/)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('needs no cropTitle nor closeLabel, but still needs the names it draws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderPlain()).not.toThrow()
    const { changeLabel, ...rest } = NO_CROP_NAMES
    expect(() => render(<ImageField {...rest} crop={false} />)).toThrow('ImageField needs a changeLabel')
    spy.mockRestore()
  })

  it('crop={true} and no prop keep opening the crop (and still need its names)', async () => {
    const user = userEvent.setup()
    const { container } = renderField({ crop: true, onChange: vi.fn() })
    await user.upload(fileInput(container), png())
    await screen.findByRole('dialog', { name: 'Image crop' })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ImageField {...NO_CROP_NAMES} crop />)).toThrow('ImageField needs a cropTitle')
    spy.mockRestore()
  })
})

// redesign bugs F row 35: a stored value that does not load must not leave the browser's broken-image icon
describe('ImageField · a value that fails to load', () => {
  it('shows the empty placeholder, keeps Change and Remove, and brings the image back with a new value', () => {
    const onRemove = vi.fn()
    const { container, rerender } = renderField({ value: 'x.png', onRemove })
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    fireEvent.error(img)
    expect(container.querySelector('img')).toBeNull()
    const placeholder = container.querySelector('.odc-image-field-empty')
    expect(placeholder).not.toBeNull()
    expect(placeholder).toHaveAttribute('data-broken')
    expect(screen.getByRole('button', { name: 'Change logo of Burger Hub' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove logo of Burger Hub' })).toBeInTheDocument()
    expect(container.querySelector('[data-has-image]')).not.toBeNull()
    rerender(<ImageField {...NAMES} value='y.png' onRemove={onRemove} />)
    expect(container.querySelector('img')).toHaveAttribute('src', 'y.png')
    expect(container.querySelector('.odc-image-field-empty')).toBeNull()
  })

  it('a working image has no broken mark', () => {
    const { container } = renderField({ value: 'x.png' })
    expect(container.querySelector('[data-broken]')).toBeNull()
  })
})
