/* eslint-disable import/first */
// redesign ordering-website B4 (; D3, D7): the 22 Advanced sections and Widgets of the sections editor. Covered: what each
// section paints (the row of the spec, for a website, with and without `isFranchise`), the checkboxes of Advanced (D3: «checked =
// shown» only for the paths that end in `.hidden`), the controls of each type (position, color, input), the images with the rules of
// `ImageBox` and the error in the field, `matchAdvanced` and its drift against the lists of `AdvancedSettings/utils.js`, the opt-in
// `hideTitle` of `OrderingWidgets` and `CustomDomain`, and a smoke test of the legacy `AdvancedSettings` (it must paint as before).
// The controller is a stand-in (its props are simulated); the two legacy pickers that need a canvas or a color panel are stand-ins
// too (ImageCrop, ColorPicker). Everything else is the real thing.
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mockState = vi.hoisted(() => ({
  customDomainProps: null,
  cropProps: [],
  websiteUrl: 'https://v26-demo.orderingplus.com'
}))

const translate = (_key, text) => text

vi.mock('../../../../../../../index', () => ({
  useLanguage: () => [{}, translate],
  useConfig: () => [{ configs: {} }],
  useApi: () => [{ project: 'demo' }, { configurations: { subdomain: 'orderingplus' } }],
  useSite: () => [{ sites: [] }],
  useToast: () => [{}, { showToast: vi.fn() }],
  ToastType: { Error: 'error' },
  ExamineClick: ({ children }) => <>{children}</>,
  DragAndDrop: ({ children }) => <>{children}</>,
  // the custom domain controller: it hands the form what the real one gives it
  CustomDomain: (props) => {
    mockState.customDomainProps = props
    const { UIComponent, ...rest } = props
    return <UIComponent {...rest} formState={{ changes: {}, loading: false }} handleChangeFormState={vi.fn()} handleChangeCustomDomain={vi.fn()} />
  }
}))
vi.mock('../../../../../hooks/useWebsiteUrl', () => ({ useWebsiteUrl: () => mockState.websiteUrl }))
// the legacy pickers: the color panel and the cropper are stand-ins that record what they are given and emit one value
vi.mock('../../../../Shared/UI/ColorPicker', () => ({
  ColorPicker: ({ defaultColor, onChangeColor }) => (
    <button type='button' className='od-color-picker-trigger' data-color={defaultColor} onClick={() => onChangeColor('#112233')}>Pick</button>
  )
}))
vi.mock('../../../../Shared/UI/ImageCrop', () => ({
  ImageCrop: (props) => {
    mockState.cropProps.push(props)
    return (
      <div data-testid='image-crop'>
        <button
          type='button'
          onClick={() => {
            props.handleChangePhoto('https://cdn.example.test/cropped.jpg')
            props.onClose && props.onClose()
          }}
        >
          Crop
        </button>
      </div>
    )
  }
}))

import { InfoShareContext } from '../../../../../contexts/InfoShareContext'
import { ProjectContext } from '../../../../../contexts/ProjectContext'
import { AdvancedSettings } from '../../../AdvancedSettings'
import { CustomDomain } from '../../../CustomDomain'
import { OrderingWidgets } from '../../../OrderingWidgets'
import { AdvancedSection, ADVANCED_COMPONENTS } from '../AdvancedSection'
import { ADVANCED_SECTION_IDS, matchAdvanced, matchAdvancedSections, useAdvancedSectionConfig } from '../advancedSections'
import { GeneralSection } from '../GeneralSection'
import { buildSections } from '../sections'
import { WidgetsSection } from '../WidgetsSection'

const dashboardTheme = createDashboardTheme(theme)

const SHOWN_HINT = 'Checked items are shown on your website.'
const FAVICON_HINT = 'Optional. If you do not upload a custom favicon, the site logo is used in the browser tab.'

// What the project's theme says about the options of each `position` setting (themesList.themes[0].structure)
const THEMES = {
  loading: false,
  themes: [{
    id: 3,
    structure: {
      header: { components: { logo: { components: { layout: { position: { options: ['left', 'center'] } } } } } },
      business_view: { components: { products: { components: { product: { components: { image: { position: { options: ['left', 'right'] } } } } } } } }
    }
  }]
}

// The editor around a section, reduced to its state: `advancedValues` and the setter the controller gives it
const Harness = ({ sectionId, initial = {}, onWrite, ...rest }) => {
  const [advancedValues, setAdvancedValues] = React.useState(initial)
  return (
    <AdvancedSection
      sectionId={sectionId}
      advancedValues={advancedValues}
      setAdvancedValues={(next) => { onWrite(next); setAdvancedValues(next) }}
      themesList={THEMES}
      site={{ id: 1 }}
      {...rest}
    />
  )
}

