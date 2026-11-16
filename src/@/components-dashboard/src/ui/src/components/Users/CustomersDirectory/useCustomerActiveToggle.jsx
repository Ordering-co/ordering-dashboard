import { useLanguage } from '../../../../../index'
import { useActiveToggle } from '../../../hooks/useActiveToggle'
import { customerName } from './customerData'

// redesign UC-B2 (decision 5 / decision 25 C8, defect M-10): the status switch of the customers list. Activating is immediate;
// deactivating asks first, in a ConfirmDialog with the initial focus on Cancel; a failure of the API opens an AlertDialog and the
// switch stays where it was.
// redesign BO-B2 (a): the behavior moved to `U/hooks/useActiveToggle` (the business owners list shares it); this keeps the
// customers' texts and the same `{ onToggleActive, pendingIds, dialogs }` result.
export const useCustomerActiveToggle = ({ handleChangeActiveUser } = {}) => {
  const [, t] = useLanguage()
  return useActiveToggle({
    handleChangeActiveUser,
    confirmDeactivate: {
      title: (user) => t('CUSTOMERS_DEACTIVATE_TITLE', 'Deactivate _name_?').replace('_name_', customerName(user, t)),
      body: t('CUSTOMERS_DEACTIVATE_BODY', 'The account becomes inactive. You can activate it again at any time.'),
      confirmLabel: t('CUSTOMERS_DEACTIVATE_CONFIRM', 'Deactivate customer')
    },
    failureTitle: t('CUSTOMERS_STATUS_ERROR_TITLE', "The status didn't change"),
    failureFallback: t('CUSTOMERS_STATUS_ERROR', 'Something went wrong. Try again.')
  })
}
