import React from 'react'

import {
  CheckboxWrapper as DGACheckboxWrapper,
  FieldContainer as DGAFieldContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Connect/DriversGroupAutoassignService/styles'
// Batch fixture for c2-connect-delivery-zones: the delivery-service and zone surfaces of
// Connect.
//
// It mounts the migrated STYLES, not the controllers, which is what keeps this batch
// inside section 5.1. That matters more here than anywhere else in the layer: these rows
// embed Google Maps and build an iframe into a third party's own domain. Nothing here
// loads either.
//
// GENERATED from the ruleset by generate-batch-fixture.mjs. Thirteen of this batch's
// sites are selectors that reach nothing the product renders, carry the `dead-selector`
// reason, and are deliberately absent from this file.
//
// Connect/DeliveryServiceDetails, DeliveryServiceGeneralForm, DeliveryServiceZoneInformation, DeliveryServiceZonesDetails, DeliveryServiceZonesList, DeliveryServices/styles.js and DeliveryServicesList were deleted as dead code; dsd-, dgf-, dzi-, dzd-, dzl-, dse-, dsl- rows (26 -> 4 role sizes) went with them, and with them the tab base/active pair and the Glyph helper.
// DeliveryServicePaymethods moved to the Product pick list and deleted its styles.js; its dpm- row went with it, and so did
// DeliveryServicesBusinesses (P/SelectableList) and its dsb- row.

export const DeliveryC2StylesFixture = () => (
  <div data-testid='delivery-c2-styles' style={{ padding: 24, display: 'grid', gap: 12 }}>
    {/* DriversGroupAutoassignService */}
    <DGACheckboxWrapper data-testid='dga-checkbox-wrapper-wrap'>
      <span data-testid='dga-checkbox-wrapper-span'>Enable</span>
    </DGACheckboxWrapper>
    <DGAFieldContainer data-testid='dga-field-container-wrap'>
      <label data-testid='dga-field-container-label'>Minimum purchase</label>
    </DGAFieldContainer>
  </div>
)
