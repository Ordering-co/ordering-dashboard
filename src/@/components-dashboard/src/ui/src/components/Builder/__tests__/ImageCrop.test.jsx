import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

import {
  byteTargets,
  clampRect,
  fileFormat,
  fitSize,
  goodEnough,
  isWholeImage,
  keepOriginal,
  parseRatio,
  pickOutputFormat,
  planImage,
  renamed
} from '../ThemeSchemaEditor/imageResize'

const state = vi.hoisted(() => ({ read: null, rendered: null, cropper: null, detail: null }))

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))
vi.mock('../../../styles', async () => {
  const ReactActual = await vi.importActual('react')
  return {
    Button: ReactActual.forwardRef(({ color, borderRadius, outline, ...props }, ref) => <button ref={ref} {...props} />)
  }
})
vi.mock('../../Shared/Modal', () => ({
  Modal: ({ open, children, onClose }) => open
    ? <div onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>{children}</div>
    : null
}))
vi.mock('../../Shared', () => ({
  Confirm: ({ open, title, acceptText, cancelText, onAccept, onCancel, children }) => open
    ? (
      <div role='alertdialog' aria-label={title}>
        {children}
        <button onClick={onCancel}>{cancelText}</button>
        <button onClick={onAccept}>{acceptText}</button>
      </div>
      )
    : null
}))
vi.mock('cropperjs', () => ({
  default: class {
    constructor (image, options) {
      this.options = options
      this.box = { left: 10, top: 10, width: 160, height: 90 }
      state.cropper = this
      options.crop?.({ detail: state.detail || { x: 0, y: 375, width: 4000, height: 2250 } })
    }

    getData () { return { x: 0, y: 375, width: 4000, height: 2250 } }
    getCropBoxData () { return this.box }
    setCropBoxData (data) { this.box = { ...this.box, ...data } }
    destroy () {}
  }
}))
vi.mock('../ThemeSchemaEditor/imageResize', async () => {
  const actual = await vi.importActual('../ThemeSchemaEditor/imageResize')
  return {
    ...actual,
    readImage: vi.fn(async () => state.read),
    renderCrop: vi.fn(async () => state.rendered)
  }
})

// Imported after the mocks
const { CONTROLS } = await import('../ThemeSchemaEditor/controls')
const imageResize = await import('../ThemeSchemaEditor/imageResize')

const HINTS = { size: [2560, 1440], ratio: '16:9', alpha: false, max_kb: 600 }
const LIMITS = { max_bytes: 5000000, max_side: 10000, max_pixels: 25000000 }

