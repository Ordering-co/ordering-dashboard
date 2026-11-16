import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLanguage, UsersExportCSV as UsersExportCSVController } from '../../../../../index'
import { AlertDialog, Button, ConfirmDialog } from '../../Shared/Product'
import { Download } from '../../Shared/Icon'
import { toAlertContent } from '../../../../../utils/alertContent'
import { directoryCopy } from './directoryRole'

// redesign DL-B4 (decision 3 | M-DL12; decision 25): the export button of /delivery/drivers-list. It asks first (scope), says what the
// file holds and shows what the API answered, without claiming more than that.
//
// What the confirmation says is what `K/UsersExportCSV` sends with `getCSV(true)` and the four props main's header gives it
// (the former drivers header: defaultUserTypesSelected, disabledActiveStateCondition, userTypesSelected, selectedUserActiveState):
//   - K/UsersExportCSV:45-47  `if (userTypesSelected.length > 0) filterConditons.push({ attribute: 'level', value: userTypesSelected })`
//     (the page's value is [4]: drivers)
//   - K/UsersExportCSV:48-50  the `enabled` condition is commented out: active AND inactive accounts go out
//   - K/UsersExportCSV:51    the search needs `searchValue` (and `isSearchBy*`), which this button never receives; `multiFilterValues`
//     (line 112) is not received either. The page's status filter is not a prop of the controller at all.
//   - K/UsersExportCSV:262-265  with `getCSV(true)` the URL is `users_new.csv?mode=dashboard&orderBy=id&version=v2&where=<conditions>`
// So the request is `where={level: [4]}` and nothing else (no page, no page_size). The API's own scope (for
// a level 5 session, say) and where the file ends up are NOT in the code: the sentence names neither, and the result dialog repeats
// what the API answered. Only these four props and `disabled` are forwarded, so the page cannot make the sentence untrue by accident.

const DriversExportUI = (props) => {
  const { actionStatus, getCSV, disabled, role } = props
  const [, t] = useLanguage()
  // redesign DM-B4 (decision 1 | M-DL12): the title and the scope sentence of the role; the default is the drivers' ones
  const copy = directoryCopy(role, t)
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
    const title = t('DRIVERS_EXPORT_RESULT_TITLE', 'Export')
    if (actionStatus?.error) {
      // `error` is whatever the request threw; its text is for the console, not for the person exporting.
      setResultState({ open: true, title, content: [t('DRIVERS_EXPORT_ERROR', 'The export failed. Try again.')] })
      return
    }
    // The title stays neutral: the API's answer says what happens next (it is shown as it came)
    setResultState({
      open: true,
      title,
      content: toAlertContent(actionStatus?.result, t('DRIVERS_EXPORT_REQUESTED', 'The export was requested.'))
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
        {t('DRIVERS_EXPORT_CSV', 'Export CSV')}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        tone='primary'
        title={copy.exportTitle}
        confirmLabel={t('DRIVERS_EXPORT_CONFIRM', 'Export CSV')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      >
        {copy.exportScope}
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

// Takes what main's former drivers header passed `UsersExportCSV`: defaultUserTypesSelected, disabledActiveStateCondition,
// userTypesSelected, selectedUserActiveState, and `disabled` (the page's actionDisabled). Nothing else goes to the controller.
// redesign DM-B4 (decision 1 | M-DL12): `role` ('drivers' by default) is for the UI only: it picks the texts of the confirmation and is NOT a prop of the controller.
// The UI bound to a role is kept per role (not rebuilt on each render), or an open dialog would be remounted and lost.
export const DriversExport = ({
  defaultUserTypesSelected,
  disabledActiveStateCondition,
  userTypesSelected,
  selectedUserActiveState,
  disabled,
  role = 'drivers'
}) => {
  const UIComponent = useCallback((uiProps) => <DriversExportUI {...uiProps} role={role} />, [role])
  return (
    <UsersExportCSVController
      defaultUserTypesSelected={defaultUserTypesSelected}
      disabledActiveStateCondition={disabledActiveStateCondition}
      userTypesSelected={userTypesSelected}
      selectedUserActiveState={selectedUserActiveState}
      disabled={disabled}
      UIComponent={UIComponent}
    />
  )
}
