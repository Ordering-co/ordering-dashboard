import React, { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { Sheet, TabPanel, Tabs } from '../../Shared/Product'
import { GloriaFoodImportDialog } from '../Importers/GloriaFoodImportDialog'
import { MenuImportDialog } from '../Importers/MenuImportDialog'
import { ImporterLogs } from '../Importers/ImporterLogs'
import { ImporterRows } from '../Importers/ImporterStorePanel'

/**
 * The importers of one store over another page (the catalog of an empty store: «Import your menu» in the start guide, main ;
 * main sync, ). Same public API as main's `BusinessImporters`: `{ open, business, onClose, onGoToProducts }`.
 * Main renders `ImportersPanel` (a SideBar) with `MenuImportModal` / `GloriaFoodImportModal`; the redesign hosts the rows of
 * /connect/importers (`ImporterRows`, with their run status) in a P/Sheet, and each row opens the redesigned dialog
 * (`GloriaFoodImportDialog` for GloriaFood, `MenuImportDialog` for the others) over it.
 *  - two tabs, as main's panel had: Importers (the rows) and Logs (`ImporterLogs`, the raw files of this store's imports, mounted on
 *    every visit as `ImporterStorePanel` does). `ImporterStorePanel` itself is not reused: its RecordPanel brings its own title and
 *    close button, which would double the Sheet's header;
 *  - the Sheet's X, the scrim and Escape call `onClose`;
 *  - «Go to products» / «Check products» in a dialog close that dialog and call `onGoToProducts` (the owner reloads the store and
 *    closes this), they do not navigate;
 *  - when a dialog closes the focus goes back to the «Import Menu» of its row, which is still mounted.
 */
export const BusinessImporters = (props) => {
  const { open, business, onClose, onGoToProducts } = props
  const [, t] = useLanguage()
  const [openCard, setOpenCard] = useState(null)
  const [tab, setTab] = useState('importers')
  const opener = useRef(null)

  const openImport = (card, button) => {
    opener.current = button
    setOpenCard(card)
  }
  const closeImport = () => setOpenCard(null)

  useEffect(() => {
    if (openCard != null || !opener.current) return
    if (opener.current.isConnected) opener.current.focus()
    opener.current = null
  }, [openCard])

  if (!business) return null

  const DialogOf = openCard?.id === 'gloriafood' ? GloriaFoodImportDialog : MenuImportDialog

  return (
    <>
      <Sheet
        open={!!open}
        onOpenChange={(next) => { if (!next) onClose?.() }}
        title={t('MENU_IMPORTERS', 'Menu importers')}
        closeLabel={t('CLOSE', 'Close')}
      >
        <Tabs
          value={tab}
          onValueChange={setTab}
          label={t('IMPORTERS_PANEL_TABS', 'Store importers')}
          size='sm'
          items={[
            { value: 'importers', label: t('IMPORTERS_TAB_IMPORTERS', 'Importers') },
            { value: 'logs', label: t('IMPORTERS_TAB_LOGS', 'Logs') }
          ]}
        >
          <TabPanel value='importers' keepMounted>
            <section className='isp-section isp-section--sheet'>
              <p className='isp-note'>{business.name || t('BUSINESS', 'Business')}</p>
              <ImporterRows business={business} onOpen={openImport} openImporterId={openCard?.id ?? null} />
            </section>
          </TabPanel>
          <TabPanel value='logs' keepMounted>
            {tab === 'logs' && <ImporterLogs business={business} onGoToImporters={() => setTab('importers')} />}
          </TabPanel>
        </Tabs>
      </Sheet>

      {open && openCard && (
        <DialogOf
          open
          card={openCard}
          business={business}
          onClose={closeImport}
          onGoToProducts={onGoToProducts}
        />
      )}
    </>
  )
}
