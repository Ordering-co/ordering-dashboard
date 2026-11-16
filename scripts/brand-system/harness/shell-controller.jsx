import React, { useState } from 'react'
import { SidebarMenu } from '../../../src/@/components-dashboard/src/components/SidebarMenu'

const ControllerProbe = ({ productsState, getBillingToken, state }) => {
  const [result, setResult] = useState(null)
  return (
    <main>
      <h1>Ordering.co sidebar controller contracts</h1>
      <output data-testid='builder-apps'>{JSON.stringify(productsState)}</output>
      <button type='button' onClick={async () => setResult(await getBillingToken())}>Read fixture billing token</button>
      <output data-testid='billing-return'>{JSON.stringify(result)}</output>
      <output data-testid='billing-state'>{JSON.stringify(state)}</output>
    </main>
  )
}
export const ShellControllerFixture = () => <SidebarMenu UIComponent={ControllerProbe} />
