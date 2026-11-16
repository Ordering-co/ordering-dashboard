/* eslint-disable import/first */
// an image config inside the Settings hub (Gift cards, logos) is P/ImageField, not the legacy grey «Put your image here»
// box. Same behaviour as SettingsImage in the hub: a picked image is a pending change (`onPick`), «Restore default» asks first and
// is a pending change too (`onRestore`), only images up to 2 MB are taken.
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: (url, params) => `${url}?${params}` }]
}))
vi.mock('../../../Shared/UI/ImageCrop', () => ({
  ImageCrop: ({ handleChangePhoto }) => <button type='button' onClick={() => handleChangePhoto('data:image/png;base64,CROP')}>crop</button>
}))

import { HubImageField } from '../HubImageField'

const config = (value = 'https://res.cloudinary.com/x/upload/card.png') => ({ id: 9, key: 'gift_card_image', name: 'Gift card image', type: 5, value })
const fileOf = (type, size = 10) => {
  const file = new window.File(['x'], 'a', { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

afterEach(cleanup)

describe('HubImageField', () => {
  it('is a Product image field named by the config, with the saved image as preview', () => {
    render(<HubImageField config={config()} onPick={vi.fn()} onRestore={vi.fn()} />)
    expect(screen.getByRole('group', { name: 'Gift card image' })).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://res.cloudinary.com/x/upload/card.png?h_200,c_limit')
    expect(screen.getByRole('button', { name: 'Change: Gift card image' })).toHaveClass('odc-btn')
    expect(screen.queryByText('Put your image here')).toBeNull()
  })

  it('a picked image goes through the crop and is handed to onPick, not saved', async () => {
    const onPick = vi.fn()
    const { container } = render(<HubImageField config={config('')} onPick={onPick} onRestore={vi.fn()} />)
    fireEvent.change(container.querySelector('input[type=file]'), { target: { files: [fileOf('image/png')] } })
    await userEvent.click(await screen.findByRole('button', { name: 'crop' }))
    expect(onPick).toHaveBeenCalledWith('data:image/png;base64,CROP')
  })

  it('refuses a file that is not an image, and one over 2 MB, saying why in the field', async () => {
    const onPick = vi.fn()
    const { container } = render(<HubImageField config={config('')} onPick={onPick} onRestore={vi.fn()} />)
    const input = container.querySelector('input[type=file]')
    fireEvent.change(input, { target: { files: [fileOf('application/pdf')] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Only images can be accepted')
    fireEvent.change(input, { target: { files: [fileOf('image/png', 3 * 1024 * 1024)] } })
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('The maximum image size is 2 megabytes'))
    expect(screen.queryByRole('button', { name: 'crop' })).toBeNull()
    expect(onPick).not.toHaveBeenCalled()
  })

  it('«Restore default» asks first and then calls onRestore', async () => {
    const onRestore = vi.fn()
    render(<HubImageField config={config()} onPick={vi.fn()} onRestore={onRestore} />)
    await userEvent.click(screen.getByRole('button', { name: 'Restore default: Gift card image' }))
    expect(onRestore).not.toHaveBeenCalled()
    expect(screen.getByText('Remove this image and use the default one?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Restore default' }))
    expect(onRestore).toHaveBeenCalledTimes(1)
  })

  it('without an image there is nothing to restore', () => {
    render(<HubImageField config={config('')} onPick={vi.fn()} onRestore={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Restore default/ })).toBeNull()
  })

  it('shows the error of the save bar', () => {
    render(<HubImageField config={config()} error='Upload failed' onPick={vi.fn()} onRestore={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Upload failed')
  })
})
