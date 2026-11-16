import React from 'react'
import styled, { css } from 'styled-components'

export const AccordionSection = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 10px 0px;
  color: #191919;
`

const AccordionStyled = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: background-color 0.6s ease;

  .rotate {
    transform: rotate(180deg);
  }

  .accordion__icon {
    margin-left: auto;
    transition: transform 0.6s ease;
    ${props => props.theme?.rtl && css`
      margin-right: auto;
      margin-left: initial;
    `}
  }

  @media (min-width: 411px){
    flex-direction: row;
  }

`

export const Accordion = (props) => {
  // Same shape as the already-migrated twin in Orders/ProductItemAccordion, and
  // for the reason section 4.1 gives: where the declaration is the same, the two
  // copies take the same treatment. A mutated `const style = {}` is a binding the
  // engine cannot resolve, so the expression stays ungoverned and no guard can
  // pin it; a constant one is pinned like its twin. Behaviour is unchanged —
  // `style={{}}` and `style={undefined}` render identically, and the invalid
  // branch still sets the same opacity.
  const style = props.isValid ? undefined : { opacity: '0.5' }
  return (
    <AccordionStyled
      {...props}
      style={style}
    >
      {props.children}
    </AccordionStyled>
  )
}

export const WrapperProductImage = styled.div`
  max-width: 55px;
  max-height: 55px;
  height: 55px;
  width: 55px;
  border-radius: 7.6px;

  @media (min-width: 768px) {
    max-width: 62px;
    max-height: 62px;
    height: 62px;
    width: 62px;
  }
`

const ProductImageStyled = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  position: relative;
  background-repeat: no-repeat, repeat;
  background-size: contain;
  object-fit: cover;
  background-position: center;
  border-radius: 10px;
`

export const ProductImage = (props) => {
  return (
    <ProductImageStyled
      {...props}
      style={{ backgroundImage: `url(${props.bgimage})` }}
    >
      {props.children}
    </ProductImageStyled>
  )
}

export const ContentInfo = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  /* : no text-transform: the product reads as in the queue row («10 ct Chick-fil-A»), as the business wrote it */
  margin-left: 10px;
  width: 100%;

  @media (min-width: 411px) {
    width: 80%;
  }

  ${props => props.theme?.rtl && css`
    margin-right: 10px;
    margin-left: 0px;
  `}

  h3 {
    font-size: var(--od-type-content-size);
    margin: 0px;
    font-weight: 400;
    color: ${props => props.theme.colors.headingColor};
  }

  /* redesign  (row 15): the price under the name at <= 410px starts where the name does */
  .mobile-product-price {
    justify-content: flex-start;
  }

  span {
    display: flex;
    justify-content: space-between;
    margin: 0px;

    p {
      margin: 0px;
      font-size: 14px;
    }

    div {
      display: flex;

      span {
        height: 20px;
        svg {
          font-size: 20px;
          &:nth-child(1) {
            margin-right: 3px;
            ${props => props.theme?.rtl && css`
              margin-left: 3px;
              margin-right: 0px;
            `}
          }
        }
      }
    }
  }

  @media (min-width: 577px) {
    h3 {
      font-size: 18px;
    }
  }
`

export const AccordionContent = styled.div`
  overflow: hidden;
  transition: max-height 0.6s ease;
  width: 100%;
  margin: auto;

  @media (min-width: 481px) {
    width: 80%;
  }

  @media print {
    margin-top: 20px;
  }
`

export const AccordionText = styled.div`
  font-weight: 400;
  font-size: var(--od-type-content-size);
  padding: 18px;
`

export const ProductComment = styled.div`
  padding-left: 40px;
  ${props => props.theme?.rtl && css`
    padding-right: 40px;
    padding-left: 0px;
  `}
  p {
    font-weight: bold;
    margin: 0px;
  }

  h3 {
    font-size: var(--od-type-content-size);
    font-weight: normal;
    /* : as written (no text-transform), as in the queue row */
    margin: 0px 20px 0px 40px;
    display: -webkit-box;
    line-height: 1.5;
    ${props => props.theme?.rtl && css`
      margin: 0px 40px 0px 20px;
    `}
  }
`

