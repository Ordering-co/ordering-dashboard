import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage } from '~components'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { isOwnZone } from '../../../../../utils/deliveryZones'
import { BusinessDeliveryZone as BusinessDeliveryZoneController } from '../../../../../components/BusinessDeliveryZone'

import { Button, ConfirmDialog, Dialog, InlineNotice, Menu, Tabs } from '../../Shared/Product'
import { CircleAlert, Ellipsis, Trash2 } from '../../Shared/Icon'
import { BusinessDeliveryZoneInformation } from '../BusinessDeliveryZoneInformation'
import { BusinessDeliveryZoneShare } from '../BusinessDeliveryZoneShare'
import { SnoozeComponent } from '../SnoozeComponent'
import { addQueryToUrl } from '../../../utils'
import './zone-details.css'

// redesign stores 5.8 (2.3): the detail of a delivery zone lives inside P/SectionSplit, which draws the title (the name of
// the zone, or «Zone delivery settings» for a new one), the X or «‹ Back», handles Esc and owns the focus. This draws what is inside:
// the tabs, the actions of a saved zone (Snooze and the ⋯ menu with Delete), the body of the tab and the Delete confirmation. The width
// is the piece's: nothing here measures or sets a width.

const ZONE_TABS = ['information', 'share_with']

// the first message of what the controller answers (a string or a list of them), or null
const firstMessage = (error) => {
  const message = Array.isArray(error) ? error[0] : error
  return typeof message === 'string' && message.trim() ? message : null
}