const show = (sectionId, props = {}) => {
  const onWrite = vi.fn()
  const view = renderWithProviders(<Harness sectionId={sectionId} onWrite={onWrite} {...props} />, { theme: dashboardTheme })
  return { ...view, onWrite, last: () => onWrite.mock.calls.at(-1)?.[0] }
}

const texts = (selector) => [...document.querySelectorAll(selector)].map(node => node.textContent.trim())
const painted = () => ({
  fields: texts('.odc-field-label-text, .odc-legacy-field-label-text'),
  checks: screen.queryAllByRole('checkbox').map(node => node.textContent.trim()),
  h3: screen.queryAllByRole('heading', { level: 3 }).map(node => node.textContent.trim())
})
const form = () => document.querySelector('.odc-ows-form')

beforeEach(() => {
  mockState.customDomainProps = null
  mockState.cropProps = []
  mockState.websiteUrl = 'https://v26-demo.orderingplus.com'
})

// ── 1 · what each section paints ─────────────────────────────────────────────────────────────────────────────────────────────────

const REVIEW_DATE = 'Review date'
const ACTIVE_ORDERS = [
  'Business logo', 'Business name', 'Order number', 'Order date', 'Review order button', 'Reorder button', 'Favorite button',
  'Order status', 'Previous order block', 'Business tab', 'Products tab'
]
const ORDER_TYPES = ['Delivery', 'Pickup', 'Eat in', 'Curbside', 'Drive thru', 'Catering delivery', 'CATERING_PICKUP']

// For a website that is not a franchise (and has no forced site). `hint`: the section has checkboxes of `.hidden` paths.
const ROWS = {
  buttons: { fields: ['Button color', 'Border radius', 'Button text color'], checks: [], h3: [], hint: false },
  typography: { fields: [], checks: [], h3: [], hint: false, text: ['Font', 'Font primary weights'] },
  advanced_images: { fields: ['Business Logo dummy image', 'Product dummy image'], checks: [], h3: [], hint: false },
  favicon: { fields: ['Favicon'], checks: [], h3: [], hint: false, text: [FAVICON_HINT] },
  header: { fields: ['Background color', 'Logo Position'], checks: ['Language selector'], h3: [], hint: true },
  business_listing: {
    fields: ['Business listing image', 'Amount of businesses to display per row:'],
    checks: ['Business listing', 'Top / Sponsored business block', 'Categories block', 'Cities dropdown'],
    h3: [],
    hint: true
  },
  business_block: {
    fields: ['Default header when business has no banner'],
    checks: ['Logo', 'Header', 'Delivery Fee', 'Time', 'Distance', 'Reviews', 'Favorite button', 'Offer badge', 'Featured badge'],
    h3: [],
    hint: true
  },
  business_page: {
    fields: [],
    checks: [
      'Products from previous orders block', 'Near business block', 'Reviews', 'Customer comments', 'Ranking', 'Reviews date', 'Search',
      'Business logo', 'Business info icon', 'Business header', 'Business header reviews', 'Business popup reviews'
    ],
    h3: [],
    hint: true
  },
  business_information: {
    fields: [],
    checks: ['About', 'Description', 'Schedule', 'Location', 'Videos', 'Delivery time', 'Pickup time', 'Images', 'Address'],
    h3: [],
    hint: true
  },
  products_block: {
    fields: ['Position'],
    checks: ['Dummy image when no image', 'Description', 'Image', 'Add to cart button', 'Favorite'],
    h3: [],
    hint: true
  },
  reviews_popups: { fields: [], checks: [REVIEW_DATE], h3: [], hint: true },
  cart_header: {
    fields: ['Open strategy', 'Open strategy position'],
    checks: ['Business logo', 'Product image', 'Discount coupon', 'Comments'],
    h3: [],
    hint: true
  },
  checkout: { fields: [], checks: ['Business address', 'Map'], h3: [], hint: true },
  confirmation_page: { fields: [], checks: ['Date', 'Progress bar'], h3: ['Order block'], hint: true },
  popup_address: { fields: [], checks: ['Map', 'Internal number', 'Address notes', 'Icons'], h3: [], hint: true },
  my_account: { fields: [], checks: ['User image', 'Birthday', 'Languages', 'Address list'], h3: [], hint: true },
  my_orders: { fields: [], checks: ACTIVE_ORDERS, h3: ['Active Orders Block'], hint: true },
  menu_options: {
    fields: [],
    checks: ['Browse and search', 'Wallets', 'Promotions', 'Messages', 'Help', 'Security', 'My favorites'],
    h3: [],
    hint: true
  },
  popup_order_types: { fields: ['Title Menu options'], checks: [], h3: ORDER_TYPES, hint: false },
  third_party_code: { fields: ['Head', 'Body'], checks: [], h3: [], hint: false },
  smart_banners: { fields: ['Android id', 'Apple id'], checks: [], h3: [], hint: false },
  order_tracking: {
    fields: [],
    checks: ['Tracking-only site: show only the order tracking page (no menu, cart, login or store pages)'],
    h3: [],
    hint: false
  }
}

