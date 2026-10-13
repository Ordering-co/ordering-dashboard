import React from 'react'
import styled, { css } from 'styled-components'

export const AccordionSection = styled.div`
  width: 100%;
`

const AccordionStyled = styled.div`
  cursor: pointer;
  width: 100%;
  transition: background-color 0.3s ease;

  .rotate {
    transform: rotate(90deg);
  }

  .accordion__icon {
    min-width: 16px;
    margin-right: 10px;
    transition: transform 0.3s ease;
    ${props => props.theme?.rtl && css`
      margin-left: 10px;
      margin-left: initial;
    `}
  }

  @media (min-width: 411px){
    flex-direction: row;
  }

`

export const Accordion = (props) => {
  const style = {}
  return (
    <AccordionStyled
      {...props}
      style={style}
    >
      {props.children}
    </AccordionStyled>
  )
}

export const AccordionItem = styled.div`
  display: flex;
  align-items: center;
  padding: 15px 10px;

  > div {
    display: flex;
    align-items: center;
    svg,
    img {
      ${props => props.theme?.rtl
? css`
        margin-left: 10px;
      `
: css`
        margin-right: 10px;
      `}
    }

    span {
      font-size: 14px;
      font-weight: 500;
    }
  }

  ${({ isProduct }) => isProduct && css`
    > div {
      span {
        font-weight: 400;
      }
    }
  `}

  ${props => props.theme?.rtl
? css`
    margin-right: ${({ margin }) => `${margin}px` || '0px'};
  `
: css`
    margin-left: ${({ margin }) => `${margin}px` || '0px'};
  `}

  border-radius: 8px;
  &:hover {
    background-color: ${props => props.theme.colors.secundary};
  }

  ${({ active }) => active && css`
    background-color: ${props => props.theme.colors.lightPrimary} !important;
    border: 1px solid ${props => props.theme.colors.primary};
  `}
  ${({ isAccept }) => isAccept && css`
    border-radius: unset;
    border: 1px solid ${props => props.theme.colors.backgroundPage};
    border-top: 1px solid ${props => props.theme.colors.primary};
  `}
  ${({ isBorderBottom }) => isBorderBottom && css`
    border-radius: unset;
    border: 1px solid ${props => props.theme.colors.backgroundPage};
    border-bottom: 1px solid ${props => props.theme.colors.primary};
  `}

  ${({ hasNotSubcategoriesAndPrincipal }) => hasNotSubcategoriesAndPrincipal && css`
    > div {
      position: relative;
      right: 20px;
    }
  `}
  ${({ isLastCategory }) => isLastCategory && css`
    > div {
        position: relative;
        left: 7px;
      }
  `}
`

export const AccordionContent = styled.div`
  overflow: hidden;
  transition: max-height 0.6s ease;
  width: 100%;
`

export const CheckWrapper = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  .default {
    min-width: 50px;
    width: 65px;
    text-align: center;
    > span.radio {
      cursor: pointer;
    }
    svg {
      color: ${props => props.theme.colors.secundaryLight};
    }
  }
  ${props => props.disabled && css`
    div{
      pointer-events: none;
    }
  `}

  .checked {
    svg {
      color: ${props => props.theme.colors.primary};
    }
  }

`
