/* eslint-disable import/first */
// redesign my-products B4 (; D3, D6, M-MP-02): the «Images», «Icons and splash» and «Colors» sections of the app editor.
// Covered: the general images (the franchise filter of main), the four groups of resources (an empty one is not painted), the
// props each image box gets (the same as main), the save of an image and its error (translated, and the box goes back to the
// saved picture), the colors (the body of main's save, the app updated without mutating it, the field disabled while it saves,
// the error in the field that keeps the chosen color and goes away when another is chosen). The controller's props are
// simulated; the image box and the color panel are stand-ins that record what they are given and emit one value.
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockState = vi.hoisted(() => ({
  texts: {},
  showToast: null,
  imageProps: {},
  file: null,
  nextColor: '#112233'
}))

// A key can be given another text for a test; every other key gives its default
const translate = (key, text) => mockState.texts[key] ?? text

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, translate],
  useToast: () => [{}, { showToast: mockState.showToast }],
  ToastType: { Success: 'success', Error: 'error' }
}))
// the image box (legacy): a stand-in that keeps the props of its last render and emits one picture
vi.mock('../../AdvancedSettings/ImageBox', () => ({
  ImageBox: (props) => {
    mockState.imageProps[props.id] = props
    return (
      <div data-testid={`image-${props.id}`}>
        <button type='button' onClick={() => props.handleChangePhoto(mockState.file, props.path)}>{`Change ${props.title}`}</button>
        <button type='button' onClick={() => props.handleClick()}>{`Touch ${props.title}`}</button>
        <span data-testid={`reset-${props.id}`}>{String(props.isResetImg)}</span>
      </div>
    )
  }
}))
// the color panel (legacy): it records the seed and emits `nextColor`
vi.mock('../../../Shared/UI/ColorPicker', () => ({
  ColorPicker: ({ defaultColor, isDisabled, onChangeColor }) => {
    const ref = React.useRef(null)
    // a browser drops the focus on <body> when the focused control gets disabled (jsdom does not): the stand-in does the same
    React.useEffect(() => {
      const node = ref.current
      if (!isDisabled || document.activeElement !== node) return
      node.removeAttribute('disabled')
      node.blur()
      node.setAttribute('disabled', '')
    }, [isDisabled])
    return (
      <button
        ref={ref}
        type='button'
        className='od-color-picker-trigger'
        disabled={isDisabled}
        data-color={defaultColor}
        onClick={() => onChangeColor(mockState.nextColor)}
      >
        Pick
      </button>
    )
  }
}))

import { ColorsSection } from '../ColorsSection'
import { ImagesSection, ResourcesSection } from '../ImagesSection'

const image = (id, group, over = {}) => ({
  id,
  name: `Image ${id}`,
  group,
  editable: true,
  public_url: `https://cdn.example.test/${id}.png`,
  target_path: `assets/${id}.png`,
  file_rules: { width: 512, height: 256, max_size: 1024, extension: 'png', mimetype: 'image/png' },
  ...over
})

const color = (id, name, text) => ({ id, group: 'colors', name, text_content: text })

const imagesApp = (actions, code = 'app_marketplace_x') => ({ id: 7, base: { code }, baseActions: actions })

const FRANCHISE = 'app_franchises_x'

beforeEach(() => {
  mockState.texts = {}
  mockState.showToast = vi.fn()
  mockState.imageProps = {}
  mockState.file = new File(['png'], 'new.png', { type: 'image/png' })
  mockState.nextColor = '#112233'
})