export const ProductInfo = styled.div`
  display: flex;
  align-items: center;
  flex: 1;

  h1,
  h3 {
    font-size: var(--od-type-content-size);
  }

  p {
    font-size: var(--od-type-identifier-size);
    margin: 0px 5px;
  }

  @media (min-width: 411px) {
    width: 80%;
  }

  @media (min-width: 481px) {
    width: 70%;
  }
`

export const ProductError = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;

  span {
    font-size: var(--od-type-content-size);
    text-align: center;
  }

  @media (min-width: 411px){
    width: 35%;

    span{
      text-align: right;
    }
  }
`

export const ProductActions = styled.div`
  display: flex;
  justify-content: flex-end;
`

export const ProductActionsEdit = styled.span`
  svg {
    font-size: 20px;
    margin-right: 5px;
    cursor: pointer;
    ${props => props.theme?.rtl && css`
      margin-left: 5px;
      margin-right: 0px;
    `}
  }
`

export const ProductActionsDelete = styled(ProductActionsEdit)`
  display: none;
  svg {
    margin-right: 0px;
  }

  @media (min-width: 411px){
    display: block;
  }
`

export const ProductPriceSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
`

export const ProductPrice = styled.div`
  width: 100%;
  display: flex;
  justify-content: flex-end;

  p,
  span {
    font-size: var(--od-type-identifier-size);
    color: ${props => props.theme.colors.headingColor};
  }

  span {
    font-weight: 500;
  }

  p {
    margin: 0px 5px;
  }

  svg {
    cursor: pointer;
  }
`

export const ProductSelect = styled.select`
  max-width: 55px;
  height: 50px;
  border: 0;
  background-color: transparent;
  font-size: var(--od-type-control-value-size);
  outline: none;
  margin-left: 5px;

  ${props => props.theme?.rtl && css`
    margin-right: 5px;
    margin-left: 0px;
  `}
`

export const ProductNotAvailable = styled.span`
  color: #D81212;
`

export const ProductOptionsList = styled.ul`
  list-style-type: none;

  .suboption {
    margin-left: -25px;
    ${props => props.theme?.rtl && css`
      margin-right: -25px;
      margin-left: 0px;
  `}
  }

  p:nth-child(1) {
    margin-bottom: 0;
  }

  p {
    font-weight: 400;
    margin: 0px;
    color: ${props => props.theme.colors.lightGray};
    font-size: var(--od-type-secondary-size);
  }

  li span {
    color: ${props => props.theme.colors.lightGray};
    font-size: var(--od-type-secondary-size);
  }

  li.ingredient {
    padding-left: 15px;
    ${props => props.theme?.rtl && css`
      padding-right: 15px;
      padding-left: 0px;
    `}
  }
`

export const ProductQuantity = styled.span`
  display: flex;
  p {
    margin: 0px 5px;
  }
  margin: 0 10px 0 20px;

  ${props => props.theme?.rtl && css`
    margin: 0 20px 0 10px;
  `}
`
export const ScheduleInfoWrapper = styled.div`
  width: calc(100% - 65px);
  box-sizing: border-box;
  h3 {
    margin: 0px;
    font-size: var(--od-type-content-size);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: ${props => props.theme.colors.headingColor};
  }
  padding-left: 10px;
  ${props => props.theme.rtl && css`
    padding-left: 0px;
    padding-right: 10px;
  `}
`

export const ScheduleInfo = styled.div`
  span {
    font-weight: 400;
    font-size: var(--od-type-identifier-size);
    line-height: 15px;
  }
`

// redesign (row 77): reason line under a dimmed unavailable row
// (no font-size of its own: it reads at the size of the line it sits under, like the Orders twin's ProductNotAvailable; the type roles are the coordinator's)
export const ProductUnavailableNote = styled(ProductNotAvailable)`
  padding-top: 2px;
`
