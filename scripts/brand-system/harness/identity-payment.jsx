import React from 'react'

import { orderingAssets } from '../../../src/brand/assets'
import { ApiContext } from '../../../src/@/components-dashboard/src/contexts/ApiContext'
import { ConfigContext } from '../../../src/@/components-dashboard/src/contexts/ConfigContext'
import { LanguageContext } from '../../../src/@/components-dashboard/src/contexts/LanguageContext'
import { SessionContext } from '../../../src/@/components-dashboard/src/contexts/SessionContext'
import { UtilsContext } from '../../../src/@/components-dashboard/src/contexts/UtilsContext'
import { BusinessPaymentInvoiceDetail } from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/BusinessPaymentInvoiceDetail'
import { identityPaymentLanguage } from './identity-payment-language'

const parsePrice = value => `$${Number(value || 0).toFixed(2)}`
// redesign business-payments (D11): the document paints its dates with the project's parseDate; the fixture hands it the
// text as it comes (the print identity does not depend on the date format)
const parseDate = value => String(value ?? '')

export const IdentityPaymentFixture = () => (
  <ApiContext.Provider value={[{ root: '/fixture-api' }, {}]}>
    <SessionContext.Provider value={[{ token: 'fixture-token' }, {}]}>
      <ConfigContext.Provider value={[{ configs: { dashboard_logo: { value: orderingAssets.logos.print } } }, {}]}>
        <UtilsContext.Provider value={[{ parsePrice, parseDate }]}>
          <LanguageContext.Provider value={identityPaymentLanguage}>
            <main data-testid='identity-payment-fixture'>
              <h1>Ordering.co payment report print identity</h1>
              <BusinessPaymentInvoiceDetail invoiceId='payment-fixture-41' />
            </main>
          </LanguageContext.Provider>
        </UtilsContext.Provider>
      </ConfigContext.Provider>
    </SessionContext.Provider>
  </ApiContext.Provider>
)
