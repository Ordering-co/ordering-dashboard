import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useConfig, useLanguage } from '../../../../../index'
import { TabPanel, Tabs } from '../../Shared/Product'
import { addQueryToUrl } from '../../../utils'
import { useStoreWebsiteUrl } from '../../../hooks/useWebsiteUrl'
import { BusinessWidgets } from '../BusinessWidgets'
import { StoreSlugField } from '../StoreSlugField'
import './ordering-channels.css'

// redesign stores 5.15a: Ordering channels (the «Extensions» of a store) on P/.
// - Two tabs on P/Tabs, Custom slug | Widgets, with the same `?tab=` as main (read on mount when it is valid for the user, else the
//   default tab is opened and written; written on every change). Every level has both tabs (main dropped the EatStreet rule).
// - Custom slug is the one slug editor, `S/StoreSlugField` (5.1b), as the Overview has it: its own «Save» sends the slug alone
//   (`keepPendingChanges`), the API's error is said under the field and «Saved» after it. One Save is one request (1.A, G5-01).
//   While typed and not saved the slug sits in the shared form, so leaving the editor asks (2.A).
export const BusinessOrderingChannels = (props) => {
  const {
    formState,
    handleUpdateBusinessClick,
    business,
    setFormState
  } = props

  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()
  const [{ configs }] = useConfig()
  const storeUrl = useStoreWebsiteUrl(business?.slug)
  const isWhiteLabelModule = !!configs?.white_label_module?.value

  const optionList = [
    { value: 'custom_slug', label: t('CUSTOM_SLUG', 'Custom slug') },
    { value: 'widgets', label: t('WIDGETS', 'Widgets') }
  ]
  const fallback = 'custom_slug'
  const [selectedOption, setSelectedOption] = useState(() => {
    const tab = query.get('tab')
    return optionList.some(option => option.value === tab) ? tab : fallback
  })

  const handleChangeOption = (tab) => {
    setSelectedOption(tab)
    addQueryToUrl({ tab })
  }

  // As main: a valid `?tab=` is read as it is; a missing or invalid one opens the default tab and
  // writes it to the URL.
  useEffect(() => {
    const tab = query.get('tab')
    if (!optionList.some(option => option.value === tab)) handleChangeOption(fallback)
  }, [])

  const saveSlug = (slug) => handleUpdateBusinessClick({ slug }, { keepPendingChanges: true })

  return (
    <div className='odc-channels'>
      <h1 className='odc-channels-title'>{t('EXTENSIONS', 'Extensions')}</h1>
      <Tabs
        className='odc-channels-tabs'
        value={selectedOption}
        onValueChange={handleChangeOption}
        label={t('EXTENSIONS', 'Extensions')}
        items={optionList}
      >
        <TabPanel value={selectedOption} className='odc-channels-panel'>
          {selectedOption === 'custom_slug' && (
            <div className='odc-channels-slug'>
              <StoreSlugField
                fieldClassName='odc-channels-slug-field'
                savedSlug={business?.slug}
                formState={formState}
                setFormState={setFormState}
                onSave={saveSlug}
                hint={storeUrl && !isWhiteLabelModule ? storeUrl.replace(/^https?:\/\//, '') : undefined}
              />
            </div>
          )}
          {selectedOption === 'widgets' && <BusinessWidgets business={business} />}
        </TabPanel>
      </Tabs>
    </div>
  )
}
