import React, { useState } from 'react'
import { Check2, Circle, Pencil, RecordCircleFill } from 'react-bootstrap-icons'

import {
  CheckboxWrapper as CondCheckboxWrapper,
  ConditionCheckButton as CondConditionCheckButton,
  ConditionItem as CondConditionItem,
  ConditionRow as CondConditionRow,
  EditButton as CondEditButton,
  Header as CondHeader
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/EnterprisePromotionConditions/styles'
import {
  DeliveryzonesContainer as ZonesDeliveryzonesContainer,
  DeliveryzonesTable as ZonesDeliveryzonesTable
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/EnterprisePromotionDeliveryzones/styles'
import {
  Header as DetHeader,
  Tab as DetTab,
  WrapperActionSelector as DetWrapperActionSelector
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/EnterprisePromotionDetails/styles'
import {
  InputWrapper as EditInputWrapper,
  SingleEditConditionContainer as EditSingleEditConditionContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/EnterprisePromotionEditCondition/styles'
import {
  DateRangeWrapper as GenDateRangeWrapper,
  InputWrapper as GenInputWrapper,
  LabelWrapper as GenLabelWrapper,
  OrderPriorityContainer as GenOrderPriorityContainer,
  StackableContainer as GenStackableContainer,
  UploadImageIcon as GenUploadImageIcon
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/EnterprisePromotionGeneralDetails/styles'
import {
  DummyImageWrapper as ListDummyImageWrapper,
  EnableWrapper as ListEnableWrapper,
  PromotionListTable as ListPromotionListTable
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/EnterprisePromotionList/styles'
import {
  HeaderTitleContainer as ListingHeaderTitleContainer,
  WorkspaceHeader as ListingWorkspaceHeader,
  WorkspaceTab as ListingWorkspaceTab
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/EnterprisePromotionListing/styles'
import {
  Container as MaxContainer,
  InputWrapper as MaxInputWrapper,
  Option as MaxOption
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/EnterprisePromotionMaxOrders/styles'
import {
  OrderTypeItem as OtypeOrderTypeItem,
  OrderTypesContainer as OtypeOrderTypesContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/EnterprisePromotionOrderTypes/styles'
import {
  PaymethodItem as PayPaymethodItem,
  PaymethodsContainer as PayPaymethodsContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/EnterprisePromotionPaymethods/styles'
import {
  AutomaticEnableWrapper as RulesAutomaticEnableWrapper,
  CondtionItem as RulesCondtionItem,
  CouponCodeContainer as RulesCouponCodeContainer,
  CouponContainer as RulesCouponContainer,
  CouponHeader as RulesCouponHeader,
  DiscountContainer as RulesDiscountContainer,
  DiscountOption as RulesDiscountOption,
  Option as RulesOption,
  SectionTitle as RulesSectionTitle,
  ShowInCartContainer as RulesShowInCartContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/EnterprisePromotionRules/styles'
import { ScheduleContainer as SchedScheduleContainer } from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/EnterprisePromotionSchedule/styles'
import {
  Container as CatContainer,
  Label as CatLabel,
  NoSelectedBusiness as CatNoSelectedBusiness,
  Option as CatOption
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/EnterprisePromotionSpecficCategory/styles'
import {
  Container as ProdContainer,
  Label as ProdLabel,
  NoSelectedBusiness as ProdNoSelectedBusiness,
  Option as ProdOption
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/EnterprisePromotionSpecficProducts/styles'
import { radioGroupKeyDown, radioTabIndex } from '../../../src/@/components-dashboard/src/ui/src/utils/radioGroupKeyboard'

// Presentation-only fixture: the real Marketing/EnterprisePromotion styled
// surfaces, no controller, SDK, account or network. These screens activate
// real promotions, so nothing is mounted from any row's index.js — only the
// styled-components exported by each row's styles.js.
export const MarketingA2StylesFixture = () => {
  // Local state, as the product keeps it in formState: Coupon (2) starts checked.
  const [promotionType, setPromotionType] = useState(2)
  const isPromotionTypeSet = promotionType === 1 || promotionType === 2
  return (
    <main data-testid='marketing-a2-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>
      <CondHeader data-testid='cond-header-wrapper'>
        <h1 data-testid='cond-header'>Conditions</h1>
      </CondHeader>
      <CondConditionItem data-testid='cond-condition-item-wrapper'>
        <div>
          <span data-testid='cond-condition-item'>Order total above $50</span>
        </div>
      </CondConditionItem>

      {/* Mirrors EnterprisePromotionConditions: one row per condition, a checked one, an unchecked
          one, and the include-options row (a whole-row toggle, no nested control). */}
      <section data-testid='cond-rows' style={{ maxWidth: 420 }}>
        <CondConditionRow data-testid='cond-row-active'>
          <div>
            <CondConditionCheckButton
              as='button'
              type='button'
              role='checkbox'
              aria-checked='true'
              aria-label='Product specific'
              className='condition-checkbox'
              active
              isCursorAllowed
              data-testid='cond-row-active-checkbox'
            >
              <Check2 aria-hidden='true' />
            </CondConditionCheckButton>
            <span data-testid='cond-row-active-title'>Product specific</span>
          </div>
          <CondEditButton aria-label='Edit: Product specific' data-testid='cond-row-active-edit'>
            <Pencil aria-hidden='true' />
          </CondEditButton>
        </CondConditionRow>
        <CondConditionRow data-testid='cond-row-inactive'>
          <div>
            <CondCheckboxWrapper className='condition-checkbox' aria-hidden='true' data-testid='cond-row-inactive-checkbox' />
            <span data-testid='cond-row-inactive-title'>Schedule limit</span>
          </div>
          <CondEditButton aria-label='Edit: Schedule limit' data-testid='cond-row-inactive-edit'>
            <Pencil aria-hidden='true' />
          </CondEditButton>
        </CondConditionRow>
        <CondConditionItem as='button' type='button' data-testid='cond-row-include'>
          <div>
            <CondCheckboxWrapper isCursorAllowed active data-testid='cond-row-include-checkbox'>
              <Check2 />
            </CondCheckboxWrapper>
            <span data-testid='cond-row-include-title'>Include options</span>
          </div>
        </CondConditionItem>
      </section>

      <ZonesDeliveryzonesContainer data-testid='zones-deliveryzones-wrapper'>
        <h1 data-testid='zones-deliveryzones'>Delivery zones</h1>
      </ZonesDeliveryzonesContainer>
      <ZonesDeliveryzonesTable data-testid='zones-deliveryzones-table-wrapper'>
        <thead>
          <tr>
            <th data-testid='zones-deliveryzones-table'>Zone</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td data-testid='zones-deliveryzones-table-content'>Downtown</td>
          </tr>
        </tbody>
      </ZonesDeliveryzonesTable>

      <DetHeader data-testid='det-header-wrapper'>
        <div>
          <h1 data-testid='det-header'>Promotion details</h1>
        </div>
      </DetHeader>
      <DetTab as='button' type='button' aria-pressed='true' data-testid='det-tab'>General</DetTab>
      <DetWrapperActionSelector data-testid='det-wrapper-action-selector-wrapper'>
        <div>
          <div>
            <button type='button' className='dropdown-item' data-testid='det-wrapper-action-selector'>Duplicate</button>
          </div>
        </div>
      </DetWrapperActionSelector>

      <EditSingleEditConditionContainer data-testid='edit-single-edit-condition-wrapper'>
        <h1 data-testid='edit-single-edit-condition'>Edit condition</h1>
      </EditSingleEditConditionContainer>
      <EditInputWrapper data-testid='edit-input-wrapper'>
        <label htmlFor='fixture-marketing-a2-edit-input' data-testid='edit-input'>Condition value</label>
        <input id='fixture-marketing-a2-edit-input' />
      </EditInputWrapper>

      <GenUploadImageIcon data-testid='gen-upload-image-icon-wrapper'>
        <span data-testid='gen-upload-image-icon'>Upload image</span>
      </GenUploadImageIcon>
      <GenInputWrapper data-testid='gen-input-wrapper'>
        <label htmlFor='fixture-marketing-a2-gen-input' data-testid='gen-input'>Promotion name</label>
        <input id='fixture-marketing-a2-gen-input' />
      </GenInputWrapper>
      <GenDateRangeWrapper data-testid='gen-date-range-wrapper'>
        <label data-testid='gen-date-range'>Date range</label>
      </GenDateRangeWrapper>
      <GenLabelWrapper data-testid='gen-label-wrapper'>
        <label data-testid='gen-label'>Order priority</label>
      </GenLabelWrapper>
      <GenOrderPriorityContainer data-testid='gen-order-priority-wrapper'>
        <label data-testid='gen-order-priority'>Order priority</label>
        <div className='select'>
          <div data-testid='gen-order-priority-controlvalue'>1</div>
        </div>
      </GenOrderPriorityContainer>
      <GenStackableContainer data-testid='gen-stackable-wrapper'>
        <span data-testid='gen-stackable'>Stackable</span>
      </GenStackableContainer>

      <ListPromotionListTable data-testid='list-promotion-list-table-wrapper'>
        <thead>
          <tr>
            <th data-testid='list-promotion-list-table'>Name</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td data-testid='list-promotion-list-table-content'>Summer promo</td>
          </tr>
        </tbody>
      </ListPromotionListTable>
      <ListEnableWrapper data-testid='list-enable-wrapper'>
        <span data-testid='list-enable'>Enabled</span>
      </ListEnableWrapper>

      <ListingWorkspaceHeader data-testid='listing-workspace-header-wrapper'>
        <h1 data-testid='listing-workspace-header'>Promotions</h1>
      </ListingWorkspaceHeader>
      <ListingWorkspaceTab type='button' data-testid='listing-workspace-tab'>Active</ListingWorkspaceTab>
      <ListingHeaderTitleContainer data-testid='listing-header-title-wrapper'>
        <h1 data-testid='listing-header-title'>Enterprise promotions</h1>
      </ListingHeaderTitleContainer>

      <MaxContainer data-testid='max-container-wrapper'>
        <h1 data-testid='max-container'>Max orders</h1>
      </MaxContainer>
      <MaxInputWrapper data-testid='max-input-wrapper'>
        <label data-testid='max-input'>Max orders per user</label>
        <div className='select'>
          <div data-testid='max-input-controlvalue'>10</div>
        </div>
      </MaxInputWrapper>
      <MaxOption data-testid='max-option'>Unlimited</MaxOption>

      <OtypeOrderTypesContainer data-testid='otype-order-types-wrapper'>
        <h1 data-testid='otype-order-types'>Order types</h1>
      </OtypeOrderTypesContainer>
      <OtypeOrderTypeItem data-testid='otype-order-type-item-wrapper'>
        <span data-testid='otype-order-type-item'>Delivery</span>
      </OtypeOrderTypeItem>

      <PayPaymethodsContainer data-testid='pay-paymethods-wrapper'>
        <h1 data-testid='pay-paymethods'>Payment methods</h1>
      </PayPaymethodsContainer>
      <PayPaymethodItem data-testid='pay-paymethod-item-wrapper'>
        <span data-testid='pay-paymethod-item'>Credit card</span>
      </PayPaymethodItem>

      <RulesSectionTitle data-testid='rules-section-title'>Rules</RulesSectionTitle>
      {/* Mirrors EnterprisePromotionRules: a plain div stands in for FormInnerContainer (it holds the
          whole form, so it is not the radiogroup); inside it the radiogroup is a display: contents
          wrapper around only the SectionTitle and the two CouponHeader. Tabindex is roving, with
          the same radioTabIndex / radioGroupKeyDown the product uses. */}
      <div data-testid='rules-apply-group'>
        <div role='radiogroup' aria-labelledby='fixture-marketing-a2-apply-title' style={{ display: 'contents' }} data-testid='rules-apply-radiogroup'>
          <RulesSectionTitle id='fixture-marketing-a2-apply-title' data-testid='rules-apply-title'>{"How it's going to be applied?"}</RulesSectionTitle>
          <RulesCouponContainer>
            <RulesCouponHeader
              as='button'
              type='button'
              role='radio'
              aria-checked={promotionType === 2}
              tabIndex={radioTabIndex(promotionType === 2, true, isPromotionTypeSet)}
              onKeyDown={radioGroupKeyDown}
              onClick={() => setPromotionType(2)}
              active={promotionType === 2}
              data-testid='rules-coupon-header-wrapper'
            >
              {promotionType === 2 ? <RecordCircleFill aria-hidden='true' /> : <Circle aria-hidden='true' />}
              <span data-testid='rules-coupon-header'>Coupon</span>
            </RulesCouponHeader>
          </RulesCouponContainer>
          <RulesDiscountOption>
            <RulesCouponHeader
              as='button'
              type='button'
              role='radio'
              aria-checked={promotionType === 1}
              tabIndex={radioTabIndex(promotionType === 1, false, isPromotionTypeSet)}
              onKeyDown={radioGroupKeyDown}
              onClick={() => setPromotionType(1)}
              active={promotionType === 1}
              data-testid='rules-discount-header-wrapper'
            >
              {promotionType === 1 ? <RecordCircleFill aria-hidden='true' /> : <Circle aria-hidden='true' />}
              <span>Discount</span>
            </RulesCouponHeader>
          </RulesDiscountOption>
        </div>
      </div>
      <RulesShowInCartContainer data-testid='rules-show-in-cart-wrapper'>
        <div>
          <p data-testid='rules-show-in-cart'>Show in cart</p>
          <p data-testid='rules-show-in-cart-secondary'>Visible to the customer at checkout</p>
        </div>
      </RulesShowInCartContainer>
      <RulesCouponCodeContainer data-testid='rules-coupon-code-wrapper'>
        <label data-testid='rules-coupon-code'>Coupon code</label>
      </RulesCouponCodeContainer>
      <RulesCondtionItem data-testid='rules-condtion-item-wrapper'>
        <div>
          <span data-testid='rules-condtion-item'>Order total above $50</span>
        </div>
      </RulesCondtionItem>
      <RulesOption data-testid='rules-option'>Percentage</RulesOption>
      <RulesDiscountContainer data-testid='rules-discount-wrapper'>
        <div>
          <label data-testid='rules-discount'>Discount amount</label>
        </div>
      </RulesDiscountContainer>
      <RulesAutomaticEnableWrapper data-testid='rules-automatic-enable-wrapper'>
        <span data-testid='rules-automatic-enable'>Apply automatically</span>
      </RulesAutomaticEnableWrapper>

      <SchedScheduleContainer data-testid='sched-schedule-wrapper'>
        <h1 data-testid='sched-schedule'>Schedule</h1>
      </SchedScheduleContainer>

      <CatContainer data-testid='cat-container-wrapper'>
        <h1 data-testid='cat-container'>Specific categories</h1>
      </CatContainer>
      <CatLabel data-testid='cat-label'>Categories</CatLabel>
      <CatNoSelectedBusiness data-testid='cat-no-selected-business'>Select a business first</CatNoSelectedBusiness>
      <CatOption data-testid='cat-option-wrapper'>
        <span data-testid='cat-option'>Burgers <b data-testid='cat-option-controlvalue'>12</b></span>
      </CatOption>

      <ProdContainer data-testid='prod-container-wrapper'>
        <h1 data-testid='prod-container'>Specific products</h1>
      </ProdContainer>
      <ProdLabel data-testid='prod-label'>Products</ProdLabel>
      <ProdNoSelectedBusiness data-testid='prod-no-selected-business'>Select a business first</ProdNoSelectedBusiness>
      <ProdOption data-testid='prod-option-wrapper'>
        <span data-testid='prod-option'>Double cheeseburger <b data-testid='prod-option-controlvalue'>1</b></span>
      </ProdOption>

      {/*
        The declared icon-glyph preservations. These must NOT move when a role
        moves: the coordinator's sixth preservation (EnterprisePromotionListing
        WorkspaceTab `font: inherit`) is a button-reset shorthand with no size
        of its own to observe and is deliberately not mounted here.
      */}
      <section data-testid='a2-preservations'>
        <CondEditButton aria-label='Edit' data-testid='cond-edit-button-wrapper'>
          <svg data-testid='cond-edit-icon' />
        </CondEditButton>
        <CondCheckboxWrapper data-testid='cond-checkbox-wrapper'>
          <svg data-testid='cond-checkbox-icon' />
        </CondCheckboxWrapper>
        <DetWrapperActionSelector data-testid='det-action-icon-wrapper'>
          <button type='button' aria-label='Promotion actions'>
            <svg data-testid='det-action-icon' />
          </button>
        </DetWrapperActionSelector>
        <GenUploadImageIcon data-testid='gen-upload-icon-wrapper'>
          <svg data-testid='gen-upload-icon' />
        </GenUploadImageIcon>
        <ListDummyImageWrapper data-testid='list-dummy-image-wrapper'>
          <svg data-testid='list-dummy-image-icon' />
        </ListDummyImageWrapper>
      </section>
    </main>
  )
}
