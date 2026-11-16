// Dedicated entry for the sidebar reach/layering spec. The shared compact registry in
// main.jsx is never edited: this entry mounts the real SidebarMenu next to the real
// Orders table styles and the closed column-visibility trigger (sticky `th`).
import React, { useState } from 'react'
// Batch 5.1: the redesigned sidebar reads the --od-x-* candidates (the app loads them in src/index.js).
import '../../../src/brand/candidates.css'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'
import 'bootstrap/dist/css/bootstrap.css'
import theme from '../../../src/theme.json'
import { createDashboardTheme } from '../../../src/brand/adapter'
import { ThemeProvider as DashboardThemeProvider } from '../../../src/@/components-dashboard/src/ui/src/contexts/ThemeContext'
import { InfoShareContext } from '../../../src/@/components-dashboard/src/ui/src/contexts/InfoShareContext'
import { ProjectContext } from '../../../src/@/components-dashboard/src/ui/src/contexts/ProjectContext'
import { Layout } from '../../../src/@/components-dashboard/src/ui/src/components/Layout'
import { SidebarMenu } from '../../../src/@/components-dashboard/src/ui/src/components/SidebarMenu'
import { HeaderItem, PopoverBody, PopoverList } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/UI/column-allow-setting-popover-styles'
import { IconButton } from '../../../src/@/components-dashboard/src/ui/src/styles/Buttons'
import { Columns3 as LayoutThreeColumns } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Icon'
import { OrdersListContainer } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrdersManager/styles'
import { OrdersContainer, Table } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrdersTable/styles'
import '../../../src/brand/ordering.tokens.generated.css'

const query = new URLSearchParams(window.location.search)
const mode = query.get('mode') || 'light'
document.documentElement.lang = 'en'

const fixtureTheme = {
  ...theme,
  rtl: false,
  images: { logos: { logotype: `${import.meta.env.BASE_URL}brand/ordering/1.3.0/assets/logos/ordering-lockup-color${mode === 'dark' ? '-on-dark' : ''}.svg` } }
}
const dashboardFixtureTheme = createDashboardTheme(fixtureTheme, { mode })

// The same DOM and styled parts ColumnAllowSettingPopover renders when closed. The
// component itself reads the SDK language context, which this entry does not provide.
const ColumnsTrigger = () => (
  <div className='od-ui od-column-allow-popover' data-slot='column-allow-setting-popover' style={{ overflow: 'hidden' }}>
    <HeaderItem>
      <IconButton type='button' color='black' aria-label='Manage columns' aria-expanded='false'>
        <LayoutThreeColumns />
      </IconButton>
    </HeaderItem>
    <PopoverBody role='group' aria-label='Manage columns' style={{ display: 'none', minWidth: '100px', transform: 'translate3d(0px, 0px, 0px)' }}>
      <PopoverList />
    </PopoverBody>
  </div>
)

const Fixture = () => {
  const [isCollapse, setIsCollapse] = useState(query.get('open') !== 'true')
  return (
    <MemoryRouter initialEntries={['/orders']}>
      <InfoShareContext.Provider value={[{ isCollapse }, { handleMenuCollapse: setIsCollapse }]}>
        <ProjectContext.Provider value={[{ loading: false, project: { id: 18 }, plan: { upgrade_plan_id: 44 } }, { getProjectStatus: () => {} }]}>
          <main data-testid='reach-fixture' style={{ minWidth: 0, width: '100%' }}>
            <Layout pt={0}>
              <SidebarMenu billingUrl='/__brand-fixture__/billing-disabled' setShowBillingPayment={() => {}} />
              <OrdersListContainer data-testid='reach-content' style={{ minWidth: 0 }}>
                <button type='button' onClick={() => setIsCollapse(false)}>Open navigation</button>
                <OrdersContainer>
                  <Table className='orders_table'>
                    <thead>
                      <tr>
                        <th className='orderPrice'>
                          <ColumnsTrigger />
                        </th>
                        <th>Order</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 40 }, (_, index) => <tr key={index}><td /><td>Order No. {910000 + index}</td></tr>)}
                    </tbody>
                  </Table>
                </OrdersContainer>
              </OrdersListContainer>
            </Layout>
          </main>
        </ProjectContext.Provider>
      </InfoShareContext.Provider>
    </MemoryRouter>
  )
}

createRoot(document.getElementById('root')).render(
  <ThemeProvider theme={fixtureTheme}>
    <DashboardThemeProvider theme={dashboardFixtureTheme}>
      <Fixture />
    </DashboardThemeProvider>
  </ThemeProvider>
)
