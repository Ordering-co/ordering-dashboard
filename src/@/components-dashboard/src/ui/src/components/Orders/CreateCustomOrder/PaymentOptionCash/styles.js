import styled, { css } from 'styled-components'

export const PaymentCashContainer = styled.div`
  margin: 20px 0px 0px;
`

export const FormCash = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  label {
    font-size: var(--od-type-control-size);
    margin-right: 20px;
    ${props => props.theme?.rtl && css`
        margin-left: 20px;
        margin-right: 0;
    `}
  }
`

export const WrapperInput = styled.div`
  width: 100%;
  label {
    font-size: var(--od-type-control-size);
  }
  
  input {
    margin-top: 10px;
    width: 100%;
    box-sizing: border-box;
    height: 44px;
  }
`

export const ErrorText = styled.p`
  margin: 10px 0px 0px;
  color: var(--od-danger-functional);
  font-size: var(--od-type-content-size);
  font-weight: bold;
`
