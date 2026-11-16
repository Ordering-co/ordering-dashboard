import React, { useId, useMemo, useRef } from 'react'
import { useTheme } from 'styled-components'

import { useLanguage } from '../../../../../../index'
import { RadioGroup } from '../../../Shared/Product'
import { useAssociate } from '../../../Shared/Product/legacyField'
import { SelectBusiness } from '../SelectBusiness'
import { setThemePath } from './themeDraft'

// redesign ordering-website B3b (D5): Website › Layout. The theme of the website (Marketplace or Single Store), the business
// of a single store and the preview picture of the choice. Everything the legacy editor did in its «Website Theme» block
// (OW: 627-667), with the same values and the same writes: `website_theme.type` and `website_theme.business_slug` of the theme draft.
// Like there, it is a block of a project's own website only (not of a franchise nor of a store's white label).

export const LayoutSection = (props) => {
  const {
    themeValues,
    setThemeValues,
    businessesList,
    franchisesList,
    isDashboard,
    isFranchise,
    forcedSiteId
  } = props

  const [, t] = useLanguage()
  const theme = useTheme()
  const businessLabelId = useId()
  // redesign ordering-website review R1-03: the legacy select takes no aria props; its trigger is named by «Business»
  // and its own value («Business, KCF»), as ColorField does for the legacy picker
  const businessRef = useRef(null)
  useAssociate(businessRef, '[role="button"], button, [tabindex="0"]', {
    id: `${businessLabelId}-trigger`,
    'aria-labelledby': `${businessLabelId} ${businessLabelId}-trigger`
  })

  const type = themeValues?.website_theme?.components?.type
  const franchiseSlug = themeValues?.website_theme?.components?.franchise_slug

  const previewImages = useMemo(() => ({
    marketplace: theme.images?.preview?.marketplace,
    franchise: theme.images?.preview?.franchise,
    single_store: theme.images?.preview?.singleStore
  }), [theme.images?.preview])

  // The franchise the theme points to, once its list is there (OW: 266-271): its header is the preview.
  const franchiseSelected = useMemo(() => {
    if (isDashboard || type !== 'franchise') return null
    if (franchisesList?.loading || !franchisesList?.franchises) return null
    return franchisesList.franchises.find((franchise) => franchise?.id === franchiseSlug) ?? null
  }, [isDashboard, type, franchiseSlug, franchisesList])

  if (isFranchise || forcedSiteId) return null

  const write = (block, value) => setThemeValues(setThemePath(themeValues, 'website_theme', block, value))

  const options = [
    { value: 'marketplace', label: t('MARKETPLACE', 'Marketplace') },
    { value: 'single_store', label: t('SINGLE_STORE', 'Single Store') }
  ]
  const previewSrc = franchiseSelected?.header || previewImages[type]

  return (
    <div className='odc-ows-layout'>
      <div className='odc-ows-layout-controls'>
        <RadioGroup
          label={t('WEBSITE_THEME', 'Website Theme')}
          options={options}
          value={type ?? ''}
          onValueChange={(value) => write('type', value)}
        />
        {type === 'single_store' && (
          <div ref={businessRef} className='odc-ows-row' role='group' aria-labelledby={businessLabelId}>
            <p id={businessLabelId} className='odc-ows-label'>{t('BUSINESS', 'Business')}</p>
            <SelectBusiness
              defaultValue={themeValues?.website_theme?.components?.business_slug}
              businessesList={businessesList}
              onChange={(value) => write('business_slug', value)}
            />
          </div>
        )}
      </div>
      {type && <img className='odc-ows-preview' src={previewSrc} alt='' />}
    </div>
  )
}
