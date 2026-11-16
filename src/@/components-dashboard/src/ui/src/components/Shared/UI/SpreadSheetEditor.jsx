import React, { useCallback, useEffect, useRef, useState, memo } from 'react'
import { createPortal } from 'react-dom'
import { HotTable, HotColumn } from '@handsontable/react'
import 'handsontable/dist/handsontable.full.css'
import { useLanguage, useToast, ToastType } from '../../../../../index'
import { SpreadSheetContainer, SpreadSheetMenuHost, SpreadSheetViewport } from './spreadsheet-styles'

// redesign W1 n.º 8 B (owner, 2026-10-21): the context-menu Paste reads the clipboard when it is clicked, instead of
// a 500 ms background poll. A click counts as a user gesture, so the browser may allow it. text/html keeps the
// <table> that Excel and Google Sheets put there, which Handsontable turns into cells as it does on Ctrl/Cmd+V.
const readClipboard = async () => {
  const clipboard = navigator.clipboard
  if (clipboard?.read) {
    try {
      const items = await clipboard.read()
      let text = ''
      let html = ''
      for (const item of items) {
        if (!html && item.types.includes('text/html')) html = await (await item.getType('text/html')).text()
        if (!text && item.types.includes('text/plain')) text = await (await item.getType('text/plain')).text()
      }
      return { text, html }
    } catch (e) {
      // some browsers refuse read() but allow readText()
    }
  }
  if (clipboard?.readText) return { text: await clipboard.readText(), html: '' }
  throw new Error('clipboard unavailable')
}

