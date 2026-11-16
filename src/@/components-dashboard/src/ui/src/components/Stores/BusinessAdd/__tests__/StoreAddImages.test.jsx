/* eslint-disable import/first */
// redesign stores · (add a store, group «Images»): the logo, the homepage background and the photo gallery on Product. Covered:
// the logo and the background crop and go to `changeFields` (same keys as main: logo, header); removing one sends `undefined`, which main's
// request never carries; several photos are read at once and the rejected ones (type, size) are named in ONE notice while the valid ones
// still join the gallery; each thumbnail has an alt and each Remove a name; photos that come from Google (an https URL) are drawn too.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))
vi.mock('~components', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))
// the cropper has its own tests: this stand-in hands back a fixed crop
vi.mock('../../../Shared/UI/ImageCrop', () => ({
  ImageCrop: (props) => (
    <button type='button' onClick={() => { props.handleChangePhoto('data:image/png;base64,CROPPED'); props.onClose && props.onClose() }}>
      Crop
    </button>
  )
}))

import { StoreAddImages } from '../StoreAddImages'

const file = (name, { size = 1000, type = 'image/png' } = {}) => new File([new Uint8Array(size)], name, { type })

class ReaderStub {
  readAsDataURL (target) {
    this.result = `data:${target.type};base64,${target.name}`
    setTimeout(() => this.onload && this.onload())
  }
}

beforeEach(() => {
  vi.stubGlobal('FileReader', ReaderStub)
  window.FileReader = ReaderStub
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const setup = (props = {}) => {
  const changeFields = vi.fn()
  const onGalleryChange = vi.fn()
  const utils = render(
    <StoreAddImages
      form={{}}
      changeFields={changeFields}
      gallery={[]}
      onGalleryChange={onGalleryChange}
      {...props}
    />
  )
  return { changeFields, onGalleryChange, ...utils }
}

const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })

const pickPhotos = async (files) => {
  await act(async () => {
    fireEvent.change(screen.getByTestId('store-add-photos-input'), { target: { files } })
  })
  await settle()
}

const fieldInput = (name) => screen.getByRole('group', { name }).querySelector('input[type="file"]')