describe('imageResize: what to do with a picked image', () => {
  it('reads the proportion from the ratio, else from the size', () => {
    expect(parseRatio({ ratio: '16:9' })).toBeCloseTo(16 / 9)
    expect(parseRatio({ ratio: '10:3', size: [1, 1] })).toBeCloseTo(10 / 3)
    expect(parseRatio({ size: [1080, 1920] })).toBeCloseTo(0.5625)
    expect(parseRatio({})).toBeNull()
    expect(parseRatio({ ratio: 'wide' })).toBeNull()
  })

  it('opens the crop for another proportion, a bigger image or one over the limits', () => {
    expect(planImage({ width: 4000, height: 3000, bytes: 1, hints: HINTS, limits: LIMITS }))
      .toMatchObject({ reasons: ['ratio', 'size'], overLimit: false, needsDialog: true, recommended: { width: 2560, height: 1440 } })
    // 1366 × 768 is 16:9 within the tolerance, and smaller than recommended
    expect(planImage({ width: 1366, height: 768, bytes: 1, hints: HINTS, limits: LIMITS }).needsDialog).toBe(false)
    expect(planImage({ width: 2560, height: 1440, bytes: 1, hints: HINTS, limits: LIMITS }).needsDialog).toBe(false)
    expect(planImage({ width: 1024, height: 1024, bytes: 1, hints: { size: [512, 512], ratio: '1:1' } }).reasons).toEqual(['size'])
    // A small image of another proportion is cropped, never enlarged
    expect(planImage({ width: 800, height: 800, bytes: 1, hints: HINTS }).reasons).toEqual(['ratio'])
    expect(planImage({ width: 1600, height: 900, bytes: 6000000, hints: HINTS, limits: LIMITS }))
      .toMatchObject({ reasons: ['limit'], overLimit: true })
    expect(planImage({ width: 12000, height: 100, bytes: 1, limits: LIMITS }).overLimit).toBe(true)
    expect(planImage({ width: 6000, height: 6000, bytes: 1, limits: LIMITS }).overLimit).toBe(true)
    expect(planImage({ width: 6000, height: 6000, bytes: 1 }).needsDialog).toBe(false)
  })

  it('saves at most the recommended size and the API limits, never bigger than the crop', () => {
    expect(fitSize(4000, 2250, { hints: HINTS })).toEqual({ width: 2560, height: 1440 })
    expect(fitSize(1200, 675, { hints: HINTS })).toEqual({ width: 1200, height: 675 })
    expect(fitSize(3000, 3000, { hints: { size: [1080, 1920] } })).toEqual({ width: 1080, height: 1080 })
    expect(fitSize(20000, 10000, { limits: LIMITS })).toEqual({ width: 7071, height: 3535 })
    expect(fitSize(12000, 100, { limits: LIMITS })).toEqual({ width: 10000, height: 83 })
  })

  it('keeps the format when it can, WebP for transparency (PNG without it), and WebP or JPEG for the rest', () => {
    const all = ['jpg', 'png', 'webp', 'avif']
    expect(pickOutputFormat({ source: 'jpg', formats: all, alpha: false })).toBe('jpg')
    expect(pickOutputFormat({ source: 'webp', formats: all, alpha: true })).toBe('webp')
    expect(pickOutputFormat({ source: 'png', formats: all, alpha: true })).toBe('webp')
    expect(pickOutputFormat({ source: 'png', formats: ['jpg', 'png'], alpha: true })).toBe('png')
    expect(pickOutputFormat({ source: 'png', formats: all, alpha: false })).toBe('webp')
    expect(pickOutputFormat({ source: 'png', formats: ['jpg', 'png'], alpha: false })).toBe('jpg')
    expect(pickOutputFormat({ source: 'avif', formats: all, alpha: false })).toBe('webp')
    expect(pickOutputFormat({ source: 'avif', formats: ['avif', 'png'], alpha: false })).toBe('png')
    expect(pickOutputFormat({ source: 'jpg', formats: ['png', 'webp'], alpha: false })).toBe('webp')
    expect(pickOutputFormat({ source: 'png', formats: ['svg'], alpha: true })).toBeNull()
  })

  it('lowers the quality only to reach the hint’s weight (to 0.7) or the API’s limit', () => {
    const targets = byteTargets({ max_kb: 600 }, LIMITS)
    expect(targets).toEqual({ soft: 600000, hard: 5000000 })
    expect(byteTargets({}, {})).toEqual({ soft: Infinity, hard: Infinity })
    expect(goodEnough(500000, 0.85, targets)).toBe(true)
    expect(goodEnough(900000, 0.85, targets)).toBe(false)
    expect(goodEnough(900000, 0.7, targets)).toBe(true)
    expect(goodEnough(5500000, 0.7, targets)).toBe(false)
  })

  it('keeps the picked file when nothing was cut or scaled and saving it again is heavier', () => {
    expect(keepOriginal({ whole: true, resized: false, outputBytes: 120, originalBytes: 100 })).toBe(true)
    expect(keepOriginal({ whole: true, resized: false, outputBytes: 80, originalBytes: 100 })).toBe(false)
    expect(keepOriginal({ whole: true, resized: true, outputBytes: 120, originalBytes: 100 })).toBe(false)
    expect(keepOriginal({ whole: false, resized: false, outputBytes: 120, originalBytes: 100 })).toBe(false)
    expect(isWholeImage({ x: 0, y: 1, width: 3999, height: 3000 }, 4000, 3000)).toBe(true)
    expect(isWholeImage({ x: 0, y: 375, width: 4000, height: 2250 }, 4000, 3000)).toBe(false)
    expect(clampRect({ x: -2.4, y: 10.6, width: 5000, height: 20 }, 4000, 3000)).toEqual({ x: 0, y: 11, width: 4000, height: 20 })
  })

  it('names the file by the format it is saved in', () => {
    expect(renamed('Hero photo.PNG', 'webp')).toBe('Hero photo.webp')
    expect(renamed('logo', 'png')).toBe('logo.png')
    expect(renamed('a.b.jpeg', 'jpg')).toBe('a.b.jpg')
    expect(fileFormat({ type: 'image/jpeg', name: 'x' })).toBe('jpg')
    expect(fileFormat({ type: '', name: 'x.JPEG' })).toBe('jpg')
    expect(fileFormat({ type: 'image/svg+xml', name: 'x.svg' })).toBe('svg')
  })
})

