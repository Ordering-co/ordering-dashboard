import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { UpgradeOffer as UpgradeOfferController } from '../../../../index'

/**
 * (sidebar follow-up): one shared fetch of the legacy-upgrade offer for both the
 * sidebar card and the UpgradeOfferModal, instead of each mounting its own `UpgradeOffer`
 * controller. The modal's "once a day" auto-open stays local to the modal; this context only
 * owns the data and the one open/close flag both surfaces use to open the same modal.
 */
export const UpgradeOfferContext = createContext()

// Bridges the controller's computed `offer` prop into this provider's state. A plain function
// component (not inline) so the controller doesn't remount it on every offer change.
const OfferSync = ({ offer, onOffer }) => {
  useEffect(() => { onOffer(offer) }, [offer, onOffer])
  return null
}

export const UpgradeOfferProvider = ({ children }) => {
  const [offer, setOffer] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const openModal = useCallback(() => setIsModalOpen(true), [])
  const closeModal = useCallback(() => setIsModalOpen(false), [])

  const value = useMemo(() => ({ offer, isModalOpen, openModal, closeModal }), [offer, isModalOpen, openModal, closeModal])

  return (
    <UpgradeOfferContext.Provider value={value}>
      <UpgradeOfferController UIComponent={OfferSync} onOffer={setOffer} />
      {children}
    </UpgradeOfferContext.Provider>
  )
}

const DEFAULT_CONTEXT = { offer: null, isModalOpen: false, openModal: () => {}, closeModal: () => {} }

export function useUpgradeOffer () {
  const context = useContext(UpgradeOfferContext)
  return context || DEFAULT_CONTEXT
}
