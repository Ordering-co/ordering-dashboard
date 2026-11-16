import React, { useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import {
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  IconButton,
  InlineNotice,
  Menu,
  RecordCardList
} from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { Ellipsis, TriangleAlert, Upload, X } from '../../Shared/Icon'
import { focusWhenFree } from '../ImportersButton/ImportersPanes'
import './importers-list.css'

// redesign stores 3.C: level 0 of the Importers panel as a Product DataTable (RecordCards under 768px). It draws what the
// ImporterListing controller gives and fetches nothing. What changes from the legacy list (decisions 6, 8, 12b of the plan):
//  - «Enable» is gone: the API has no state for an importer, so the switch was decoration (it never saved).
//  - Delete asks first (ConfirmDialog, danger): the legacy menu deleted on the click.
//  - The failed load and the failed delete are shown (the legacy list showed neither), and the load can be retried.
// Kept: Name, a click (or Enter) on the row imports a file, the row menu has Edit and Delete (Delete is not offered for the default
// importers). J2 row 15 (P-1): the repeated «Add new importer» under the list is gone; «Add importer» of the panel's header stays.

// The importers the API brings to every project cannot be deleted. The legacy menu knew 8 slugs; the API also brings others
// (`sync_full_menu_default_v2`, `sync_users_default`, `sync_external_orders_default`), so every slug with `_default` counts
// (n.º 15, stores-3-c P-2, owner 2026-10-20).
const isDefaultImporter = importer => typeof importer?.slug === 'string' && importer.slug.includes('_default')

const SKELETON_ROWS = 10 // the legacy list drew 10 loading rows

/**
 * The readable name of an importer type (the titles ImporterJobForm gave its form). A type that is not in the table is shown as it comes.
 *
 * @param {string} type  `importer.type`, e.g. `sync_products`
 * @param {(key: string, text: string) => string} t
 * @returns {string}
 */
export const importerTypeLabel = (type, t) => {
  switch (type) {
    case 'sync_businesses':
      return t('STORE_IMPORTER', 'Store importer')
    case 'sync_categories':
      return t('CATEGORY_IMPORTER', 'Category importer')
    case 'sync_products':
      return t('PRODUCT_IMPORTER', 'Product importer')
    case 'sync_extra_products':
      return t('EXTRA_PRODUCTS', 'Extra products')
    case 'sync_extras':
      return t('EXTRAS', 'Extras')
    case 'sync_extra_options':
      return t('EXTRA_OPTIONS', 'Extra options')
    case 'sync_extra_option_suboptions':
      return t('EXTRA_OPTION_SUBOPTIONS', 'extra option suboptions')
    case 'sync_multiple':
      return t('MULTIPLE', 'Multiple')
    case 'sync_users':
      return t('USER_IMPORTER', 'User importer')
    default:
      return type ?? ''
  }
}

const nameLabel = (template, importer) => template.replace('_name_', importer?.name ?? '')

// What the API (or a thrown error) left as the failure: a string, or a list of strings / { message }.
const errorText = (t, error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .filter(Boolean)
  .map(message => translateApiMessage(t, message, message))
  .join(' ')

// The card is a link to this same address (a middle click opens the panel again); a plain click goes through `onOpen`.
const cardHref = () => (typeof window === 'undefined' ? '#' : `${window.location.pathname}${window.location.search}`)

// ---- ⋯: Import file, Edit, Delete ---------------------------------------------------------------------------------------------------
const ImporterRowMenu = ({ importer, onImportFile, onEdit, onDelete }) => {
  const [, t] = useLanguage()
  const items = [
    { key: 'import', label: t('IMPORT_FILE', 'Import file'), onSelect: () => onImportFile(importer) },
    { key: 'edit', label: t('EDIT', 'Edit'), onSelect: () => onEdit(importer) }
  ]
  if (!isDefaultImporter(importer)) {
    items.push({ key: 'delete', label: t('DELETE', 'Delete'), tone: 'danger', separatorBefore: true, onSelect: () => onDelete(importer) })
  }
  return (
    // the menu is portaled: its clicks still bubble through React, and none of them may open the row
    <span className='odc-imp-list-menu' data-odc-no-open='' data-card-actions='' onClick={event => event.stopPropagation()}>
      <Menu
        icon={Ellipsis}
        label={nameLabel(t('IMPORTERS_ROW_ACTIONS', 'Actions for _name_'), importer)}
        items={items}
      />
    </span>
  )
}

/**
 * @param {object} props
 * @param {{loading: boolean, error: *, importers: Array<object>}} props.importerList  state of the ImporterListing controller
 * @param {Function} props.getImporters            retry of a load that failed
 * @param {{loading: boolean, error: *}} [props.actionStatus]  state of the delete
 * @param {Function} props.handleDeleteImporter    `(id)`: only called once the person confirmed
 * @param {number|string} [props.activeImporterId] the importer whose detail is open: its row is the active one
 * @param {Function} props.onImportFile            `(importer)`: row click, Enter and «Import file»
 * @param {Function} props.onEditImporter          `(importer)`
 */
export const ImportersList = (props) => {
  const {
    importerList,
    getImporters,
    actionStatus,
    handleDeleteImporter,
    activeImporterId,
    onImportFile,
    onEditImporter
  } = props
  const [, t] = useLanguage()
  const isPhone = useIsPhone()
  const bodyRef = useRef(null)
  const [deleting, setDeleting] = useState({ importer: null, open: false, busy: false })
  // The notices are closed by remembering the error they showed: a new failure is a new object and shows again.
  const [closedActionError, setClosedActionError] = useState(null)
  const [closedLoadError, setClosedLoadError] = useState(null)

  const rows = importerList?.importers || []
  const loading = Boolean(importerList?.loading)
  const loadError = importerList?.error
  const actionError = actionStatus?.error
  const showLoadError = Boolean(loadError) && loadError !== closedLoadError && !loading
  const showActionError = Boolean(actionError) && actionError !== closedActionError
  const loadingLabel = t('IMPORTERS_LOADING', 'Loading importers')
  const typeText = importer => importerTypeLabel(importer?.type, t)

  // «Try again» hides the notice it answers: the controller keeps its old `error` after a load that works, a new failure replaces it.
  const retry = () => {
    setClosedLoadError(loadError)
    getImporters?.()
  }

  const askDelete = importer => setDeleting({ importer, open: true, busy: false })
  const cancelDelete = () => setDeleting(current => (current.busy ? current : { ...current, open: false }))
  const confirmDelete = async () => {
    const { importer } = deleting
    if (!importer || deleting.busy) return
    setDeleting(current => ({ ...current, busy: true }))
    try {
      await handleDeleteImporter(importer.id)
    } finally {
      setDeleting(current => ({ ...current, open: false, busy: false }))
    }
  }

  const rowMenu = importer => (
    <ImporterRowMenu importer={importer} onImportFile={onImportFile} onEdit={onEditImporter} onDelete={askDelete} />
  )

  const empty = <EmptyState icon={Upload} title={t('NOT_FOUND_IMPOTERS', 'No importers yet')} />

  const columns = [
    {
      id: 'name',
      header: t('NAME', 'Name'),
      rowHeader: true,
      wrap: true,
      skeleton: { lines: 1 },
      cell: importer => <span className='odc-imp-list-name' dir='auto' title={importer.name}>{importer.name}</span>
    },
    {
      id: 'type',
      header: t('TYPE', 'Type'),
      wrap: true,
      skeleton: { lines: 1 },
      cell: importer => <span className='odc-imp-list-type' dir='auto'>{typeText(importer)}</span>
    },
    {
      id: 'actions',
      header: '',
      srHeader: t('ACTIONS', 'Actions'),
      align: 'end',
      skeleton: { lines: 1 },
      cell: rowMenu
    }
  ]

  const toCard = importer => ({
    id: importer.id,
    href: cardHref(),
    label: importer.name ?? '',
    title: <span className='odc-imp-list-name' dir='auto'>{importer.name}</span>,
    from: <span className='odc-imp-list-type' dir='auto'>{typeText(importer)}</span>,
    active: activeImporterId != null && activeImporterId === importer.id,
    actions: <div className='odc-imp-list-card-actions' data-card-actions=''>{rowMenu(importer)}</div>,
    onOpen: () => onImportFile(importer)
  })

  // A load that failed with nothing to show: the notice (the header keeps «Add importer»), not a table that says «No importers yet»
  const hideList = showLoadError && rows.length === 0

  return (
    <div className='odc-root odc-imp-list-body' ref={bodyRef}>
      {showActionError && (
        <div className='odc-imp-list-notice'>
          <InlineNotice
            tone='danger'
            icon={TriangleAlert}
            action={<IconButton icon={X} size='sm' label={t('CLOSE', 'Close')} onClick={() => setClosedActionError(actionError)} />}
          >
            {errorText(t, actionError)}
          </InlineNotice>
        </div>
      )}
      {showLoadError && (
        <div className='odc-imp-list-notice'>
          <InlineNotice
            tone='danger'
            icon={TriangleAlert}
            action={<Button size='sm' onClick={retry}>{t('TRY_AGAIN', 'Try again')}</Button>}
          >
            {t('IMPORTERS_LOAD_ERROR', "We couldn't load the importers.")}
          </InlineNotice>
        </div>
      )}
      {!hideList && (isPhone
        ? (
          <RecordCardList
            label={t('IMPORTERS_LIST', 'Importers list')}
            items={loading ? [] : rows.map(toCard)}
            loading={loading}
            loadingLabel={loadingLabel}
            skeletonCount={SKELETON_ROWS}
            empty={empty}
          />
          )
        : (
          <div className='odc-imp-list-table'>
            <DataTable
              label={t('IMPORTERS_LIST', 'Importers list')}
              columns={columns}
              rows={rows}
              getRowId={importer => importer.id}
              activeRowId={activeImporterId ?? undefined}
              onOpenRow={importer => onImportFile(importer)}
              loading={loading}
              loadingLabel={loadingLabel}
              skeletonRows={SKELETON_ROWS}
              empty={empty}
            />
          </div>
          ))}
      <ConfirmDialog
        // review (3.C): the menu item that opened it is gone; the focus goes back to the row's «⋯» (or, once deleted, to the list)
        finalFocus={() => {
          const label = nameLabel(t('IMPORTERS_ROW_ACTIONS', 'Actions for _name_'), deleting.importer)
          focusWhenFree(() => {
            const body = bodyRef.current
            if (!body?.isConnected) return null
            return [...body.querySelectorAll('button[aria-label]')].find(node => node.getAttribute('aria-label') === label && node.getClientRects().length > 0) ||
              body.querySelector('button:not([disabled])')
          })
          return false
        }}
        open={deleting.open}
        title={nameLabel(t('IMPORTER_DELETE_TITLE', 'Delete _name_?'), deleting.importer)}
        confirmLabel={t('IMPORTER_DELETE_CONFIRM', 'Delete importer')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        tone='danger'
        busy={deleting.busy || Boolean(actionStatus?.loading)}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      >
        {t('IMPORTER_DELETE_DESCRIPTION', "This importer and its mapping are deleted. Data you already imported stays. This can't be undone.")}
      </ConfirmDialog>
    </div>
  )
}
