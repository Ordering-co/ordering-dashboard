import React, { useEffect, useState } from 'react'
import {
  useLanguage,
  useSession,
  ImporterListing as ImportersListingController
} from '../../../../../index'
import { canOpenDashboardRoute } from '../../../../../utils/dashboardNavigation'

import { Button, TabPanel, Tabs } from '../../Shared/Product'
import { useRequestLeave } from '../../Shared/Product/LeaveGuard'
import { Plus } from '../../Shared/Icon'
import { LearnDropDown } from '../../Shared/LearnDropDown'
import { ImportersList } from '../ImportersList'
import { ImporterForm } from '../ImporterForm'
import { ImporterJobForm } from '../ImporterJobForm'
import { ImportersPane } from '../ImportersButton/ImportersPanes'
import { learnOptionsValues } from '../../../utils'
import { MenuImportersTab } from './MenuImportersTab'
import '../ImportersList/importers-list.css'

// redesign stores 3.C: level 0 of the Importers panel. The two side bars it opened (the importer form and the import of a
// file) are now ONE level 1 of the panel (P/ImportersPane): «Import file» (a row, Enter on it, or the row menu) opens the
// ImporterJobForm; «Edit» and «Add importer» open the ImporterForm. Only one at a time: opening another replaces it, and doing so (like
// closing the panel) asks first when the open form has unsaved work (the leave guard of the panel). The advanced options and the mapping
// of a multiple importer are level 2, declared by those forms. The legacy `setExtraOpen`, `moveDistance`, `openMappingDetails` and
// `handleOpenChildForm` are gone with the side bars. The help modal (ImporterHelpContent) was never reachable (nothing set
// `openImporterHelp`), so it goes (decision 8: no redesign of it; the folder stays).

export const ImportersListingUI = (props) => {
  const {
    importerList,
    getImporters,
    actionStatus,
    handleDeleteImporter,
    handleSuccessAddImporter,
    handleSuccessUpdateImporter,
    onImportSuccess,
    business,
    businessLoading,
    onMenuImportClose,
    onMenuImportGoToProducts
  } = props
  const [, t] = useLanguage()
  // (main #488): two tabs, the menu importers (with an explicit target store) and the CSV importers. Who cannot open
  // /connect/importers (a business owner) keeps only the CSV importers, without tabs.
  const [{ user }] = useSession()
  const canUseMenuImporters = canOpenDashboardRoute('/connect/importers', user?.level)
  const [selectedTab, setSelectedTab] = useState('menu')
  const activeTab = canUseMenuImporters ? selectedTab : 'csv'
  const requestLeave = useRequestLeave()
  // The open level 1: { kind: 'import' | 'edit' | 'add', importer }
  const [detail, setDetail] = useState(null)

  const learnOptions = learnOptionsValues(
    [
      'importers',
      'business_importer',
      'category_importers',
      'products_importers',
      'users_importers',
      'creating_new_importer',
      'import_full_menu',
      'import_orders'
    ],
    t
  )

  const closeDetail = () => setDetail(null)
  // A form closes itself after saving. With «Save and continue» the leave guard of the level is still waiting for that save, and
  // it drops the way out if its level unmounts first (P/LeaveGuard: «nowhere to go on from»). So the form's own close waits one
  // turn, and only closes the level while it still shows that record: by then the way out that asked may have opened another.
  const closeDetailAfterSave = () => {
    const shown = detail
    setTimeout(() => setDetail(current => (current === shown ? null : current)), 0)
  }
  // changing the record of level 1 goes through the leave guard (nothing open or nothing dirty: it opens at once)
  const openDetail = (next) => requestLeave(() => setDetail(next))

  const importFile = (importer) => openDetail({ kind: 'import', importer })
  const editImporter = (importer) => openDetail({ kind: 'edit', importer })
  const addImporter = () => {
    setSelectedTab('csv')
    openDetail({ kind: 'add', importer: null })
  }

  // An importer that was deleted (its row is gone) cannot keep its detail open
  const openId = detail?.importer?.id
  const stillListed = openId == null || Boolean(importerList?.loading) || (importerList?.importers || []).some(item => item.id === openId)
  useEffect(() => {
    if (!stillListed) setDetail(null)
  }, [stillListed])

  const importer = detail?.importer
  // the title follows a rename saved from the form; the forms keep the record they opened with, as the side bars did
  const listed = (importerList?.importers || []).find(item => item.id === openId)
  const importerName = listed?.name ?? importer?.name ?? ''

  const csvImporters = (
    <>
      {canUseMenuImporters && (
        <p className='odc-root odc-imp-store-hint' data-testid='csv-importers-store-hint'>
          {t('CSV_IMPORTERS_STORE_HINT', 'Each CSV file sets the stores it imports into.')}
        </p>
      )}
      <ImportersList
        importerList={importerList}
        getImporters={getImporters}
        actionStatus={actionStatus}
        handleDeleteImporter={handleDeleteImporter}
        activeImporterId={detail && detail.kind !== 'add' ? importer?.id : undefined}
        onImportFile={importFile}
        onEditImporter={editImporter}
        onAddImporter={addImporter}
      />
    </>
  )

  return (
    <>
      <div className='odc-root odc-imp-list-head'>
        <LearnDropDown learnOptions={learnOptions} />
        <Button variant='secondary' icon={Plus} onClick={addImporter}>
          {t('ADD_IMPORTER', 'Add importer')}
        </Button>
      </div>
      {canUseMenuImporters
        ? (
          <Tabs
            value={activeTab}
            onValueChange={setSelectedTab}
            label={t('IMPORTERS', 'Importers')}
            size='sm'
            items={[
              { value: 'menu', label: t('MENU_IMPORTERS', 'Menu importers') },
              { value: 'csv', label: t('CSV_IMPORTERS', 'CSV importers') }
            ]}
          >
            <TabPanel value='menu' keepMounted>
              <MenuImportersTab
                business={business}
                businessLoading={businessLoading}
                onImportClose={onMenuImportClose}
                onGoToProducts={onMenuImportGoToProducts}
              />
            </TabPanel>
            <TabPanel value='csv' keepMounted>
              {csvImporters}
            </TabPanel>
          </Tabs>
          )
        : csvImporters}
      {detail?.kind === 'import' && (
        <ImportersPane title={importerName} onBack={closeDetail}>
          <ImporterJobForm
            key={importer?.id}
            selectedImporter={importer}
            handleSuccessUpdateImporter={handleSuccessUpdateImporter}
            onImportSuccess={onImportSuccess}
            onClose={closeDetailAfterSave}
          />
        </ImportersPane>
      )}
      {(detail?.kind === 'edit' || detail?.kind === 'add') && (
        <ImportersPane
          title={detail.kind === 'edit' ? t('EDIT_IMPORTER', 'Edit importer') : t('ADD_IMPORTER', 'Add importer')}
          onBack={closeDetail}
        >
          <ImporterForm
            key={importer?.id || 'new'}
            openNewImporter
            selectedImporter={importer || {}}
            handleSuccessAdd={handleSuccessAddImporter}
            handleSuccessUpdateImporter={handleSuccessUpdateImporter}
            onClose={closeDetailAfterSave}
          />
        </ImportersPane>
      )}
    </>
  )
}

export const ImportersListing = (props) => {
  const importersListingProps = {
    ...props,
    UIComponent: ImportersListingUI,
    asDashboard: true
  }

  return (
    <ImportersListingController {...importersListingProps} />
  )
}