// For a franchise: the sections of `!isFranchise` are gone and the lists drop their `disabled` items (and gain the one for `!disabled: !isFranchise`)
const FRANCHISE_GONE = ['business_listing', 'checkout', 'popup_order_types', 'order_tracking']
const FRANCHISE_ROWS = {
  advanced_images: { fields: ['Product dummy image'], checks: [], h3: [], hint: false },
  business_block: { fields: [], checks: ['Delivery Fee', 'Time', 'Distance', 'Favorite button', 'Featured badge'], h3: [], hint: true },
  business_page: { fields: [], checks: [...ROWS.business_page.checks, 'Show first categories'], h3: [], hint: true },
  business_information: {
    fields: [],
    checks: ['About', 'Description', 'Schedule', 'Location', 'Delivery time', 'Pickup time', 'Address'],
    h3: [],
    hint: true
  },
  cart_header: { fields: [], checks: ['Business logo', 'Product image'], h3: [], hint: true },
  my_account: { fields: [], checks: ['User image', 'Languages', 'Address list'], h3: [], hint: true },
  menu_options: { fields: [], checks: ROWS.menu_options.checks.slice(1), h3: [], hint: true }
}

describe('1 · the 22 sections paint what the row of the spec says', () => {
  it('lists the 22 ids, in the order of the editor, and has a component for each one', () => {
    expect(ADVANCED_SECTION_IDS).toHaveLength(22)
    expect(Object.keys(ADVANCED_COMPONENTS)).toEqual(ADVANCED_SECTION_IDS)
    const registered = buildSections({ t: translate }).filter(section => section.group === 'advanced').map(section => section.id)
    expect(ADVANCED_SECTION_IDS).toEqual(registered)
    expect(Object.keys(ROWS)).toEqual(ADVANCED_SECTION_IDS)
  })

  it.each(Object.entries(ROWS))('%s', (id, expected) => {
    show(id)
    const { fields, checks, h3 } = painted()
    expect({ fields, checks, h3 }).toEqual({ fields: expected.fields, checks: expected.checks, h3: expected.h3 })
    ;(expected.text || []).forEach(text => expect(screen.getByText(text)).toBeInTheDocument())
    expect(screen.queryAllByText(SHOWN_HINT)).toHaveLength(expected.hint ? 1 : 0)
    // the frame draws the h2: a section paints none of its own, and no h1
    expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(0)
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0)
  })

  it('popup_order_types: seven order types with their title, description, call to action and image', () => {
    show('popup_order_types')
    expect(screen.getAllByPlaceholderText('Title')).toHaveLength(7)
    expect(screen.getAllByPlaceholderText('Description')).toHaveLength(7)
    expect(screen.getAllByPlaceholderText('Call to action')).toHaveLength(7)
    expect(screen.getAllByText('Order type image')).toHaveLength(7)
  })

  it.each(FRANCHISE_GONE)('with isFranchise, %s paints nothing', (id) => {
    show(id, { isFranchise: true })
    expect(form()).toBeNull()
  })

  it('with a forced site, buttons paints nothing', () => {
    show('buttons', { forcedSiteId: 5 })
    expect(form()).toBeNull()
  })

  it.each(Object.entries(FRANCHISE_ROWS))('with isFranchise, %s drops what is only for a project\'s own website', (id, expected) => {
    show(id, { isFranchise: true })
    expect(painted()).toEqual({ fields: expected.fields, checks: expected.checks, h3: expected.h3 })
  })

  it('advanced_images has no «Homepage image fullscreen» (it lives in Website › Images)', () => {
    show('advanced_images')
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByText('Homepage image fullscreen')).toBeNull()
  })

  it('favicon: the optional hint only without a favicon of its own, and a preview of 32 px of the one in use', () => {
    const view = show('favicon', { site: { id: 1, logo: 'https://cdn.example.test/logo.png' } })
    expect(screen.getByText(FAVICON_HINT)).toBeInTheDocument()
    const preview = screen.getByRole('img', { name: 'Favicon preview' })
    expect(preview).toHaveAttribute('src', 'https://cdn.example.test/logo.png')
    expect(preview).toHaveAttribute('width', '32')
    expect(preview).toHaveAttribute('height', '32')
    expect(screen.getByText('Currently looks like this.')).toBeInTheDocument()
    view.unmount()

    show('favicon', {
      site: { id: 1, logo: 'https://cdn.example.test/logo.png' },
      initial: { general: { components: { favicon: { components: { image: 'https://cdn.example.test/my-icon.png' } } } } }
    })
    expect(screen.queryByText(FAVICON_HINT)).toBeNull()
    expect(screen.getByRole('img', { name: 'Favicon preview' })).toHaveAttribute('src', 'https://cdn.example.test/my-icon.png')
  })

  it('favicon: a placeholder asset is no favicon, and with nothing to show there is no preview', () => {
    show('favicon', { site: { id: 1, logo: '/default-logo.png' } })
    expect(screen.getByText(FAVICON_HINT)).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Favicon preview' })).toBeNull()
  })

  it('typography is the legacy font group, unchanged: choosing a weight writes it at `general.components.fonts.primary.weights`', async () => {
    const user = userEvent.setup()
    const view = show('typography', { initial: { general: { components: { fonts: { primary: { name: 'Lobster', weights: [400] } } } } } })
    await user.click(screen.getByText('700 - Bold'))
    expect(view.last().general.components.fonts.primary.weights).toEqual([700])
  })

  it('popup_order_types: the legacy fields write under `order_types.components.<type>.components`', async () => {
    const user = userEvent.setup()
    const view = show('popup_order_types')
    await user.type(screen.getAllByPlaceholderText('Title')[0], 'X')
    expect(view.last().order_types.components.delivery.components.title).toBe('X')
    await user.type(screen.getByRole('textbox', { name: 'Title Menu options' }), 'Y')
    expect(view.last().order_types.components.title_menu).toBe('Y')
  })
})

