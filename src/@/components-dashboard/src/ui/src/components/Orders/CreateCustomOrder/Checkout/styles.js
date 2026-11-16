import styled, { css } from 'styled-components'

export const Conatiner = styled.div`

`

export const WarningMessage = styled.div`
  width: 100%;
  height: fit-content;
  max-height: fit-content;
  min-height: 150px;
  background-color: var(--od-warning-soft);
  color: var(--od-text);
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 10px;
  position: relative;

  svg {
    position: absolute;
    font-size: 30px;
    top: 0;
    left: 0;
    margin: 11px;
    ${props => props.theme?.rtl && css`
        right: 0;
        left: initial;
    `}
  }

  p {
    font-size: var(--od-type-title-size);
    margin: 0px 60px;
    text-align: center;
  }
`
export const Flag = styled.span`
  font-size: var(--od-type-secondary-size);
  margin: 0px;
  text-transform: capitalize;
  color: var(--od-danger-functional);
  font-weight: 500;

  @media (min-width: 381px) {
    font-size: var(--od-type-content-size);
  }
`
export const SectionTitleContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`
export const PaymentMethodContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin: 50px 0px 0px;
`
export const WarningText = styled.p`
  margin: 10px auto;
  text-align: center;
  color: ${props => props.theme.colors.primary};
`
export const WrapperPlaceOrderButton = styled.div`
  padding: 15px 0px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;

  span {
    font-weight: 600;
    font-size: var(--od-type-content-size);

    @media (min-width: 1200px) {
      font-size: var(--od-type-section-title-size);
      padding-left: 20px;
    }
  }

  button {
    min-height: 44px;
    border-radius: 7.6px;
  }
`