describe('ImageControl crop dialog', () => {
  const schema = { images: { hero: { $type: 'image', $value: null, $extensions: { 'co.ordering': { formats: null, hints: HINTS }, 'co.ordering.editor': { control: 'image' } } } } }
  const t = (_key, fallback) => fallback
  const photo = new File(['x'.repeat(2000)], 'photo.jpg', { type: 'image/jpeg' })

  const renderControl = (extra = {}) => {
    const uploadImage = vi.fn(async () => ({ ok: true, errorCodes: [] }))
    const ctx = { schema, t, uploadImage, format: { images: { default_formats: ['jpg', 'png', 'webp', 'avif'], ...LIMITS } }, ...extra }
    renderWithProviders(<CONTROLS.image ctx={ctx} path='images.hero' label='Home banner' value={null} onChange={vi.fn()} />)
    const pick = (file) => fireEvent.change(screen.getByLabelText('Image file: Home banner'), { target: { files: [file] } })
    return { uploadImage, pick }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    state.read = { url: 'blob:photo', image: {}, width: 4000, height: 3000 }
    state.rendered = new File(['y'], 'photo.jpg', { type: 'image/jpeg' })
    state.detail = null
    globalThis.URL.revokeObjectURL = vi.fn()
  })

  it('opens the crop, locked to the hint’s proportion, and uploads the crop', async () => {
    const { uploadImage, pick } = renderControl()
    pick(photo)
    const dialog = await screen.findByRole('dialog', { name: 'Crop Home banner' })
    expect(dialog).toHaveAccessibleDescription('This image has a different proportion. Move the frame to choose the part to keep.')
    expect(state.cropper.options.aspectRatio).toBeCloseTo(16 / 9)
    expect(screen.getByText('4000 × 3000 px')).toBeInTheDocument()
    expect(screen.getByText('2560 × 1440 px (16:9)')).toBeInTheDocument()
    // The result is filled in when cropperjs reports the frame, a commit after the dialog opens
    expect(await screen.findByText('2560 × 1440 px')).toBeInTheDocument()
    expect(uploadImage).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Use this crop' }))
    await waitFor(() => expect(uploadImage).toHaveBeenCalledWith('hero', state.rendered))
    expect(imageResize.renderCrop).toHaveBeenCalledWith(expect.objectContaining({
      file: photo,
      rect: { x: 0, y: 375, width: 4000, height: 2250 },
      hints: HINTS,
      formats: ['jpg', 'png', 'webp', 'avif']
    }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo')
  })

  it('says when the crop ends up smaller than recommended, and why', async () => {
    state.read = { url: 'blob:photo', image: {}, width: 1600, height: 1200 }
    state.detail = { x: 0, y: 150, width: 1600, height: 900 }
    const { pick } = renderControl()
    pick(photo)
    await screen.findByRole('dialog', { name: 'Crop Home banner' })
    const badge = (await screen.findByText('Too small')).closest('span')
    expect(badge).toHaveAttribute('tabindex', '0')
    expect(badge).toHaveTextContent('The result is smaller than the recommended 2560 × 1440 px, so it may look blurry on large screens.')
    fireEvent.focus(badge)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('smaller than the recommended 2560 × 1440 px')
  })

  it('says nothing about the size when the crop reaches the recommended one', async () => {
    const { pick } = renderControl()
    pick(photo)
    await screen.findByRole('dialog', { name: 'Crop Home banner' })
    await screen.findByText('2560 × 1440 px')
    expect(screen.queryByText('Too small')).toBeNull()
  })

  it('uploads the picked file as it is, or nothing on Cancel and Esc', async () => {
    const { uploadImage, pick } = renderControl()
    pick(photo)
    fireEvent.click(await screen.findByRole('button', { name: 'Upload as is' }))
    // It asks first: the website most likely won't fit it well
    const confirm = screen.getByRole('alertdialog', { name: 'Upload it without cropping?' })
    expect(confirm).toHaveTextContent('Its proportion isn’t 16:9, so it most likely won’t fit well on your website')
    expect(confirm).toHaveTextContent('It’s bigger than needed')
    expect(uploadImage).not.toHaveBeenCalled()
    fireEvent.click(within(confirm).getByRole('button', { name: 'Back' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Crop Home banner' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Upload as is' })).toHaveFocus())
    // Esc closes only the Confirm, not the crop
    fireEvent.click(screen.getByRole('button', { name: 'Upload as is' }))
    fireEvent.keyDown(screen.getByRole('group', { name: 'Crop frame' }), { key: 'Escape', code: 'Escape' })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Crop Home banner' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Upload as is' }))
    fireEvent.click(screen.getByRole('button', { name: 'Upload anyway' }))
    await waitFor(() => expect(uploadImage).toHaveBeenCalledWith('hero', photo))
    expect(imageResize.renderCrop).not.toHaveBeenCalled()

    uploadImage.mockClear()
    pick(photo)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Upload' })).toHaveFocus())

    pick(photo)
    fireEvent.keyDown(await screen.findByRole('group', { name: 'Crop frame' }), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(uploadImage).not.toHaveBeenCalled()
  })

  it('shows nothing in place of an empty image, and its thumbnail when it has one', () => {
    renderControl()
    expect(screen.queryByText('Standard image')).toBeNull()
    expect(document.querySelector('img')).toBeNull()
    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use a link' })).toBeInTheDocument()
  })

  it('keeps the thumbnail of an image the theme has', () => {
    const ctx = { schema, t, uploadImage: vi.fn(), format: { images: LIMITS } }
    renderWithProviders(<CONTROLS.image ctx={ctx} path='images.hero' label='Home banner' value='https://cdn.example.com/hero.webp' onChange={vi.fn()} />)
    expect(document.querySelector('img')).toHaveAttribute('src', 'https://cdn.example.com/hero.webp')
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument()
  })

  it('moves and resizes the frame with the keyboard', async () => {
    const { pick } = renderControl()
    pick(photo)
    const frame = await screen.findByRole('group', { name: 'Crop frame' })
    await waitFor(() => expect(state.cropper).not.toBeNull())
    fireEvent.keyDown(frame, { key: 'ArrowRight' })
    expect(state.cropper.box).toMatchObject({ left: 20, top: 10 })
    fireEvent.keyDown(frame, { key: 'ArrowDown', shiftKey: true })
    expect(state.cropper.box).toMatchObject({ left: 20, top: 60 })
    fireEvent.keyDown(frame, { key: '+' })
    expect(state.cropper.box.width).toBe(170)
    expect(state.cropper.box.height).toBeCloseTo(170 * 9 / 16)
  })

  it('uploads directly an image that fits, an SVG, or one the browser can’t read', async () => {
    const { uploadImage, pick } = renderControl()
    state.read = { url: 'blob:fits', image: {}, width: 2560, height: 1440 }
    pick(photo)
    await waitFor(() => expect(uploadImage).toHaveBeenCalledWith('hero', photo))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fits')

    const svg = new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' })
    imageResize.readImage.mockClear()
    pick(svg)
    await waitFor(() => expect(uploadImage).toHaveBeenCalledWith('hero', svg))
    expect(imageResize.readImage).not.toHaveBeenCalled()

    imageResize.readImage.mockRejectedValueOnce(new Error('image.unreadable'))
    const broken = new File(['?'], 'broken.png', { type: 'image/png' })
    pick(broken)
    await waitFor(() => expect(uploadImage).toHaveBeenCalledWith('hero', broken))
  })

  it('asks before uploading an image under the recommended size, with its proportion', async () => {
    const { uploadImage, pick } = renderControl()
    state.read = { url: 'blob:small', image: {}, width: 1920, height: 1080 }
    pick(photo)
    const confirm = await screen.findByRole('alertdialog', { name: 'This image is smaller than recommended' })
    expect(confirm).toHaveTextContent('Yours is 1920 × 1080 px and the recommended size is 2560 × 1440 px, so it may look blurry on large screens.')
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    expect(uploadImage).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Upload' })).toHaveFocus())

    pick(photo)
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Upload anyway' }))
    await waitFor(() => expect(uploadImage).toHaveBeenCalledWith('hero', photo))
  })

  it('doesn’t offer to upload as is an image the API would refuse', async () => {
    const { pick } = renderControl()
    state.read = { url: 'blob:huge', image: {}, width: 12000, height: 6750 }
    pick(photo)
    await screen.findByRole('dialog')
    expect(screen.queryByRole('button', { name: 'Upload as is' })).toBeNull()
    expect(screen.getByText('It can’t be uploaded as is: it is over the upload limit.')).toBeInTheDocument()
  })

  it('says when the crop couldn’t be made', async () => {
    const { uploadImage, pick } = renderControl()
    imageResize.renderCrop.mockRejectedValueOnce(new Error('image.encode_failed'))
    pick(photo)
    const useCrop = await screen.findByRole('button', { name: 'Use this crop' })
    await waitFor(() => expect(useCrop).toBeEnabled())
    fireEvent.click(useCrop)
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t crop the image. Upload it as is or try another one.')
    expect(uploadImage).not.toHaveBeenCalled()
  })
})
