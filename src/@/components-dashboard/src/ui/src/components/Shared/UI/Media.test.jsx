/* eslint-disable import/first */
import React, { createRef } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const runtime = vi.hoisted(() => ({
  canvas: null,
  cropperInstances: [],
  optimizeImage: null
}))

vi.mock('cropperjs', () => ({
  default: class CropperMock {
    constructor (element, options) {
      this.element = element
      this.options = options
      this.destroy = vi.fn()
      this.getCroppedCanvas = vi.fn(() => runtime.canvas)
      this.rotate = vi.fn()
      this.scale = vi.fn()
      this.setAspectRatio = vi.fn()
      runtime.cropperInstances.push(this)
    }
  }
}))

vi.mock('react-loading-skeleton', () => ({
  default: props => <span data-testid='media-skeleton' style={props.style} />
}))

vi.mock('../../../../../index', () => ({
  useApi: () => [{ root: 'https://api.example.test' }],
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useSession: () => [{ token: 'session-token' }],
  useUtils: () => [{ optimizeImage: (...args) => runtime.optimizeImage(...args) }]
}))

import { Image } from './Image'
import { ImageCrop } from './ImageCrop'

const lightTheme = createDashboardTheme(theme)
const rtlDarkTheme = { ...createDashboardTheme(theme, { mode: 'dark' }), rtl: true }
const renderWithTheme = (content, currentTheme = lightTheme) => render(
  <ThemeProvider theme={currentTheme}>{content}</ThemeProvider>
)

const createCropProps = overrides => ({
  aspectRatio: 1.5,
  handleChangePhoto: vi.fn(),
  onClose: vi.fn(),
  photo: 'data:image/jpeg;base64,photo',
  showAspectRatioBox: true,
  ...overrides
})

const deferred = () => {
  let resolveGate
  let rejectGate
  const promise = new Promise((resolve, reject) => {
    resolveGate = resolve
    rejectGate = reject
  })
  return { promise, reject: rejectGate, resolve: resolveGate }
}

