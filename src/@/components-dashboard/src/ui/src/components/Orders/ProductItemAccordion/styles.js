import React from 'react'
import styled from 'styled-components'
import { IconButton } from '../../../styles'

export const AccordionSection = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 10px 0px;
  min-width: 0;
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor ?? '#191919'};
`

const AccordionStyled = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  transition: background-color ${props => props.theme?.ordering?.motion?.duration?.base ?? '0.6s'} ${props => props.theme?.ordering?.motion?.easing?.standard ?? 'ease'};
  min-width: 0;

  .rotate {
    transform: rotate(180deg);
  }

  .accordion__icon {
    margin-inline-start: auto;
    transition: transform ${props => props.theme?.ordering?.motion?.duration?.base ?? '0.6s'} ${props => props.theme?.ordering?.motion?.easing?.standard ?? 'ease'};
  }

  @media (min-width: 411px){
    flex-direction: row;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    .accordion__icon {
      transition: none;
    }
  }

`

export const Accordion = (props) => {
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
  border-radius: ${props => props.theme?.ordering?.radius?.component ?? '7.6px'};
  flex: 0 0 auto;

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
  border-radius: ${props => props.theme?.ordering?.radius?.panel ?? '10px'};
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
  text-transform: capitalize;
  margin-inline-start: 10px;
  min-width: 0;
  width: 100%;

  @media (min-width: 411px) {
    width: 80%;
  }

  h3 {
    font-size: var(--od-type-content-size);
    margin: 0px;
    font-weight: 400;
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
    overflow-wrap: anywhere;
  }

  > .mobile-product-summary {
    display: flex;
    justify-content: space-between;
    margin: 0px;

    p {
      margin: 0px;
      font-size: var(--od-type-identifier-size);
      font-family: var(--od-type-identifier-font);
      font-variant-ligatures: var(--od-type-identifier-ligatures);
      direction: ltr;
      unicode-bidi: isolate;
    }

    > div {
      display: flex;
    }
  }

`

export const AccordionContent = styled.div`
  overflow: hidden;
  transition: max-height ${props => props.theme?.ordering?.motion?.duration?.base ?? '0.6s'} ${props => props.theme?.ordering?.motion?.easing?.standard ?? 'ease'};
  width: 100%;
  margin: auto;
  min-width: 0;

  @media (min-width: 481px) {
    width: 80%;
  }

  @media print {
    margin-block-start: 20px;
    max-height: none !important;
    overflow: visible;
    break-inside: avoid;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

export const AccordionText = styled.div`
  font-weight: 400;
  font-size: var(--od-type-content-size);
  padding: 18px;
`

export const ProductComment = styled.div`
  padding-inline-start: 40px;
  p {
    font-weight: bold;
    margin: 0px;
  }

  h3 {
    font-size: var(--od-type-content-size);
    font-weight: normal;
    text-transform: capitalize;
    margin-block: 0px;
    margin-inline: 40px 20px;
    display: -webkit-box;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
`

export const ProductInfo = styled.div`
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;

  h1,
  h3 {
    font-size: var(--od-type-content-size);
  }

  p {
    font-size: var(--od-type-identifier-size);
    font-family: var(--od-type-identifier-font);
    font-variant-ligatures: var(--od-type-identifier-ligatures);
    direction: ltr;
    unicode-bidi: isolate;
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
      text-align: end;
    }
  }
`

export const ProductActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  position: relative;
  z-index: 1;
`

export const ProductActionsEdit = styled(IconButton)`
  min-width: 44px;
  min-height: 44px;

  svg {
    font-size: 20px;
    color: ${props => props.theme?.ordering?.semantic?.state?.warning?.functional ?? '#F2BB40'};
  }
`

export const ProductActionsDelete = styled(ProductActionsEdit)`
  svg {
    color: ${props => props.theme?.ordering?.semantic?.state?.danger?.functional ?? props.theme.colors?.danger ?? '#D81212'};
  }
`

export const ProductPriceSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 0;
`

export const ProductPrice = styled.div`
  width: 100%;
  display: flex;
  justify-content: flex-end;

  span {
    font-size: var(--od-type-identifier-size);
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
    font-weight: 500;
    font-family: var(--od-type-identifier-font);
    font-variant-ligatures: var(--od-type-identifier-ligatures);
    direction: ltr;
    unicode-bidi: isolate;
  }
`

export const ProductAccordionToggle = styled(IconButton)`
  min-width: 44px;
  min-height: 44px;

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors.primary};
    outline-offset: 2px;
  }

  svg {
    color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors?.lightGray};
  }
`

export const ProductSelect = styled.select`
  max-width: 55px;
  height: 50px;
  border: 0;
  background-color: transparent;
  font-size: var(--od-type-control-value-size);
  outline: none;
  margin-inline-start: 5px;
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors.primary};
    outline-offset: 2px;
  }
`

export const ProductNotAvailable = styled.span`
  color: ${props => props.theme?.ordering?.semantic?.state?.danger?.functional ?? props.theme.colors?.danger ?? '#D81212'};
`

export const ProductOptionsList = styled.ul`
  list-style-type: none;

  .suboption {
    margin-inline-start: -25px;
  }

  p:nth-child(1) {
    margin-bottom: 0;
  }

  p {
    font-weight: 400;
    margin: 0px;
    color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.lightGray};
    font-size: var(--od-type-secondary-size);
  }

  li span {
    color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.lightGray};
    font-size: var(--od-type-secondary-size);
    overflow-wrap: anywhere;
  }

  li.ingredient {
    padding-inline-start: 15px;
  }
`

export const ProductQuantity = styled.span`
  display: flex;
  font-size: var(--od-type-identifier-size);
  font-family: var(--od-type-identifier-font);
  font-variant-ligatures: var(--od-type-identifier-ligatures);
  direction: ltr;
  unicode-bidi: isolate;
  p {
    margin: 0px 5px;
  }
  margin-block: 0;
  margin-inline: 20px 10px;
`
export const ScheduleInfoWrapper = styled.div`
  width: calc(100% - 65px);
  box-sizing: border-box;
  h3 {
    margin: 0px;
    font-size: var(--od-type-content-size);
    overflow-wrap: anywhere;
    white-space: normal;
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
  }
  padding-inline-start: 10px;
`

export const ScheduleInfo = styled.div`
  span {
    font-weight: 400;
    font-size: var(--od-type-identifier-size);
    font-family: var(--od-type-identifier-font);
    font-variant-ligatures: var(--od-type-identifier-ligatures);
    direction: ltr;
    unicode-bidi: isolate;
    line-height: 15px;
  }
`
