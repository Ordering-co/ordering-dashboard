/* eslint-disable import/first */
// redesign (lot C, decision 6, OP-06, OP-10): one image of the site (Header, Logo, Social share). A real button with a name
// that carries the label opens the file chooser; a file can also be dropped. The checks are the ones of `main` (one file, an image,
// 2 MB at most) and the reason is said under the zone, not in an Alert. No crop.
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

import { SiteImageField } from '../SiteImageField'

const png = () => new File(['png'], 'logo.png', { type: 'image/png' })
const pdf = () => new File(['pdf'], 'terms.pdf', { type: 'application/pdf' })
const bigPng = () => {
  const file = new File(['png'], 'big.png', { type: 'image/png' })
  Object.defineProperty(file, 'size', { value: 3 * 1024 * 1024 })
  return file
}

const setup = (props = {}) => {
  const onFile = vi.fn()
  const view = render(<SiteImageField label='Header' hint='A new logo also replaces it.' value='' onFile={onFile} {...props} />)
  const input = view.container.querySelector('input[type="file"]')
  const zone = view.container.querySelector('.odc-op-image-zone')
  return { ...view, onFile, input, zone }
}

afterEach(cleanup)

describe('SiteImageField', () => {
  it('has a real button named «Choose image» plus the label, and the hint is visible', () => {
    setup()

    const button = screen.getByRole('button', { name: 'Choose image Header' })
    expect(button.tagName).toBe('BUTTON')
    expect(button).toHaveAttribute('type', 'button')
    expect(screen.getByText('A new logo also replaces it.')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Header' })).toBeInTheDocument()
  })

  it('the button opens the file chooser, which accepts PNG and JPG and stays out of the tab order', async () => {
    const user = userEvent.setup()
    const { input } = setup()
    const click = vi.spyOn(input, 'click')

    await user.click(screen.getByRole('button', { name: 'Choose image Header' }))

    expect(click).toHaveBeenCalledTimes(1)
    expect(input).toHaveAttribute('accept', 'image/png, image/jpeg, image/jpg')
    expect(input).toHaveAttribute('hidden')
  })

  it('the preview is decorative (the name is on the button) and shows the value', () => {
    const { container } = setup({ value: 'https://cdn.example.test/header.png' })

    const image = container.querySelector('img')
    expect(image).toHaveAttribute('src', 'https://cdn.example.test/header.png')
    expect(image).toHaveAttribute('alt', '')
  })

  it('accepts a PNG: hands it to onFile and says nothing', () => {
    const { input, onFile } = setup()
    const file = png()

    fireEvent.change(input, { target: { files: [file] } })

    expect(onFile).toHaveBeenCalledWith(file)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('rejects a PDF with the reason under the zone, and does not call onFile', () => {
    const { input, onFile } = setup()

    fireEvent.change(input, { target: { files: [pdf()] } })

    expect(onFile).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Only images can be accepted')
  })

  it('rejects an image over 2 MB with the reason under the zone', () => {
    const { input, onFile } = setup()

    fireEvent.change(input, { target: { files: [bigPng()] } })

    expect(onFile).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('The maximum image size is 2 megabytes')
  })

  it('an image of exactly 2 MB is fine, as in main', () => {
    const { input, onFile } = setup()
    const file = new File(['png'], 'edge.png', { type: 'image/png' })
    Object.defineProperty(file, 'size', { value: 2048 * 1024 })

    fireEvent.change(input, { target: { files: [file] } })

    expect(onFile).toHaveBeenCalledWith(file)
  })

  it('a good file after a bad one clears the reason', () => {
    const { input, onFile } = setup()

    fireEvent.change(input, { target: { files: [pdf()] } })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.change(input, { target: { files: [png()] } })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onFile).toHaveBeenCalledTimes(1)
  })

  it('accepts a dropped file and marks the zone while a file is over it', () => {
    const { zone, onFile } = setup()
    const file = png()

    fireEvent.dragOver(zone, { dataTransfer: { files: [file] } })
    expect(zone).toHaveAttribute('data-dragging')
    fireEvent.drop(zone, { dataTransfer: { files: [file] } })

    expect(zone).not.toHaveAttribute('data-dragging')
    expect(onFile).toHaveBeenCalledWith(file)
  })

  it('rejects a dropped PDF with the same reason', () => {
    const { zone, onFile } = setup()

    fireEvent.drop(zone, { dataTransfer: { files: [pdf()] } })

    expect(onFile).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Only images can be accepted')
  })

  it('takes one file at a time: several dropped files do nothing, as in main', () => {
    const { zone, onFile } = setup()

    fireEvent.drop(zone, { dataTransfer: { files: [png(), png()] } })

    expect(onFile).not.toHaveBeenCalled()
  })

  it('disabled: the button is off and a drop is ignored', () => {
    const { zone, onFile } = setup({ disabled: true })

    expect(screen.getByRole('button', { name: 'Choose image Header' })).toBeDisabled()
    fireEvent.dragOver(zone, { dataTransfer: { files: [png()] } })
    expect(zone).not.toHaveAttribute('data-dragging')
    fireEvent.drop(zone, { dataTransfer: { files: [png()] } })
    expect(onFile).not.toHaveBeenCalled()
  })

  it('the aspect is a data attribute: wide for the header, square by default', () => {
    const wide = setup({ aspect: 'wide' })
    expect(wide.container.firstChild).toHaveAttribute('data-aspect', 'wide')
    cleanup()
    const square = setup({ label: 'Logo' })
    expect(square.container.firstChild).toHaveAttribute('data-aspect', 'square')
  })
})
