import React, { useEffect, useRef, useState } from 'react'
import { useLanguage, UsersExportCSV as UsersExportCSVController } from '../../../../../index'
import { AlertDialog, Button, ConfirmDialog } from '../../Shared/Product'
import { Download } from '../../Shared/Icon'
import { toAlertContent } from '../../../../../utils/alertContent'

// redesign UC-B6 (decision 5, M-C13, auditor #12): the page's export button. It asks first (decision 25: scope and
// destination), says what the file holds, and shows what the API answered without claiming more than that.
// redesign BO-B2 (promotion): moved from CustomersDirectory/CustomersExport.jsx. Its words come in the `copy` prop, each as
// `{ key, text }` (a translation key with its default text): button, title, confirm, scopeAll, scopeFiltered, resultTitle,
// requested, error. `copy` is required: there is no default, so a page can never export under another page's words.
const say = (t, entry) => t(entry.key, entry.text)

// What `K/UsersExportCSV` turns into a condition when it exports with `getCSV(true)`. The search, the Orders
// segmented control and the Active/Inactive tab are not props of the export, and ID / External ID are not read by
// it, so none of those counts: the sentence in the confirmation must be true of the request that goes out.
const hasText = (value) => typeof value === 'string' ? value.trim() !== '' : value != null && value !== ''

export const hasSheetFields = (multiFilterValues) => {
  const values = multiFilterValues || {}
  return (
    ['name', 'lastname', 'email', 'cellphone'].some(key => hasText(values[key])) ||
    ['countryPhoneCode', 'phoneVerified', 'emailVerified', 'userType', 'loyaltyLevel', 'enabled', 'deliveryFromDatetime', 'deliveryEndDatetime']
      .some(key => values[key] != null && values[key] !== '') ||
    (Array.isArray(values.cityIds) && values.cityIds.length > 0) ||
    hasText(values.ordersCount?.value)
  )
}

const UsersExportUI = (props) => {
  const { actionStatus, getCSV, disabled, multiFilterValues, copy } = props
  const [, t] = useLanguage()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [resultState, setResultState] = useState({ open: false, title: '', content: [] })
  // Only an answer to a request made from this button is news; the controller keeps its last answer between uses.
  const requested = useRef(false)

  const handleConfirm = () => {
    setConfirmOpen(false)
    requested.current = true
    getCSV(true)
  }

  useEffect(() => {
    if (!requested.current || actionStatus?.loading) return
    requested.current = false
    const title = say(t, copy.resultTitle)
    if (actionStatus?.error) {
      // `error` is whatever the request threw; its text is for the console, not for the person exporting.
      setResultState({ open: true, title, content: [say(t, copy.error)] })
      return
    }
    // The API usually answers that the report was requested (and will arrive by e-mail), so the title stays neutral.
    setResultState({
      open: true,
      title,
      content: toAlertContent(actionStatus?.result, say(t, copy.requested))
    })
  }, [actionStatus])

  return (
    <>
      <Button
        icon={Download}
        busy={!!actionStatus?.loading}
        disabled={disabled}
        onClick={() => setConfirmOpen(true)}
      >
        {/* redesign (row 92): its own node, so a narrow page header clips it (data-collapse-label) instead of the page hiding a bare text with font-size: 0 */}
        <span data-collapse-label>{say(t, copy.button)}</span>
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        tone='primary'
        title={say(t, copy.title)}
        confirmLabel={say(t, copy.confirm)}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      >
        {hasSheetFields(multiFilterValues)
          // redesign UC-R2b (Q-03): Verified, Sign up date and Loyalty level are pills, not part of the Filters panel, and they apply
          ? say(t, copy.scopeFiltered)
          : say(t, copy.scopeAll)}
      </ConfirmDialog>
      <AlertDialog
        open={resultState.open}
        title={resultState.title}
        content={resultState.content}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={() => setResultState(current => ({ ...current, open: false }))}
      />
    </>
  )
}

// Takes what today's `U/UsersExportCSV` takes from `CustomersListing`: defaultUserTypesSelected,
// disabledActiveStateCondition, userTypesSelected, selectedUserActiveState, multiFilterValues.
export const UsersExport = (props) => (
  <UsersExportCSVController {...props} UIComponent={UsersExportUI} />
)