// ── 2 · D3: the checkboxes ───────────────────────────────────────────────────────────────────────────────────────────────────────

describe('2 · D3 · the checkboxes of Advanced', () => {
  const language = (hidden) => ({ header: { components: { language_selector: { hidden } } } })

  it('«Language selector» is checked when it is not hidden, and unchecking it writes `hidden = true`', async () => {
    const user = userEvent.setup()
    const view = show('header', { initial: language(false) })
    const box = screen.getByRole('checkbox', { name: 'Language selector' })
    expect(box).toHaveAttribute('aria-checked', 'true')
    await user.click(box)
    expect(view.onWrite).toHaveBeenCalledTimes(1)
    expect(view.last().header.components.language_selector.hidden).toBe(true)
    expect(screen.getByRole('checkbox', { name: 'Language selector' })).toHaveAttribute('aria-checked', 'false')
  })

  it('a hidden one is unchecked, and checking it writes `hidden = false`', async () => {
    const user = userEvent.setup()
    const view = show('header', { initial: language(true) })
    const box = screen.getByRole('checkbox', { name: 'Language selector' })
    expect(box).toHaveAttribute('aria-checked', 'false')
    await user.click(box)
    expect(view.last().header.components.language_selector.hidden).toBe(false)
  })

  it('without a value it is shown (checked), and the path is created, without touching what was there', async () => {
    const user = userEvent.setup()
    const initial = { general: { components: { buttons: { color: '#123456' } } } }
    const view = show('header', { initial })
    const box = screen.getByRole('checkbox', { name: 'Language selector' })
    expect(box).toHaveAttribute('aria-checked', 'true')
    await user.click(box)
    expect(view.last().header.components.language_selector.hidden).toBe(true)
    expect(view.last().general.components.buttons.color).toBe('#123456')
    expect(initial).toEqual({ general: { components: { buttons: { color: '#123456' } } } })
  })

  it('the whole row toggles, and the checkbox is named by the setting (no «Hidden» word)', async () => {
    const user = userEvent.setup()
    const view = show('header', { initial: language(false) })
    await user.click(screen.getByText('Language selector'))
    expect(view.last().header.components.language_selector.hidden).toBe(true)
    expect(screen.queryByText('Hidden')).toBeNull()
  })

  it('order_tracking writes `tracking_settings.tracking_only` as it is, without inverting it', async () => {
    const user = userEvent.setup()
    const view = show('order_tracking', { initial: { tracking_settings: { tracking_only: false } } })
    const box = screen.getByRole('checkbox', { name: /^Tracking-only site/ })
    expect(box).toHaveAttribute('aria-checked', 'false')
    await user.click(box)
    expect(view.last().tracking_settings.tracking_only).toBe(true)
    expect(screen.getByRole('checkbox', { name: /^Tracking-only site/ })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('checkbox', { name: /^Tracking-only site/ }))
    expect(view.last().tracking_settings.tracking_only).toBe(false)
  })

  it('the first checkbox of business_listing, which has no name, takes the name of its section', async () => {
    const user = userEvent.setup()
    const view = show('business_listing', { initial: { business_listing_view: { hidden: false } } })
    const box = screen.getByRole('checkbox', { name: 'Business listing' })
    expect(box).toHaveAttribute('aria-checked', 'true')
    await user.click(box)
    expect(view.last().business_listing_view.hidden).toBe(true)
  })

  it('a setting of another path in the same list does not move when one is toggled', async () => {
    const user = userEvent.setup()
    const view = show('business_listing', { initial: { business_listing_view: { hidden: false, components: { cities: { hidden: true } } } } })
    expect(screen.getByRole('checkbox', { name: 'Cities dropdown' })).toHaveAttribute('aria-checked', 'false')
    await user.click(screen.getByRole('checkbox', { name: 'Categories block' }))
    expect(view.last().business_listing_view.components.categories.hidden).toBe(true)
    expect(view.last().business_listing_view.components.cities.hidden).toBe(true)
    expect(view.last().business_listing_view.hidden).toBe(false)
  })
})

