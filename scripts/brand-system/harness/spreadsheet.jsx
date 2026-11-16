import React, { useCallback, useMemo, useState } from 'react'
import { useTheme } from 'styled-components'

import SpreadSheetEditor from '../../../src/@/components-dashboard/src/ui/src/components/Shared/SpreadSheetEditor'

const primaryHeaders = [
  { title: 'Name', code: 'name', readOnly: false, type: 'text' },
  { title: 'Units', code: 'units', readOnly: false, type: 'numeric' },
  { title: 'Notes', code: 'notes', readOnly: false, type: 'text' },
  { title: 'Active', code: 'active', readOnly: false, type: 'checkbox' },
  { title: 'Private', code: 'private', readOnly: false, type: 'text' }
]

const productHeaders = [
  { title: 'ID', code: 'id', readOnly: false, type: 'numeric' },
  { title: 'Product', code: 'name', readOnly: false, type: 'text' },
  { title: 'Price', code: 'price', readOnly: false, type: 'numeric' }
]

const initialRows = [
  { name: 'Alpha product with a deliberately long customer supplied name', units: 12, notes: 'First note', active: true, private: 'owner-a' },
  { name: 'Beta product', units: 7, notes: 'Second note', active: false, private: 'owner-b' },
  { name: 'Gamma product', units: 3, notes: 'Third note', active: true, private: 'owner-c' }
]

const products = [
  { id: 501, name: 'Protected product identifier', price: 18 },
  { id: 502, name: 'Editable product name', price: 24 }
]

const instanceProof = instance => ({
  active: Boolean(instance?.getDataAtCell),
  rows: instance?.countSourceRows?.(),
  firstValue: instance?.getDataAtCell?.(0, 0)
})

const Sheet = ({ children, label, testId }) => (
  <section aria-label={label} data-testid={testId} className='spreadsheet-fixture-section'>
    <h2>{label}</h2>
    <div className='spreadsheet-fixture-grid'>{children}</div>
  </section>
)

export const SpreadsheetFixture = () => {
  const theme = useTheme()
  const [hiddenColumns, setHiddenColumns] = useState([4])
  const [events, setEvents] = useState([])
  const record = useCallback((sheet, kind, args) => {
    const instance = kind === 'outside' ? null : args.at(-1)
    const values = kind === 'outside'
      ? [{ tag: args[0]?.tagName, testId: args[0]?.dataset?.testid }]
      : args.slice(0, -1)
    setEvents(current => [...current, { sheet, kind, values, instance: instanceProof(instance) }])
  }, [])
  const callbacks = useMemo(() => Object.fromEntries(['primary', 'products', 'loading'].map(sheet => [sheet, {
    handleItemChange: (...args) => record(sheet, 'change', args),
    handleRowRemove: (...args) => record(sheet, 'remove', args),
    handleAfterSectionEnd: (...args) => record(sheet, 'selection', args),
    handleoutsideClickDeselects: (...args) => record(sheet, 'outside', args)
  }])), [record])

  return (
    <main
      data-testid='spreadsheet-fixture'
      className='spreadsheet-fixture'
      style={{ background: theme.ordering?.semantic?.background, color: theme.ordering?.semantic?.text?.default }}
    >
      <style>{`
        .spreadsheet-fixture { box-sizing: border-box; display: grid; gap: 20px; min-width: 0; padding: 24px; width: 100%; }
        .spreadsheet-fixture * { box-sizing: border-box; }
        .spreadsheet-fixture h1, .spreadsheet-fixture h2 { margin: 0; }
        .spreadsheet-fixture-section { border: 1px solid currentColor; border-radius: 8px; display: grid; gap: 12px; min-width: 0; padding: 16px; }
        .spreadsheet-fixture-grid { height: 330px; min-width: 0; width: 100%; }
        .spreadsheet-fixture-controls { display: flex; flex-wrap: wrap; gap: 8px; }
        .spreadsheet-fixture-controls button { min-height: 44px; white-space: normal; }
        .spreadsheet-fixture output { display: block; max-height: 180px; max-width: 100%; overflow: auto; overflow-wrap: anywhere; padding: 8px; white-space: pre-wrap; }
        @media (max-width: 420px) {
          .spreadsheet-fixture { gap: 12px; padding: 12px; }
          .spreadsheet-fixture-section { padding: 12px; }
          .spreadsheet-fixture-grid { height: 300px; }
        }
      `}</style>
      <h1>Ordering.co spreadsheet fixture</h1>
      <div className='spreadsheet-fixture-controls'>
        <button data-testid='fixture-outside' type='button'>Outside grid</button>
        <button type='button' onClick={() => setEvents([])}>Clear receipts</button>
        <button type='button' onClick={() => setHiddenColumns(current => current.length === 1 ? [2, 4] : [4])}>Toggle Notes column</button>
      </div>

      <Sheet label='Editable inventory' testId='sheet-primary'>
        <SpreadSheetEditor
          headerItems={primaryHeaders}
          hotTableData={initialRows}
          hiddenColumns={hiddenColumns}
          isRemove
          isUndo
          isRedo
          {...callbacks.primary}
        />
      </Sheet>

      <Sheet label='Business products' testId='sheet-products'>
        <SpreadSheetEditor
          headerItems={productHeaders}
          hotTableData={products}
          isBusinessProducts
          isRemove
          {...callbacks.products}
        />
      </Sheet>

      <Sheet label='Loading business products' testId='sheet-loading'>
        <SpreadSheetEditor
          headerItems={productHeaders}
          hotTableData={products}
          isBusinessProducts
          isLoading
          {...callbacks.loading}
        />
      </Sheet>

      <output data-testid='spreadsheet-events'>{JSON.stringify(events)}</output>
    </main>
  )
}
