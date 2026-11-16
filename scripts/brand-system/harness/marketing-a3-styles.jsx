import React from 'react'

import {
  HeaderContainer as AdHeaderContainer,
  InfoContent as AdInfoContent
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/AdBannersListing/styles'
import {
  Description as PosDescription,
  IconWrapper as PosIconWrapper,
  Title as PosTitle
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/AdBannersListing/PostionItemUI/styles'
import {
  ActionSelectorWrapper as BdActionSelectorWrapper,
  BusinessesWrapper as BdBusinessesWrapper,
  FormController as BdFormController,
  HeaderContainer as BdHeaderContainer,
  Tab as BdTab,
  UploadImageIconContainer as BdUploadImageIconContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/BannerDetails/styles'
import {
  BusinessWrapper as BdBizBusinessWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/BannerDetails/Businesses/styles'
import {
  BusinessName as BidBusinessName,
  DropDownWrapper as BidDropDownWrapper,
  FormController as BidFormController,
  HeaderContainer as BidHeaderContainer,
  Option as BidOption,
  SelectWrapper as BidSelectWrapper,
  UploadImageIconContainer as BidUploadImageIconContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/BannerImageDetails/styles'
import {
  AccordionItem as SbpAccordionItem
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/BannerImageDetails/SelectBusinessProducts/styles'
import {
  AddNewBanner as PbAddNewBanner,
  BannerTitleConatiner as PbBannerTitleConatiner,
  BannersHeader as PbBannersHeader,
  EnableWrapper as PbEnableWrapper,
  HeaderContainer as PbHeaderContainer,
  InfoContent as PbInfoContent
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/PageBanner/styles'
import {
  ActionButton as PjActionButton,
  ApiError as PjApiError,
  BuilderHeader as PjBuilderHeader,
  BusinessOption as PjBusinessOption,
  CheckGrid as PjCheckGrid,
  ChoiceGroup as PjChoiceGroup,
  EmptyState as PjEmptyState,
  ErrorText as PjErrorText,
  Field as PjField,
  FieldHint as PjFieldHint,
  Hero as PjHero,
  ProductOption as PjProductOption,
  ProductPickerEmpty as PjProductPickerEmpty,
  ProductPickerHeader as PjProductPickerHeader,
  ProductPickerLoadMore as PjProductPickerLoadMore,
  ProductPickerSearch as PjProductPickerSearch,
  ProductSelectionCount as PjProductSelectionCount,
  PromotionAction as PjPromotionAction,
  PromotionCard as PjPromotionCard,
  PromotionPagination as PjPromotionPagination,
  ScopeBox as PjScopeBox,
  ScopeHint as PjScopeHint,
  ScopeModeButton as PjScopeModeButton,
  Section as PjSection,
  Status as PjStatus,
  TemplateContent as PjTemplateContent,
  TemplateMeta as PjTemplateMeta
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/PromotionJourneysListing/styles'

// Presentation-only fixture: the real Marketing banner/journey styled
// surfaces, no controller, SDK, account or network. These screens edit real
// promotion banners and journeys, so nothing is mounted from any row's
// index.js — only the styled-components exported by each row's styles.js.
export const MarketingA3StylesFixture = () => {
  return (
    <main data-testid='marketing-a3-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>
      <AdHeaderContainer data-testid='ad-header-wrapper'>
        <h1 data-testid='ad-header'>Ad banners</h1>
      </AdHeaderContainer>
      <AdInfoContent data-testid='ad-info-content'>Ad banners run across all businesses.</AdInfoContent>

      <PosTitle data-testid='pos-title'>Homepage hero</PosTitle>
      <PosDescription data-testid='pos-description'>Shown on the homepage above the fold.</PosDescription>

      <BdHeaderContainer data-testid='bd-header-wrapper'>
        <h1 data-testid='bd-header'>Banner details</h1>
      </BdHeaderContainer>
      {/*
        The product renders this tab strip as a native button after this
        batch's accessibility conversion, so the fixture renders the same
        element. A fixture that shows a div here would let the spec verify
        a control the product does not actually ship.
      */}
      <BdTab as='button' type='button' aria-pressed='true' data-testid='bd-tab'>General</BdTab>
      <BdUploadImageIconContainer data-testid='bd-upload-image-icon-wrapper'>
        <p data-testid='bd-upload-image-icon'>Upload image</p>
      </BdUploadImageIconContainer>
      <BdFormController data-testid='bd-form-controller-wrapper'>
        <label htmlFor='fixture-marketing-a3-bd-form-controller' data-testid='bd-form-controller'>Banner title</label>
        <input id='fixture-marketing-a3-bd-form-controller' />
      </BdFormController>
      <BdActionSelectorWrapper data-testid='bd-action-selector-wrapper'>
        <div>
          <div>
            <button type='button' className='dropdown-item' data-testid='bd-action-selector'>Duplicate</button>
          </div>
        </div>
      </BdActionSelectorWrapper>
      <BdBusinessesWrapper data-testid='bd-businesses-wrapper'>
        <p data-testid='bd-businesses'>Visible to 3 businesses</p>
      </BdBusinessesWrapper>

      <BdBizBusinessWrapper data-testid='bdbiz-business-wrapper'>
        <p data-testid='bdbiz-business'>Downtown Diner</p>
      </BdBizBusinessWrapper>

      <BidHeaderContainer data-testid='bid-header-wrapper'>
        <h1 data-testid='bid-header'>Banner image</h1>
      </BidHeaderContainer>
      <BidDropDownWrapper data-testid='bid-drop-down-wrapper'>
        <div>
          <div>
            <button type='button' className='dropdown-item' data-testid='bid-drop-down'>Duplicate</button>
          </div>
        </div>
      </BidDropDownWrapper>
      <BidUploadImageIconContainer data-testid='bid-upload-image-icon-wrapper'>
        <p data-testid='bid-upload-image-icon'>Upload image</p>
      </BidUploadImageIconContainer>
      <BidFormController data-testid='bid-form-controller-wrapper'>
        <label htmlFor='fixture-marketing-a3-bid-form-controller' data-testid='bid-form-controller'>Banner title</label>
        <input id='fixture-marketing-a3-bid-form-controller' />
      </BidFormController>
      <BidSelectWrapper data-testid='bid-select-wrapper'>
        <div className='select' data-testid='bid-select'>Priority 1</div>
      </BidSelectWrapper>
      <BidBusinessName data-testid='bid-business-name'>Downtown Diner</BidBusinessName>
      <BidOption data-testid='bid-option-wrapper'>
        <span data-testid='bid-option'>Double cheeseburger <b data-testid='bid-option-2'>1</b></span>
      </BidOption>

      <SbpAccordionItem data-testid='sbp-accordion-item-wrapper'>
        <div>
          <span data-testid='sbp-accordion-item'>Burgers</span>
        </div>
      </SbpAccordionItem>

      <PbHeaderContainer data-testid='pb-header-wrapper'>
        <div>
          <h1 data-testid='pb-header'>Banners</h1>
        </div>
      </PbHeaderContainer>
      <PbBannersHeader data-testid='pb-banners-header'>Active banners</PbBannersHeader>
      <PbBannerTitleConatiner data-testid='pb-banner-title-conatiner'>Summer promo banner</PbBannerTitleConatiner>
      <PbEnableWrapper data-testid='pb-enable-wrapper'>
        <span data-testid='pb-enable'>Enabled</span>
      </PbEnableWrapper>
      <PbAddNewBanner data-testid='pb-add-new-banner'>Add new banner</PbAddNewBanner>
      <PbInfoContent data-testid='pb-info-content'>Banners run across all businesses.</PbInfoContent>

      <PjHero data-testid='pj-hero-wrapper'>
        <h2 data-testid='pj-hero'>Promotion journeys</h2>
        <p data-testid='pj-hero-2'>Build a guided promotion for your customers.</p>
      </PjHero>
      <PjTemplateContent data-testid='pj-template-content-wrapper'>
        <h3 data-testid='pj-template-content'>Welcome discount</h3>
        <p data-testid='pj-template-content-2'>Give new customers a first-order discount.</p>
      </PjTemplateContent>
      <PjTemplateMeta data-testid='pj-template-meta'>5 minute setup</PjTemplateMeta>
      <PjSection data-testid='pj-section-wrapper'>
        <h2 data-testid='pj-section'>Active promotions</h2>
        <p data-testid='pj-section-2'>Promotions currently running.</p>
      </PjSection>
      <PjPromotionCard data-testid='pj-promotion-card-wrapper'>
        <h3 data-testid='pj-promotion-card'>Summer promo</h3>
        <p data-testid='pj-promotion-card-2'>10% off all orders above $30.</p>
      </PjPromotionCard>
      <PjStatus data-testid='pj-status'>Active</PjStatus>
      <PjPromotionAction type='button' data-testid='pj-promotion-action'>Edit</PjPromotionAction>
      <PjPromotionPagination data-testid='pj-promotion-pagination'>Page 1 of 2</PjPromotionPagination>
      <PjBuilderHeader data-testid='pj-builder-header-wrapper'>
        <h2 data-testid='pj-builder-header'>New journey</h2>
        <p data-testid='pj-builder-header-2'>Set up a promotion journey.</p>
      </PjBuilderHeader>
      <PjField data-testid='pj-field'>
        Journey name
        <input data-testid='pj-field-2' />
      </PjField>
      <PjFieldHint data-testid='pj-field-hint'>Shown to customers in the app.</PjFieldHint>
      <PjErrorText data-testid='pj-error-text'>This field is required.</PjErrorText>
      <PjScopeBox data-testid='pj-scope-box-wrapper'>
        <h3 data-testid='pj-scope-box'>Scope</h3>
        <p data-testid='pj-scope-box-2'>Choose which businesses this applies to.</p>
      </PjScopeBox>
      <PjScopeModeButton type='button' data-testid='pj-scope-mode-button'>All businesses</PjScopeModeButton>
      <PjBusinessOption data-testid='pj-business-option'>Downtown Diner</PjBusinessOption>
      <PjChoiceGroup data-testid='pj-choice-group'>Any order</PjChoiceGroup>
      <PjScopeHint data-testid='pj-scope-hint'>Applies to all current and future businesses.</PjScopeHint>
      <PjCheckGrid data-testid='pj-check-grid-wrapper'>
        <label data-testid='pj-check-grid'>Delivery</label>
      </PjCheckGrid>
      <PjProductPickerHeader data-testid='pj-product-picker-header-wrapper'>
        <h4 data-testid='pj-product-picker-header'>Products</h4>
        <p data-testid='pj-product-picker-header-2'>Choose which products qualify.</p>
      </PjProductPickerHeader>
      <PjProductSelectionCount data-testid='pj-product-selection-count'>2 selected</PjProductSelectionCount>
      <PjProductPickerSearch as='input' data-testid='pj-product-picker-search' />
      <PjProductOption data-testid='pj-product-option'>Double cheeseburger</PjProductOption>
      <PjProductPickerEmpty data-testid='pj-product-picker-empty'>No products match your search.</PjProductPickerEmpty>
      <PjProductPickerLoadMore type='button' data-testid='pj-product-picker-load-more'>Load more</PjProductPickerLoadMore>
      <PjActionButton type='button' data-testid='pj-action-button'>Save</PjActionButton>
      <PjApiError data-testid='pj-api-error'>Something went wrong. Try again.</PjApiError>
      <PjEmptyState data-testid='pj-empty-state'>No promotion journeys yet.</PjEmptyState>

      {/*
        The declared icon-glyph preservations. These must NOT move when a role
        moves: the coordinator's other six preservations in this batch are
        `font: inherit` button/field resets in PromotionJourneysListing with no
        size of their own to observe and are deliberately not mounted here.
      */}
      <section data-testid='a3-preservations'>
        <PosIconWrapper data-testid='pos-icon-wrapper'>
          <svg data-testid='pos-icon' />
        </PosIconWrapper>
        <BdUploadImageIconContainer data-testid='bd-upload-icon-wrapper'>
          <svg data-testid='bd-upload-icon' />
        </BdUploadImageIconContainer>
        <BdActionSelectorWrapper data-testid='bd-action-icon-wrapper'>
          <button type='button' aria-label='Promotion actions'>
            <svg data-testid='bd-action-icon' />
          </button>
        </BdActionSelectorWrapper>
        <BidDropDownWrapper data-testid='bid-dropdown-icon-wrapper'>
          <button type='button' aria-label='Banner actions'>
            <svg data-testid='bid-dropdown-icon' />
          </button>
        </BidDropDownWrapper>
        <BidUploadImageIconContainer data-testid='bid-upload-icon-wrapper'>
          <svg data-testid='bid-upload-icon' />
        </BidUploadImageIconContainer>
      </section>
    </main>
  )
}