// ── 3 · position, color and input ────────────────────────────────────────────────────────────────────────────────────────────────

describe('3 · position, color and input', () => {
  it('position: a C18 select with its visible label, the options of the theme, and it writes the one chosen', async () => {
    const user = userEvent.setup()
    const view = show('products_block', {
      initial: { business_view: { components: { products: { components: { product: { components: { image: { position: 'left' } } } } } } } }
    })
    const trigger = screen.getByRole('button', { name: 'Position left' })
    expect(document.querySelector('.od-first-select-root')).toHaveAttribute('data-fit', 'trigger')
    await user.click(trigger)
    expect(screen.getAllByRole('option').map(option => option.textContent.trim())).toEqual(['left', 'right'])
    await user.click(screen.getByRole('option', { name: 'right' }))
    expect(view.last().business_view.components.products.components.product.components.image.position).toBe('right')
  })

  it('position: a click on its label puts the focus on the select, and a theme without options leaves it empty', async () => {
    const user = userEvent.setup()
    show('cart_header')
    await user.click(screen.getByText('Open strategy'))
    expect(screen.getAllByRole('button', { name: /^Open strategy/ })[0]).toHaveFocus()
    await user.click(screen.getAllByRole('button', { name: /^Open strategy/ })[0])
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('color: the picker starts at the stored value (or #2C7BE5 without one) and writes the hex it emits', async () => {
    const user = userEvent.setup()
    const view = show('buttons', { initial: { general: { components: { buttons: { buttonTextColor: '#FF0000' } } } } })
    expect(screen.getByRole('button', { name: /^Button color/ })).toHaveAttribute('data-color', '#2C7BE5')
    expect(screen.getByRole('button', { name: /^Button text color/ })).toHaveAttribute('data-color', '#FF0000')
    await user.click(screen.getByRole('button', { name: /^Button color/ }))
    expect(view.last().general.components.buttons.color).toBe('#112233')
    expect(view.last().general.components.buttons.buttonTextColor).toBe('#FF0000')
  })

  it('input: a controlled text field that writes what is typed', async () => {
    const user = userEvent.setup()
    const view = show('buttons', { initial: { general: { components: { buttons: { borderRadius: '4' } } } } })
    const field = screen.getByRole('textbox', { name: 'Border radius' })
    expect(field).toHaveValue('4')
    await user.type(field, '8')
    expect(view.last().general.components.buttons.borderRadius).toBe('48')
    expect(screen.getByRole('textbox', { name: 'Border radius' })).toHaveValue('48')
  })

  it('input: an empty one is an empty text, and the third-party code is written at its path', async () => {
    const user = userEvent.setup()
    const view = show('third_party_code')
    expect(screen.getByRole('textbox', { name: 'Head' })).toHaveValue('')
    await user.type(screen.getByRole('textbox', { name: 'Body' }), 'ab')
    expect(view.last().third_party_code.body).toBe('ab')
  })
})

// ── 4 · images ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('4 · images · the rules of ImageBox for a website, with the error in the field', () => {
  const PRODUCT_IMAGE = 'business_view.components.products.components.photo.components.dummy_image'
  // `hidden`: while the crop dialog is open the page behind it is inert
  const field = () => screen.getByRole('group', { name: 'Product dummy image', hidden: true })
  const input = () => field().querySelector('input[type="file"]')
  const jpg = (name = 'photo.jpg', type = 'image/jpeg', bytes = 8) => new File([new Uint8Array(bytes)], name, { type })
  const MEGABYTE = 1024 * 1024

  it('accepts JPG and WEBP, in the picker and as a hint of the field', () => {
    show('advanced_images')
    expect(input()).toHaveAttribute('accept', 'image/jpeg, image/jpg, image/webp')
    expect(field()).toHaveTextContent('900 x 200 px')
    expect(field()).toHaveTextContent('Format: JPG, WEBP')
    expect(screen.getByRole('button', { name: 'Change image of Product dummy image' })).toBeInTheDocument()
  })

  it('a PNG gets the extension error in its field, and nothing is written or cropped', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const view = show('advanced_images')
    await user.upload(input(), jpg('photo.png', 'image/png'))
    expect(within(field()).getByRole('alert')).toHaveTextContent('Invalid file type. Allowed format is JPG, WEBP')
    expect(screen.queryByTestId('image-crop')).toBeNull()
    expect(view.onWrite).not.toHaveBeenCalled()
    // the other image is not touched by it
    expect(within(screen.getByRole('group', { name: 'Business Logo dummy image' })).queryByRole('alert')).toBeNull()
  })

  it('a file that is not an image gets the type error', async () => {
    const user = userEvent.setup({ applyAccept: false })
    show('advanced_images')
    await user.upload(input(), jpg('notes.jpg', 'text/plain'))
    expect(within(field()).getByRole('alert')).toHaveTextContent('Only images can be accepted')
  })

  it('a file over 3 MB gets the size error with «3 MB»', async () => {
    const user = userEvent.setup({ applyAccept: false })
    show('advanced_images')
    await user.upload(input(), jpg('big.jpg', 'image/jpeg', 4 * MEGABYTE))
    expect(within(field()).getByRole('alert')).toHaveTextContent('The maximum image size is 3 MB')
  })

  it('«.jpeg» is JPG, and a valid file clears the error and goes to the crop with Cloudinary and the theme', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const view = show('advanced_images')
    await user.upload(input(), jpg('big.jpg', 'image/jpeg', 4 * MEGABYTE))
    expect(within(field()).getByRole('alert')).toBeInTheDocument()
    await user.upload(input(), jpg('photo.JPEG'))
    expect(within(field()).queryByRole('alert', { hidden: true })).toBeNull()
    const crop = await screen.findByTestId('image-crop')
    expect(crop).toBeInTheDocument()
    expect(mockState.cropProps.at(-1)).toMatchObject({ useCloudinaryUrl: true, themeId: 3 })
    await user.click(within(crop).getByRole('button', { name: 'Crop' }))
    expect(view.last().business_view.components.products.components.photo.components.dummy_image).toBe('https://cdn.example.test/cropped.jpg')
    expect(PRODUCT_IMAGE.split('.').reduce((node, key) => node?.[key], view.last())).toBe('https://cdn.example.test/cropped.jpg')
    await waitFor(() => expect(field().querySelector('img')).toHaveAttribute('src', 'https://cdn.example.test/cropped.jpg'))
  })

  it('an image of a list (Business listing image) has the same rules', async () => {
    const user = userEvent.setup({ applyAccept: false })
    show('business_listing')
    const listing = screen.getByRole('group', { name: 'Business listing image' })
    await user.upload(listing.querySelector('input[type="file"]'), jpg('photo.png', 'image/png'))
    expect(within(listing).getByRole('alert')).toHaveTextContent('Invalid file type. Allowed format is JPG, WEBP')
  })
})

