import React from 'react'

export { getCurrentDiffDays } from '../../../src/@/components-dashboard/src/ui/src/utils/getCurrentDiffDays'

export const getIntercomHash = async payload => {
  globalThis.__OD_HOME_INTERCOM__ = [...(globalThis.__OD_HOME_INTERCOM__ || []), { kind: 'hash', payload }]
  return 'fixture-intercom-hash'
}

export const setIntercomSettings = (settings, user) => {
  globalThis.__OD_HOME_INTERCOM__ = [...(globalThis.__OD_HOME_INTERCOM__ || []), { kind: 'settings', settings, user }]
}

const FixtureHubspotForm = props => {
  globalThis.__OD_HOME_HUBSPOT__ = { formId: props.formId, portalId: props.portalId, region: props.region }
  return <div data-testid='fixture-hubspot-form'>Fixture HubSpot boundary</div>
}

export default FixtureHubspotForm
