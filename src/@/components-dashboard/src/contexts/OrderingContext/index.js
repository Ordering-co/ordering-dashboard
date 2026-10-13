import React, { createContext } from 'react'
import { ConfigProvider } from '../ConfigContext'
import { SessionProvider } from '../SessionContext'
import { WebsocketProvider } from '../WebsocketContext'
import { OrderProvider } from '../OrderContext'
import { BusinessProvider } from '../BusinessContext'
import { LanguageProvider } from '../LanguageContext'
import { ApiProvider } from '../ApiContext'
import { EventProvider } from '../EventContext'
import { UtilsProviders } from '../UtilsContext'
import { ToastProvider } from '../ToastContext'
import { WebStrategy } from '../../webStrategy'
import { ValidationFieldsProvider } from '../ValidationsFieldsContext'
import { CustomerProvider } from '../CustomerContext'
import { SiteProvider } from '../SiteContext'

/**
 * Create OrderingContext
 * Wrapper to use all context to ordering apps
 */
export const OrderingContext = createContext()

/**
 * Custom provider to languages manager
 * This provider has a reducer for manage languages state
 * @param {props} props
 */
export const OrderingProvider = ({ Alert, settings, children }) => {
  const webStrategy = new WebStrategy()
  return (
    <OrderingContext.Provider value={{}}>
      <EventProvider>
        <ApiProvider settings={settings}>
          <LanguageProvider strategy={webStrategy} settings={settings}>
            <SessionProvider strategy={webStrategy} settings={settings}>
              <ConfigProvider settings={settings}>
                <UtilsProviders>
                  <ToastProvider>
                    <ValidationFieldsProvider>
                      <WebsocketProvider settings={Object.assign(settings.socket, { project: settings.project })}>
                        <SiteProvider>
                          <CustomerProvider strategy={webStrategy}>
                            <OrderProvider strategy={webStrategy} Alert={Alert}>
                              <BusinessProvider>
                                {children}
                              </BusinessProvider>
                            </OrderProvider>
                          </CustomerProvider>
                        </SiteProvider>
                      </WebsocketProvider>
                    </ValidationFieldsProvider>
                  </ToastProvider>
                </UtilsProviders>
              </ConfigProvider>
            </SessionProvider>
          </LanguageProvider>
        </ApiProvider>
      </EventProvider>
    </OrderingContext.Provider>
  )
}
