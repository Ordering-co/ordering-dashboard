import React, { useEffect, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { Maximize2, Minimize2, TriangleAlert } from '../../Shared/Icon'
import { Button, IconButton, RecordPanel, useSplitView } from '../../Shared/Product'
import { GloriaFoodImportDialog } from './GloriaFoodImportDialog'
import { IMPORTER_CARDS } from './importerCards'
import { ImporterLogs } from './ImporterLogs'
import { ImporterRunStatus } from './ImporterRunStatus'
import { MenuImportDialog } from './MenuImportDialog'
import './importer-store-panel.css'

// `hideRunStatus`: the importer whose dialog is open hides its status line (the dialog shows it), as in main (`openImporterId`)
const ImporterRow = ({ card, business, onImport, hideRunStatus = false, disabled = false }) => {
  const [, t] = useLanguage()
  const importButton = useRef(null)
  const title = t(card.titleKey, card.titleDefault)
  return (
    <li className='isp-row' data-testid={`importer-row-${card.id}`}>
      {/* the brand colour of each importer is data of importerCards (as in main); it is the only literal colour of the panel */}
      <span className='isp-logo' style={{ background: card.logoColor }} aria-hidden='true'>{card.logoLabel}</span>
      <span className='isp-row-text'>
        <span className='isp-row-name'>{title}</span>
        <span className='isp-note'>{t(card.descriptionKey, card.descriptionDefault)}</span>
        {card.showImagesNote && (
          <span className='isp-warning' data-testid='gloriafood-images-note'>
            <TriangleAlert className='odc-icon' aria-hidden='true' />
            <span>{t('IMPORTER_GLORIAFOOD_IMAGES_NOTE', 'Product images cannot be migrated via the GloriaFood API.')}</span>
          </span>
        )}
        {/* Retry opens the importer again; the focus comes back to this row's «Import Menu» (the Retry button is gone by then) */}
        <ImporterRunStatus
          card={card}
          business={business}
          hidden={hideRunStatus}
          onRetry={() => onImport(card, importButton.current)}
        />
      </span>
      <span className='isp-row-action'>
        <Button
          ref={importButton}
          aria-label={t('IMPORTERS_IMPORT_FROM', 'Import menu from _name_').replace('_name_', title)}
          onClick={(event) => onImport(card, event.currentTarget)}
          disabled={disabled}
          data-testid={`importer-import-${card.id}`}
        >
          {t(card.importButtonKey, card.importButtonDefault)}
        </Button>
      </span>
    </li>
  )
}

/**
 * The importer rows of a store (the list of the Importers tab), reusable by another surface: each row has its logo, name, description,
 * the run status of the last import of this store and importer (main sync, ) and «Import Menu».
 * `onOpen(card, button)` is called to open that importer's dialog (`button` is the element to give the focus back to);
 * `openImporterId` is the card whose dialog is open: its row hides the status line.
 * `disabled` (main #488): no store chosen yet, so no row can start an import.
 */
export const ImporterRows = ({ business, onOpen, openImporterId = null, disabled = false }) => (
  <ul className='isp-list'>
    {IMPORTER_CARDS.map((card) => (
      <ImporterRow
        key={card.id}
        card={card}
        business={business}
        onImport={onOpen}
        hideRunStatus={card.id === openImporterId}
        disabled={disabled}
      />
    ))}
  </ul>
)

/**
 * The panel of a store of /connect/importers (redesign IM-B, , decision D2): one RecordPanel with the store and two tabs,
 * Importers (the four rows with «Import Menu») and Logs. It replaces `ImportersPanel` of main (a SideBar). No controller and no
 * request of its own, as in main: `business` is the row of the list, and the shell mounts this only with a row (so a `?id=` of a
 * store that is not on the page shows no panel, as in main). The shell mounts it with `key={business.id}`, so each store starts clean.
 *  - «Import Menu» opens the dialog of batch C over the panel (`GloriaFoodImportDialog` for GloriaFood, `MenuImportDialog` for the
 *    others) with `{ open, card, business, onClose }`; closing gives the focus back to the button that opened it.
 *  - The Logs tab mounts `ImporterLogs` on every visit (in main the tab mounts when pressed, and its requests start then);
 *    RecordPanel keeps every panel mounted, so the tab that is not shown is given nothing.
 */
export const ImporterStorePanel = ({ business, expanded = false, onExpandedChange, onClose }) => {
  const [, t] = useLanguage()
  const split = useSplitView()
  const phone = split.mode === 'full'
  const [tab, setTab] = useState('importers')
  const [openCard, setOpenCard] = useState(null)
  const opener = useRef(null)

  const changeTab = (next) => setTab(next)

  const openImport = (card, button) => {
    opener.current = button
    setOpenCard(card)
  }
  const closeImport = () => setOpenCard(null)

  // The dialog goes; the focus goes back to the button that opened it (it is a button of this panel, still mounted)
  useEffect(() => {
    if (openCard != null || !opener.current) return
    if (opener.current.isConnected) opener.current.focus()
    opener.current = null
  }, [openCard])

  const headerActions = !phone && onExpandedChange && (
    <IconButton
      icon={expanded ? Minimize2 : Maximize2}
      label={expanded ? t('BACK_TO_SPLIT_VIEW', 'Back to split view') : t('OPEN_AS_PAGE', 'Open as page')}
      onClick={() => onExpandedChange(!expanded)}
    />
  )

  const importers = (
    <section className='isp-section' aria-labelledby='isp-importers-title'>
      <h3 id='isp-importers-title' className='isp-heading'>{t('MENU_IMPORTERS', 'Menu importers')}</h3>
      <ImporterRows business={business} onOpen={openImport} openImporterId={openCard?.id ?? null} />
    </section>
  )

  const DialogOf = openCard?.id === 'gloriafood' ? GloriaFoodImportDialog : MenuImportDialog

  return (
    <>
      <RecordPanel
        data-testid='importer-store-panel'
        title={business?.name || t('BUSINESS', 'Business')}
        subtitle={business?.city?.name || undefined}
        closeLabel={phone ? t('BACK', 'Back') : t('CLOSE', 'Close')}
        onClose={onClose}
        headerActions={headerActions || undefined}
        tabs={{
          label: t('IMPORTERS_PANEL_TABS', 'Store importers'),
          value: tab,
          onValueChange: changeTab,
          items: [
            { value: 'importers', label: t('IMPORTERS_TAB_IMPORTERS', 'Importers'), content: importers },
            {
              value: 'logs',
              label: t('IMPORTERS_TAB_LOGS', 'Logs'),
              // redesign IM-R1-2 (review r1 #2): mounted on every visit, as main did, so the logs are asked for again and an
              // import made meanwhile shows up; RecordPanel keeps every panel mounted, so the hidden tab gets nothing
              content: tab === 'logs' ? <ImporterLogs business={business} onGoToImporters={() => changeTab('importers')} /> : null
            }
          ]
        }}
      />

      {openCard && <DialogOf open card={openCard} business={business} onClose={closeImport} />}
    </>
  )
}
