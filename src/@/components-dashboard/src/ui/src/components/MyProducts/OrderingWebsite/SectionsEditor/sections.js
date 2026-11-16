import { ColorsContentSection } from './ColorsContentSection'
import { GeneralSection } from './GeneralSection'
import { ImagesSection } from './ImagesSection'
import { LayoutSection } from './LayoutSection'
import { ADVANCED_COMPONENTS } from './AdvancedSection'
import { advancedSectionLabels, matchAdvancedSections } from './advancedSections'
import { WidgetsSection } from './WidgetsSection'

// redesign ordering-website B3a (D1): the registry of the sections of the editor, in the order the navigation lists them.
// The sections of the Website group have a `Component` (General: B3a; Layout, Images, Colors & content: B3b); the others are listed
// (id, group, label) so the navigation is complete; B4 adds Advanced and Widgets (wired at integration).
//
// `match(change)` says which section a pending change belongs to, for the names the save bar lists. A change is
// `{ scope: 'site' | 'theme' | 'advanced', path }` (see `countChanges` in themeDraft.js).

export const SECTION_GROUPS = ['website', 'advanced', 'integrations']

export const DEFAULT_SECTION = 'general'

const underPath = (path, root) => path === root || path.startsWith(`${root}.`)

const SITE_GENERAL_KEYS = ['name', 'description', 'domain']
const SITE_IMAGE_KEYS = ['logo', 'image']

const matchGeneral = (change) => change.scope === 'site' && SITE_GENERAL_KEYS.includes(change.path)
const matchImages = (change) => (
  (change.scope === 'site' && SITE_IMAGE_KEYS.includes(change.path)) ||
  (change.scope === 'theme' && underPath(change.path, 'images'))
)
const matchLayout = (change) => change.scope === 'theme' && underPath(change.path, 'website_theme')
const matchColorsContent = (change) => change.scope === 'theme' && underPath(change.path, 'theme_settings')

/**
 * @param {{ t: Function, isFranchise?: boolean, forcedSiteId?: any }} options
 * @returns {Array<{ id: string, group: string, label: string, description?: string, Component?: Function, match?: Function }>}
 */
export const buildSections = ({ t, isFranchise = false, forcedSiteId = null }) => {
  // redesign ordering-website review R1-06: «Layout» only where the legacy editor drew «Website Theme» (OW:627)
  const website = [
    { id: 'general', group: 'website', label: t('GENERAL', 'General'), Component: GeneralSection, match: matchGeneral },
    { id: 'layout', group: 'website', label: t('LAYOUT', 'Layout'), Component: LayoutSection, match: matchLayout },
    { id: 'images', group: 'website', label: t('IMAGES', 'Images'), Component: ImagesSection, match: matchImages },
    { id: 'colors_content', group: 'website', label: t('COLORS_AND_CONTENT', 'Colors & content'), Component: ColorsContentSection, match: matchColorsContent }
  ]

  // The same sections, names, fallbacks, order and conditions as MyProducts/AdvancedSettings/index.js for a website (no app, no
  // kiosk). Their `match` is added by B4; their names are advancedSectionLabels (shared with the app editor, ).
  const labels = advancedSectionLabels(t)
  const advancedList = [
    ['buttons', !forcedSiteId],
    ['typography', true],
    ['advanced_images', true],
    ['favicon', true],
    ['header', true],
    ['business_listing', !isFranchise],
    ['business_block', true],
    ['business_page', true],
    ['business_information', true],
    ['products_block', true],
    ['reviews_popups', true],
    ['cart_header', true],
    ['checkout', !isFranchise],
    ['confirmation_page', true],
    ['popup_address', true],
    ['my_account', true],
    ['my_orders', true],
    ['menu_options', true],
    ['popup_order_types', !isFranchise],
    ['third_party_code', true],
    ['smart_banners', true],
    ['order_tracking', !isFranchise]
  ]
  // redesign ordering-website integration: B4's sections and matchers. A path some sections share (a review row
  // shown in two of them) names every section that shows it.
  const advanced = advancedList
    .filter(([, enabled]) => enabled)
    .map(([id]) => ({
      id,
      group: 'advanced',
      label: labels[id],
      Component: ADVANCED_COMPONENTS[id],
      match: (change) => change.scope === 'advanced' && matchAdvancedSections(change.path).includes(id)
    }))
  // Two «Images» (Website and Advanced): the phone selector lists labels without their group, so this one says it.
  const advancedImages = advanced.find((section) => section.id === 'advanced_images')
  if (advancedImages) advancedImages.description = t('ADVANCED_SETTINGS_TITLE', 'Advanced settings')

  // The Widgets tab of the legacy editor is shown for a project's own website only (OW: settingsList).
  const integrations = (!isFranchise && !forcedSiteId)
    ? [{ id: 'widgets', group: 'integrations', label: t('ORDERING_WIDGETS', 'Ordering Widgets'), Component: WidgetsSection }]
    : []

  const websiteShown = (isFranchise || forcedSiteId) ? website.filter((section) => section.id !== 'layout') : website
  return [...websiteShown, ...advanced, ...integrations]
}

/** The groups of the navigation, in order: `{ id, label }`. A group with no sections is left out. */
export const buildGroups = ({ t, sections }) => {
  const labels = {
    website: t('WEBSITE', 'Website'),
    advanced: t('ADVANCED_SETTINGS_TITLE', 'Advanced settings'),
    integrations: t('INTEGRATIONS', 'Integrations')
  }
  return SECTION_GROUPS
    .filter((id) => sections.some((section) => section.group === id))
    .map((id) => ({ id, label: labels[id] }))
}
