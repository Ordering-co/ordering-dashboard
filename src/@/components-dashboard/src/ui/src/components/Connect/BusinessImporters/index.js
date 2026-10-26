import React, { useState } from 'react'
import { ImportersPanel } from '../ImportersPanel'
import { MenuImportModal } from '../Importers/MenuImportModal'
import { GloriaFoodImportModal } from '../Importers/GloriaFoodImportModal'

export const BusinessImporters = (props) => {
  const { open, business, onClose, onGoToProducts } = props

  const [importModal, setImportModal] = useState({ open: false, card: null })

  const handleImportClick = (card) => {
    setImportModal({ open: true, card })
  }

  const handleCloseImportModal = () => {
    setImportModal({ open: false, card: null })
  }

  if (!business) return null

  return (
    <>
      <ImportersPanel
        open={open}
        business={business}
        onClose={onClose}
        onImportClick={handleImportClick}
        openImporterId={importModal.open ? importModal.card?.id : null}
      />
      {importModal.open && (
        importModal.card?.id === 'gloriafood'
          ? (
            <GloriaFoodImportModal
              open={importModal.open}
              business={business}
              onClose={handleCloseImportModal}
              onGoToProducts={onGoToProducts}
            />
            )
          : (
            <MenuImportModal
              open={importModal.open}
              card={importModal.card}
              business={business}
              onClose={handleCloseImportModal}
              onGoToProducts={onGoToProducts}
            />
            )
      )}
    </>
  )
}
