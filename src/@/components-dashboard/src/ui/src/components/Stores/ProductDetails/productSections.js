import { useLanguage } from '~components'

// redesign SP-F1 (D1)
// The sections of the product editor (`/stores/products?...&section=&tab=`). The editor used to have two places that
// held the list: `ProductSummary` (the menu, :55-115) and the tabs of `ProductMainDetails`. Now both are one list, in the
// order of the product: the five tabs of «Product details» are entries of their own, in their order.
//
// An entry is identified by one string: `section` or, for the tabs of Product details, `product_details:<tab>`. The URL
// keeps main's two keys (`?section=product_details&tab=advanced`); `entryFromUrl` / `entryToQuery` are the only two
// places that translate between the entry and the URL, so a single handler decides `section` + `tab` (audit 4).

export const PRODUCT_OVERVIEW_ID = 'overview'

export const PRODUCT_DETAILS_SECTION = 'product_details'
export const PRODUCT_DETAILS_TABS = ['information', 'advanced', 'labels', 'categories', 'seo_options']
export const DEFAULT_PRODUCT_DETAILS_TAB = 'information'

/**
 * Query keys the editor clears when the open section changes or closes. The list `handleCloseExtraOpen` had in main
 * (ProductDetails:61-66): `tag` (Labels), `ingredient` (Ingredients) and `extra` (Product options) are read by components
 * inside those sections.
 */
export const PRODUCT_SECTION_QUERY_KEYS = ['section', 'tab', 'tag', 'ingredient', 'extra']

const SEPARATOR = ':'

/** `('product_details', 'advanced')` → `'product_details:advanced'`; any other section is its own id. */
export const toEntryId = (section, tab) => (
  section === PRODUCT_DETAILS_SECTION ? `${section}${SEPARATOR}${tab}` : section
)

/**
 * `?section=&tab=` → the entry. Any `section` is accepted (a deep link is not checked against the list, as in main:
 * `custom_fields` and `personalization` are not in it and still paint their branch). Product details without a valid
 * `tab` is its first tab, which is what ProductMainDetails opened.
 */
export const entryFromUrl = (section, tab) => {
  if (!section) return null
  if (section !== PRODUCT_DETAILS_SECTION) return section
  return toEntryId(section, PRODUCT_DETAILS_TABS.includes(tab) ? tab : DEFAULT_PRODUCT_DETAILS_TAB)
}

/** Entry → `{ section, tab? }`. */
export const parseEntryId = (entry) => {
  if (entry == null) return { section: null, tab: undefined }
  const [section, tab] = String(entry).split(SEPARATOR)
  return section === PRODUCT_DETAILS_SECTION
    ? { section, tab: PRODUCT_DETAILS_TABS.includes(tab) ? tab : DEFAULT_PRODUCT_DETAILS_TAB }
    : { section, tab: undefined }
}

/** Entry → what `addQueryToUrl` writes. */
export const entryToQuery = (entry) => {
  const { section, tab } = parseEntryId(entry)
  return tab ? { section, tab } : { section }
}

/**
 * Pure builder. `ctx.isService`: `product.type === 'service'`.
 *
 * Returns `[{ id, label, group? }]`: `overview` first and then, for a product, Product details (five entries under one
 * group header), Ingredients / Properties, Product options, Product images and Product video; for a service, Service
 * details, Professionals, Product options and Product images (ProductSummary:55-115).
 */
export const buildProductSections = ({ isService = false } = {}, t) => {
  const overview = { id: PRODUCT_OVERVIEW_ID, label: t('PRODUCT_EDITOR_OVERVIEW', 'Overview') }
  if (isService) {
    return [
      overview,
      { id: 'service_details', label: t('SERVICE_DETAILS', 'Service details') },
      { id: 'professionals', label: t('PROFESSIONALS', 'Professionals') },
      { id: 'product_options', label: t('PRODUCT_OPTIONS', 'Product options') },
      { id: 'product_images', label: t('PRODUCT_IMAGES', 'Product images') }
    ]
  }
  const group = t('PRODUCT_DETAILS', 'Product details')
  return [
    overview,
    { id: toEntryId(PRODUCT_DETAILS_SECTION, 'information'), label: t('INFORMATION', 'Information'), group },
    { id: toEntryId(PRODUCT_DETAILS_SECTION, 'advanced'), label: t('ADVANCED', 'Advanced'), group },
    { id: toEntryId(PRODUCT_DETAILS_SECTION, 'labels'), label: t('LABELS', 'Labels'), group },
    { id: toEntryId(PRODUCT_DETAILS_SECTION, 'categories'), label: t('CATEGORIES', 'Categories'), group },
    { id: toEntryId(PRODUCT_DETAILS_SECTION, 'seo_options'), label: t('SEO_OPTIONS', 'SEO Options'), group },
    { id: 'ingredients', label: `${t('INGREDIENTS', 'Ingredients')} / ${t('PROPERTIES', 'Properties')}` },
    { id: 'product_options', label: t('PRODUCT_OPTIONS', 'Product options') },
    { id: 'product_images', label: t('PRODUCT_IMAGES', 'Product images') },
    { id: 'product_video', label: t('PRODUCT_VIDEO', 'Product video') }
  ]
}

export const useProductSections = ({ product } = {}) => {
  const [, t] = useLanguage()
  return buildProductSections({ isService: product?.type === 'service' }, t)
}
