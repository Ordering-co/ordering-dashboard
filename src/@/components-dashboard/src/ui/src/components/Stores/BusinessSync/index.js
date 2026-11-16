import React, { useEffect, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { Sheet, TabPanel, Tabs } from '../../Shared/Product'
import { BusinessSyncBasic } from '../BusinessSyncBasic'
import { BusinessSyncItsaCheckmate } from '../BusinessSyncItsaCheckmate'
import { BusinessSyncStore } from '../BusinessSyncStore'
import { addQueryToUrl } from '../../../utils'
import './business-sync.css'

const DEFAULT_TAB = 'deliverect'
const SYNCED_STORES_TAB = 'synced_store'

/**
 * The Sync content (redesign stores 3.D, ): Deliverect and ItsaCheckmate tabs, and the synced stores (`?tab=synced_store`,
 * reached by URL, no tab of its own). The URL keeps its contract: a `?tab=` on mount is used as it is, without writing it back;
 * with none, `tab=deliverect` is written; a tab change writes `?tab=`. An unknown tab shows no body.
 *
 *  - `handleParentSidebarMove(0)`: the legacy side bar's width; called as before when the parent gives it.
 *  - `onDetailChange(open)`: the synced stores always get a function to call (a no-op without a parent) to say whether one of their
 *    details is open; it is closed again when they go away.
 *  - `embedded`: it lives inside the Sheet, which brings the title and the padding.
 */
export const BusinessSync = (props) => {
  const { handleParentSidebarMove, onDetailChange, embedded = false } = props

  // redesign bugs F row 26: addQueryToUrl / removeQueryToUrl use history.replaceState, which the router does not
  // see, so useLocation().search is stale after Sync was closed; the address bar is the truth (a deep link is in it too)
  const readTab = () => {
    const query = new URLSearchParams(window.location.search)
    return query.get('tab')
  }
  const [, t] = useLanguage()
  const [selectedOption, setSelectedOption] = useState(() => readTab() || DEFAULT_TAB)

  const syncOptions = [
    { value: 'deliverect', label: t('DELIVERECT', 'Deliverect') },
    { value: 'itsacheckmate', label: t('ITSACHECKMATE', 'ItsaCheckmate') }
  ]
  const isProviderTab = syncOptions.some(option => option.value === selectedOption)

  const handleChangeOption = (key) => {
    handleParentSidebarMove?.(0)
    setSelectedOption(key)
    addQueryToUrl({ tab: key })
  }

  useEffect(() => {
    handleParentSidebarMove?.(0)
    if (!readTab()) addQueryToUrl({ tab: DEFAULT_TAB })
  }, [])

  useEffect(() => {
    if (selectedOption !== SYNCED_STORES_TAB) return undefined
    return () => onDetailChange?.(false)
  }, [selectedOption])

  return (
    <div className='odc-root stores-sync' data-in-sheet={embedded ? '' : undefined}>
      {!embedded && <h2 className='stores-sync-title'>{t('SYNC_WITH', 'Sync with')}</h2>}
      <Tabs
        className='stores-sync-tabs'
        label={t('SYNC_WITH', 'Sync with')}
        items={syncOptions}
        value={selectedOption}
        onValueChange={handleChangeOption}
      >
        {isProviderTab && (
          <TabPanel value={selectedOption}>
            {selectedOption === 'deliverect' && <BusinessSyncBasic />}
            {selectedOption === 'itsacheckmate' && <BusinessSyncItsaCheckmate />}
          </TabPanel>
        )}
      </Tabs>
      {selectedOption === SYNCED_STORES_TAB && (
        <BusinessSyncStore
          handleParentSidebarMove={handleParentSidebarMove}
          onDetailChange={(open) => onDetailChange?.(open)}
        />
      )}
    </div>
  )
}

/**
 * The Sync content in a Sheet (`end`). While a synced store's detail is open (`onDetailChange(true)`) the panel carries
 * `data-detail='true'` and, from 1100px, doubles its width (business-sync.css).
 */
export const BusinessSyncSheet = ({ open, onClose }) => {
  const [, t] = useLanguage()
  const [detail, setDetail] = useState(false)

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => { if (!next) onClose?.() }}
      title={t('SYNC_WITH', 'Sync with')}
      closeLabel={t('CLOSE', 'Close')}
      className='stores-sync-sheet'
      data-detail={detail ? 'true' : undefined}
    >
      <BusinessSync embedded onDetailChange={setDetail} />
    </Sheet>
  )
}
