import React, { useState } from 'react'
import { useLanguage } from '../../../../../index'
import FaTrash from '@meronex/icons/fa/FaTrash'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { Button } from '../../../styles/Buttons'
import { Button as ProductButton } from '../../Shared/Product'
import { Trash2 } from '../../Shared/Icon'
import { ConfirmAdmin } from '../../Shared'

export const OrderDelete = (props) => {
  const {
    handleDeleteMultiOrders,
    // redesign fix-qa E5: how many orders are selected, so the confirmation can say it. Optional: without
    // it the confirmation names «the selected orders».
    count,
    // 'selection' = the Product button of the orders list selection bar; anything else keeps
    // the legacy button (order detail, /all-in-one).
    triggerVariant
  } = props
  const { width } = useWindowSize()
  const [, t] = useLanguage()

  const [confirmAdmin, setConfirmAdmin] = useState({ open: false, handleOnConfirm: null })

  const confirmTitle = count > 0
    ? (count === 1
        ? t('DELETE_ONE_ORDER', 'Delete 1 order?')
        : t('DELETE_N_ORDERS', 'Delete _n_ orders?').replace('_n_', count))
    : t('DELETE_SELECTED_ORDERS', 'Delete the selected orders?')

  // redesign F6d (Q3-13): the confirm button says the verb with the object («Delete order», «Delete 3 orders»).
  const confirmLabel = count > 0
    ? (count === 1
        ? t('DELETE_ORDER', 'Delete order')
        : t('DELETE_N_ORDERS_BUTTON', 'Delete _n_ orders').replace('_n_', count))
    : t('DELETE_SELECTED_ORDERS_BUTTON', 'Delete selected orders')

  const handleModalOpen = () => {
    setConfirmAdmin({
      open: true,
      // ConfirmAdmin checks the password or the code server-side (action `orders_delete`) and
      // hands over the one-time confirmation_token the DELETE now carries.
      handleOnConfirm: (token) => {
        setConfirmAdmin({ ...confirmAdmin, open: false })
        if (token) handleDeleteMultiOrders(token)
        else handleDeleteMultiOrders()
      }
    })
  }

  return (
    <>
      {triggerVariant === 'selection'
        ? (
          <ProductButton
            size='sm'
            icon={Trash2}
            data-tone='danger'
            onClick={() => handleModalOpen()}
          >
            {t('DELETE_ORDERS', 'Delete…')}
          </ProductButton>
          )
        : (
          <Button
            type='button'
            borderRadius='8px'
            color='secundary'
            aria-label={t('DELETE', 'Delete')}
            onClick={() => handleModalOpen()}
          >
            {width > 600 && t('DELETE', 'Delete')}
            <FaTrash aria-hidden='true' />
          </Button>
          )}

      <ConfirmAdmin
        open={confirmAdmin.open}
        action='orders_delete'
        title={confirmTitle}
        confirmLabel={confirmLabel}
        description={t('DELETE_ORDERS_CONFIRM_DESCRIPTION', 'Type your password to confirm. This can’t be undone.')}
        onClose={() => setConfirmAdmin({ ...confirmAdmin, open: false })}
        onConfirm={confirmAdmin.handleOnConfirm}
      />
    </>
  )
}