const BusinessDeliveryZoneDetailsUI = (props) => {
  const {
    business,
    businessZones,
    zoneState,
    formState,
    handleChangeInput,
    handleChangeFormState,
    handleDiscardChanges,
    handleUpdateBusinessDeliveryZone,
    handleAddBusinessDeliveryZone,
    handleDeleteBusinessDeliveryZone,
    kmlData,
    handleUploadKmlFiles,
    handleSuccessUpdate
  } = props

  const location = useLocation()
  const [, t] = useLanguage()
  const mounted = useRef(true)
  const [isSnoozeOpen, setIsSnoozeOpen] = useState(false)
  const [deleteState, setDeleteState] = useState({ open: false, busy: false, error: null })
  // G3-22: Snooze, Delete and Share act on a saved zone (`zone.id`); a new zone gets them once it is saved.
  const isZoneSaved = !!zoneState?.zone

  // The tab is read from the URL once, when the zone opens (so `?zone=&zone_tab=` opens what it did), and written when the user clicks a
  // tab. An unknown one (the old «channels») or «share_with» of a zone not saved yet opens Information.
  const requestedTab = new URLSearchParams(location.search).get('zone_tab')
  const isValidRequest = ZONE_TABS.includes(requestedTab) && (requestedTab !== 'share_with' || isZoneSaved)
  const [tab, setTab] = useState(isValidRequest ? requestedTab : 'information')
  const activeTab = tab === 'share_with' && !isZoneSaved ? 'information' : tab

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    // redesign bugs F row 31: only a saved zone says its tab in the URL; a new one would leave zone_tab without zone=
    if (isZoneSaved && !isValidRequest) addQueryToUrl({ zone_tab: 'information' })
  }, [])

  // The panel stays mounted when the list switches from a saved zone to «Add delivery zone».
  useEffect(() => {
    if (!isZoneSaved && tab === 'share_with') setTab('information')
  }, [isZoneSaved])

  const handleTabChange = (next) => {
    setTab(next)
    addQueryToUrl({ zone_tab: next })
  }

  const tabItems = [
    { value: 'information', label: t('INFORMATION', 'Information') },
    ...(isZoneSaved ? [{ value: 'share_with', label: t('SHARE_WITH', 'Share with') }] : [])
  ]

  // Delete: asks first; if the API refuses, the dialog stays open and says why. When it works the controller closes the detail.
  const closeDelete = () => {
    if (deleteState.busy) return
    setDeleteState({ open: false, busy: false, error: null })
  }

  const confirmDelete = async () => {
    if (deleteState.busy) return
    setDeleteState({ open: true, busy: true, error: null })
    let result
    try {
      result = await handleDeleteBusinessDeliveryZone()
    } catch (error) {
      result = { ok: false, error: error?.message }
    }
    if (!mounted.current) return
    if (result?.ok === false) {
      setDeleteState({
        open: true,
        busy: false,
        error: translateApiMessage(t, firstMessage(result.error), t('SOMETHING_WENT_WRONG_TRY_AGAIN', 'Something went wrong. Try again.'))
      })
      return
    }
    setDeleteState({ open: false, busy: false, error: null })
  }

  const menuItems = [
    {
      key: 'delete',
      label: t('DELETE', 'Delete'),
      icon: Trash2,
      tone: 'danger',
      onSelect: () => setDeleteState({ open: true, busy: false, error: null })
    }
  ]

  return (
    <div className='odc-bdz'>
      <div className='odc-bdz-tools'>
        <div className='odc-bdz-tabs'>
          <Tabs
            label={t('ZONE_DELIVERY_SETTINGS', 'Zone delivery settings')}
            value={activeTab}
            onValueChange={handleTabChange}
            items={tabItems}
          />
        </div>
        {isZoneSaved && (
          <div className='odc-bdz-actions'>
            <Button onClick={() => setIsSnoozeOpen(true)}>{t('SNOOZE', 'Snooze')}</Button>
            <Menu icon={Ellipsis} label={t('STORES_ZONE_ACTIONS', 'Zone actions')} items={menuItems} />
          </div>
        )}
      </div>
      <div className='odc-bdz-body'>
        {/* Information stays mounted while Share is in front: its pending changes and its leave guard must not vanish with the tab */}
        <div hidden={activeTab !== 'information'}>
          <BusinessDeliveryZoneInformation
            active={activeTab === 'information'}
            business={business}
            zone={zoneState.zone}
            businessZones={businessZones}
            formState={formState}
            handleChangeInput={handleChangeInput}
            handleChangeFormState={handleChangeFormState}
            handleDiscardChanges={handleDiscardChanges}
            handleUpdateBusinessDeliveryZone={handleUpdateBusinessDeliveryZone}
            handleAddBusinessDeliveryZone={handleAddBusinessDeliveryZone}
            kmlData={kmlData}
            handleUploadKmlFiles={handleUploadKmlFiles}
          />
        </div>
        {activeTab === 'share_with' && isZoneSaved && (
          <BusinessDeliveryZoneShare
            business={business}
            zone={zoneState.zone}
            handleSuccessUpdate={handleSuccessUpdate}
          />
        )}
      </div>
      {isZoneSaved && (
        <>
          <Dialog
            open={isSnoozeOpen}
            onOpenChange={setIsSnoozeOpen}
            size='lg'
            title={t('SNOOZE', 'Snooze')}
            closeLabel={t('CLOSE', 'Close')}
          >
            <SnoozeComponent
              dataState={zoneState.zone}
              handleUpdate={handleUpdateBusinessDeliveryZone}
              handleChangeFormState={handleChangeFormState}
              formState={formState}
              onClose={() => setIsSnoozeOpen(false)}
            />
          </Dialog>
          <ConfirmDialog
            open={deleteState.open}
            tone='danger'
            busy={deleteState.busy}
            title={zoneState.zone.name ?? ''}
            confirmLabel={t('DRIVERS_GROUPS_DELETE_ZONE', 'Delete zone')} // redesign tanda AB (S-5): verb + object
            cancelLabel={t('CANCEL', 'Cancel')}
            closeLabel={t('CLOSE', 'Close')}
            onCancel={closeDelete}
            onConfirm={confirmDelete}
          >
            <p className='odc-bdz-delete-body'>
              {/* P6: from a store that does not own the zone, the API only unlinks it from that store */}
              {isOwnZone(zoneState.zone)
                ? t('QUESTION_DELETE_DELIVERYZONE', 'Are you sure that you want to delete this delivery zone?')
                : t('STORES_ZONE_DELETE_SHARED_BODY', '_name_ is shared by another store. It is removed from this store only; the other stores keep it.')
                  .replace('_name_', () => zoneState.zone.name ?? '')}
            </p>
            {deleteState.error && (
              <InlineNotice tone='danger' icon={CircleAlert} role='alert' className='odc-bdz-delete-error'>
                {deleteState.error}
              </InlineNotice>
            )}
          </ConfirmDialog>
        </>
      )}
    </div>
  )
}

export const BusinessDeliveryZoneDetails = (props) => {
  const businessDeliveryZoneProps = {
    ...props,
    UIComponent: BusinessDeliveryZoneDetailsUI
  }
  return <BusinessDeliveryZoneController {...businessDeliveryZoneProps} />
}