describe('ImagesSection', () => {
  it('paints the general images only, in the grid', () => {
    const app = imagesApp([image(1, 'general_images'), image(2, 'general_images'), image(3, 'resources_icons')])
    const { container } = render(<ImagesSection app={app} updateBaseActions={vi.fn()} />)

    expect(container.firstChild.className).toBe('odc-api')
    expect(container.querySelector('.odc-api-grid')).not.toBeNull()
    expect(screen.queryByTestId('image-1')).not.toBeNull()
    expect(screen.queryByTestId('image-2')).not.toBeNull()
    expect(screen.queryByTestId('image-3')).toBeNull()
    expect(screen.queryAllByRole('heading')).toHaveLength(0)
  })

  it('leaves out, in the franchise app, the pictures main left out', () => {
    const app = imagesApp([
      image(1, 'general_images', { target_path: 'assets/logo.png' }),
      image(2, 'general_images', { target_path: 'assets/not-found.png' }),
      image(3, 'general_images', { target_path: 'assets/empty-active-orders.png' }),
      image(4, 'general_images', { target_path: 'assets/category-all.png' })
    ], FRANCHISE)
    render(<ImagesSection app={app} updateBaseActions={vi.fn()} />)

    expect(screen.queryByTestId('image-1')).not.toBeNull()
    for (const id of [2, 3, 4]) expect(screen.queryByTestId(`image-${id}`)).toBeNull()
  })

  it('does not filter the same pictures out of any other app', () => {
    render(<ImagesSection app={imagesApp([image(2, 'general_images', { target_path: 'assets/not-found.png' })])} updateBaseActions={vi.fn()} />)

    expect(screen.queryByTestId('image-2')).not.toBeNull()
  })

  it('paints nothing without general images, or when the franchise filter leaves none', () => {
    const none = render(<ImagesSection app={imagesApp([image(3, 'resources_icons')])} updateBaseActions={vi.fn()} />)
    expect(none.container.firstChild).toBeNull()

    const nothing = render(<ImagesSection app={{ id: 7 }} updateBaseActions={vi.fn()} />)
    expect(nothing.container.firstChild).toBeNull()

    const filtered = render(
      <ImagesSection app={imagesApp([image(2, 'general_images', { target_path: 'assets/not-found.png' })], FRANCHISE)} updateBaseActions={vi.fn()} />
    )
    expect(filtered.container.firstChild).toBeNull()
  })

  it('gives each image box the same props as main', () => {
    const app = imagesApp([
      image(1, 'general_images'),
      image(2, 'general_images', { editable: false, file_rules: { width: 100, height: 50, max_size: 5000, extension: 'jpg', mimetype: 'image/jpeg' } })
    ])
    render(<ImagesSection app={app} updateBaseActions={vi.fn()} />)

    expect(mockState.imageProps[1]).toMatchObject({
      id: 1,
      useAlertToast: true,
      disableCrop: true,
      editable: true,
      title: 'Image 1',
      ratio: '512 x 256 px',
      photo: 'https://cdn.example.test/1.png',
      path: 'assets/1.png',
      requireDimentions: { width: 512, height: 256 },
      isResetImg: false,
      // never under 3 MB, as main
      fileSize: 3072,
      extensionFile: 'png',
      mimeTypeAccept: 'image/png'
    })
    expect(mockState.imageProps[2]).toMatchObject({
      editable: false,
      ratio: '100 x 50 px',
      requireDimentions: { width: 100, height: 50 },
      fileSize: 5000,
      extensionFile: 'jpg',
      mimeTypeAccept: 'image/jpeg'
    })
    expect(typeof mockState.imageProps[1].handleClick).toBe('function')
    expect(typeof mockState.imageProps[1].handleChangePhoto).toBe('function')
  })

  it('saves a picture as main does and says so', async () => {
    const user = userEvent.setup()
    const updateBaseActions = vi.fn().mockResolvedValue({ error: false, result: { id: 1 } })
    render(<ImagesSection app={imagesApp([image(1, 'general_images')])} updateBaseActions={updateBaseActions} />)

    await user.click(screen.getByRole('button', { name: 'Change Image 1' }))

    await waitFor(() => expect(mockState.showToast).toHaveBeenCalledWith('success', 'Correctly saved image'))
    expect(updateBaseActions).toHaveBeenCalledTimes(1)
    const { id, body, ...rest } = updateBaseActions.mock.calls[0][0]
    expect(id).toBe(1)
    expect(rest).toEqual({})
    expect(body).toBeInstanceOf(FormData)
    expect(body.get('source_file')).toBe(mockState.file)
    expect(mockState.imageProps[1].isResetImg).toBe(false)
  })

  it('says the error of the API in the user\'s language, and sends the box back to the saved picture', async () => {
    const user = userEvent.setup()
    // main built the key from the text (`FILE_IS_INVALID.`, with the dot): a text with punctuation never reached its translation
    mockState.texts.FILE_IS_INVALID = 'Archivo no válido'
    const updateBaseActions = vi.fn().mockResolvedValue({ error: true, result: ['File is invalid.'] })
    render(<ImagesSection app={imagesApp([image(1, 'general_images')])} updateBaseActions={updateBaseActions} />)

    await user.click(screen.getByRole('button', { name: 'Change Image 1' }))

    await waitFor(() => expect(mockState.showToast).toHaveBeenCalledWith('error', 'Archivo no válido'))
    expect(mockState.showToast).not.toHaveBeenCalledWith('success', expect.anything())
    await waitFor(() => expect(screen.getByTestId('reset-1').textContent).toBe('true'))

    // touching a box clears the error (main's `handleClick`), so the next failure resets it again
    await user.click(screen.getByRole('button', { name: 'Touch Image 1' }))
    expect(screen.getByTestId('reset-1').textContent).toBe('false')
  })

  it('shows the text of the error as it came when the project has no translation for it', async () => {
    const user = userEvent.setup()
    const updateBaseActions = vi.fn().mockResolvedValue({ error: true, result: ['Unknown rejection'] })
    render(<ImagesSection app={imagesApp([image(1, 'general_images')])} updateBaseActions={updateBaseActions} />)

    await user.click(screen.getByRole('button', { name: 'Change Image 1' }))

    await waitFor(() => expect(mockState.showToast).toHaveBeenCalledWith('error', 'Unknown rejection'))
  })

  it('says a request that fails, and also resets the box', async () => {
    const user = userEvent.setup()
    mockState.texts.NETWORK_DOWN = 'Sin red'
    const updateBaseActions = vi.fn().mockRejectedValue(new Error('Network down'))
    render(<ImagesSection app={imagesApp([image(1, 'general_images')])} updateBaseActions={updateBaseActions} />)

    await user.click(screen.getByRole('button', { name: 'Change Image 1' }))

    await waitFor(() => expect(mockState.showToast).toHaveBeenCalledWith('error', 'Sin red'))
    await waitFor(() => expect(screen.getByTestId('reset-1').textContent).toBe('true'))
  })
})