// ── 5 · matchAdvanced ────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('5 · matchAdvanced', () => {
  it.each([
    ['header.components.language_selector.hidden', 'header'],
    ['header.components.style.backgroundColor', 'header'],
    ['general.components.buttons.color', 'buttons'],
    ['general.components.fonts.primary.weights', 'typography'],
    ['general.components.favicon.components.image', 'favicon'],
    ['business_view.components.header.components.logo.dummy_image', 'advanced_images'],
    ['business_view.components.products.components.photo.components.dummy_image', 'advanced_images'],
    ['business_view.components.header.components.dummy_image', 'business_block'],
    ['business_view.components.header.components.logo.hidden', 'business_page'],
    ['business_view.components.header.hidden', 'business_page'],
    ['business_listing_view.hidden', 'business_listing'],
    ['business_listing_view.components.business.components.fee.hidden', 'business_block'],
    ['business_view.components.information.components.about.hidden', 'business_information'],
    ['business_view.components.products.components.add_to_cart_button.hidden', 'products_block'],
    ['header.components.cart.components.comments.hidden', 'cart_header'],
    ['checkout.components.map.hidden', 'checkout'],
    ['confirmation.components.order.components.date.hidden', 'confirmation_page'],
    ['address.components.map.hidden', 'popup_address'],
    ['profile.components.languages.hidden', 'my_account'],
    ['orders.components.business_tab.hidden', 'my_orders'],
    ['bar_menu.components.wallet.hidden', 'menu_options'],
    ['order_types.components.title_menu', 'popup_order_types'],
    ['order_types.components.delivery.components.image', 'popup_order_types'],
    ['third_party_code.head', 'third_party_code'],
    ['smart_banner_settings.apple_id', 'smart_banners'],
    ['tracking_settings.tracking_only', 'order_tracking']
  ])('%s → %s', (path, id) => {
    expect(matchAdvanced(path)).toBe(id)
    expect(matchAdvancedSections(path)).toContain(id)
  })

  it('a path no section owns belongs to none (the theme of Website, a made-up one)', () => {
    expect(matchAdvanced('my_products.components.images.components.homepage_image_fullscreen')).toBeNull()
    expect(matchAdvanced('something.else')).toBeNull()
    expect(matchAdvancedSections('something.else')).toEqual([])
  })

  it('a path is not owned by a sibling that only shares its start', () => {
    expect(matchAdvanced('general.components.buttons_other')).toBeNull()
    expect(matchAdvanced('order_types_extra.x')).toBeNull()
  })

  it('a setting shown in two sections (the review date) belongs to both, and matchAdvanced names the first', () => {
    const path = 'business_view.components.reviews.components.review_date.hidden'
    expect(matchAdvancedSections(path)).toEqual(['business_page', 'reviews_popups'])
    expect(matchAdvanced(path)).toBe('business_page')
  })

  it('every path of every list of utils.js (and of the images) is owned by the section that paints it', () => {
    const { result } = renderHook(() => useAdvancedSectionConfig({ isFranchise: true }))
    const franchise = result.current
    const full = renderHook(() => useAdvancedSectionConfig({ isFranchise: false })).result.current
    const owned = []
    ADVANCED_SECTION_IDS.forEach((id) => {
      const section = full[id]
      expect(section).toBeTruthy()
      section.blocks.forEach((block) => {
        if (block.kind === 'list') block.list.forEach(item => owned.push([id, item.path]))
        else if (block.path) owned.push([id, block.path])
      })
      // a franchise paints no more than a website does
      expect(franchise[id].blocks.length).toBeLessThanOrEqual(section.blocks.length)
    })
    expect(owned.length).toBeGreaterThan(90)
    owned.forEach(([id, path]) => expect(matchAdvancedSections(path), `${id} · ${path}`).toContain(id))
  })

  it('the config says which sections a franchise or a forced site does not have', () => {
    const franchise = renderHook(() => useAdvancedSectionConfig({ isFranchise: true })).result.current
    expect(ADVANCED_SECTION_IDS.filter(id => !franchise[id].enabled)).toEqual(FRANCHISE_GONE)
    const forced = renderHook(() => useAdvancedSectionConfig({ forcedSiteId: 5 })).result.current
    expect(ADVANCED_SECTION_IDS.filter(id => !forced[id].enabled)).toEqual(['buttons'])
    const own = renderHook(() => useAdvancedSectionConfig({})).result.current
    expect(ADVANCED_SECTION_IDS.filter(id => !own[id].enabled)).toEqual([])
  })
})

