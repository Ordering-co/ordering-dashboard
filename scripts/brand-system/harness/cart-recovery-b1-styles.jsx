import React from 'react'

import {
  OpenCartBillContainer as OcbOpenCartBillContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/CartRecovery/OpenCartBill/styles'
import {
  AccordionText as PiaAccordionText,
  ContentInfo as PiaContentInfo,
  ProductActionsEdit as PiaProductActionsEdit,
  ProductComment as PiaProductComment,
  ProductError as PiaProductError,
  ProductInfo as PiaProductInfo,
  ProductOptionsList as PiaProductOptionsList,
  ProductPrice as PiaProductPrice,
  ProductSelect as PiaProductSelect,
  ScheduleInfo as PiaScheduleInfo,
  ScheduleInfoWrapper as PiaScheduleInfoWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/CartRecovery/ProductItemAccordion/styles'

// Presentation-only fixture: the real CartRecovery open-carts bill and product
// accordion styled surfaces, no controller, SDK, account or network. These
// screens edit real carts and orders, so nothing is mounted from any row's
// index.js — only the styled-components exported by each row's styles.js.
export const CartRecoveryB1StylesFixture = () => {
  return (
    <main data-testid='cart-recovery-b1-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>
      <OcbOpenCartBillContainer data-testid='ocb-container-wrapper'>
        <table>
          <tbody>
            <tr>
              <td data-testid='ocb-table'>Subtotal</td>
            </tr>
          </tbody>
        </table>
        <table className='total'>
          <tbody>
            <tr data-testid='ocb-table-total-tr'>
              <td>Total</td>
            </tr>
          </tbody>
        </table>
        <table className='payments'>
          <thead>
            <tr>
              <th data-testid='ocb-table-payments-th'>Payments</th>
            </tr>
          </thead>
        </table>
      </OcbOpenCartBillContainer>

      <PiaContentInfo data-testid='pia-content-info-wrapper'>
        {/*
          This h3 carries both entry 23 (base content role) and preservation
          P9 (the @media (min-width: 577px) 18px override of the same
          declaration): the coordinator asserts this one node at two viewport
          widths, so only one node is mounted here.
        */}
        <h3 data-testid='pia-content-info-h3'>Double cheeseburger</h3>
      </PiaContentInfo>
      <PiaAccordionText data-testid='pia-accordion-text'>Tap to expand</PiaAccordionText>
      <PiaProductComment data-testid='pia-product-comment-wrapper'>
        <h3 data-testid='pia-product-comment-h3'>Extra sauce please</h3>
      </PiaProductComment>
      <PiaProductInfo data-testid='pia-product-info-wrapper'>
        <h3 data-testid='pia-product-info-h3'>Cheeseburger</h3>
        <p data-testid='pia-product-info-p'>x2</p>
      </PiaProductInfo>
      <PiaProductError data-testid='pia-product-error-wrapper'>
        <span data-testid='pia-product-error-span'>Out of stock</span>
      </PiaProductError>
      <PiaProductPrice data-testid='pia-product-price-wrapper'>
        <span data-testid='pia-product-price-span'>$12.00</span>
      </PiaProductPrice>
      <PiaProductSelect data-testid='pia-product-select'>
        <option>1</option>
      </PiaProductSelect>
      <PiaProductOptionsList data-testid='pia-product-options-list-wrapper'>
        <li>
          <p data-testid='pia-product-options-p'>Add-ons</p>
          <span data-testid='pia-product-options-li-span'>Extra cheese</span>
        </li>
      </PiaProductOptionsList>
      <PiaScheduleInfoWrapper data-testid='pia-schedule-info-wrapper-wrapper'>
        <h3 data-testid='pia-schedule-info-wrapper-h3'>Ready by</h3>
      </PiaScheduleInfoWrapper>
      <PiaScheduleInfo data-testid='pia-schedule-info-wrapper2'>
        <span data-testid='pia-schedule-info-span'>5:30 PM</span>
      </PiaScheduleInfo>

      {/*
        The declared icon-glyph and numeric-indicator preservations. Each is
        mounted on its own instance of the row's styled-component so the role
        mounts above stay free of preservation-only markup. The ruleset's
        remaining preservation (ProductItemAccordion ContentInfo `span > p`)
        matches no node in the component's current markup and is deliberately
        not mounted here.
      */}
      <section data-testid='b1-preservations'>
        <PiaContentInfo data-testid='pia-content-info-icon-wrapper'>
          <span>
            <div>
              <span>
                <svg data-testid='pia-content-info-icon' />
              </span>
            </div>
          </span>
        </PiaContentInfo>
        <PiaProductActionsEdit data-testid='pia-product-actions-edit-wrapper'>
          <svg data-testid='pia-product-actions-edit-icon' />
        </PiaProductActionsEdit>
      </section>
    </main>
  )
}
