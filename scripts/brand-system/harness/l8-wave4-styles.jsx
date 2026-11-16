import React from 'react'
import { ChevronRight } from 'react-bootstrap-icons'

import { Button } from '../../../src/@/components-dashboard/src/ui/src/styles'
import {
  ProductCategoryHeader,
  ProductCategoryMeta,
  ProductCategorySelection,
  ProductCategoryToggle,
  UnavailableNotice
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/PromotionJourneysListing/styles'
import {
  Container as GoogleMapsContainer,
  WarningBanner
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/GoogleMapsApiKeySettingButton/style'
import { TrackingOption } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrderTrackingLink/styles'
import { ImageActions } from '../../../src/@/components-dashboard/src/ui/src/components/Settings/SettingsImage/styles'
import {
  IconWrapper as IntegrationIconWrapper,
  SettingItemContainer as IntegrationItemContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/IntegrationListing/styles'
import { AiBadge } from '../../../src/@/components-dashboard/src/ui/src/components/SidebarMenu/styles'

// Batch fixture for L8 wave 4 (id `l8-wave4`).
//
// Wave 4 classifies literals that `main` added inside rows that were ALREADY
// adopted. As in the other fixtures it mounts the real styled components, not the
// controllers: the controllers reach payment gateways, integrations and tracking
// domains, and none of that belongs behind a typography test.
//
// Every `data-testid` sits on the node where the declaration APPLIES, in the
// selector context the rule names. The markup mirrors what the product renders
// (read from each component's index.js / row file), including the real shared
// `Button` where the product renders one: `ImageActions button`,
// `PaymethodInstallAction button` and `ButtonWrapper button:not(.skip-action)` are
// descendant selectors, so the node that matters is whatever the product puts
// under them.
//
// Lot 5.9: the payments section moved to Product wrappers, so
// Stores/PaymentOptionGlobal `GatewayStatus` and Stores/BusinessPaymentMethods
// `PaymethodInstallAction` (their styles.js are gone) are no longer mounted;
// w4-gateway-status-p, w4-gateway-status-a and w4-install-action are gone.
//
// (main sync, ): Stores/RestaurantSelectGuide was deleted by
// main with its flow (Ordering Network import), so its `ButtonWrapper` is no
// longer mounted and w4-continue-glyph is gone.
//
// NOT MOUNTED, on purpose:
//   - Settings/CustomOrder `EmptyHelp` (w4-empty-help). It is a `styled.p`
//     declared inside CustomOrder/index.js and is NOT exported. Mounting it here
//     would mean duplicating its CSS, and a copy measures the copy, not the
//     product. The site is left out of this fixture until the component is
//     exported or the coordinator decides how to observe it.
export const L8Wave4StylesFixture = () => (
  <div data-testid='l8-wave4-styles' style={{ padding: 24, display: 'grid', gap: 12 }}>

    {/* Marketing/PromotionJourneysListing */}
    <UnavailableNotice role='note' data-testid='w4-unavailable-notice'>
      Product options are not available for Buy X, get Y promotions yet.
    </UnavailableNotice>
    <ProductCategoryHeader selected={false}>
      <ProductCategoryToggle type='button' aria-label='Expand Burgers'>
        <ChevronRight aria-hidden='true' />
      </ProductCategoryToggle>
      <ProductCategorySelection>
        <input type='checkbox' aria-label='Select all products in Burgers' readOnly />
      </ProductCategorySelection>
      <span data-testid='w4-category-header'>Burgers</span>
      <ProductCategoryMeta data-testid='w4-category-meta'>12</ProductCategoryMeta>
    </ProductCategoryHeader>

    {/* Orders/GoogleMapsApiKeySettingButton (the product's Link is an anchor) */}
    <GoogleMapsContainer>
      <WarningBanner data-testid='w4-warning-banner'>
        <span>Google Maps API key is missing.</span>
        <a href='#settings'>Add it in Settings</a>
      </WarningBanner>
    </GoogleMapsContainer>

    {/* Orders/OrderTrackingLink: rendered inside a select option */}
    <TrackingOption>
      <span data-testid='w4-tracking-option'>Default</span>
      <small data-testid='w4-tracking-option-small'>https://orders.example.com</small>
    </TrackingOption>

    {/* Settings/SettingsImage */}
    <ImageActions>
      <Button type='button' outline color='primary' borderRadius='8px' data-testid='w4-image-actions-button'>
        Restore default
      </Button>
    </ImageActions>

    {/* Shared/UI shell-navigation.css `.od-shell-ai-badge`, as SidebarMenu mounts it */}
    <div>
      <AiBadge data-testid='w4-ai-badge' aria-hidden='true'>AI</AiBadge>
    </div>

    {/* Settings/IntegrationListing, stacked (avoidExpand) row */}
    <IntegrationItemContainer $stack>
      <IntegrationIconWrapper $compact>
        <svg data-testid='w4-integration-compact-icon' viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
      </IntegrationIconWrapper>
      <ChevronRight data-testid='w4-integration-chevron' />
    </IntegrationItemContainer>
  </div>
)
