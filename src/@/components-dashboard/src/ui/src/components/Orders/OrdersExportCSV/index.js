import React, { useState, useEffect, useId, useRef } from 'react'
import { useLanguage, ExportCSV as ExportCSVController } from '../../../../../index'
import { Button, Checkbox, ConfirmDialog, Dialog, Menu } from '../../Shared/Product'
import { Download, Ellipsis } from '../../Shared/Icon'
import { getApiMessageDefault, translateApiMessage } from '../../../../../utils/translateApiMessage'
import { ExportContainer } from './styles'
import './orders-export-csv.css'

// redesign F6b (D-18): in a narrow page head the trigger keeps only this icon (content-header.css clips the label,
// it does not remove it, so the name stays). Wide, the icon is not drawn and the button looks as it did.
const ExportIcon = ({ className }) => <Download className={`${className ?? ''} odc-export-icon`.trim()} />

const orderStatusTabs = [
  { key: 'pending', name: 'PENDING', defaultName: 'Pending' },
  { key: 'inProgress', name: 'IN_PROGRESS', defaultName: 'In progress' },
  { key: 'completed', name: 'COMPLETED', defaultName: 'Completed' },
  { key: 'cancelled', name: 'CANCELLED', defaultName: 'Cancelled' }
]

// What the API (or the failed request) left in `actionStatus.error`, as plain lines of text.
// redesign W0-2 r2 (W0-P1-04): `error` is whatever the controller kept, so an item (or its `message`) may be a
// number, an object without text or anything else. Only text gets through: a string, a number as its digits.
// Never an object, which React cannot paint.
const toMessageText = (value) => {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

// (bugs H, 24a): a message that is only a three-digit code (an HTTP status such as 429) is not a sentence;
// the dialog says «Could not export (error 429)» instead of painting the bare digits.
const isStatusCode = (message) => /^\d{3}$/.test(message)

const getErrorMessages = (error) => {
  if (!error) return []
  const items = Array.isArray(error) ? error.flat() : [error]
  return items
    .map(item => toMessageText(typeof item === 'string' || typeof item === 'number' ? item : item?.message))
    .filter(Boolean)
}

// redesign fix-qa E4: what the API answered, read as it came. `result` is a list of messages (a string, or an
// object with `message`); the real answer is «The report will be generated and sent to your email when
// ready». Nothing is promised beyond that: an e-mail answer is «requested» and goes by e-mail, an answer with a
// file address is «ready» and offers the download, and any other answer is «requested» with its own words.
const FILE_ADDRESS = /https?:\/\/[^\s"'<>]+/i
const EMAIL_ANSWER = /e-?mail/i

const readResult = (result) => {
  const items = Array.isArray(result) ? result : (result ? [result] : [])
  const files = []
  const messages = []
  items.forEach((item) => {
    const text = typeof item === 'string' ? item : item?.message
    const address = (typeof item?.url === 'string' && item.url) || (typeof text === 'string' && text.match(FILE_ADDRESS)?.[0])
    if (address && !files.includes(address)) files.push(address)
    if (typeof text === 'string' && text && text !== address) messages.push(text)
  })
  const byEmail = files.length === 0 && messages.some(message => EMAIL_ANSWER.test(message))
  return { files, messages, kind: files.length > 0 ? 'ready' : 'requested', byEmail }
}

const ExportCSVUI = (props) => {
  const {
    actionStatus,
    getCSV,
    ordersStatusGroup,
    selectedSubOrderStatus,
    variant,
    extraItems,
    franchiseId,
    userLevel
  } = props
  const [, t] = useLanguage()
  const reasonId = useId()
  const triggerId = useId()
  // Where the focus starts in each dialog: the first tab to pick, and the only action to dismiss.
  const firstTabRef = useRef(null)
  const finishedOkRef = useRef(null)
  const failedOkRef = useRef(null)
  const failedMessagesId = useId() // redesign W0-2 r3 (W0-P2-07)
  const [modalOpen, setModalOpen] = useState(false)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [tabsModalOpen, setTabsModalOpen] = useState(false)
  const [exportWithoutMetafields, setExportWithoutMetafields] = useState(false)
  const [selectedTabs, setSelectedTabs] = useState([])
  const [exportLabel, setExportLabel] = useState('')
  // What the confirmation is about. It keeps its text while the dialog fades out.
  const [confirmState, setConfirmState] = useState({ open: false, kind: 'all', withoutMetafields: undefined, label: '', tabs: [], statuses: [] })

  // redesign fix-qa E4: no option exports on its own; each one asks first (`handleConfirmExport` calls the
  // controller with what it always sent).
  const handleExportAll = (withoutMetafields, label) => {
    setConfirmState({ open: true, kind: 'all', withoutMetafields, label, tabs: [], statuses: [] })
  }

  const handleExportFiltered = (withoutMetafields, label) => {
    setExportWithoutMetafields(!!withoutMetafields)
    setExportLabel(label)
    setSelectedTabs(ordersStatusGroup ? [ordersStatusGroup] : [])
    setTabsModalOpen(true)
  }

  const handleToggleTab = (key) => {
    setSelectedTabs(prev => prev.includes(key)
      ? prev.filter(tab => tab !== key)
      : [...prev, key])
  }

  // The picker only chooses the scope; the confirmation that follows is what exports.
  const handleConfirmTabs = () => {
    const statuses = selectedTabs.reduce((acc, key) => acc.concat(selectedSubOrderStatus?.[key] || []), [])
    const tabs = orderStatusTabs.filter(tab => selectedTabs.includes(tab.key)).map(tab => t(tab.name, tab.defaultName))
    setTabsModalOpen(false)
    setConfirmState({ open: true, kind: 'filtered', withoutMetafields: exportWithoutMetafields, label: exportLabel, tabs, statuses })
  }

  const closeConfirm = () => {
    setConfirmState(current => ({ ...current, open: false }))
  }

  const handleConfirmExport = () => {
    const { kind, withoutMetafields, statuses } = confirmState
    closeConfirm()
    if (kind === 'all') getCSV(false, withoutMetafields)
    else getCSV(true, withoutMetafields, statuses)
  }

  // The trigger is disabled while the export runs, so the browser drops the focus to the page. Before the
  // result or the error opens, the focus goes back to the trigger, which is where the dialog returns it.
  const restoreTriggerFocus = () => {
    const active = document.activeElement
    if (active && active !== document.body) return
    document.querySelector(`[data-export-trigger="${triggerId}"]`)?.focus()
  }

  // Keeps the text while the dialog fades out.
  const closeAlert = () => {
    setAlertState(current => ({ ...current, open: false }))
  }

  useEffect(() => {
    // While a new export runs the controller still holds the previous answer; it is not news.
    if (actionStatus?.loading) return
    if (actionStatus?.error) {
      restoreTriggerFocus()
      setAlertState({
        open: true,
        content: actionStatus?.error
      })
    }
    if (!actionStatus?.result || actionStatus?.error) return
    restoreTriggerFocus()
    setModalOpen(true)
  }, [actionStatus])

  const exportItems = [
    { key: 'all', label: t('EXPORT_ALL', 'Export all') },
    { key: 'filtered', label: t('EXPORT_FILTERED', 'Export filtered') },
    { key: 'all-without-metafields', label: t('EXPORT_ALL_WITHOUT_METAFIELDS', 'Export all without metafields') },
    { key: 'filtered-without-metafields', label: t('EXPORT_FILTERED_WITHOUT_METAFIELDS', 'Export filtered without metafields') }
  ].map(item => ({
    ...item,
    onSelect: () => {
      const withoutMetafields = item.key.endsWith('without-metafields') ? true : undefined
      if (item.key.startsWith('all')) handleExportAll(withoutMetafields, item.label)
      else handleExportFiltered(withoutMetafields, item.label)
    }
  }))

  // The same translation the legacy Alert applied to the messages the API sends as keys.
  // redesign W0-2d (T0-7): the shared helper; `getErrorMessages` already left only non-empty text (a string, or a
  // number as its digits; blank strings pass, and the helper gives them back as they are).
  // redesign W0-2 r2 (W0-P1-05): the two report messages have a text by default, as in main.
  const translateMessage = (message) => translateApiMessage(t, message, message, getApiMessageDefault(message))
  const errorMessages = getErrorMessages(alertState.content)
  const noTabSelected = selectedTabs.length === 0
  const closeLabel = t('CLOSE', 'Close')
  const confirmAll = confirmState.kind === 'all'
  const answer = readResult(actionStatus?.result)
  // The Export button's own attributes: the menu popup is marked so its rows can be 44px on a phone.
  const triggerMark = { 'data-export-trigger': triggerId }

  return (
    <>
      {variant === 'more'
        ? (
          // redesign 5.6-B (phones): the page's «More actions» menu. The export options are these same
          // items (same handlers, same dialogs below) and `extraItems` (the Learn articles) follow after a
          // separator. While an export runs only its options wait; the menu stays reachable.
          <Menu
            label={t('MORE_ACTIONS', 'More actions')}
            icon={Ellipsis}
            data-learn-menu={extraItems?.length ? '' : undefined}
            data-export-menu=''
            triggerProps={triggerMark}
            items={[
              ...exportItems.map(item => ({ ...item, disabled: actionStatus.loading })),
              ...(extraItems ?? []).map((item, index) => (index === 0 ? { ...item, separatorBefore: true } : item))
            ]}
          />
          )
        : (
          <ExportContainer>
            <Menu
              label={<span className='odc-export-label'>{t('EXPORT', 'Export')}</span>}
              items={exportItems}
              data-export-menu=''
              triggerProps={{
                ...triggerMark,
                icon: ExportIcon,
                title: t('EXPORT', 'Export'),
                disabled: actionStatus.loading,
                busy: actionStatus.loading
              }}
            />
          </ExportContainer>
          )}
      <Dialog
        open={tabsModalOpen}
        className='odc-export-dialog'
        initialFocus={firstTabRef}
        onOpenChange={(next) => { if (!next) setTabsModalOpen(false) }}
        size='sm'
        title={t('SELECT_TABS_TO_EXPORT', 'Select tabs to export')}
        closeLabel={closeLabel}
        footer={(
          <>
            <Button onClick={() => setTabsModalOpen(false)}>{t('CANCEL', 'Cancel')}</Button>
            <Button
              variant='primary'
              disabled={noTabSelected}
              aria-describedby={noTabSelected ? reasonId : undefined}
              onClick={handleConfirmTabs}
            >
              {t('CONTINUE', 'Continue')}
            </Button>
          </>
        )}
      >
        <div className='odc-export-tabs'>
          {orderStatusTabs.map((tab, index) => (
            <Checkbox
              key={tab.key}
              ref={index === 0 ? firstTabRef : undefined}
              checked={selectedTabs.includes(tab.key)}
              onCheckedChange={() => handleToggleTab(tab.key)}
            >
              {t(tab.name, tab.defaultName)}
            </Checkbox>
          ))}
        </div>
        {noTabSelected && (
          <p id={reasonId} className='odc-export-reason'>
            {t('SELECT_AT_LEAST_ONE_TAB_TO_EXPORT', 'Select at least one tab to export.')}
          </p>
        )}
      </Dialog>
      <ConfirmDialog
        open={confirmState.open}
        className='odc-export-dialog'
        tone='primary'
        title={t('EXPORT_ORDERS_QUESTION', 'Export orders?')}
        confirmLabel={t('EXPORT_ORDERS', 'Export orders')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={closeLabel}
        onConfirm={handleConfirmExport}
        onCancel={closeConfirm}
      >
        {/* The lead line is the option as the project words it (a catalog may say «Last 3 months»); the facts below
            are only what this screen sends and what the API answered, so the two never contradict each other. */}
        <div className='odc-export-confirm'>
          <p className='odc-export-choice'>{confirmState.label}</p>
          <ul className='odc-export-facts'>
            <li>
              {confirmAll
                // (bugs H, 37c): every order of the project, only for an admin (level 0: other levels get their
                // own orders from the API) and unless a franchise filter narrows it (the controller adds it to «Export all»
                // too) or it is the export without metafields (the API names that one «Export (Last 3 months) without
                // metafields»); otherwise the plain line stays.
                ? (Number(userLevel) !== 0 || franchiseId || confirmState.withoutMetafields
                    ? t('EXPORT_SCOPE_ALL', 'Not narrowed by the tab or the filters on screen.')
                    : t('EXPORT_SCOPE_ALL_PROJECT', 'All the project’s orders, not narrowed by the tab or the filters on screen.'))
                : `${t('EXPORT_SCOPE_FILTERED_TABS', 'Orders in')} ${confirmState.tabs.join(', ')}. ${t('EXPORT_SCOPE_FILTERED_FILTERS', 'The filters on screen are applied too.')}`}
            </li>
            <li>
              {confirmState.withoutMetafields
                ? t('EXPORT_FIELDS_WITHOUT', 'Leaves out custom fields (metafields).')
                : t('EXPORT_FIELDS_WITH', 'Includes custom fields (metafields).')}
            </li>
            <li>{t('EXPORT_DESTINATION', 'The report is generated in the background and sent to your e-mail when it is ready.')}</li>
          </ul>
        </div>
      </ConfirmDialog>
      <Dialog
        open={modalOpen}
        className='odc-export-dialog'
        initialFocus={finishedOkRef}
        onOpenChange={(next) => { if (!next) setModalOpen(false) }}
        size='sm'
        title={answer.kind === 'ready' ? t('EXPORT_READY', 'Export ready') : t('EXPORT_REQUESTED', 'Export requested')}
        closeLabel={closeLabel}
        footer={<Button ref={finishedOkRef} variant='primary' onClick={() => setModalOpen(false)}>{t('OK', 'OK')}</Button>}
      >
        <div className='odc-export-messages'>
          {answer.byEmail
            ? <p>{t('EXPORT_BY_EMAIL', 'You’ll get it by e-mail.')}</p>
            : answer.messages.map((message, i) => <p key={i}>{message}</p>)}
          {answer.files.map(address => (
            <p key={address}>
              <a className='odc-export-download' href={address} target='_blank' rel='noopener noreferrer'>
                {t('DOWNLOAD_FILE', 'Download file')}
              </a>
            </p>
          ))}
        </div>
      </Dialog>
      <Dialog
        open={alertState.open}
        className='odc-export-dialog'
        initialFocus={failedOkRef}
        onOpenChange={(next) => { if (!next) closeAlert() }}
        size='sm'
        title={t('EXPORT_FAILED', 'Export failed')}
        closeLabel={closeLabel}
        footer={<Button ref={failedOkRef} variant='primary' onClick={closeAlert}>{t('OK', 'OK')}</Button>}
        role='alertdialog' // redesign W0-2 r3 (W0-P2-07): the failure is an alert, as AlertDialog and ConfirmDialog are
        aria-describedby={errorMessages.length ? failedMessagesId : undefined}
      >
        <div id={failedMessagesId} className='odc-export-messages'>
          {errorMessages.map((message, i) => (
            <p key={i}>{isStatusCode(message) ? t('EXPORT_FAILED_CODE', 'Could not export (error _code_)').replace('_code_', () => message) : translateMessage(message)}</p>
          ))}
        </div>
      </Dialog>
    </>
  )
}

export const OrdersExportCSV = (props) => {
  const ExportCSVControlProps = {
    ...props,
    UIComponent: ExportCSVUI,
    filterValues: props.filterValues
  }
  return <ExportCSVController {...ExportCSVControlProps} />
}
