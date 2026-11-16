import React from 'react'

import {
  ActionSelectorWrapper as BSUActionSelectorWrapper,
  BusinessName as BSUBusinessName
} from '../../../src/@/components-dashboard/src/ui/src/components/Connect/BusinessSummary/styles'
import {
  DataName as IHBDataName,
  Description as IHBDescription,
  VideoContainer as IHBVideoContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Connect/InfoHelpBox/styles'
// Batch fixture for c1-connect-businesses: the business, integration and sales-channel
// surfaces of Connect. First batch of Wave C, and the first outside BusinessIntelligence.
//
// It mounts the migrated STYLES, not the controllers, which is what keeps this batch
// inside section 5.1: Connect talks to third-party POS and sales-channel integrations,
// and nothing here opens a request to any of them.
//
// GENERATED from the ruleset by generate-batch-fixture.mjs.
//
// MOST OF THIS BATCH IS NOT HERE, and that is the point. Twenty-one of its sites are
// selectors that reach nothing the product renders -- a permanently unreachable branch,
// exports no file imports, a class nobody applies, and selectors the markup never
// produces. Each carries the `dead-selector` reason, and the generator refuses to mount
// any of them, so this spec cannot assert a size for a node that never paints.
//
// Connect/BusinessIntegration, BusinessesList, BusinessesListingHeader, SingleBusiness, ConnectOverview/styles.js and the BusinessSummary exports BusinessHeader, BusinessLogo, BusinessDescription and ButtonWrapper were deleted as dead code; bin-, bls-, blh-, cov-, sbu- rows (18 -> 4 role sizes) went with them.
const Glyph = ({ testid }) => (
  <svg data-testid={testid} viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
)

export const ConnectC1StylesFixture = () => (
  <div data-testid='connect-c1-styles' style={{ padding: 24, display: 'grid', gap: 12 }}>
    {/* BusinessSummary */}
    <BSUBusinessName data-testid='bsu-business-name-root'>Integration name</BSUBusinessName>
    <BSUActionSelectorWrapper data-testid='bsu-action-selector-wrapper-wrap'>
      <div><div><span className='dropdown-item' data-testid='bsu-action-selector-wrapper-divdivdropdownitem'>Disconnect</span></div></div>
      <button type='button'><Glyph testid='bsu-action-selector-wrapper-buttonsvg' /></button>
    </BSUActionSelectorWrapper>

    {/* InfoHelpBox */}
    <IHBDataName data-testid='ihb-data-name-wrap'>
      <p data-testid='ihb-data-name-p'>Acme Store</p>
    </IHBDataName>
    <IHBDescription data-testid='ihb-description-root'>Integration name</IHBDescription>
    <IHBVideoContainer data-testid='ihb-video-container-wrap'>
      <Glyph testid='ihb-video-container-svg' />
    </IHBVideoContainer>
  </div>
)
