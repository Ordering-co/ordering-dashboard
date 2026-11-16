import React, { useEffect, useRef, useState } from 'react'
import { useEvent, useLanguage } from '../../../../../index'
import { Button, Skeleton } from '../../Shared/Product'
import { ChevronDown } from '../../Shared/Icon'
import { BusinessSelectHeader } from '../BusinessSelectHeader'
import { ImporterRows } from '../../Connect/Importers/ImporterStorePanel'
import { GloriaFoodImportDialog } from '../../Connect/Importers/GloriaFoodImportDialog'
import { MenuImportDialog } from '../../Connect/Importers/MenuImportDialog'
import '../../Connect/Importers/importer-store-panel.css'

// (main #488): the menu importers (DoorDash, Uber Eats, GloriaFood, Ordering.co) inside the Importers panel of Stores and
// Products, always with an explicit target store.
//  - From Products the store is the one open (`business`), shown by name; while it loads, a skeleton.
//  - From Stores nothing is chosen at first: the store selector (BusinessSelectHeader) picks it, and every «Import Menu» stays
//    disabled until then, with a hint that says why.
//  - Each import keeps the store it started with (the dialog gets the store of the moment it opened).
//  - Each row opens the redesigned dialog (GloriaFoodImportDialog for GloriaFood, MenuImportDialog for the others), as
//    Connect/BusinessImporters does; closing it gives the focus back to the row's «Import Menu».
export const MenuImportersTab = (props) => {
  const { business: storeBusiness, businessLoading, onImportClose, onGoToProducts } = props
  const [, t] = useLanguage()
  const [events] = useEvent()
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [showSelector, setShowSelector] = useState(false)
  const [importing, setImporting] = useState({ card: null, business: null })
  const opener = useRef(null)

  const isStoreFixed = Boolean(storeBusiness)
  const business = isStoreFixed ? (businessLoading ? null : storeBusiness) : selectedBusiness
  const hasStore = Boolean(business?.id)

  const handleSelectBusiness = (value) => {
    setShowSelector(false)
    setSelectedBusiness(value)
  }

  const handleOpenAddBusiness = () => {
    setShowSelector(false)
    events.emit('go_to_page', { page: 'business_add' })
  }

  const openImport = (card, button) => {
    if (!hasStore) return
    opener.current = button
    setImporting({ card, business })
  }

  const closeImport = () => {
    setImporting({ card: null, business: null })
    onImportClose && onImportClose()
  }

  useEffect(() => {
    if (importing.card != null || !opener.current) return
    if (opener.current.isConnected) opener.current.focus()
    opener.current = null
  }, [importing.card])

  const DialogOf = importing.card?.id === 'gloriafood' ? GloriaFoodImportDialog : MenuImportDialog

  return (
    <section className='odc-root isp-section isp-section--sheet' data-testid='menu-importers'>
      <div data-testid='menu-importers-store'>
        <p className='isp-note'>{t('IMPORTER_MODAL_BUSINESS_LABEL', 'Store')}</p>
        {isStoreFixed
          ? (
            <p data-testid='menu-importers-store-name'>
              {hasStore ? business.name : <Skeleton size='10rem' />}
            </p>
            )
          : (
            <Button
              variant='secondary'
              onClick={() => setShowSelector(!showSelector)}
              aria-expanded={showSelector}
              data-testid='menu-importers-store-select'
            >
              {selectedBusiness?.name || t('SELECT_BUSINESS', 'Select business')}
              <ChevronDown className='odc-icon' aria-hidden='true' />
            </Button>
            )}
        {showSelector && (
          <BusinessSelectHeader
            isOpen={showSelector}
            close={() => setShowSelector(false)}
            changeBusinessState={handleSelectBusiness}
            handleOpenAddBusiness={handleOpenAddBusiness}
          />
        )}
      </div>
      {!isStoreFixed && !hasStore && (
        <p className='isp-note' data-testid='menu-importers-store-hint'>
          {t('MENU_IMPORTERS_SELECT_STORE', 'Select the store you want to import the menu into.')}
        </p>
      )}
      <ImporterRows
        business={business}
        onOpen={openImport}
        openImporterId={importing.card?.id ?? null}
        disabled={!hasStore}
      />
      {importing.card && (
        <DialogOf
          open
          card={importing.card}
          business={importing.business}
          onClose={closeImport}
          onGoToProducts={onGoToProducts}
        />
      )}
    </section>
  )
}
