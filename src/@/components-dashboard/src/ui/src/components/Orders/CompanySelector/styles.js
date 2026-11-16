import React from 'react'
import styled, { css } from 'styled-components'

export const Option = styled.div`
  display: flex;
  align-items: center;
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
  padding: ${({ padding }) => padding || '5px 10px'};
  white-space: nowrap;
  ${({ isPhoneView }) => isPhoneView && css`
    width: 100%;
  `}
  ${({ isRemove }) => isRemove && css`
    color: ${props => props.theme?.ordering?.semantic?.state?.danger?.functional ?? props.theme.colors.danger};
    padding: 3px 10px;
    font-size: var(--od-type-control-size);
  `}

  img {
    width: 45px;
    border-radius: 8px;
  }

  ${({ small }) => small && css`
    padding: ${({ padding }) => padding || '5px 0px'};
    img {
      width: 25px;
    }
  `}

  span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    max-width: 350px;
    font-size: var(--od-type-control-value-size);
  }

  @media (max-width: 576px) {
    padding: ${({ padding }) => padding || '5px 0px'};
    ${({ isFilterView }) => isFilterView && css`
      margin-inline-start: 10px;
    `}
    span {
      max-width: 280px;
    }
  }
`

export const OptionContent = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
`

export const CompanyNameContainer = styled.div`
  line-height: 1.3;
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? '#263238'};
`

export const CompanyName = styled.p`
  font-size: var(--od-type-control-value-size);
  font-weight: 600;
  line-height: 1.3;
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: 150px;
  margin: 0px;

  ${({ small }) => small && css`
    font-weight: 400;
  `}

  @media (max-width: 576px) {
    max-width: 90px;
  }
`
export const CompanyText = styled.span`
  font-size: var(--od-type-secondary-size);
  color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.lightGray};
  ${({ small }) => small && css`
    display: none;
  `}
`

export const WrapperCompanyImage = styled.div`
  width: 45px;
  height: 45px;
  box-shadow: ${props => props.theme?.ordering?.shadow?.[1] ?? '0px 1px 4px rgba(0, 0, 0, 0.1)'};
  border-radius: 8px;
  display: flex;

  svg {
    width: 100%;
    height: 100%;
    padding: 7px;
    box-sizing: border-box;
    border-radius: 50%;
  }

  ${({ small }) => small && css`
    width: 24px;
    height: 24px;
    border-radius: 8px;
    svg {
      padding: 3px;
    }
  `}

  margin-inline-end: 8px;
`
const CompanyImageStyled = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  position: relative;
  background-repeat: no-repeat, repeat;
  background-size: cover;
  object-fit: cover;
  background-position: center;
  border-radius: 8px;
`
export const CompanyImage = (props) => {
  return (
    <CompanyImageStyled
      {...props}
      style={{ backgroundImage: `url(${props.bgimage})` }}
    >
      {props.children}
    </CompanyImageStyled>
  )
}

export const PlaceholderTitle = styled(Option)`
  padding: 10px;

  ${({ isSingle }) => isSingle && css`
    padding: 0px;
    font-size: var(--od-type-control-value-size);
  `}
`
