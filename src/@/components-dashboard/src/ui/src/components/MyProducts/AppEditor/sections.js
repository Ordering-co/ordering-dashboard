import { BuildsSection } from './BuildsSection'
import { GeneralSection } from './GeneralSection'
import { ConstantsSection } from './ConstantsSection'
import { CredentialsSection } from './CredentialsSection'
import { FilesSection } from './FilesSection'
import { ImagesSection, ResourcesSection } from './ImagesSection'
import { ColorsSection } from './ColorsSection'
import { APP_ADVANCED_COMPONENTS, appThemeFlags } from './AdvancedThemeSection'
import { isMawejaProject } from '../AdvancedSettings/isMawejaProject'
import { advancedSectionLabels, appAdvancedSectionIds } from '../OrderingWebsite/SectionsEditor/advancedSections'

// redesign my-products B2 (D1): the registry of the sections of the editor of an app, in the order the navigation lists them,
// with the condition each one had in main (main's basic settings, `AppUI/index.js` for Advanced).
// `buildSections` gives every section, visible or not, in one order; `visibleSections` keeps the ones this app has.
// «Advanced settings» is a group of its own, one section per block of the legacy page, as in the website editor.

export const SECTION_GROUPS = ['build', 'app', 'look', 'advanced']

export const DEFAULT_SECTION = 'builds'

// The apps whose theme is edited in the app (`AppUI/index.js` `codesWithThemes`): main showed the «Advanced Settings» tab only for them.
export const CODES_WITH_THEMES = [
  'app_franchises_x', 'app_kiosk_x', 'app_marketplace_x',
  'app_franchises_26', 'app_kiosk_26', 'app_marketplace_26'
]

const actionsOf = (app, test) => (Array.isArray(app?.baseActions) ? app.baseActions.filter(test) : [])
const hasActions = (app, group) => actionsOf(app, (action) => action?.group === group).length > 0

// The four groups of resources (main's basic settings): icons, notifications and the Android and iOS splash.
const hasResources = (app) => (
  hasActions(app, 'resources_icons') ||
  hasActions(app, 'resources_notifications') ||
  actionsOf(app, (action) => ['splash', 'android'].every((part) => action?.group?.includes(part))).length > 0 ||
  actionsOf(app, (action) => ['splash', 'ios'].every((part) => action?.group?.includes(part))).length > 0
)

// The Advanced sections this app has (none without a theme of its own), labelled as in the website editor.
const advancedSections = ({ t, appCode, project }) => {
  if (!CODES_WITH_THEMES.includes(appCode)) return []
  const labels = advancedSectionLabels(t)
  return appAdvancedSectionIds({ ...appThemeFlags(appCode), isMaweja: isMawejaProject(project) }).map((id) => ({
    id,
    group: 'advanced',
    label: labels[id],
    // Two «Images» (Look and Advanced): the phone selector lists labels without their group, so this one says it.
    description: id === 'advanced_images' ? t('ADVANCED_SETTINGS_TITLE', 'Advanced settings') : undefined,
    Component: APP_ADVANCED_COMPONENTS[id],
    visible: true
  }))
}

/**
 * @param {{ t: Function, app?: object, appCode?: string, project?: string }} options `appCode` is the code of the app (`base.code`), not
 * its numeric id; `project` is the project's code (a Maweja project has the app design).
 * @returns {Array<{ id: string, group: string, label: string, description?: string, Component: Function, visible: boolean }>}
 */
export const buildSections = ({ t, app, appCode, project }) => [
  { id: 'builds', group: 'build', label: t('BUILDER_BUILDS', 'Builds'), Component: BuildsSection, visible: true },
  { id: 'general', group: 'app', label: t('GENERAL', 'General'), Component: GeneralSection, visible: true },
  { id: 'constants', group: 'app', label: t('CONSTANTS_SETTINGS', 'Constants'), Component: ConstantsSection, visible: Boolean(app?.baseConstants?.length) },
  { id: 'credentials', group: 'app', label: t('BUILDER_CREDENTIALS', 'Credentials'), Component: CredentialsSection, visible: true },
  { id: 'files', group: 'app', label: t('BUILD_FILES', 'Files'), Component: FilesSection, visible: hasActions(app, 'files') },
  { id: 'images', group: 'look', label: t('GENERAL_IMAGES_APP_SETTINGS', 'Images'), Component: ImagesSection, visible: hasActions(app, 'general_images') },
  { id: 'colors', group: 'look', label: t('BUILDER_COLORS', 'Colors'), Component: ColorsSection, visible: hasActions(app, 'colors') },
  { id: 'resources', group: 'look', label: t('BUILDER_ICONS_AND_SPLASH', 'Icons and splash'), Component: ResourcesSection, visible: hasResources(app) },
  ...advancedSections({ t, appCode, project })
]

/** The sections this app has, in order. */
export const visibleSections = (sections) => sections.filter((section) => section.visible)

/** The caption above each run of sections in the navigation, by group id. Literal calls, so the key scanner sees every key. */
export const groupLabels = (t) => ({
  build: t('BUILD_APPS', 'Build Apps'),
  app: t('APP', 'App'),
  look: t('BUILDER_APP_LOOK', 'Look'),
  advanced: t('ADVANCED_SETTINGS_TITLE', 'Advanced settings')
})
