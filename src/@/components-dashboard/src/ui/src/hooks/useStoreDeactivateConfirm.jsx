import { useLanguage } from '../../../index'
import { useConfirmStep } from './useConfirmStep'

// redesign (owner decision 31 A, 2026-10-21; ): switching a store off asks first, as deactivating a driver,
// a customer or a group does; switching it on does not. Shared by the Enabled switch of a /stores/list row (table, cards, phone),
// the store editor header and the store panel of Connect › POS & Menu, which all save `enabled` on the store.
//   title    t('STORES_DEACTIVATE_TITLE', 'Deactivate _name_?')
//   body     t('STORES_DEACTIVATE_BODY', "Customers won't be able to order from it until you turn it back on.")
//   confirm  t('STORES_DEACTIVATE_CONFIRM', 'Deactivate store')
// A ConfirmDialog with tone danger and the initial focus on Cancel (useConfirmStep). Cancel writes nothing.
//
// Returns `{ confirmChange(next, name), dialog }`: `confirmChange` resolves `true` at once when `next` is on, and the answer of the
// dialog when it is off (the shape of P/AsyncSwitch `confirmChange`); `dialog` is a node the host renders once.

export const useStoreDeactivateConfirm = () => {
  const [, t] = useLanguage()
  const { ask, dialog } = useConfirmStep()

  const confirmChange = (next, name) => {
    if (next) return Promise.resolve(true)
    return ask({
      title: t('STORES_DEACTIVATE_TITLE', 'Deactivate _name_?').replace('_name_', () => name || ''),
      body: t('STORES_DEACTIVATE_BODY', "Customers won't be able to order from it until you turn it back on."),
      confirmLabel: t('STORES_DEACTIVATE_CONFIRM', 'Deactivate store'),
      tone: 'danger'
    })
  }

  return { confirmChange, dialog }
}
