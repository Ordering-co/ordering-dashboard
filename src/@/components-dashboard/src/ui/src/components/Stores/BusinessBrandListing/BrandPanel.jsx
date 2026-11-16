import React from 'react'

import { useLanguage } from '../../../../../index'
import { Ellipsis, Maximize2, Minimize2, Trash2 } from '../../Shared/Icon'
import { AsyncSwitch, IconButton, Menu, RecordPanel, useSplitView } from '../../Shared/Product'
import { BusinessBrandGENDetail } from '../BusinessBrandGENDetail'
import { BusinessBrandBUSIDetail } from '../BusinessBrandBUSIDetail'
import { BrandWhiteLabel } from '../BrandWhiteLabel'

// redesign SB-B2 (; decisions 1, 6, 7; G5-30, G5-47, M-SB9): the brand's ficha, a Product RecordPanel inside the SplitView of the
// list. Header: name (or «Add new brand»), `#id`, the Enabled switch of a saved brand (AsyncSwitch: waits for the API and goes back if it
// fails), «Open as page» and a ⋯ menu with «Delete brand» (the host asks first). Tabs: General always; Stores and White label with a
// saved brand (White label only with the flag of main). Only General and the tab that is open have content: Stores and White label
// ask for their data when they are opened, and opening a brand asks for nothing. General stays mounted when the person goes to another
// tab, so its draft survives; its `dirty` guards closing the panel (RecordPanel) and, in the host, switching brand.
//
// The three children are the ones of before (SB-B3, SB-B4 and SB-B5 rewrite them): they are mounted with the props of the list's
// controller, as before, plus the open brand, `onSelectedBrand` and, for General, `onDirtyChange`.

export const BrandPanel = ({
  brand,
  tab,
  onTabChange,
  whiteLabelEnabled = false,
  expanded = false,
  onExpandedChange,
  onClose,
  onDelete,
  onToggleEnabled,
  dirty = false,
  onDirtyChange,
  onSelectedBrand,
  onUpdateBrand,
  controllerProps
}) => {
  const [, t] = useLanguage()
  const split = useSplitView()
  const phone = split.mode === 'full'

  const title = brand ? brand.name : t('ADD_NEW_BRAND', 'Add new brand')
  const subtitle = brand ? <bdi dir='ltr' className='odc-figure'>{`#${brand.id}`}</bdi> : undefined

  const headerActions = (
    <>
      {brand && (
        <AsyncSwitch
          className='odc-brand-head-switch'
          checked={!!brand.enabled}
          failureText={t('BRAND_UPDATE_FAILED', "The brand couldn't be changed. Try again.")}
          onToggle={next => onToggleEnabled?.(brand, next)}
        >
          {t('ENABLED', 'Enabled')}
        </AsyncSwitch>
      )}
      {!phone && onExpandedChange && (
        <IconButton
          icon={expanded ? Minimize2 : Maximize2}
          label={expanded ? t('BACK_TO_SPLIT_VIEW', 'Back to split view') : t('OPEN_AS_PAGE', 'Open as page')}
          onClick={() => split.guardPlaceChange(() => onExpandedChange(!expanded))}
        />
      )}
      {brand && (
        <Menu
          label={t('MORE_ACTIONS', 'More actions')}
          icon={Ellipsis}
          items={[{
            key: 'delete',
            label: t('DELETE_BRAND', 'Delete brand'),
            icon: Trash2,
            tone: 'danger',
            onSelect: () => onDelete?.(brand)
          }]}
        />
      )}
    </>
  )

  const items = [
    {
      value: 'general',
      label: t('GENERAL', 'General'),
      content: (
        <BusinessBrandGENDetail
          {...controllerProps}
          brand={brand}
          onSelectedBrand={onSelectedBrand}
          onDirtyChange={onDirtyChange}
        />
      )
    }
  ]
  if (brand) {
    items.push({
      value: 'businesses',
      label: t('STORES', 'Stores'),
      content: tab === 'businesses' ? <BusinessBrandBUSIDetail {...controllerProps} brand={brand} /> : undefined
    })
    if (whiteLabelEnabled) {
      items.push({
        value: 'white_label',
        label: t('WHITE_LABEL', 'White Label'),
        content: tab === 'white_label' ? <BrandWhiteLabel brand={brand} handleUpdateBrand={onUpdateBrand} /> : undefined
      })
    }
  }

  return (
    <RecordPanel
      className='odc-brand-panel'
      title={title}
      subtitle={subtitle}
      closeLabel={phone ? t('BACK', 'Back') : t('CLOSE', 'Close')}
      onClose={onClose}
      headerActions={headerActions}
      tabs={{
        label: t('BRAND_SECTIONS', 'Brand sections'),
        items,
        value: tab,
        onValueChange: onTabChange
      }}
      // the White label editor is a wide surface: opened as a page it takes the whole width (auditor 2)
      fullWidth={tab === 'white_label'}
      dirty={dirty}
      discardTitle={t('ORDER_PANEL_DISCARD_TITLE', 'Discard your changes?')}
      discardDescription={t('DRIVERS_DISCARD_BODY', 'What you changed here is not saved yet.')}
      discardConfirmLabel={t('DISCARD', 'Discard')}
      keepEditingLabel={t('KEEP_EDITING', 'Keep editing')}
    />
  )
}
