import React, { useRef, useState } from 'react'
import {
  useLanguage,
  DriverGroupDeliveryZone as DriverGroupDeliveryZoneController
} from '../../../../../index'
import { DriverGroupDeliveryZoneInformation } from '../DriversGroupDeliveryZoneInformation'
import { Button as ProductButton, ConfirmDialog, Menu } from '../../Shared/Product'
import { ArrowLeft, Ellipsis, Trash2 } from '../../Shared/Icon'

import {
  Container,
  Header,
  TabContainer,
  Tab,
  TabPanel
} from './styles'

// redesign DG-B2b (decisión 6): the "back" arrow mirrors in right-to-left like the other Product back buttons
const BackIcon = ({ className }) => <ArrowLeft className={[className, 'odc-icon-flip'].filter(Boolean).join(' ')} />

const DriverGroupDeliveryZoneDetailsUI = (props) => {
  const {
    drivergroup,
    driverGroupsZones,
    zoneState,
    formState,
    handleChangeInput,
    handleChangeFormState,
    handleUpdateDriverGroupDeliveryZone,
    handleAddDriverGroupDeliveryZone,
    handleDeleteDriverGroupDeliveryZone,
    handleUploadKmlFiles,
    kmlData,
    onBack,
    backLabel,
    onDirtyChange
  } = props

  const [, t] = useLanguage()
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedMenuOption, setSelectedMenuOption] = useState('information')
  const tabs = [
    { key: 'information', content: t('INFORMATION', 'Information') }
  ]
  const tabRefs = useRef([])
  const selectedTabIndex = tabs.findIndex(tab => tab.key === selectedMenuOption)
  const focusableTabIndex = selectedTabIndex === -1 ? 0 : selectedTabIndex

  const handleTabKeyDown = (event, index) => {
    let nextIndex = index
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = tabs.length - 1
    else return
    event.preventDefault()
    setSelectedMenuOption(tabs[nextIndex].key)
    tabRefs.current[nextIndex]?.focus()
  }

  // redesign DG-B2b (M-DG28 | decisión 6): C8 confirmation (focus on Cancel) instead of the generic Confirm; one step, as before.
  const onConfirmDelete = () => {
    setIsDeleteOpen(false)
    handleDeleteDriverGroupDeliveryZone()
  }

  return (
    <>
      <Container>
        {onBack && (
          <ProductButton variant='ghost' icon={BackIcon} onClick={onBack}>
            {backLabel ?? t('DRIVERS_GROUPS_ALL_ZONES', 'All zones')}
          </ProductButton>
        )}
        <Header>
          <h1>
            {zoneState?.zone ? zoneState?.zone?.name : t('ZONE_DELIVERY_SETTINGS', 'Zone delivery settings')}
          </h1>
          {/* redesign DG-B2b (M-DG28): the ⋯ with Delete only exists for a saved zone (adding one has nothing to delete) and has a name */}
          {/* redesign DG-R1 (R1-07): inside the group panel the group's ⋯ is «Actions»; this one is «Zone actions» and is the house
              icon button (P/Menu): seen at 32px, with the 44px touch area of product.css under 768px or a coarse pointer */}
          {zoneState?.zone?.id && (
            <Menu
              label={t('DRIVERS_GROUPS_ZONE_ACTIONS', 'Zone actions')}
              icon={Ellipsis}
              items={[{ key: 'delete', label: t('DELETE', 'Delete'), icon: Trash2, tone: 'danger', onSelect: () => setIsDeleteOpen(true) }]}
            />
          )}
        </Header>
        <TabContainer role='tablist' aria-label={t('DELIVERY_ZONE', 'Delivery zone')}>
          {tabs?.map((tab, index) => (
            <Tab
              key={tab?.key}
              type='button'
              id={`delivery-zone-${tab?.key}-tab`}
              role='tab'
              aria-selected={selectedMenuOption === tab?.key}
              aria-controls='delivery-zone-panel'
              tabIndex={index === focusableTabIndex ? 0 : -1}
              active={selectedMenuOption === tab?.key}
              onClick={() => setSelectedMenuOption(tab?.key)}
              onKeyDown={event => handleTabKeyDown(event, index)}
              ref={element => { tabRefs.current[index] = element }}
            >
              {tab?.content}
            </Tab>
          ))}
        </TabContainer>

        <TabPanel
          id='delivery-zone-panel'
          role='tabpanel'
          aria-labelledby={`delivery-zone-${selectedMenuOption}-tab`}
        >
          {selectedMenuOption === 'information' && (
            <DriverGroupDeliveryZoneInformation
              drivergroup={drivergroup}
              zone={zoneState?.zone}
              driverGroupsZones={driverGroupsZones?.zones}
              formState={formState}
              handleChangeInput={handleChangeInput}
              handleChangeFormState={handleChangeFormState}
              handleUpdateDriverGroupDeliveryZone={handleUpdateDriverGroupDeliveryZone}
              handleAddDriverGroupDeliveryZone={handleAddDriverGroupDeliveryZone}
              kmlData={kmlData}
              handleUploadKmlFiles={handleUploadKmlFiles}
              onDirtyChange={onDirtyChange}
            />
          )}
        </TabPanel>
      </Container>
      <ConfirmDialog
        open={isDeleteOpen}
        title={t('DRIVERS_GROUPS_DELETE_ZONE_TITLE', 'Delete _name_?').replace('_name_', zoneState?.zone?.name || '')}
        confirmLabel={t('DRIVERS_GROUPS_DELETE_ZONE', 'Delete zone')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={() => setIsDeleteOpen(false)}
        onConfirm={onConfirmDelete}
      >
        {t('DRIVERS_GROUPS_CANT_UNDO', "This can't be undone.")}
      </ConfirmDialog>
    </>
  )
}

export const DriverGroupDeliveryZoneDetails = (props) => {
  const driverGroupDeliveryZoneProps = {
    ...props,
    UIComponent: DriverGroupDeliveryZoneDetailsUI
  }
  return <DriverGroupDeliveryZoneController {...driverGroupDeliveryZoneProps} />
}
