import React from 'react'

import { useLanguage } from '../../../../../index'
import { TabPanel, Tabs } from '../../Shared/Product'
import { InvoicesTable } from './InvoicesTable'
import { LegacyReportsTable } from './LegacyReportsTable'
import { PaymentHistory } from './PaymentHistory'
import { StorePicker } from '../AnalyticsKit/StorePicker'
import './store-reports.css'

// redesign business-payments FC1 (D1): the «Reports by business» view. One bar (wraps on a narrow screen) with the store picker at
// the start and, at the end, the payment history, only with a store chosen and in the Reports tab (as `main`, `BPR:779-811`);
// under it, when the store has legacy reports, the two tabs; then the invoices or the legacy reports. It receives the whole state
// of the controller as props (`business`, `plugin`, `invoices`, `history`, `legacy`, `detail`, `legacyDetail`) and keeps none.
// The line «REPORTS_BY_BUSINESS_DESC» is not repeated here: the shell has it. `panelOpen` (optional) tells the table a panel is
// open beside it; without it, it follows `detail` and `legacyDetail`.

export const StoreReports = ({ business, plugin, invoices, history, legacy, detail, legacyDetail, panelOpen }) => {
  const [, t] = useLanguage()
  const hasPanel = panelOpen ?? (detail?.invoiceId != null || legacyDetail?.reportId != null)
  const platform = !legacy?.available || legacy.tab === 'platform'

  const content = platform
    ? <InvoicesTable invoices={invoices} business={business} detail={detail} panelOpen={hasPanel} />
    : <LegacyReportsTable legacy={legacy} legacyDetail={legacyDetail} />

  return (
    <div className='odc-bp-store'>
      <div className='odc-bp-bar'>
        <StorePicker business={business} plugin={plugin} />
        {business?.selected && platform && <PaymentHistory history={history} business={business} />}
      </div>
      {legacy?.available
        ? (
          <Tabs
            className='odc-bp-tabs'
            label={t('BUSINESS_PAYMENTS_REPORT_SOURCE', 'Report source')}
            value={legacy.tab}
            onValueChange={legacy.setTab}
            items={[
              { value: 'platform', label: t('REPORTS', 'Reports') },
              { value: 'eatstreet', label: t('LEGACY_REPORTS', 'Legacy Reports') }
            ]}
          >
            <TabPanel value={legacy.tab}>{content}</TabPanel>
          </Tabs>
          )
        : content}
    </div>
  )
}
