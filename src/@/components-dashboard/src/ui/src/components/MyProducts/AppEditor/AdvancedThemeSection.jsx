import React from 'react'

import { useApi, useLanguage } from '../../../../../index'
import { Button, Skeleton } from '../../Shared/Product'
import { isMawejaProject } from '../AdvancedSettings/isMawejaProject'
import { AdvancedSection } from '../OrderingWebsite/SectionsEditor/AdvancedSection'
import { APP_ADVANCED_SECTION_IDS } from '../OrderingWebsite/SectionsEditor/advancedSections'
import './app-editor.css'
import './app-sections.css'

// redesign my-products B2 (D1): Look › Advanced Settings, only while the theme of the app is not loading; while it loads, a
// skeleton as a busy status (main drew a card skeleton). The editor paints the section's h2 and gives the props of the controller
// (`themesList`, `orderingTheme`, `advancedValues`, `setAdvancedValues`, `handleUpdateSiteTheme`) and the app's `appCode`.
// the one long legacy page (`AdvancedSettings` with `isApp`) is now one section per block, painted by the Advanced section of
// the website editor with the app's conditions (advancedSections.js). Every section edits the same draft (`advancedValues`) and has the
// legacy page's Save, which sends the whole draft as before (`handleUpdateSiteTheme(advancedValues)`).

/** The flags `AppUI` gave the legacy page for this app (only the `_x` kiosk and franchise apps had them). */
export const appThemeFlags = (appCode) => ({
  isKiosk: appCode === 'app_kiosk_x',
  isFranchise: appCode === 'app_franchises_x'
})

export const AdvancedThemeSection = (props) => {
  const {
    sectionId,
    appCode,
    orderingTheme,
    themesList,
    advancedValues,
    setAdvancedValues,
    handleUpdateSiteTheme
  } = props

  const [, t] = useLanguage()
  const [ordering] = useApi()

  if (orderingTheme?.loading) {
    return (
      <div className='odc-ape-skeleton' role='status' aria-busy='true'>
        <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
        <Skeleton size='30%' />
        <Skeleton block='var(--od-x-control-height)' />
        <Skeleton size='30%' />
        <Skeleton block='var(--od-x-control-height-lg)' />
        <Skeleton size='30%' />
        <Skeleton block='var(--od-x-control-height)' />
      </div>
    )
  }

  return (
    <div className='odc-aps'>
      <AdvancedSection
        sectionId={sectionId}
        isApp
        {...appThemeFlags(appCode)}
        isMaweja={isMawejaProject(ordering?.project)}
        themesList={themesList}
        advancedValues={advancedValues}
        setAdvancedValues={setAdvancedValues}
      />
      <div className='odc-aps-foot'>
        <Button variant='primary' onClick={() => handleUpdateSiteTheme(advancedValues)}>
          {t('SAVE', 'Save')}
        </Button>
      </div>
    </div>
  )
}

/** `{ [id]: Component }` for the registry of the editor (sections.js): the Advanced section of each id an app may have. */
export const APP_ADVANCED_COMPONENTS = Object.fromEntries(APP_ADVANCED_SECTION_IDS.map((id) => {
  const Component = (props) => <AdvancedThemeSection sectionId={id} {...props} />
  Component.displayName = `AdvancedThemeSection(${id})`
  return [id, Component]
}))
