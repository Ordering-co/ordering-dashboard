/* eslint-disable import/first */
// redesign ordering-website B3b (; D5, D7): the Website sections of the editor after General: Layout, Images and
// Colors & content. Covered: the theme radio and the business select of Layout with its preview image (the franchise's header wins),
// the six image fields (five for a franchise) with their validation shown in the field and the three ways they write (the site's
// field with its mirror in the theme, or a path of `images`), the fullscreen checkbox, the two color fields, the two content dialogs
// with the real ContentForm (no title of its own inside a dialog that has one), and ContentForm as it was without `hideTitle`.
// The controller (B2) is a stand-in: its props are simulated. The image cropper (cropperjs needs a canvas), the color panel, the
// rich-text editor and the controller of ContentForm are stand-ins too; everything else is the real thing.
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders, defaultTheme } from '~/__tests__/helpers/testUtils'

const mockState = vi.hoisted(() => ({
  phone: false,
  cropProps: [],
  contentFormProps: null
}))

const translate = (_key, text) => text

vi.mock('../../../../../../../index', () => ({
  useLanguage: () => [{}, translate],
  useConfig: () => [{ configs: {} }],
  useApi: () => [{ project: 'demo' }, { configurations: { subdomain: 'orderingplus' } }],
  useSite: () => [{ sites: [] }],
  useSession: () => [{ user: { level: 0 } }],
  useUtils: () => [{ optimizeImage: (src) => src }],
  ExamineClick: ({ children }) => <>{children}</>,
  DragAndDrop: ({ children }) => <>{children}</>,
  OrderingWebsite: () => null,
  // The controller of ContentForm: it keeps the body in its form state and, on Accept or Delete, hands it to `handleChangeContent`
  // and closes (what the real one does: its own tests cover the rest).
  ContentForm: ({ UIComponent, ...props }) => {
    mockState.contentFormProps = props
    const [changes, setChanges] = React.useState({})
    return (
      <UIComponent
        {...props}
        imageListState={{ images: [], loading: false, error: null }}
        insertImageState={{ loading: false, change: {}, error: null }}
        formState={{ loading: false, changes, error: null }}
        selectedImageUrl={null}
        setSelectedImageUrl={() => {}}
        handleInsertImage={() => {}}
        handleDeleteImage={() => {}}
        handleChangeFormState={(field, value) => setChanges((current) => ({ ...current, [field]: value }))}
        handleSave={(value) => {
          props.handleChangeContent(props.type, value ?? changes.body)
          props.onClose()
        }}
        handleDelete={() => {
          props.handleChangeContent(props.type, '')
          props.onClose()
        }}
      />
    )
  }
}))
vi.mock('../../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => mockState.phone }))
// The cropper: it records its props and, on «Crop», emits a cropped image and closes, the way the real one does.
vi.mock('../../../../Shared/UI/ImageCrop', () => ({
  ImageCrop: (props) => {
    mockState.cropProps.push(props)
    return (
      <div data-testid='image-crop'>
        <button
          type='button'
          onClick={() => {
            props.handleChangePhoto('https://cdn.example.test/cropped.jpg')
            props.onClose?.()
          }}
        >
          Crop
        </button>
      </div>
    )
  }
}))
// The color panel: «Pick» emits a color after the picker's own delay.
vi.mock('react-color', () => ({
  SketchPicker: ({ color, onChange }) => (
    <div data-testid='sketch-picker' data-color={color}>
      <button type='button' onClick={() => onChange({ hex: '#112233' })}>Pick</button>
    </div>
  )
}))
// The rich-text editor: a text area that gives its text to `onChange`.
vi.mock('../../../../Shared/RichHtmlEditor', () => ({
  RichHtmlEditor: ({ value, onChange }) => <textarea aria-label='Rich text' value={value} onChange={(event) => onChange(event.target.value)} />
}))
// The legacy children the editor does not mount in these cases (their own tests cover them)
vi.mock('../../../AdvancedSettings', () => ({ AdvancedSettings: () => null }))
vi.mock('../../../OrderingWidgets', () => ({ OrderingWidgets: () => null }))
vi.mock('../../../CustomDomain', () => ({ CustomDomain: () => null }))
vi.mock('../../../WhiteLabelCustomDomain', () => ({ WhiteLabelCustomDomain: () => null }))
vi.mock('../../../WhiteLabelCustomDomain/WhiteLabelCustomDomainBlock', () => ({ WhiteLabelCustomDomainBlock: () => null }))
vi.mock('../../../../Settings', () => ({ FilterSettings: () => null }))

import { InfoShareContext } from '../../../../../contexts/InfoShareContext'
import { ProjectContext } from '../../../../../contexts/ProjectContext'
import { ContentForm } from '../../../ContentForm'
import { OrderingWebsiteUI } from '../../index'
import { buildSections } from '../sections'

const theme = {
  ...defaultTheme,
  images: {
    preview: { marketplace: 'marketplace.png', franchise: 'franchise.png', singleStore: 'single.png' },
    myProducts: { orderingWebsite: 'ordering-website.png' }
  }
}

const SITE = { id: 7, code: 'website', type: 'web_marketplace_26', name: 'Marketplace Website', description: 'Your awesome website', logo: 'site-logo.jpg', image: 'site-image.jpg' }
const CROPPED = 'https://cdn.example.test/cropped.jpg'

const makeThemeValues = () => ({
  website_theme: { components: { type: 'marketplace', business_slug: '', franchise_slug: '' } },
  images: {
    components: {
      logo: { components: { image: 'header-logo.jpg' } },
      logo_mobile: { components: { image: 'header-mobile.jpg' } },
      homepage_background: { components: { image: 'background.jpg' } },
      homepage_mobile_background: { components: { image: 'mobile-background.jpg' } },
      homepage_image_fullscreen: false
    }
  },
  theme_settings: {
    components: {
      style: { background_page: '#FFFFFF', primary_btn_color: '#FF5500' },
      values: { homepage_content: '<p>Welcome</p>', footer_content: '<p>Bye</p>' }
    }
  },
  website_settings: { components: { values: { name: SITE.name, description: SITE.description } } }
})

const BUSINESSES = [
  { id: 1, slug: 'burger-hub', name: 'Burger Hub', logo: 'burger.jpg' },
  { id: 2, slug: 'pizza-place', name: 'Pizza Place', logo: 'pizza.jpg' }
]

const makeProps = ({ themeValues = makeThemeValues(), ...overrides } = {}) => {
  return {
    layout: 'sections',
    orderingTheme: { loading: false, themes: [{ theme_id: 1, site_id: SITE.id }], error: null },
    themeValues,
    setThemeValues: vi.fn(),
    advancedValues: { my_products: { components: makeThemeValues() } },
    setAdvancedValues: vi.fn(),
    savedValues: { my_products: { components: makeThemeValues() } },
    savedSite: SITE,
    themesList: { loading: false, themes: [], error: null },
    site: SITE,
    setSite: vi.fn(),
    businessesList: { loading: false, businesses: BUSINESSES, error: null },
    franchisesList: { loading: false, franchises: [], error: null },
    handleChangeInput: vi.fn(),
    formState: { loading: false, changes: {}, error: null },
    handleUpdateSite: vi.fn(),
    handleUpdateSiteTheme: vi.fn(),
    handleSaveAll: vi.fn().mockResolvedValue({ ok: true }),
    discardChanges: vi.fn(),
    saving: false,
    appId: 'website',
    ...overrides
  }
}

const render = (props, section) => {
  const Wrapper = ({ children }) => (
    <ProjectContext.Provider value={[{ websiteProduct: 'web_marketplace_26' }, {}]}>
      <InfoShareContext.Provider value={[{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]}>
        {children}
      </InfoShareContext.Provider>
    </ProjectContext.Provider>
  )
  return renderWithProviders(<OrderingWebsiteUI {...props} />, {
    initialEntries: [`/my-products/ordering-website?section=${section}`],
    theme,
    wrapper: Wrapper
  })
}

const lastTheme = (props) => props.setThemeValues.mock.calls.at(-1)[0]
const previewSrc = () => document.querySelector('img.odc-ows-preview')?.getAttribute('src')
const imageGroups = () => [...document.querySelectorAll('.odc-image-field')]

beforeEach(() => {
  mockState.phone = false
  mockState.cropProps = []
  mockState.contentFormProps = null
})

describe('registry · the three sections have their component', () => {
  it('layout, images and colors_content are drawn, and their `match` places the changes they own', () => {
    const sections = buildSections({ t: translate })
    const byId = (id) => sections.find((section) => section.id === id)
    for (const id of ['layout', 'images', 'colors_content']) expect(typeof byId(id).Component).toBe('function')
    expect(byId('layout').match({ scope: 'theme', path: 'website_theme.type' })).toBe(true)
    expect(byId('images').match({ scope: 'theme', path: 'images.homepage_image_fullscreen' })).toBe(true)
    expect(byId('images').match({ scope: 'site', path: 'logo' })).toBe(true)
    expect(byId('colors_content').match({ scope: 'theme', path: 'theme_settings.values.footer_content' })).toBe(true)
  })
})

describe('Layout · theme and business (D5)', () => {
  it('the radio «Website Theme» writes `website_theme.type`', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(props, 'layout')
    const group = screen.getByRole('radiogroup', { name: 'Website Theme' })
    expect(within(group).getByRole('radio', { name: 'Marketplace' })).toHaveAttribute('aria-checked', 'true')
    expect(within(group).getByRole('radio', { name: 'Single Store' })).toHaveAttribute('aria-checked', 'false')
    await user.click(within(group).getByRole('radio', { name: 'Single Store' }))
    expect(lastTheme(props).website_theme.components.type).toBe('single_store')
    expect(props.themeValues.website_theme.components.type).toBe('marketplace')
  })

  it('with Marketplace there is no business select; with Single store it appears, named, and writes `business_slug`', async () => {
    const user = userEvent.setup()
    const marketplace = render(makeProps(), 'layout')
    expect(screen.queryByRole('group', { name: 'Business' })).toBeNull()
    expect(screen.queryByText('Select business')).toBeNull()
    marketplace.unmount()

    const themeValues = makeThemeValues()
    themeValues.website_theme.components.type = 'single_store'
    themeValues.website_theme.components.business_slug = 'burger-hub'
    const props = makeProps({ themeValues })
    render(props, 'layout')
    const field = screen.getByRole('group', { name: 'Business' })
    expect(within(field).getByText('Business')).toBeVisible()
    await user.click(within(field).getByText('Burger Hub'))
    await user.click(await screen.findByText('Pizza Place'))
    expect(lastTheme(props).website_theme.components.business_slug).toBe('pizza-place')
  })

  // redesign ordering-website review R1-03
  it('the business select is named by «Business» and its value', () => {
    const themeValues = makeThemeValues()
    themeValues.website_theme.components.type = 'single_store'
    themeValues.website_theme.components.business_slug = 'burger-hub'
    render(makeProps({ themeValues }), 'layout')
    const field = screen.getByRole('group', { name: 'Business' })
    const trigger = field.querySelector('[aria-labelledby]')
    expect(trigger).not.toBeNull()
    const names = trigger.getAttribute('aria-labelledby').split(' ').map(id => document.getElementById(id)?.textContent ?? '')
    expect(names[0]).toBe('Business')
    expect(names[1]).toContain('Burger Hub')
  })

  it('the preview is decorative and follows the type; the header of the chosen franchise wins', () => {
    const marketplace = render(makeProps(), 'layout')
    expect(previewSrc()).toBe('marketplace.png')
    expect(document.querySelector('img.odc-ows-preview')).toHaveAttribute('alt', '')
    marketplace.unmount()

    const single = makeThemeValues()
    single.website_theme.components.type = 'single_store'
    const second = render(makeProps({ themeValues: single }), 'layout')
    expect(previewSrc()).toBe('single.png')
    second.unmount()

    const franchise = makeThemeValues()
    franchise.website_theme.components.type = 'franchise'
    franchise.website_theme.components.franchise_slug = 9
    render(makeProps({
      themeValues: franchise,
      franchisesList: { loading: false, franchises: [{ id: 3, header: 'other.png' }, { id: 9, header: 'franchise-header.png' }], error: null }
    }), 'layout')
    expect(previewSrc()).toBe('franchise-header.png')
  })

  it('a franchise whose list is not there yet falls back to the preview of the type', () => {
    const franchise = makeThemeValues()
    franchise.website_theme.components.type = 'franchise'
    franchise.website_theme.components.franchise_slug = 9
    render(makeProps({ themeValues: franchise, franchisesList: { loading: true, franchises: undefined, error: null } }), 'layout')
    expect(previewSrc()).toBe('franchise.png')
  })

  it('a franchise or a forced site has no theme block (as in the legacy editor)', () => {
    render(makeProps({ isFranchise: true }), 'layout')
    expect(screen.queryByRole('radiogroup', { name: 'Website Theme' })).toBeNull()
  })
})

describe('Images · six fields (D5)', () => {
  const group = (name) => screen.getByRole('group', { name })

  it('draws six fields in order, each with its size and format hint (the size in `.odc-figure`)', () => {
    render(makeProps(), 'images')
    expect(imageGroups()).toHaveLength(6)
    expect(imageGroups().map((field) => field.querySelector('.odc-legacy-field-label-text').textContent)).toEqual([
      'Site logo', 'Header logo', 'Header mobile logo', 'Site image', 'Homepage background', 'Homepage mobile background'
    ])
    const sizes = ['512 × 512 px', '900 × 200 px', '512 × 512 px', '1920 × 1280 px', '1920 × 1280 px', '1440 × 770 px']
    imageGroups().forEach((field, index) => {
      expect(field.querySelector('.odc-legacy-field-hint .odc-figure')).toHaveTextContent(sizes[index])
      expect(field.querySelector('.odc-legacy-field-hint')).toHaveTextContent('Format: JPG, WEBP')
    })
  })

  it('a franchise has five: no «Site image»', () => {
    render(makeProps({ isFranchise: true }), 'images')
    expect(imageGroups()).toHaveLength(5)
    expect(screen.queryByRole('group', { name: 'Site image' })).toBeNull()
  })

  it('each field shows the image it has and names its «Change» button with the object', () => {
    render(makeProps(), 'images')
    expect(within(group('Site logo')).getByRole('img', { name: 'Site logo' })).toHaveAttribute('src', 'site-logo.jpg')
    expect(within(group('Header logo')).getByRole('img', { name: 'Header logo' })).toHaveAttribute('src', 'header-logo.jpg')
    expect(within(group('Homepage mobile background')).getByRole('img', { name: 'Homepage mobile background' })).toHaveAttribute('src', 'mobile-background.jpg')
    const change = within(group('Header mobile logo')).getByRole('button', { name: 'Change image of Header mobile logo' })
    expect(change).toHaveTextContent('Change')
    // the legacy editor could not remove an image: there is no «Remove»
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull()
  })

  it('a PNG gets the JPG/WEBP error in its field, and picking a valid file clears it', async () => {
    render(makeProps(), 'images')
    const field = group('Header logo')
    const input = field.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [new File(['pixels'], 'logo.png', { type: 'image/png' })] } })
    expect(await within(field).findByRole('alert')).toHaveTextContent('Only JPG and WEBP images can be accepted')
    expect(screen.queryByRole('dialog')).toBeNull()
    // the other fields are left alone
    expect(within(group('Site logo')).queryByRole('alert')).toBeNull()

    fireEvent.change(input, { target: { files: [new File(['pixels'], 'logo.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(within(field).queryByRole('alert')).toBeNull())
    expect(await screen.findByRole('dialog', { name: 'Image crop' })).toBeInTheDocument()
  })

  it('a file over 3 MB gets the size error in its field; 3 MB exactly goes on', async () => {
    render(makeProps(), 'images')
    const field = group('Homepage background')
    const input = field.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [new File([new Uint8Array(4 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' })] } })
    expect(await within(field).findByRole('alert')).toHaveTextContent('The maximum image size is 3 MB')
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.change(input, { target: { files: [new File([new Uint8Array(3 * 1024 * 1024)], 'limit.webp', { type: 'image/webp' })] } })
    await waitFor(() => expect(within(field).queryByRole('alert')).toBeNull())
    expect(await screen.findByRole('dialog', { name: 'Image crop' })).toBeInTheDocument()
  })

  it('the cropper gets the theme id and the Cloudinary option, and a square ratio only for the two square logos', async () => {
    const user = userEvent.setup()
    render(makeProps(), 'images')
    const ratios = {}
    for (const name of ['Site logo', 'Header logo', 'Header mobile logo', 'Site image', 'Homepage background', 'Homepage mobile background']) {
      const input = group(name).querySelector('input[type="file"]')
      fireEvent.change(input, { target: { files: [new File(['pixels'], 'photo.jpg', { type: 'image/jpeg' })] } })
      const dialog = await screen.findByRole('dialog', { name: 'Image crop' })
      const props = mockState.cropProps.at(-1)
      expect(props.themeId).toBe(1)
      expect(props.useCloudinaryUrl).toBe(true)
      ratios[name] = props.aspectRatio
      await user.click(within(dialog).getByRole('button', { name: 'Close' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    }
    expect(ratios).toEqual({
      'Site logo': 1,
      'Header logo': undefined,
      'Header mobile logo': 1,
      'Site image': undefined,
      'Homepage background': undefined,
      'Homepage mobile background': undefined
    })
  })

  it('the site logo goes to the controller as `logo` and is mirrored in the theme', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(props, 'images')
    fireEvent.change(group('Site logo').querySelector('input[type="file"]'), { target: { files: [new File(['pixels'], 'logo.jpg', { type: 'image/jpeg' })] } })
    await user.click(within(await screen.findByRole('dialog', { name: 'Image crop' })).getByRole('button', { name: 'Crop' }))
    expect(props.handleChangeInput).toHaveBeenCalledTimes(1)
    expect(props.handleChangeInput).toHaveBeenCalledWith({ target: { name: 'logo', value: CROPPED } })
    expect(lastTheme(props).website_settings.components.values.logo).toBe(CROPPED)
    expect(props.themeValues.website_settings.components.values.logo).toBeUndefined()
  })

  it('the site image goes as `image`, and in the dashboard it is not mirrored', async () => {
    const user = userEvent.setup()
    const props = makeProps({ isDashboard: true })
    render(props, 'images')
    fireEvent.change(group('Site image').querySelector('input[type="file"]'), { target: { files: [new File(['pixels'], 'site.jpg', { type: 'image/jpeg' })] } })
    await user.click(within(await screen.findByRole('dialog', { name: 'Image crop' })).getByRole('button', { name: 'Crop' }))
    expect(props.handleChangeInput).toHaveBeenCalledWith({ target: { name: 'image', value: CROPPED } })
    expect(props.setThemeValues).not.toHaveBeenCalled()
  })

  it.each([
    ['Header logo', (values) => values.images.components.logo.components.image],
    ['Header mobile logo', (values) => values.images.components.logo_mobile.components.image],
    ['Homepage background', (values) => values.images.components.homepage_background.components.image],
    ['Homepage mobile background', (values) => values.images.components.homepage_mobile_background.components.image]
  ])('«%s» writes its path under `images` and leaves the site alone', async (name, read) => {
    const user = userEvent.setup()
    const props = makeProps()
    render(props, 'images')
    fireEvent.change(group(name).querySelector('input[type="file"]'), { target: { files: [new File(['pixels'], 'photo.jpg', { type: 'image/jpeg' })] } })
    await user.click(within(await screen.findByRole('dialog', { name: 'Image crop' })).getByRole('button', { name: 'Crop' }))
    expect(read(lastTheme(props))).toBe(CROPPED)
    expect(read(props.themeValues)).not.toBe(CROPPED)
    expect(props.handleChangeInput).not.toHaveBeenCalled()
  })
})

describe('Images · homepage image fullscreen (OW-01)', () => {
  it('is one positive checkbox, named by its text, that writes `images.homepage_image_fullscreen`', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(props, 'images')
    const checkbox = screen.getByRole('checkbox', { name: 'Homepage image fullscreen' })
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect(checkbox).toHaveAttribute('aria-checked', 'false')
    await user.click(checkbox)
    expect(lastTheme(props).images.components.homepage_image_fullscreen).toBe(true)
  })

  it('shows what the theme has and turns it off', async () => {
    const user = userEvent.setup()
    const themeValues = makeThemeValues()
    themeValues.images.components.homepage_image_fullscreen = true
    const props = makeProps({ themeValues })
    render(props, 'images')
    const checkbox = screen.getByRole('checkbox', { name: 'Homepage image fullscreen' })
    expect(checkbox).toHaveAttribute('aria-checked', 'true')
    await user.click(checkbox)
    expect(lastTheme(props).images.components.homepage_image_fullscreen).toBe(false)
  })
})

describe('Colors · background and buttons (D7)', () => {
  const pick = async (user, name) => {
    await user.click(within(screen.getByRole('group', { name })).getByRole('button', { name: /^(Background color|Primary Color for Buttons)/ }))
    await user.click(await screen.findByRole('button', { name: 'Pick' }))
  }

  it('«Background color» writes `style.background_page`', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(props, 'colors_content')
    await pick(user, 'Background color')
    await waitFor(() => expect(props.setThemeValues).toHaveBeenCalled(), { timeout: 3000 })
    expect(lastTheme(props).theme_settings.components.style.background_page).toBe('#112233')
    expect(lastTheme(props).theme_settings.components.style.primary_btn_color).toBe('#FF5500')
  })

  it('«Primary Color for Buttons» writes `style.primary_btn_color`', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(props, 'colors_content')
    await pick(user, 'Primary Color for Buttons')
    await waitFor(() => expect(props.setThemeValues).toHaveBeenCalled(), { timeout: 3000 })
    expect(lastTheme(props).theme_settings.components.style.primary_btn_color).toBe('#112233')
    expect(lastTheme(props).theme_settings.components.style.background_page).toBe('#FFFFFF')
  })

  it('shows each color as text, and the background is #FFFFFF when the theme has none', () => {
    const themeValues = makeThemeValues()
    delete themeValues.theme_settings.components.style.background_page
    render(makeProps({ themeValues }), 'colors_content')
    expect(within(screen.getByRole('group', { name: 'Background color' })).getByText('#FFFFFF')).toHaveClass('odc-figure')
    expect(within(screen.getByRole('group', { name: 'Primary Color for Buttons' })).getByText('#FF5500')).toBeInTheDocument()
  })
})

describe('Content · homepage and footer (D7)', () => {
  const open = async (user, name) => {
    const edit = screen.getByRole('button', { name })
    await user.click(edit)
    return edit
  }

  it('two rows, each with an «Edit» button named with its content', () => {
    render(makeProps(), 'colors_content')
    const homepage = screen.getByRole('group', { name: 'Homepage Content' })
    const footer = screen.getByRole('group', { name: 'Footer Content' })
    expect(within(homepage).getByRole('button', { name: 'Edit Homepage Content' })).toHaveTextContent('Edit')
    expect(within(footer).getByRole('button', { name: 'Edit Footer Content' })).toHaveTextContent('Edit')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('«Edit Homepage Content» opens a dialog named «Home Page Content» with the editor and no title of its own', async () => {
    const user = userEvent.setup()
    render(makeProps(), 'colors_content')
    await open(user, 'Edit Homepage Content')
    const dialog = await screen.findByRole('dialog', { name: 'Home Page Content' })
    expect(dialog).toHaveAttribute('data-size', 'lg')
    // (#78): the class the SectionsEditor css widens to 70% of the viewport from 768px
    expect(dialog).toHaveClass('odc-ows-content-dialog')
    // the only heading is the dialog's own
    expect(within(dialog).getAllByRole('heading')).toHaveLength(1)
    expect(within(dialog).queryByRole('heading', { level: 1 })).toBeNull()
    expect(within(dialog).getByRole('textbox', { name: 'Rich text' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Accept' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(mockState.contentFormProps).toMatchObject({
      title: 'Home Page Content',
      content: '<p>Welcome</p>',
      type: 'homepage_content',
      hideTitle: true
    })
  })

  it('«Edit Footer Content» opens «Footer» with the footer content', async () => {
    const user = userEvent.setup()
    render(makeProps(), 'colors_content')
    await open(user, 'Edit Footer Content')
    expect(await screen.findByRole('dialog', { name: 'Footer' })).toBeInTheDocument()
    expect(mockState.contentFormProps).toMatchObject({ title: 'Footer', content: '<p>Bye</p>', type: 'footer_content', hideTitle: true })
  })

  it('Accept writes the content in `values.homepage_content` and closes', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(props, 'colors_content')
    await open(user, 'Edit Homepage Content')
    const dialog = await screen.findByRole('dialog', { name: 'Home Page Content' })
    const editor = within(dialog).getByRole('textbox', { name: 'Rich text' })
    expect(editor).toHaveValue('<p>Welcome</p>')
    await user.clear(editor)
    await user.type(editor, 'Hello')
    await user.click(within(dialog).getByRole('button', { name: 'Accept' }))
    expect(lastTheme(props).theme_settings.components.values.homepage_content).toBe('Hello')
    expect(lastTheme(props).theme_settings.components.values.footer_content).toBe('<p>Bye</p>')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('Accept without editing writes the same content back', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(props, 'colors_content')
    await open(user, 'Edit Footer Content')
    const dialog = await screen.findByRole('dialog', { name: 'Footer' })
    await user.click(within(dialog).getByRole('button', { name: 'Accept' }))
    expect(lastTheme(props).theme_settings.components.values.footer_content).toBe('<p>Bye</p>')
  })

  it('Delete empties `values.footer_content` and closes', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(props, 'colors_content')
    await open(user, 'Edit Footer Content')
    const dialog = await screen.findByRole('dialog', { name: 'Footer' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(lastTheme(props).theme_settings.components.values.footer_content).toBe('')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('closing the dialog returns the focus to its «Edit» button and writes nothing', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(props, 'colors_content')
    const edit = await open(user, 'Edit Homepage Content')
    const dialog = await screen.findByRole('dialog', { name: 'Home Page Content' })
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(edit).toHaveFocus())
    expect(props.setThemeValues).not.toHaveBeenCalled()
  })
})

describe('ContentForm · the title is opt-out', () => {
  const renderForm = (extra = {}) => renderWithProviders(
    <ContentForm title='Footer' content='' type='footer_content' handleChangeContent={vi.fn()} onClose={vi.fn()} {...extra} />,
    { theme }
  )

  it('without `hideTitle` it paints its own title, as before', () => {
    renderForm()
    expect(screen.getByRole('heading', { level: 1, name: 'Footer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
  })

  it('with `hideTitle` it paints none, and the editor and its buttons are the same', () => {
    renderForm({ hideTitle: true })
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Rich text' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })
})