describe('ResourcesSection', () => {
  const resources = [
    image(10, 'resources_icons'),
    image(11, 'resources_notifications'),
    image(12, 'splash_android'),
    image(13, 'splash_ios')
  ]

  it('paints the four groups, each under its own heading, in order', () => {
    const { container } = render(<ResourcesSection app={imagesApp([...resources, image(1, 'general_images')])} updateBaseActions={vi.fn()} />)

    expect(container.firstChild.className).toBe('odc-api')
    expect(screen.getAllByRole('heading', { level: 3 }).map(node => node.textContent)).toEqual([
      'Icons', 'Notifications', 'Android Splash', 'iOS Splash'
    ])
    const groups = [...container.querySelectorAll('.odc-api-group')]
    expect(groups.map(group => [...group.querySelectorAll('[data-testid^="image-"]')].map(node => node.getAttribute('data-testid')))).toEqual([
      ['image-10'], ['image-11'], ['image-12'], ['image-13']
    ])
    expect(screen.queryByTestId('image-1')).toBeNull()
  })

  it('does not paint a group that has no pictures', () => {
    render(<ResourcesSection app={imagesApp([resources[0], resources[2]])} updateBaseActions={vi.fn()} />)

    expect(screen.getAllByRole('heading', { level: 3 }).map(node => node.textContent)).toEqual(['Icons', 'Android Splash'])
    expect(screen.queryByText('Notifications')).toBeNull()
    expect(screen.queryByText('iOS Splash')).toBeNull()
  })

  it('does not paint a group the franchise filter empties', () => {
    const app = imagesApp([
      image(10, 'resources_icons', { target_path: 'assets/delivery.png' }),
      image(11, 'resources_notifications', { target_path: 'assets/bell.png' })
    ], FRANCHISE)
    render(<ResourcesSection app={app} updateBaseActions={vi.fn()} />)

    expect(screen.getAllByRole('heading', { level: 3 }).map(node => node.textContent)).toEqual(['Notifications'])
  })

  it('paints nothing when every group is empty', () => {
    const { container } = render(<ResourcesSection app={imagesApp([image(1, 'general_images')])} updateBaseActions={vi.fn()} />)
    expect(container.firstChild).toBeNull()

    const none = render(<ResourcesSection app={{ id: 7 }} updateBaseActions={vi.fn()} />)
    expect(none.container.firstChild).toBeNull()
  })

  it('saves a picture of a group the same way', async () => {
    const user = userEvent.setup()
    const updateBaseActions = vi.fn().mockResolvedValue({ error: false, result: { id: 12 } })
    render(<ResourcesSection app={imagesApp(resources)} updateBaseActions={updateBaseActions} />)

    await user.click(screen.getByRole('button', { name: 'Change Image 12' }))

    await waitFor(() => expect(mockState.showToast).toHaveBeenCalledWith('success', 'Correctly saved image'))
    expect(updateBaseActions.mock.calls[0][0].id).toBe(12)
    expect(updateBaseActions.mock.calls[0][0].body.get('source_file')).toBe(mockState.file)
  })
})

