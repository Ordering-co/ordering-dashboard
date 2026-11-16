import { useLanguage } from '../../../../../../index'
import { AdvancedSettingsUtilities } from '../../AdvancedSettings/utils'

// redesign ordering-website B4 (D3): what each of the 22 Advanced sections paints, and which section a changed path of the
// Advanced draft belongs to. The content, the order and the conditions are those of MyProducts/AdvancedSettings/index.js for a
// website (no app, no kiosk): same lists (utils.js), same texts and fallbacks. The sections editor draws the h2 of each section;
// the subtitles (h3) of the legacy page are blocks here.
//
// A section is `{ id, enabled, blocks }`. `enabled` says whether a website of this kind has it (the registry of sections.js leaves
// the others out of the navigation too). A block is one of:
//   { kind: 'list', list, fallbackName? }   a list of utils.js: `{ name, type, path, disabled }` (the `disabled` ones are not painted);
//                                           `fallbackName` names the checkbox that has no name of its own
//   { kind: 'image', title, ratio, path }   a lone image
//   { kind: 'heading', text }               an h3
//   { kind: 'typography', path }            the legacy font group
//   { kind: 'favicon', title, ratio, path } the favicon image with its optional hint and its preview
//   { kind: 'order_types', path, titleField: { label, path }, types: [{ key, title }] }   the title of the menu and the order types
//   { kind: 'app_design', label, path, options: [{ value, label }] }   the layout of a Maweja app (`<path>.type`), apps only

/** The ids of the Advanced sections, in the order of the navigation (the same as buildSections in sections.js). */
export const ADVANCED_SECTION_IDS = [
  'buttons',
  'typography',
  'advanced_images',
  'favicon',
  'header',
  'business_listing',
  'business_block',
  'business_page',
  'business_information',
  'products_block',
  'reviews_popups',
  'cart_header',
  'checkout',
  'confirmation_page',
  'popup_address',
  'my_account',
  'my_orders',
  'menu_options',
  'popup_order_types',
  'third_party_code',
  'smart_banners',
  'order_tracking'
]

// the Advanced sections of an app (My products › an app of AppEditor/sections.js CODES_WITH_THEMES), in the order of
// AdvancedSettings/index.js with `isApp`: the app design (Maweja) and the homepage first (AS:131-157), no «Menu options» (AS:403) nor
// «Order tracking» (AS:513), and «Navigation bar menu» (AS:487) before «Smart banners» (AS:501).
export const APP_ADVANCED_SECTION_IDS = [
  'app_design',
  'homepage',
  ...ADVANCED_SECTION_IDS.slice(0, ADVANCED_SECTION_IDS.indexOf('menu_options')),
  'popup_order_types',
  'third_party_code',
  'navigation_bar',
  'smart_banners'
]

/**
 * The Advanced sections an app has, in order: the conditions of AdvancedSettings/index.js with `isApp`. A kiosk has the homepage only
 * (AS:158); the app design is for a Maweja project's own app (AS:119); smart banners only for a franchise app (AS:501).
 * @param {{ isKiosk?: boolean, isFranchise?: boolean, isMaweja?: boolean }} options
 */
export const appAdvancedSectionIds = ({ isKiosk = false, isFranchise = false, isMaweja = false } = {}) => {
  if (isKiosk) return ['homepage']
  const gone = [
    ...(isMaweja && !isFranchise ? [] : ['app_design']),
    ...(isFranchise ? ['business_listing', 'checkout', 'popup_order_types'] : ['smart_banners'])
  ]
  return APP_ADVANCED_SECTION_IDS.filter(id => !gone.includes(id))
}

/** The name of each Advanced section (its h2 and its row in the navigation), by id. Literal calls, so the key scanner sees every key. */
export const advancedSectionLabels = (t) => ({
  app_design: t('APP_DESIGN', 'App design'),
  homepage: t('HOMEPAGE', 'Homepage'),
  buttons: t('BUTTONS', 'Buttons'),
  typography: t('TIPOGRAPHY', 'Typography'),
  advanced_images: t('IMAGES', 'Images'),
  favicon: t('FAVICON', 'Favicon'),
  header: t('HEADER', 'Header'),
  business_listing: t('BUSINESS_LISTING', 'Business listing'),
  business_block: t('BUSINESS_BLOCK', 'Business block'),
  business_page: t('BUSINESS_PAGE', 'Business page'),
  business_information: t('BUSINESS_INFORMATION', 'Business Information'),
  products_block: t('PRODUCTS_BLOCK', 'Products block'),
  reviews_popups: t('REVIEWS_POPUPS', 'Reviews popups'),
  cart_header: t('CART_HEADER', 'Cart Header'),
  checkout: t('CHECKOUT', 'Checkout'),
  confirmation_page: t('CONFIRMATION_PAGE', 'Confirmation page'),
  popup_address: t('POPUP_ADDRESS', 'Popup: Address'),
  my_account: t('MY_ACCOUNT_PAGE', 'My account page'),
  my_orders: t('MY_ORDERS', 'My orders'),
  menu_options: t('MENU_OPTIONS', 'Menu options'),
  popup_order_types: t('POPUP_ORDER_TYPES', 'Popup: Order types '),
  third_party_code: t('THIRD_PARTY_CODE', 'Third-party code'),
  navigation_bar: t('NAVIGATION_BAR_MENU', 'Navigation bar menu'),
  smart_banners: t('SMART_BANNER_SETTINGS', 'Smart banners settings'),
  order_tracking: t('TRACKING_SETTINGS', 'Order tracking')
})