beforeEach(() => {
  runtime.canvas = {
    toDataURL: vi.fn((mime, quality) => `cropped:${mime}:${quality}`)
  }
  runtime.cropperInstances = []
  runtime.optimizeImage = vi.fn(url => `optimized:${url}`)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('L2d-C11 Image', () => {
  it('keeps hooks stable when the forwarded ref changes and preserves image props', () => {
    const style = { width: '30px' }
    const forwardedRef = createRef()
    const rendered = render(<Image src='/primary.png' className='avatar' style={style} fallback='/fallback.png' />)
    expect(screen.getByAltText('profile-image')).toHaveAttribute('src', '/primary.png')
    expect(screen.getByAltText('profile-image')).toHaveClass('avatar')
    expect(screen.getByAltText('profile-image')).toHaveStyle(style)

    rendered.rerender(<Image ref={forwardedRef} src='/primary.png' className='avatar' style={style} fallback='/fallback.png' />)
    expect(forwardedRef.current).toBe(screen.getByAltText('profile-image'))
  })

  it('keeps string fallback, failed-fallback removal, and non-string fallback branches exact', () => {
    const rendered = render(<Image src='/bad.png' fallback='/fallback.png' className='media' style={{ height: '20px' }} />)
    fireEvent.error(screen.getByAltText('profile-image'))
    expect(screen.getByAltText('profile-image')).toHaveAttribute('src', '/fallback.png')
    fireEvent.error(screen.getByAltText('profile-image'))
    const removed = rendered.container.querySelector('div.media')
    expect(removed).toBeInTheDocument()
    expect(removed).toHaveStyle({ height: '20px' })

    rendered.rerender(<Image src='/bad-again.png' fallback={<span>Fallback node</span>} className='node-fallback' />)
    expect(rendered.container.querySelector('div.node-fallback')).toContainElement(screen.getByText('Fallback node'))

    rendered.unmount()
    const missing = render(<Image fallback={<span>Missing source fallback</span>} />)
    expect(screen.getByText('Missing source fallback').parentElement).toBe(missing.container)
  })
})

describe('L2d-C11 ImageCrop', () => {
  it('keeps Cropper options, slider scale, rotate, aspect toggle, JPEG canvas and callback order', async () => {
    const user = userEvent.setup()
    const props = createCropProps()
    renderWithTheme(<ImageCrop {...props} />, rtlDarkTheme)
    await waitFor(() => expect(runtime.cropperInstances).toHaveLength(1))
    const cropper = runtime.cropperInstances[0]
    expect(cropper.element).toBe(screen.getByAltText('Crop'))
    expect(cropper.options).toEqual({
      aspectRatio: 1.5,
      dragMode: 'move',
      zoomable: false,
      toggleDragModeOnDblclick: false,
      autoCropArea: 1
    })
    const root = document.querySelector('[data-slot="image-crop"]')
    expect(root).toHaveAttribute('dir', 'rtl')
    expect(getComputedStyle(root).getPropertyValue('--od-entity-selector-surface')).toBe(rtlDarkTheme.ordering.semantic.surface.default)

    const slider = screen.getByRole('slider', { name: 'Resize image' })
    fireEvent.change(slider, { target: { value: '25' } })
    expect(cropper.scale).toHaveBeenCalledWith(0.5)
    expect(document.querySelector('[data-slot="image-crop-range"] output')).toHaveTextContent('50 %')

    const rotate = screen.getByRole('button', { name: 'Rotate' })
    expect(rotate).toHaveAttribute('type', 'button')
    await user.click(rotate)
    expect(cropper.rotate).toHaveBeenCalledWith(45)
    const aspect = screen.getByRole('checkbox', { name: 'Use web aspect ratio' })
    await user.click(aspect)
    await user.click(aspect)
    expect(cropper.setAspectRatio).toHaveBeenNthCalledWith(1, 18 / 9)
    expect(cropper.setAspectRatio).toHaveBeenNthCalledWith(2, 1.5)

    const crop = screen.getByRole('button', { name: 'Crop' })
    expect(crop).toHaveAttribute('type', 'button')
    await user.click(crop)
    expect(cropper.getCroppedCanvas).toHaveBeenCalledWith({
      imageSmoothingQuality: 'high',
      maxWidth: 1920,
      maxHeight: 1080
    })
    expect(runtime.canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.92)
    expect(props.handleChangePhoto).toHaveBeenCalledWith('cropped:image/jpeg:0.92')
    expect(props.handleChangePhoto.mock.invocationCallOrder[0]).toBeLessThan(props.onClose.mock.invocationCallOrder[0])
  })

  it.each([
    ['data:image/webp;base64,photo', 'image/webp'],
    ['data:image/gif;base64,photo', 'image/png'],
    ['/ordinary-url.png', 'image/png']
  ])('keeps output MIME mapping for %s', async (photo, mime) => {
    const props = createCropProps({ aspectRatio: undefined, photo, showAspectRatioBox: false })
    renderWithTheme(<ImageCrop {...props} />)
    await waitFor(() => expect(runtime.cropperInstances).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Crop' }))
    await waitFor(() => expect(props.handleChangePhoto).toHaveBeenCalledOnce())
    expect(runtime.canvas.toDataURL).toHaveBeenCalledWith(mime, 0.92)
    expect(runtime.cropperInstances[0].options).not.toHaveProperty('aspectRatio')
  })

  it('keeps the cropper DOM mounted during gallery POST and preserves success payload/order', async () => {
    const request = deferred()
    vi.stubGlobal('fetch', vi.fn(() => request.promise))
    const props = createCropProps({ themeId: 44, useCloudinaryUrl: true })
    renderWithTheme(<ImageCrop {...props} />)
    await waitFor(() => expect(runtime.cropperInstances).toHaveLength(1))
    const cropper = runtime.cropperInstances[0]
    const image = screen.getByAltText('Crop')
    fireEvent.click(screen.getByRole('button', { name: 'Crop' }))

    expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(screen.getByAltText('Crop')).toBe(image)
    expect(cropper.destroy).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Crop' })).toBeDisabled()
    expect(fetch).toHaveBeenCalledWith('https://api.example.test/themes/44/gallery', {
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer session-token' },
      method: 'POST',
      body: JSON.stringify({ type: 'image', file: 'cropped:image/jpeg:0.92' })
    })

    request.resolve({ json: () => Promise.resolve({ result: { image: '/cloud-image.png' }, error: null }) })
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Loading' })).not.toBeInTheDocument())
    expect(runtime.optimizeImage).toHaveBeenCalledWith('/cloud-image.png', 'f_auto,q_auto,w_2000,c_limit')
    expect(props.handleChangePhoto).toHaveBeenCalledWith('optimized:/cloud-image.png')
    expect(props.handleChangePhoto.mock.invocationCallOrder[0]).toBeLessThan(props.onClose.mock.invocationCallOrder[0])
  })

  // a site still to be created has no theme id; `resolveThemeId` (the controller's ensureSite) gives the one to upload to
  it('without themeId, resolveThemeId runs on Crop and the gallery upload goes to the theme it gives', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ result: { image: '/cloud-image.png' }, error: null }) }))
    vi.stubGlobal('fetch', fetchMock)
    const resolveThemeId = vi.fn(() => Promise.resolve(9))
    const props = createCropProps({ useCloudinaryUrl: true, resolveThemeId })
    renderWithTheme(<ImageCrop {...props} />)
    await waitFor(() => expect(runtime.cropperInstances).toHaveLength(1))
    expect(resolveThemeId).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Crop' }))
    await waitFor(() => expect(props.handleChangePhoto).toHaveBeenCalledWith('optimized:/cloud-image.png'))
    expect(resolveThemeId).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.test/themes/9/gallery')
    expect(props.handleChangePhoto).not.toHaveBeenCalledWith(expect.stringContaining('cropped:'))
  })

  it.each([
    ['gives no theme id', () => Promise.resolve(null)],
    ['throws', () => Promise.reject(new Error('site not created'))]
  ])('without themeId, a resolveThemeId that %s uploads nothing and emits no data URI', async (_name, resolver) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const props = createCropProps({ useCloudinaryUrl: true, resolveThemeId: vi.fn(resolver) })
    renderWithTheme(<ImageCrop {...props} />)
    await waitFor(() => expect(runtime.cropperInstances).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Crop' }))
    await waitFor(() => expect(props.resolveThemeId).toHaveBeenCalledOnce())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Crop' })).not.toBeDisabled())
    expect(fetchMock).not.toHaveBeenCalled()
    expect(props.handleChangePhoto).not.toHaveBeenCalled()
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('with a themeId, resolveThemeId is never called', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ result: { image: '/cloud-image.png' }, error: null }) })))
    const resolveThemeId = vi.fn(() => Promise.resolve(9))
    const props = createCropProps({ themeId: 44, useCloudinaryUrl: true, resolveThemeId })
    renderWithTheme(<ImageCrop {...props} />)
    await waitFor(() => expect(runtime.cropperInstances).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Crop' }))
    await waitFor(() => expect(props.handleChangePhoto).toHaveBeenCalledOnce())
    expect(resolveThemeId).not.toHaveBeenCalled()
    expect(fetch.mock.calls[0][0]).toBe('https://api.example.test/themes/44/gallery')
  })

  it('restores loading after rejected gallery fetch without success callbacks or cropper destruction', async () => {
    const request = deferred()
    vi.stubGlobal('fetch', vi.fn(() => request.promise))
    const props = createCropProps({ themeId: 45, useCloudinaryUrl: true })
    renderWithTheme(<ImageCrop {...props} />)
    await waitFor(() => expect(runtime.cropperInstances).toHaveLength(1))
    const cropper = runtime.cropperInstances[0]
    fireEvent.click(screen.getByRole('button', { name: 'Crop' }))
    expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
    request.reject(new Error('network failed'))
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Loading' })).not.toBeInTheDocument())
    expect(props.handleChangePhoto).not.toHaveBeenCalled()
    expect(props.onClose).not.toHaveBeenCalled()
    expect(cropper.destroy).not.toHaveBeenCalled()
    expect(screen.getByAltText('Crop')).toBeInTheDocument()
  })

  it('preserves gallery error as no-success and destroys exactly once on cropper dependency change', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ result: null, error: true }) })))
    const props = createCropProps({ themeId: 46, useCloudinaryUrl: true })
    const rendered = renderWithTheme(<ImageCrop {...props} />)
    await waitFor(() => expect(runtime.cropperInstances).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Crop' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Crop' })).not.toBeDisabled())
    expect(props.handleChangePhoto).not.toHaveBeenCalled()
    expect(props.onClose).not.toHaveBeenCalled()

    const firstCropper = runtime.cropperInstances[0]
    rendered.rerender(<ThemeProvider theme={lightTheme}><ImageCrop {...props} photo='data:image/png;base64,next' /></ThemeProvider>)
    await waitFor(() => expect(runtime.cropperInstances).toHaveLength(2))
    expect(firstCropper.destroy).toHaveBeenCalledOnce()
  })

  it('uses unique accessible ids for simultaneous aspect and range controls', async () => {
    renderWithTheme(
      <>
        <ImageCrop {...createCropProps()} />
        <ImageCrop {...createCropProps({ photo: 'data:image/png;base64,second' })} />
      </>
    )
    await waitFor(() => expect(runtime.cropperInstances).toHaveLength(2))
    const sliders = screen.getAllByRole('slider', { name: 'Resize image' })
    const aspects = screen.getAllByRole('checkbox', { name: 'Use web aspect ratio' })
    expect(new Set(sliders.map(slider => slider.id)).size).toBe(2)
    expect(new Set(aspects.map(checkbox => checkbox.id)).size).toBe(2)
  })
})
