import React, { useEffect, useState } from 'react'
import { useLanguage, BusinessSpreadSheet as BusinessSpreadSheetController } from '../../../../../index'
import { Alert, SpreadSheetEditor } from '../../Shared'
import { ConfirmDialog } from '../../Shared/Product'
import {
  BusinessSpreadSheetContainer
} from './styles'

const BusinessSpreadSheetUI = (props) => {
  const {
    handleItemChange,
    spreadSheetState,
    handleRowRemove,
    handleAfterSectionEnd,
    handleoutsideClickDeselects,
    allowSpreadColumns,
    pendingRemoval,
    confirmRemoval,
    cancelRemoval
  } = props

  const [, t] = useLanguage()
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [hiddenColumns, setHiddenColumns] = useState([])

  const spreadSheetHeaderItems = [
    { title: t('ID', 'Id'), code: 'id', readOnly: true, type: 'numeric' },
    { title: t('NAME', 'Name'), code: 'name', readOnly: false, type: 'text', editor: false },
    { title: t('DESCRIPTION', 'Description'), code: 'description', readOnly: false, type: 'text' },
    { title: t('PRICE', 'Price'), code: 'price', readOnly: false, type: 'numeric' },
    { title: t('PRODUCT_COST', 'Product cost'), code: 'cost_price', readOnly: false, type: 'numeric' },
    { title: t('INVENTORY', 'Inventory'), code: 'inventoried', readOnly: false, type: 'checkbox' },
    { title: t('QUANTITY', 'Quantity'), code: 'quantity', readOnly: false, type: 'numeric' }
  ]

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  // redesign D-9 (owner, 2026-10-19): deleting saved rows asks first. One product is named, several are counted.
  const removalCount = pendingRemoval?.count || 0
  const removalOne = removalCount === 1
  const removalName = pendingRemoval?.names?.[0] || t('SPREADSHEET_DELETE_THIS_PRODUCT', 'this product')

  useEffect(() => {
    if (spreadSheetState?.result?.error) {
      setAlertState({
        open: true,
        content: spreadSheetState?.result?.result
      })
    }
  }, [spreadSheetState?.result])

  useEffect(() => {
    let index = 0
    const _hiddenColumns = []
    for (const key in allowSpreadColumns) {
      if (!allowSpreadColumns[key]) {
        _hiddenColumns.push(index)
      }
      index++
    }
    setHiddenColumns(_hiddenColumns)
  }, [allowSpreadColumns])

  return (
    <>
      <BusinessSpreadSheetContainer>
        <SpreadSheetEditor
          {...props}
          isBusinessProducts
          hotTableData={spreadSheetState.products}
          isLoading={spreadSheetState.loading}
          headerItems={spreadSheetHeaderItems}
          handleItemChange={handleItemChange}
          handleRowRemove={handleRowRemove}
          handleAfterSectionEnd={handleAfterSectionEnd}
          handleoutsideClickDeselects={handleoutsideClickDeselects}
          hiddenColumns={hiddenColumns}
          isRemove
        />
      </BusinessSpreadSheetContainer>
      <Alert
        width='700px'
        title={t('PRODUCT EDIT', 'Product Edit')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
      />
      <ConfirmDialog
        open={pendingRemoval != null}
        tone='danger'
        title={removalOne
          ? t('SPREADSHEET_DELETE_PRODUCT_TITLE_ONE', 'Delete _name_?').replace('_name_', () => removalName)
          : t('SPREADSHEET_DELETE_PRODUCT_TITLE_OTHER', 'Delete _count_ products?').replace('_count_', () => String(removalCount))}
        confirmLabel={removalOne
          ? t('SPREADSHEET_DELETE_PRODUCT_ONE', 'Delete product')
          : t('SPREADSHEET_DELETE_PRODUCT_OTHER', 'Delete _count_ products').replace('_count_', () => String(removalCount))}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        busy={Boolean(spreadSheetState?.loading)}
        onConfirm={() => confirmRemoval && confirmRemoval()}
        onCancel={() => cancelRemoval && cancelRemoval()}
      >
        {removalOne
          ? t('SPREADSHEET_DELETE_PRODUCT_BODY_ONE', "It is removed from this store's menu. This can't be undone.")
          : t('SPREADSHEET_DELETE_PRODUCT_BODY', "They are removed from this store's menu. This can't be undone.")}
      </ConfirmDialog>
    </>
  )
}

export const BusinessSpreadSheet = (props) => {
  const businessSpreadSheetProps = {
    ...props,
    UIComponent: BusinessSpreadSheetUI
  }
  return <BusinessSpreadSheetController {...businessSpreadSheetProps} />
}
