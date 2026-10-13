import styled, { css } from 'styled-components'

export const Container = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  padding: 0px 30px;
`

export const List = styled.div`
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  padding: 15px 0;
`

export const PayCard = styled.div`
  width: calc(50% - 30px);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 15px;
  text-align: center;

  ${props => props.isDisabled && css`
    pointer-events: none;
  `}

  > div {
    max-width: 88px;
    width: 100%;
    border: 1px solid #DEE2E6;
    border-radius: 7.6px;
    padding: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
    box-sizing: border-box;

    > svg {
      font-size: 25px;
      path {
        fill: #DEE2E6;
      }
    }
  }

  p {
    margin: 0px;
    font-size: 13px;
    text-align: center;
    color: #DEE2E6;
    white-space: nowrap;
  }

  @media (min-width: 351px) {
    width: calc(33% - 30px);
  }

  @media (min-width: 513px) {
    width: calc(25% - 30px);
  }

  @media (min-width: 768px) {
    width: calc(25% - 30px);
  }

  @media (min-width: 1200px) {
    width: calc(20% - 30px);
  }

  &.active {
    > div {
      border: 1px solid ${props => props.theme.colors.primary};
      svg path {
        fill: ${props => props.theme.colors.primary};
      }
    }
    p {
      color: ${props => props.theme.colors.headingColor};
    }
  }

  /* &:not(.active) {
    border: ${({ isSkeleton }) => isSkeleton ? '0' : '1px solid #EAEAEA'};
  } */
`

export const PayCardSelected = styled.div`
  padding: 30px 0px 0px;
`

export const CardItemContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  font-weight: bold;

  span {
    display: flex;
  }

  .checks svg {
    color: ${props => props.theme.colors.primary};
    font-size: 22px;
  }

  .brand svg {
    font-size: 26px;
  }

  > * {
    margin-right: 10px
    ${props => props.theme?.rtl && css`
      margin-left: 10px;
      margin-right: 0;
    `}
  }
`

export const WrapperPlaceOrderButton = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
  flex-direction: column;

  button {
    width: 100%;
    padding: 5px 20px;
    cursor: pointer;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
  p {
    color: ${props => props.theme.colors.danger};
  }
  .ConfirmTerms {
    line-height: 17px;
    text-align: center;
    color: hsla(0,0%,10%,.6);
    font-size: 13px;
    margin: 10px 0 0;

    a {
      color: ${props => props.theme.colors.primary};
      cursor: pointer;
    }
  }
`

export const BlockTrial = styled.div`
  background: #FFFFFF;
  box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;

  h3#plan-title {
    margin-top: 0px;
    font-size: 22px;
  }
`

export const BlockContainer = styled.div`
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
`

export const PlanDetails = styled.div`
  display: flex;
  box-sizing: border-box;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 20px;

  @media (min-width: 769px) {
    flex-direction: row;
  }
`

export const PlanWrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;

  @media (min-width: 768px) {
    h3 {
      margin-top: 30px;
      margin-bottom: ${props => props.isDescription ? 0 : 20}px;
    }
  }
`

const PlanBase = styled.div`
  display: flex;
  flex-direction: ${props => props.fd ?? 'row'};
  ${props => props.isBorder && css`
    border-bottom: 1px solid ${props => props.theme.colors.gray200};
  `};
  ${props => props.p && css`
    padding: ${props => props.p ?? '20px'};
  `};
`

export const PlanTitle = styled.div`
  display: flex;
  width: 100%;
  justify-content: space-between;
  flex-direction: row;
  align-items: center;
`

export const PlanDescription = styled(PlanBase)`
  p, h4 {
    margin: 0;
  }

  h4 {
    font-size: 20px;
  }

  p, span {
    color: ${props => props.theme.colors.darkTextColor};
    font-size: 12px;
    font-weight: 100;
  }

  div#wrap1 {
    display: flex;
  }

  div:first-child:not(#wrap1) {
    display: flex;
    flex-direction: column;
    margin-right: 20px;
    min-width: 120px;
  }

  #action {
    display: flex;
    align-items: flex-end;

    svg {
      font-size: 25px;
      cursor: pointer;
      color: ${props => props.theme.colors.primary};
    }

    span#switch {
      cursor: pointer;
      font-size: 20px;
      margin: 0 20px;
      display: flex;
      transform: rotate(${(props) => props.rotate}deg);
    }
  }
`

export const BlockPlanLoading = styled.div`
  width: 100%;
  margin: 0 auto;

  @media (min-width: 768px) {
    width: 60%;
  }
`

export const WrapperTierList = styled.div`
  ${(props) => props.isBorderBottom && css`
    border-bottom: 1px solid ${props => props.theme.colors.gray200};
  `}
  padding-bottom: 30px;
  width: 100%;
  h2 {
    font-size: 18px;
  }

  p {
    margin: 0 0 10px;
    font-weight: bold;
    font-size: 14px;
    display: flex;
    align-items: flex-start;

    svg {
      font-size: 20px;
    }
  }

  @media (min-width: 768px) {
    p {
      align-items: center;
    }
  }
`

export const InfoMessage = styled.div`
  padding-bottom: 10px;
  display: flex;
  justify-content: center;

  span {
    color: ${props => props.theme.colors.darkTextColor};
    font-size: 12px;
    font-weight: 100;
  }
`