// ── 6 · hideTitle · Widgets and the custom domain ────────────────────────────────────────────────────────────────────────────────

describe('6 · hideTitle', () => {
  const renderWidgets = (props, { collapsed = false } = {}) => renderWithProviders(
    <InfoShareContext.Provider value={[{ isCollapse: collapsed }, { handleMenuCollapse: vi.fn() }]}>
      <OrderingWidgets {...props} />
    </InfoShareContext.Provider>,
    { theme: dashboardTheme }
  )

  it('OrderingWidgets without hideTitle has its h1 (as before)', () => {
    renderWidgets({})
    expect(screen.getByRole('heading', { level: 1, name: 'Ordering Widgets' })).toBeInTheDocument()
    renderWidgets({ hideSideBar: true })
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(2)
  })

  it('OrderingWidgets with hideTitle has no h1 and no menu button, and keeps its content', () => {
    renderWidgets({ hideSideBar: true, hideTitle: true })
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.getAllByRole('heading', { level: 2 }).map(node => node.textContent)).toEqual([
      'Integration on your website: Popup',
      'Integration on your website: Inline'
    ])
    expect(screen.getAllByPlaceholderText('Code').length).toBeGreaterThan(0)
  })

  it('OrderingWidgets: the menu button of a folded menu is the title\'s, so hideTitle takes it too; without it it is there', () => {
    const { unmount } = renderWidgets({}, { collapsed: true })
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0)
    unmount()
    renderWidgets({ hideTitle: true }, { collapsed: true })
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('WidgetsSection is OrderingWidgets without its h1', () => {
    renderWithProviders(
      <InfoShareContext.Provider value={[{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]}>
        <WidgetsSection advancedValues={{}} />
      </InfoShareContext.Provider>,
      { theme: dashboardTheme }
    )
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2)
  })

  it('CustomDomain without hideTitle has its h1 «Custom domain» (as before)', () => {
    renderWithProviders(<CustomDomain site={{}} setSite={vi.fn()} onClose={vi.fn()} />, { theme: dashboardTheme })
    expect(screen.getByRole('heading', { level: 1, name: 'Custom domain' })).toBeInTheDocument()
  })

  it('CustomDomain with hideTitle has no h1 and keeps the rest of the form', () => {
    renderWithProviders(<CustomDomain site={{}} setSite={vi.fn()} onClose={vi.fn()} hideTitle />, { theme: dashboardTheme })
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.getByText('Domain')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('www.yourdomain.com')).toBeInTheDocument()
    expect(screen.getByText('I have my Google Maps API Key, I want to share it')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  // redesign ordering-website review R1-04
  it('CustomDomain: the button that copies the CNAME is named «Copy»', () => {
    renderWithProviders(<CustomDomain site={{}} setSite={vi.fn()} onClose={vi.fn()} hideTitle />, { theme: dashboardTheme })
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  })

  it('the dialog of the custom domain in General passes hideTitle: the dialog gives the title, the form has no h1', async () => {
    const user = userEvent.setup()
    const props = {
      site: { id: 7, name: 'Site', description: 'd' },
      setSite: vi.fn(),
      handleChangeInput: vi.fn(),
      themeValues: {},
      setThemeValues: vi.fn(),
      formState: { loading: false, changes: {} },
      handleUpdateSite: vi.fn(),
      isFranchise: false
    }
    renderWithProviders(
      <ProjectContext.Provider value={[{ websiteProduct: 'web_marketplace_26' }, {}]}>
        <GeneralSection {...props} />
      </ProjectContext.Provider>,
      { theme: dashboardTheme }
    )
    await user.click(screen.getByRole('button', { name: 'Request custom domain' }))
    const dialog = await screen.findByRole('dialog', { name: 'Custom domain' })
    expect(mockState.customDomainProps.hideTitle).toBe(true)
    expect(within(dialog).queryByRole('heading', { level: 1 })).toBeNull()
    expect(within(dialog).getByPlaceholderText('www.yourdomain.com')).toBeInTheDocument()
  })
})

// ── 7 · the legacy AdvancedSettings paints as before ─────────────────────────────────────────────────────────────────────────────

describe('7 · AdvancedSettings (legacy) paints as before', () => {
  const props = (overrides = {}) => ({
    themesList: THEMES,
    advancedValues: {},
    setAdvancedValues: vi.fn(),
    handleUpdateSiteTheme: vi.fn(),
    ...overrides
  })
  const render = (overrides) => renderWithProviders(<AdvancedSettings {...props(overrides)} />, { theme: dashboardTheme })
  const count = (level) => screen.queryAllByRole('heading', { level }).length
  const boxes = () => document.querySelectorAll('svg.bi-square, svg.bi-check-square-fill').length

  it('a website: one h1, the h2 of the sections, the h3 of their blocks and the «Hidden» boxes', () => {
    render({})
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Website Advanced Settings')
    expect({ h1: count(1), h2: count(2), h3: count(3), boxes: boxes() }).toEqual({ h1: 1, h2: 18, h3: 13, boxes: 77 })
    expect(screen.getAllByText('Hidden')).toHaveLength(75)
    expect(screen.getByText('Homepage image fullscreen')).toBeInTheDocument()
  })

  it('a website of a franchise: no listing, checkout, order types or tracking', () => {
    render({ isFranchise: true })
    expect({ h1: count(1), h2: count(2), h3: count(3) }).toEqual({ h1: 1, h2: 14, h3: 6 })
    expect(screen.queryByText('Homepage image fullscreen')).toBeNull()
  })

  it('a customer app', () => {
    render({ isApp: true })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Customer App Advanced Settings')
    expect({ h1: count(1), h2: count(2), h3: count(3) }).toEqual({ h1: 1, h2: 17, h3: 13 })
    expect(screen.queryByText('Order tracking')).toBeNull()
    expect(screen.queryByText('Menu options')).toBeNull()
  })
})