const SpreadSheetEditor = (props) => {
  const {
    headerItems,
    hotTableData,
    handleItemChange,
    handleRowRemove,
    handleAfterSectionEnd,
    handleoutsideClickDeselects,
    isRemove,
    isUndo,
    isRedo,
    isBusinessProducts,
    hiddenColumns,
    isLoading
  } = props
  const [, t] = useLanguage()
  const [, toastApi] = useToast()
  // Handsontable rebuilds and closes an open context menu on every updateSettings, which
  // @handsontable/react runs on each render, so reading the clipboard must not set state.
  const [uiContainer, setUiContainer] = useState(null)

  const hotTableRef = useRef(null)
  const handleMenuHostRef = useCallback(node => setUiContainer(node), [])

  const productIdColumnRenderer = (instance, td, row, col, prop, value, cellProperties) => {
    if (value !== null) {
      td.textContent = ''
      const productId = document.createElement('span')
      productId.className = 'product-id'
      productId.textContent = String(value)
      td.appendChild(productId)
    }
  }

  const settings = {
    // data: hotTableData,
    licenseKey: 'non-commercial-and-evaluation',
    autoRowSize: false,
    autoColumnSize: false,
    width: '100%',
    height: '100%',
    minSpareRows: 1,
    stretchH: 'all',
    copyPaste: true,
    undo: true,
    contextMenu: {
      ...(uiContainer ? { uiContainer } : {}),
      items: {
        copy: {
          name: t('SPREADSHEET_COPY', 'Copy')
        },
        ...(isUndo && { undo: { name: t('SPREADSHEET_UNDO', 'Undo') } }),
        ...(isRedo && { redo: { name: t('SPREADSHEET_REDO', 'Redo') } }),
        ...(isRemove && { remove_row: { name: t('SPREADSHEET_REMOVE_ROW', 'Remove row') } }),
        paste: {
          key: 'paste',
          name: t('SPREADSHEET_PASTE', 'Paste'),
          callback: async function () {
            if (!hotTableRef?.current?.hotInstance) return
            let pasted
            try {
              pasted = await readClipboard()
            } catch (e) {
              toastApi?.showToast?.(ToastType.Info, t('SPREADSHEET_PASTE_BLOCKED', 'Your browser blocked the clipboard. Paste with Ctrl+V (⌘V on a Mac).'))
              return
            }
            const hotRef = hotTableRef?.current?.hotInstance
            if (!hotRef) return
            const plugin = hotRef.getPlugin('copyPaste')
            hotRef.listen()
            if (pasted.html) plugin.paste(pasted.text, pasted.html)
            else plugin.paste(pasted.text)
          }
        }
      }
    },
    cells: (row, column, prop) => {
      const cellProperties = { readOnly: false }
      if (hotTableRef?.current?.hotInstance && isBusinessProducts) {
        const visualColIndex = hotTableRef?.current?.hotInstance?.toVisualColumn(column)
        if (visualColIndex === 0 || isLoading) {
          cellProperties.readOnly = true
        }
      }
      if (isBusinessProducts && column === 0) {
        cellProperties.renderer = productIdColumnRenderer
      }
      return cellProperties
    },
    beforeKeyDown: function (e) {
      const selectedLast = this.getSelectedLast()
      if (!selectedLast) {
        return
      }
      const row = selectedLast[0]
      const col = selectedLast[1]
      const celltype = this.getCellMeta(row, col).type

      if (celltype === 'numeric') {
        const evt = e || window.event
        const key = evt.charCode || evt.keyCode || 0

        // check for cut and paste
        let isClipboard = false
        const ctrlDown = evt.ctrlKey || evt.metaKey // Mac support

        // Check for Alt+Gr (http://en.wikipedia.org/wiki/AltGr_key)
        if (ctrlDown && evt.altKey) isClipboard = false
        // Check for ctrl+c, v and x
        else if (ctrlDown && key === 67) isClipboard = true // c
        else if (ctrlDown && key === 86) isClipboard = true // v
        else if (ctrlDown && key === 88) isClipboard = true // x

        const isNumeric = ((key === 8) || (key === 9) || (key === 13) || (key === 46) || (key === 110) ||
          (key === 116) || (key === 123) || (key === 189) || (key === 190) || ((key >= 35) && (key <= 40)) ||
          ((key >= 48) && (key <= 57)) || ((key >= 96) && (key <= 105)))

        if (!isNumeric && !isClipboard) {
          e.stopImmediatePropagation()
          e.preventDefault()
        }
      }
    }
  }

  const handleAfterChange = (changes, accionHanson) => {
    if (hotTableRef?.current?.hotInstance) {
      const hotTableObj = hotTableRef?.current?.hotInstance
      handleItemChange && handleItemChange(changes, accionHanson, hotTableObj)
    }
  }

  // redesign D-9 (owner, 2026-10-19): the value goes back to Handsontable, which cancels the removal when
  // `beforeRemoveRow` returns false. A host that returns nothing (or has no handleRowRemove) removes as before.
  const handleBeforeRemoveRow = (index, amount, physicalRows) => {
    if (hotTableRef?.current?.hotInstance) {
      const hotTableObj = hotTableRef?.current?.hotInstance
      return handleRowRemove && handleRowRemove(index, amount, physicalRows, hotTableObj)
    }
  }

  const afterSelectionEnd = (row, col, row1, col1) => {
    if (hotTableRef?.current?.hotInstance) {
      const hotTableObj = hotTableRef?.current?.hotInstance
      handleAfterSectionEnd && handleAfterSectionEnd(row, col, row1, col1, hotTableObj)
    }
  }

  const outsideClickDeselects = (event) => {
    if (hotTableRef?.current?.hotInstance) {
      handleoutsideClickDeselects && handleoutsideClickDeselects(event)
    }
  }

  useEffect(() => {
    if (typeof hiddenColumns === 'undefined') return
    if (hotTableRef?.current?.hotInstance) {
      const hotTableObj = hotTableRef?.current?.hotInstance
      hotTableObj.updateSettings({
        hiddenColumns: {
          columns: hiddenColumns
        }
      })
    }
  }, [hiddenColumns])

  return (
    <>
      <SpreadSheetContainer role='region' aria-label={t('SPREADSHEET', 'Spreadsheet')}>
        <SpreadSheetViewport>
          <HotTable
            data={hotTableData}
            settings={settings}
            ref={hotTableRef}
            beforeRemoveRow={(index, amount, physicalRows) => handleBeforeRemoveRow(index, amount, physicalRows)}
            afterChange={(changes, accionHanson) => handleAfterChange(changes, accionHanson)}
            afterSelectionEnd={(row, col, row1, col1) => afterSelectionEnd(row, col, row1, col1)}
            outsideClickDeselects={(event) => outsideClickDeselects(event)}
          >
            {
              headerItems && headerItems.length > 0 && headerItems.map((item, i) => (
                <HotColumn
                  key={i}
                  title={item.title}
                  readOnly={item.readOnly}
                  data={item.code}
                  type={item.type}
                />
              ))
            }
          </HotTable>
        </SpreadSheetViewport>
      </SpreadSheetContainer>
      {createPortal(<SpreadSheetMenuHost ref={handleMenuHostRef} />, document.body)}
    </>
  )
}

export default memo(SpreadSheetEditor)
