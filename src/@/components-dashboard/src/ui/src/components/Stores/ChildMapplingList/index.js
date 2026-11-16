import React, { useMemo, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { Button } from '../../Shared/Product'
import { LeaveGuardContext, useLeaveGuardHost, useNestedLeaveGuard } from '../../Shared/Product/LeaveGuard'
import { ChevronRight } from '../../Shared/Icon'
import { ImporterForm } from '../ImporterForm'
import { ImportersPane, useReportImportersDirty } from '../ImportersButton/ImportersPanes'
import '../ImporterForm/importer-form.css'

// redesign stores 3.C: the mappings of a multiple importer are a list of Product buttons, and one mapping opens as a level of
// the Importers panel («Edit mapping» / «Add mapping», ImportersPane) instead of a SideBar. Saving a mapping does what it did: the form
// hands its changes to handleUpdateMappingList / handleAddMapping and the list of the importer is updated.
//
// Going from one mapping to another (or to «Add type mapping») with one open asks first when that mapping has unsaved work. It asks the
// mapping and nobody else: the importer form that holds this list is also a leave-guard form, and `useRequestLeave()` would have asked it
// too (changing mapping does not leave the importer). So the list is a host of its own for the mapping level (`guard`), and it is a nested
// guard of the level above, so closing that level still asks about the open mapping.
//
// `openMappingDetails` and `setOpenMappingDetails` came from the owner to size the side bars. The level no longer needs them; the setter
// is still called, as before, for whoever listens.

export const ChildMapplingList = (props) => {
  const {
    mappingList,
    setOpenMappingDetails,
    handleUpdateMultipleMapping,
    defaultImporter
  } = props

  const [, t] = useLanguage()
  const [selectedMapping, setSelectedMapping] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [openAddMapping, setOpenAddMapping] = useState(false)

  const guard = useLeaveGuardHost()
  useNestedLeaveGuard(guard.requestLeave)
  // bugs E: the Importers panel holds the page while this host has unsaved work
  useReportImportersDirty(guard.dirty)

  // The form refills itself whenever `selectedImporter` changes identity: a new object per render would wipe what is being typed.
  const selectedImporter = useMemo(
    () => (openAddMapping ? {} : { type: selectedMapping?.type, mapping: selectedMapping }),
    [openAddMapping, selectedMapping]
  )

  const handleEditMapping = (mapping, index) => {
    setOpenAddMapping(false)
    setOpenMappingDetails?.(true)
    setSelectedMapping(mapping)
    setSelectedIndex(index)
  }

  const handleOpenAddMapping = () => {
    setOpenMappingDetails?.(true)
    setSelectedIndex(null)
    setSelectedMapping({})
    setOpenAddMapping(true)
  }

  const handleClose = () => {
    setSelectedIndex(null)
    setSelectedMapping(null)
    setOpenMappingDetails?.(false)
  }

  const handleUpdateMappingList = (val) => {
    handleClose()
    const _mappingList = [...mappingList]
    const updatedMapping = JSON.parse(val.mapping)
    _mappingList[selectedIndex] = updatedMapping
    handleUpdateMultipleMapping(_mappingList)
  }

  const handleAddMapping = (val) => {
    handleClose()
    const newMapping = JSON.parse(val.mapping)
    const _mappingList = [...mappingList, { ...newMapping, type: val.type }]
    handleUpdateMultipleMapping(_mappingList)
  }

  const nameOf = (item) => t(`${item.type === 'sync_orders' ? item.type?.toUpperCase()?.trim() : item.type.replace('sync_order_', '')?.toUpperCase()?.trim()}`, `${item.type.replace('sync_', '').replace(/_/g, ' ')[0].toUpperCase() + item.type.replace('sync_', '').replace(/_/g, ' ').slice(1)}`)

  return (
    <div className='odc-root odc-imp-map'>
      {mappingList.length > 0 && (
        <ul className='odc-imp-map-list'>
          {mappingList.map((item, index) => (
            <li key={index}>
              <button
                type='button'
                className='odc-imp-map-item'
                aria-current={index === selectedIndex ? 'true' : undefined}
                onClick={() => guard.requestLeave(() => handleEditMapping(item, index))}
              >
                <span className='odc-imp-map-name'>{nameOf(item)}</span>
                <ChevronRight className='odc-icon odc-icon-flip odc-imp-map-chevron' aria-hidden='true' />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!defaultImporter && (
        <Button variant='link' onClick={() => guard.requestLeave(handleOpenAddMapping)}>
          {t('ADD_TYPE_MAPPING', 'Add type mapping')}
        </Button>
      )}
      <LeaveGuardContext.Provider value={guard.context}>
        {selectedMapping !== null && (
          <ImportersPane
            title={openAddMapping ? t('ADD_MAPPING', 'Add mapping') : t('EDIT_MAPPING', 'Edit mapping')}
            onBack={handleClose}
          >
            <ImporterForm
              isMapping
              selectedImporter={selectedImporter}
              handleCustomEditImporter={handleUpdateMappingList}
              handleCustomAddImporter={handleAddMapping}
              defaultImporter={defaultImporter}
            />
          </ImportersPane>
        )}
      </LeaveGuardContext.Provider>
    </div>
  )
}