const BUSINESS_LOGO_DUMMY = 'business_view.components.header.components.logo.dummy_image'
const PRODUCT_DUMMY = 'business_view.components.products.components.photo.components.dummy_image'
const BUSINESS_HEADER_DUMMY = 'business_view.components.header.components.dummy_image'

// The paths a section owns: a path is the section's when it is one of these or under one (`a.b` owns `a.b.c`, not `a.bc`). They are the
// paths of the lists of utils.js, grouped under the roots only that section edits, plus the images and the groups of the section.
// `reviews_popups` shares its review date with «Business page»: a path may belong to two sections (see matchAdvancedSections).
const SECTION_PATHS = {
  buttons: ['general.components.buttons'],
  typography: ['general.components.fonts'],
  advanced_images: [BUSINESS_LOGO_DUMMY, PRODUCT_DUMMY],
  favicon: ['general.components.favicon'],
  header: ['header.components.style', 'header.components.logo', 'header.components.language_selector'],
  business_listing: ['business_listing_view.hidden', 'business_listing_view.components.business_hero', 'business_listing_view.components.highest_rated_business_block', 'business_listing_view.components.categories', 'business_listing_view.components.layout', 'business_listing_view.components.cities'],
  business_block: ['business_listing_view.components.business', BUSINESS_HEADER_DUMMY],
  business_page: [
    'business_view.components.products_ordered',
    'business_view.components.near_business',
    'business_view.components.reviews',
    'business_view.components.header.components.logo.hidden',
    'business_view.components.header.components.business_info',
    'business_view.components.header.hidden',
    'business_view.components.header.components.business',
    'business_view.components.header.components.reviews',
    'business_view.components.categories'
  ],
  business_information: ['business_view.components.information'],
  products_block: ['business_view.components.products.components.product', 'business_view.components.products.components.add_to_cart_button'],
  reviews_popups: ['business_view.components.reviews.components.review_date'],
  cart_header: ['header.components.cart'],
  checkout: ['checkout'],
  confirmation_page: ['confirmation'],
  popup_address: ['address'],
  my_account: ['profile'],
  my_orders: ['orders'],
  menu_options: ['bar_menu'],
  popup_order_types: ['order_types'],
  third_party_code: ['third_party_code'],
  smart_banners: ['smart_banner_settings'],
  order_tracking: ['tracking_settings']
}

const underPath = (path, root) => path === root || path.startsWith(`${root}.`)

/**
 * Every section a changed path of `advancedValues` belongs to, in the order of the navigation (usually one; the review date is shown in
 * two). `[]` for a path no Advanced section owns (the theme of Website under `my_products`, for one).
 */
export const matchAdvancedSections = (path) => {
  if (typeof path !== 'string') return []
  return ADVANCED_SECTION_IDS.filter(id => SECTION_PATHS[id].some(root => underPath(path, root)))
}

/** The section a changed path belongs to (the first one when it is in two), or `null`. */
export const matchAdvanced = (path) => matchAdvancedSections(path)[0] ?? null

const list = (items, extra) => ({ kind: 'list', list: items, ...extra })
const heading = (text) => ({ kind: 'heading', text })

/**
 * What each Advanced section paints, by id: `{ [id]: { id, enabled, blocks } }`. A hook: the texts come from `useLanguage` (through the
 * lists of utils.js, which are `AdvancedSettingsUtilities({ isFranchise })`). With `isApp` a section is enabled when the
 * app has it (appAdvancedSectionIds) and «Images» keeps the «Homepage image fullscreen» of the legacy page (AS:206-215).
 * @param {{ isFranchise?: boolean, forcedSiteId?: any, isApp?: boolean, isKiosk?: boolean, isMaweja?: boolean }} options
 */
