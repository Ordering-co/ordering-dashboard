import React, { useState } from 'react'
import { LanguageTransSpread } from '../../../src/@/components-dashboard/src/ui/src/components/Settings/LanguageTransSpread'
import { BusinessSpreadSheet } from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessSpreadSheet'

export const SpreadsheetConsumersFixture = () => {
  const [translations, setTranslations] = useState([{ id: 71, key: 'FIXTURE_GREETING', text: 'Original greeting' }])
  const [products] = useState([{ id: 81, name: 'Fixture product', description: 'Description', price: 12, cost_price: 5, inventoried: true, quantity: 4 }])
  const record = (kind, args) => {
    globalThis.__OD_SPREADSHEET_CONSUMER_EVENTS__ = [...(globalThis.__OD_SPREADSHEET_CONSUMER_EVENTS__ || []), { kind, args: args.slice(0, -1), instance: Boolean(args.at(-1)?.getData) }]
  }
  return (
    <main style={{ padding: 20 }}>
      <h1>Ordering.co spreadsheet consumers</h1>
      <section data-testid='translation-sheet' style={{ height: 360 }}>
        <LanguageTransSpread
          translationList={{ loading: false, translations }}
          handleUpdateTranslationList={setTranslations}
          getTranslations={() => {}}
        />
      </section>
      <output data-testid='translation-state'>{JSON.stringify(translations)}</output>
      <section data-testid='product-sheet' style={{ height: 360, marginTop: 30 }}>
        <BusinessSpreadSheet
          spreadSheetState={{ products, loading: false }}
          allowSpreadColumns={{ id: true, name: true, description: true, price: true, cost_price: false, inventoried: true, quantity: true }}
          handleItemChange={(...args) => record('change', args)}
          handleRowRemove={(...args) => record('remove', args)}
          handleAfterSectionEnd={(...args) => record('selection', args)}
          handleoutsideClickDeselects={() => {}}
        />
      </section>
    </main>
  )
}