describe('Add a store › Images', () => {
  it('is a section named Images, marked optional', () => {
    setup()
    const section = screen.getByRole('region', { name: /Images/ })
    expect(within(section).getByRole('heading', { level: 2, name: 'Images Optional' })).toBeTruthy()
    expect(within(section).getByText('Optional')).toBeTruthy()
    expect(section.className).toContain('odc-sadd-group')
  })

  it('crops the logo and hands it to changeFields as `logo`', async () => {
    const user = userEvent.setup()
    const { changeFields } = setup()
    expect(screen.getByText('512 × 512 px · PNG, JPG')).toBeTruthy()
    await act(async () => {
      fireEvent.change(fieldInput('Business logo'), { target: { files: [file('logo.png')] } })
    })
    await settle()
    await user.click(screen.getByRole('button', { name: 'Crop' }))
    expect(changeFields).toHaveBeenCalledWith({ logo: 'data:image/png;base64,CROPPED' })
  })

  it('crops the homepage background and hands it to changeFields as `header`', async () => {
    const user = userEvent.setup()
    const { changeFields } = setup()
    expect(screen.getByText('1350 × 400 px · PNG, JPG')).toBeTruthy()
    await act(async () => {
      fireEvent.change(fieldInput('Homepage background'), { target: { files: [file('bg.png')] } })
    })
    await settle()
    await user.click(screen.getByRole('button', { name: 'Crop' }))
    expect(changeFields).toHaveBeenCalledWith({ header: 'data:image/png;base64,CROPPED' })
  })

  it('refuses a logo that is not an image or is over 2 MB, before the crop', async () => {
    setup()
    await act(async () => {
      fireEvent.change(fieldInput('Business logo'), { target: { files: [file('a.pdf', { type: 'application/pdf' })] } })
    })
    await settle()
    expect(screen.queryByRole('button', { name: 'Crop' })).toBeNull()
    expect(screen.getByText('Only images can be accepted')).toBeTruthy()
    await act(async () => {
      fireEvent.change(fieldInput('Business logo'), { target: { files: [file('big.png', { size: 3 * 1024 * 1024 })] } })
    })
    await settle()
    expect(screen.queryByRole('button', { name: 'Crop' })).toBeNull()
    expect(screen.getByText('The maximum image size is 2 megabytes')).toBeTruthy()
  })

  it('removes a logo and a background with `undefined`, as if none had been picked', async () => {
    const user = userEvent.setup()
    const { changeFields } = setup({ form: { logo: 'data:image/png;base64,L', header: 'data:image/png;base64,H' } })
    await user.click(screen.getByRole('button', { name: 'Remove logo' }))
    await user.click(screen.getByRole('button', { name: 'Remove homepage background' }))
    expect(changeFields).toHaveBeenNthCalledWith(1, { logo: undefined })
    expect(changeFields).toHaveBeenNthCalledWith(2, { header: undefined })
    expect(Object.keys(changeFields.mock.calls[0][0])).toEqual(['logo'])
    expect(Object.keys(changeFields.mock.calls[1][0])).toEqual(['header'])
  })

  it('offers Remove only when there is an image', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Remove logo' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove homepage background' })).toBeNull()
  })

  it('has a real «Add photos» button that opens a multiple image picker', async () => {
    const user = userEvent.setup()
    setup()
    const button = screen.getByRole('button', { name: 'Add photos' })
    expect(button.tagName).toBe('BUTTON')
    const input = screen.getByTestId('store-add-photos-input')
    expect(input.multiple).toBe(true)
    expect(input.getAttribute('accept')).toBe('image/png, image/jpeg, image/jpg')
    const click = vi.spyOn(input, 'click')
    await user.click(button)
    expect(click).toHaveBeenCalled()
  })

  it('adds two valid photos and names the one over 2 MB in a single notice', async () => {
    const { onGalleryChange } = setup()
    await pickPhotos([file('one.png'), file('huge.png', { size: 3 * 1024 * 1024 }), file('two.jpg', { type: 'image/jpeg' })])
    expect(onGalleryChange).toHaveBeenCalledTimes(1)
    const next = onGalleryChange.mock.calls[0][0]
    expect(next.map(item => item.file)).toEqual(['data:image/png;base64,one.png', 'data:image/jpeg;base64,two.jpg'])
    expect(new Set(next.map(item => item.temp_id)).size).toBe(2)
    next.forEach(item => expect(item.temp_id).toBeTruthy())
    const notice = screen.getByText('1 image could not be added:').closest('[role="status"]')
    expect(within(notice).getAllByRole('listitem').map(li => li.textContent)).toEqual([
      'huge.png: The maximum image size is 2 megabytes'
    ])
  })

  it('names every rejected file and why, with a type that is not an image too', async () => {
    const { onGalleryChange } = setup()
    await pickPhotos([file('notes.txt', { type: 'text/plain' }), file('huge.png', { size: 3 * 1024 * 1024 })])
    expect(onGalleryChange).not.toHaveBeenCalled()
    const notice = screen.getByText('2 images could not be added:').closest('[role="status"]')
    expect(within(notice).getAllByRole('listitem').map(li => li.textContent)).toEqual([
      'notes.txt: Only images can be accepted',
      'huge.png: The maximum image size is 2 megabytes'
    ])
  })

  it('keeps the photos already in the gallery when more are added', async () => {
    const { onGalleryChange } = setup({ gallery: [{ temp_id: 'a', file: 'https://img.test/a.png' }] })
    await pickPhotos([file('b.png')])
    expect(onGalleryChange.mock.calls[0][0]).toEqual([
      { temp_id: 'a', file: 'https://img.test/a.png' },
      { temp_id: expect.any(String), file: 'data:image/png;base64,b.png' }
    ])
  })

  it('takes photos dropped on the zone', async () => {
    const { onGalleryChange } = setup()
    const zone = screen.getByText('Drag and drop').closest('.odc-sadd-img-drop')
    await act(async () => {
      fireEvent.drop(zone, { dataTransfer: { files: [file('d1.png'), file('d2.png')], types: ['Files'] } })
    })
    await settle()
    expect(onGalleryChange.mock.calls[0][0]).toHaveLength(2)
  })

  it('draws every photo with an alt and gives every Remove its own name, Google ones included', () => {
    setup({
      gallery: [
        { temp_id: 'a', file: 'data:image/png;base64,a' },
        { temp_id: 'b', file: 'https://maps.googleusercontent.com/p/b' }
      ]
    })
    const list = screen.getByRole('list', { name: 'Photos' })
    const images = within(list).getAllByRole('img')
    expect(images.map(img => img.getAttribute('alt'))).toEqual(['Store photo 1', 'Store photo 2'])
    expect(images[1].getAttribute('src')).toBe('https://maps.googleusercontent.com/p/b')
    expect(within(list).getByRole('button', { name: 'Remove photo 1' }).tagName).toBe('BUTTON')
    expect(within(list).getByRole('button', { name: 'Remove photo 2' })).toBeTruthy()
  })

  it('removes the photo asked for and leaves the rest', async () => {
    const user = userEvent.setup()
    const gallery = [
      { temp_id: 'a', file: 'data:image/png;base64,a' },
      { temp_id: 'b', file: 'data:image/png;base64,b' },
      { temp_id: 'c', file: 'data:image/png;base64,c' }
    ]
    const { onGalleryChange } = setup({ gallery })
    await user.click(screen.getByRole('button', { name: 'Remove photo 2' }))
    expect(onGalleryChange).toHaveBeenCalledWith([gallery[0], gallery[2]])
  })

  it('ignores everything while the form is saving', async () => {
    const { onGalleryChange } = setup({
      disabled: true,
      form: { logo: 'data:image/png;base64,L' },
      gallery: [{ temp_id: 'a', file: 'data:image/png;base64,a' }]
    })
    expect(screen.getByRole('button', { name: 'Add photos' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Remove photo 1' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Remove logo' }).disabled).toBe(true)
    const zone = screen.getByText('Drag and drop').closest('.odc-sadd-img-drop')
    await act(async () => {
      fireEvent.drop(zone, { dataTransfer: { files: [file('d1.png')], types: ['Files'] } })
    })
    await settle()
    expect(onGalleryChange).not.toHaveBeenCalled()
  })
})