export const useAdvancedSectionConfig = ({ isFranchise = false, forcedSiteId = null, isApp = false, isKiosk = false, isMaweja = false } = {}) => {
  const [, t] = useLanguage()
  const lists = AdvancedSettingsUtilities({ isFranchise })
  const appIds = isApp ? appAdvancedSectionIds({ isKiosk, isFranchise, isMaweja }) : []

  const businessLogoDummy = {
    kind: 'image',
    title: t('BUSINESS_LOGO_DUMMY_IMAGE', 'Business Logo dummy image'),
    ratio: '512 x 512 px',
    path: BUSINESS_LOGO_DUMMY
  }
  const productDummy = {
    kind: 'image',
    title: t('PRODUCT_DUMMY_IMAGE', 'Product dummy image'),
    ratio: '900 x 200 px',
    path: PRODUCT_DUMMY
  }
  const businessHeaderDummy = {
    kind: 'image',
    title: t('BUSINESS_CARD_DEFAULT_HEADER', 'Default header when business has no banner'),
    ratio: '1350 x 400 px',
    path: BUSINESS_HEADER_DUMMY
  }

  const section = (id, enabled, blocks) => ({ id, enabled: isApp ? appIds.includes(id) : enabled, blocks })

  return {
    // the two blocks only an app has (AS:131-157). The app design is the legacy `LayoutStyleGroup` choice, as a radio group.
    app_design: section('app_design', false, [{
      kind: 'app_design',
      label: t('APP_DESIGN', 'App design'),
      path: 'app_design.components.layout',
      options: [{ value: 'original', label: 'Original' }, { value: 'maweja', label: 'Maweja' }]
    }]),
    homepage: section('homepage', false, [{
      kind: 'image',
      title: t('HOMEPAGE_IMAGE', 'Homepage image'),
      ratio: '1350 x 400 px',
      path: 'my_products.components.images.components.homepage_background.components.image'
    }]),
    buttons: section('buttons', !forcedSiteId, [list(lists.buttonList)]),
    typography: section('typography', true, [{ kind: 'typography', path: 'general.components.fonts.primary' }]),
    // «Homepage image fullscreen» (AS:206-215) is not here: it lives in Website › Images (OW-01)
    advanced_images: section('advanced_images', true, [
      ...(isFranchise ? [] : [businessLogoDummy]),
      ...(isApp && !isFranchise ? [list(lists.homeImageFullScreen)] : []),
      productDummy
    ]),
    favicon: section('favicon', true, [{
      kind: 'favicon',
      title: t('FAVICON', 'Favicon'),
      ratio: '512 x 512 px',
      path: 'general.components.favicon.components.image'
    }]),
    header: section('header', true, [list(lists.headerList)]),
    business_listing: section('business_listing', !isFranchise, [
      list(lists.businessListing, { fallbackName: t('BUSINESS_LISTING', 'Business listing') })
    ]),
    business_block: section('business_block', true, [...(isFranchise ? [] : [businessHeaderDummy]), list(lists.businessBlockList)]),
    business_page: section('business_page', true, [list(lists.businessPageList)]),
    business_information: section('business_information', true, [list(lists.businessInfoList)]),
    products_block: section('products_block', true, [list(lists.productBlockList)]),
    reviews_popups: section('reviews_popups', true, [list(lists.reviewsPopups)]),
    cart_header: section('cart_header', true, [list(lists.cartHeaderList)]),
    checkout: section('checkout', !isFranchise, [list(lists.checkoutList)]),
    confirmation_page: section('confirmation_page', true, [heading(t('ORDER_BLOCK', 'Order block')), list(lists.orderBlockList)]),
    popup_address: section('popup_address', true, [list(lists.popupAddressList)]),
    my_account: section('my_account', true, [list(lists.myAccountList)]),
    my_orders: section('my_orders', true, [heading(t('ACTIVE_ORDERS_BLOCK', 'Active Orders Block')), list(lists.activeOrderBlockList)]),
    menu_options: section('menu_options', true, [list(lists.menuOptionList)]),
    popup_order_types: section('popup_order_types', !isFranchise, [{
      kind: 'order_types',
      path: 'order_types',
      titleField: { label: t('TITLE_MENU_OPTIONS', 'Title Menu options'), path: 'order_types.components.title_menu' },
      types: [
        { key: 'delivery', title: t('DELIVERY', 'Delivery') },
        { key: 'pickup', title: t('PICKUP', 'Pickup') },
        { key: 'eat_in', title: t('EAT_IN', 'Eat in') },
        { key: 'curbside', title: t('CURBSIDE', 'Curbside') },
        { key: 'drive_thru', title: t('DRIVE_THRU', 'Drive thru') },
        { key: 'catering_delivery', title: t('CATERING_DELIVERY', 'Catering delivery') },
        // the fallback is the key itself, as in AdvancedSettings/index.js
        { key: 'catering_pickup', title: t('CATERING_PICKUP', 'CATERING_PICKUP') }
      ]
    }]),
    third_party_code: section('third_party_code', true, [list(lists.thirdPartyCodeList)]),
    navigation_bar: section('navigation_bar', false, [list(lists.navigationBarList)]),
    smart_banners: section('smart_banners', true, [list(lists.smartBannersList)]),
    order_tracking: section('order_tracking', !isFranchise, [list(lists.trackingSettingsList)])
  }
}
