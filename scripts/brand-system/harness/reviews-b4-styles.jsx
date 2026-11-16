import React from 'react'

import {
  Comment as BRDComment,
  Header as BRDHeader,
  InfoBlock as BRDInfoBlock,
  NotReviewed as BRDNotReviewed,
  ReviewQualityTextContainer as BRDReviewQualityTextContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/BusinessReviewDetails/styles'
import {
  InfoBlock as BRLInfoBlock,
  ReviewMarkerWrapper as BRLReviewMarkerWrapper,
  ReviewObject as BRLReviewObject,
  ReviewsTable as BRLReviewsTable
} from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/BusinessReviewList/styles'
import {
  Header as PRDHeader,
  LikeSignWrapper as PRDLikeSignWrapper,
  NotReviewed as PRDNotReviewed,
  ReviewComment as PRDReviewComment
} from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/ProductReviewDetails/styles'
import {
  ReviewMarkerWrapper as RPLReviewMarkerWrapper,
  ReviewObject as RPLReviewObject,
  ReviewsTable as RPLReviewsTable
} from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/ReviewProductsListing/styles'
import {
  ClearFilter as RLClearFilter,
  ErrorText as RLErrorText,
  FilterButton as RLFilterButton,
  FormField as RLFormField,
  HeaderLeft as RLHeaderLeft,
  Tab as RLTab,
  TitleWrapper as RLTitleWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/ReviewsListing/styles'
import {
  Comment as URDComment,
  Header as URDHeader,
  NotReviewed as URDNotReviewed,
  ReviewMeta as URDReviewMeta,
  ReviewQualityTextContainer as URDReviewQualityTextContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/UserReviewDetails/styles'
import {
  InfoBlock as URLInfoBlock,
  ReviewMarkerWrapper as URLReviewMarkerWrapper,
  ReviewObject as URLReviewObject,
  ReviewsTable as URLReviewsTable
} from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/UsersReviewList/styles'
// Batch fixture for b4-reviews-realtime: the review, real-time and reports surfaces of
// BusinessIntelligence.
//
// It mounts the migrated STYLES, not the controllers, so nothing here opens a socket or
// a request -- which matters in a batch whose rows include the real-time screen.
//
// GENERATED from the ruleset by generate-batch-fixture.mjs; its `--check` refuses a
// fixture that is not what the ruleset derives today, and the batch's fixture-config
// states how to mount every selector that is not a bare element name.
//
// Two of the components mounted here govern TWO jobs with one declaration: ReviewObject
// and ReviewMarkerWrapper size both a table column label and, by inheritance, a value in
// the body. The role asserted below is the label's. The batch record says so, so that a
// green here is not read as a claim about the second job.
const Glyph = ({ testid }) => (
  <svg data-testid={testid} viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
)

export const ReviewsB4StylesFixture = () => (
  <div data-testid='reviews-b4-styles' style={{ padding: 24, display: 'grid', gap: 12 }}>
    {/* BusinessReviewDetails */}
    <BRDHeader data-testid='brd-header-wrap'>
      <h1 data-testid='brd-header-h1'>Reviews manager</h1>
    </BRDHeader>
    <BRDReviewQualityTextContainer data-testid='brd-review-quality-text-container-wrap'>
      <p data-testid='brd-review-quality-text-container-p'>Order No. 1234</p>
    </BRDReviewQualityTextContainer>
    <BRDInfoBlock data-testid='brd-info-block-wrap'>
      <p data-testid='brd-info-block-p'>Order No. 1234</p>
      <p className='bold' data-testid='brd-info-block-pbold'>Acme Store</p>
    </BRDInfoBlock>
    <BRDComment data-testid='brd-comment-root'>Business</BRDComment>
    <BRDNotReviewed data-testid='brd-not-reviewed-root'>Business</BRDNotReviewed>

    {/* BusinessReviewList */}
    <BRLReviewsTable data-testid='brl-reviews-table-wrap'>
      <table><thead><tr><th data-testid='brl-reviews-table-th'>Business</th></tr></thead></table>
    </BRLReviewsTable>
    <BRLReviewObject data-testid='brl-review-object-root'>Business</BRLReviewObject>
    <BRLInfoBlock data-testid='brl-info-block-wrap'>
      <p data-testid='brl-info-block-p'>Order No. 1234</p>
      <p className='bold' data-testid='brl-info-block-pbold'>Acme Store</p>
    </BRLInfoBlock>
    <BRLReviewMarkerWrapper data-testid='brl-review-marker-wrapper-root'>
      <Glyph testid='brl-review-marker-wrapper-svg' />
    </BRLReviewMarkerWrapper>

    {/* ProductReviewDetails */}
    <PRDHeader data-testid='prd-header-wrap'>
      <h1 data-testid='prd-header-h1'>Reviews manager</h1>
    </PRDHeader>
    <PRDReviewComment data-testid='prd-review-comment-root'>Business</PRDReviewComment>
    <PRDNotReviewed data-testid='prd-not-reviewed-root'>Business</PRDNotReviewed>
    <PRDLikeSignWrapper data-testid='prd-like-sign-wrapper-wrap'>
      <Glyph testid='prd-like-sign-wrapper-svg' />
    </PRDLikeSignWrapper>

    {/* ReviewProductsListing */}
    <RPLReviewsTable data-testid='rpl-reviews-table-wrap'>
      <table><thead><tr><th data-testid='rpl-reviews-table-th'>Business</th></tr></thead></table>
    </RPLReviewsTable>
    <RPLReviewObject data-testid='rpl-review-object-root'>Business</RPLReviewObject>
    <RPLReviewMarkerWrapper data-testid='rpl-review-marker-wrapper-root'>
      <Glyph testid='rpl-review-marker-wrapper-svg' />
    </RPLReviewMarkerWrapper>

    {/* ReviewsListing */}
    <RLHeaderLeft data-testid='rl-header-left-wrap'>
      <h1 data-testid='rl-header-left-h1'>Reviews manager</h1>
    </RLHeaderLeft>
    <RLTab data-testid='rl-tab-root'>Business</RLTab>
    <RLFormField data-testid='rl-form-field-wrap'>
      <label data-testid='rl-form-field-label'>Business</label>
    </RLFormField>
    <RLFilterButton data-testid='rl-filter-button-root'>
      <Glyph testid='rl-filter-button-svg' />
    </RLFilterButton>
    <RLClearFilter data-testid='rl-clear-filter-root'>Business</RLClearFilter>
    <RLErrorText data-testid='rl-error-text-root'>Business</RLErrorText>
    <RLTitleWrapper data-testid='rl-title-wrapper-wrap'>
      <Glyph testid='rl-title-wrapper-svg' />
    </RLTitleWrapper>

    {/* UserReviewDetails */}
    <URDHeader data-testid='urd-header-wrap'>
      <h1 data-testid='urd-header-h1'>Reviews manager</h1>
    </URDHeader>
    <URDReviewMeta data-testid='urd-review-meta-wrap'>
      <p data-testid='urd-review-meta-p'>Order No. 1234</p>
    </URDReviewMeta>
    <URDReviewQualityTextContainer data-testid='urd-review-quality-text-container-wrap'>
      <p data-testid='urd-review-quality-text-container-p'>Order No. 1234</p>
    </URDReviewQualityTextContainer>
    <URDComment data-testid='urd-comment-root'>Business</URDComment>
    <URDNotReviewed data-testid='urd-not-reviewed-root'>Business</URDNotReviewed>

    {/* UsersReviewList */}
    <URLReviewsTable data-testid='url-reviews-table-wrap'>
      <table><thead><tr><th data-testid='url-reviews-table-th'>Business</th></tr></thead></table>
    </URLReviewsTable>
    <URLReviewObject data-testid='url-review-object-root'>Business</URLReviewObject>
    <URLInfoBlock data-testid='url-info-block-wrap'>
      <p data-testid='url-info-block-p'>Order No. 1234</p>
      <p className='bold' data-testid='url-info-block-pbold'>Acme Store</p>
    </URLInfoBlock>
    <URLReviewMarkerWrapper data-testid='url-review-marker-wrapper-root'>
      <Glyph testid='url-review-marker-wrapper-svg' />
    </URLReviewMarkerWrapper>
  </div>
)