// The editor around the section, reduced to its state: the app and the setter the controller gives it
const ColorsHarness = ({ initial, updateBaseActions, onApp = () => {} }) => {
  const [app, setApp] = React.useState(initial)
  return (
    <ColorsSection
      app={app}
      updateBaseActions={updateBaseActions}
      updateAppValues={(next) => { onApp(next); setApp(next) }}
    />
  )
}

const colorsApp = () => ({
  id: 7,
  baseActions: [
    color(3, 'Primary color', '#aa0000'),
    color(4, 'Secondary color', '#00aa00'),
    image(1, 'general_images')
  ]
})

const trigger = (name) => screen.getByRole('button', { name: new RegExp(name) })

describe('ColorsSection', () => {
  it('paints one field per color, labelled and showing the stored value', () => {
    const { container } = render(<ColorsHarness initial={colorsApp()} updateBaseActions={vi.fn()} />)

    expect(container.firstChild.className).toBe('odc-api')
    expect(container.querySelector('.odc-api-colors')).not.toBeNull()
    expect(trigger('Primary color').getAttribute('data-color')).toBe('#aa0000')
    expect(trigger('Secondary color').getAttribute('data-color')).toBe('#00aa00')
    expect(screen.getByText('#aa0000')).toBeTruthy()
    expect(screen.queryAllByRole('button')).toHaveLength(2)
  })

  it('labels a color with the key of its name when the project has a translation', () => {
    mockState.texts.THEME_COLOR_PRIMARY_COLOR = 'Color principal'
    render(<ColorsHarness initial={colorsApp()} updateBaseActions={vi.fn()} />)

    expect(screen.getByText('Color principal')).toBeTruthy()
    expect(screen.getByText('Secondary color')).toBeTruthy()
  })

  it('paints nothing without colors', () => {
    const { container } = render(<ColorsHarness initial={{ id: 7, baseActions: [image(1, 'general_images')] }} updateBaseActions={vi.fn()} />)
    expect(container.firstChild).toBeNull()

    const none = render(<ColorsHarness initial={{ id: 7 }} updateBaseActions={vi.fn()} />)
    expect(none.container.firstChild).toBeNull()
  })

  it('saves as main does, updates the app without mutating it and says so', async () => {
    const user = userEvent.setup()
    const initial = colorsApp()
    const original = initial.baseActions
    const updateBaseActions = vi.fn().mockResolvedValue({ error: false, result: { id: 3, text_content: '#112233' } })
    const onApp = vi.fn()
    render(<ColorsHarness initial={initial} updateBaseActions={updateBaseActions} onApp={onApp} />)

    await user.click(trigger('Primary color'))

    await waitFor(() => expect(mockState.showToast).toHaveBeenCalledWith('success', 'Correctly saved color'))
    expect(updateBaseActions).toHaveBeenCalledTimes(1)
    expect(updateBaseActions).toHaveBeenCalledWith({ id: 3, type: 'colors', body: JSON.stringify({ text_content: '#112233' }) })

    expect(onApp).toHaveBeenCalledTimes(1)
    const next = onApp.mock.calls[0][0]
    expect(next).not.toBe(initial)
    expect(next.baseActions).not.toBe(original)
    expect(next.baseActions.map(action => [action.id, action.text_content])).toEqual([[3, '#112233'], [4, '#00aa00'], [1, undefined]])
    // what main kept in place is not touched
    expect(original[0].text_content).toBe('#aa0000')
    expect(initial.baseActions).toBe(original)

    await waitFor(() => expect(trigger('Primary color').getAttribute('data-color')).toBe('#112233'))
  })

  it('does not touch the app when the answer is not one of its colors', async () => {
    const user = userEvent.setup()
    const onApp = vi.fn()
    const updateBaseActions = vi.fn().mockResolvedValue({ error: false, result: { id: 999, text_content: '#112233' } })
    render(<ColorsHarness initial={colorsApp()} updateBaseActions={updateBaseActions} onApp={onApp} />)

    await user.click(trigger('Primary color'))

    await waitFor(() => expect(mockState.showToast).toHaveBeenCalledWith('success', 'Correctly saved color'))
    expect(onApp).not.toHaveBeenCalled()
  })

  it('disables only the color that is being saved', async () => {
    const user = userEvent.setup()
    let finish
    const updateBaseActions = vi.fn(() => new Promise((resolve) => { finish = resolve }))
    render(<ColorsHarness initial={colorsApp()} updateBaseActions={updateBaseActions} />)

    await user.click(trigger('Primary color'))

    expect(trigger('Primary color')).toBeDisabled()
    expect(trigger('Secondary color')).toBeEnabled()

    finish({ error: false, result: { id: 3, text_content: '#112233' } })
    await waitFor(() => expect(trigger('Primary color')).toBeEnabled())
  })

  it('shows the error in its field and keeps the color that was chosen', async () => {
    const user = userEvent.setup()
    mockState.texts.INVALID_COLOR_VALUE = 'Valor de color no válido'
    const onApp = vi.fn()
    const updateBaseActions = vi.fn().mockResolvedValue({ error: true, result: ['Invalid color value'] })
    render(<ColorsHarness initial={colorsApp()} updateBaseActions={updateBaseActions} onApp={onApp} />)

    await user.click(trigger('Primary color'))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Valor de color no válido')
    // the chosen color stays in the field (and in its text), not the stored one
    expect(trigger('Primary color').getAttribute('data-color')).toBe('#112233')
    expect(screen.getByText('#112233')).toBeTruthy()
    expect(trigger('Primary color')).toBeEnabled()
    expect(onApp).not.toHaveBeenCalled()
    expect(mockState.showToast).not.toHaveBeenCalled()
    // the other color has no error
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('says «error» when the answer has no message, and the message of a request that fails', async () => {
    const user = userEvent.setup()
    mockState.texts.NETWORK_DOWN = 'Sin red'
    const updateBaseActions = vi.fn()
      .mockResolvedValueOnce({ error: true, result: undefined })
      .mockRejectedValueOnce(new Error('Network down'))
    render(<ColorsHarness initial={colorsApp()} updateBaseActions={updateBaseActions} />)

    await user.click(trigger('Primary color'))
    expect((await screen.findByRole('alert')).textContent).toContain('An error has occurred')

    await user.click(trigger('Primary color'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Sin red'))
  })

  it('clears the error when another color is chosen', async () => {
    const user = userEvent.setup()
    const updateBaseActions = vi.fn()
      .mockResolvedValueOnce({ error: true, result: ['Invalid color value'] })
      .mockResolvedValueOnce({ error: false, result: { id: 3, text_content: '#445566' } })
    render(<ColorsHarness initial={colorsApp()} updateBaseActions={updateBaseActions} />)

    await user.click(trigger('Primary color'))
    await screen.findByRole('alert')

    mockState.nextColor = '#445566'
    await user.click(trigger('Primary color'))

    expect(screen.queryByRole('alert')).toBeNull()
    await waitFor(() => expect(mockState.showToast).toHaveBeenCalledWith('success', 'Correctly saved color'))
    expect(trigger('Primary color').getAttribute('data-color')).toBe('#445566')
    expect(within(screen.getByRole('group', { name: /Primary color/ })).queryByRole('alert')).toBeNull()
  })

  // redesign my-products R1-02: disabling the field while it saves drops the focus on <body>; it goes back to the field
  it('gives the focus back to the color field after a save that worked', async () => {
    const user = userEvent.setup()
    const updateBaseActions = vi.fn().mockResolvedValue({ error: false, result: { id: 3, text_content: '#112233' } })
    render(<ColorsHarness initial={colorsApp()} updateBaseActions={updateBaseActions} />)

    await user.click(trigger('Primary color'))
    await waitFor(() => expect(mockState.showToast).toHaveBeenCalledWith('success', 'Correctly saved color'))

    await waitFor(() => expect(document.activeElement).toBe(trigger('Primary color')))
  })

  it('gives the focus back to the color field after a save that failed', async () => {
    const user = userEvent.setup()
    const updateBaseActions = vi.fn().mockResolvedValue({ error: true, result: ['Invalid color value'] })
    render(<ColorsHarness initial={colorsApp()} updateBaseActions={updateBaseActions} />)

    await user.click(trigger('Primary color'))
    await screen.findByRole('alert')

    await waitFor(() => expect(document.activeElement).toBe(trigger('Primary color')))
  })

  it('does not take the focus from a control the user went to while the color saved', async () => {
    const user = userEvent.setup()
    let finish
    const updateBaseActions = vi.fn(() => new Promise((resolve) => { finish = resolve }))
    render(<ColorsHarness initial={colorsApp()} updateBaseActions={updateBaseActions} />)

    await user.click(trigger('Primary color'))
    trigger('Secondary color').focus()
    finish({ error: false, result: { id: 3, text_content: '#112233' } })
    await waitFor(() => expect(trigger('Primary color')).toBeEnabled())
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(document.activeElement).toBe(trigger('Secondary color'))
  })
})
