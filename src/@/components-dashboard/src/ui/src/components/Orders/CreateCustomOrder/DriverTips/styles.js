import styled, { css } from 'styled-components'

export const DriverTipContainer = styled.div`
  margin-top: 50px;

  > p {
    font-size: var(--od-type-content-size);
    line-height: 24px;
    margin-top: 0;
    margin-bottom: 24px;
  }
`

export const TipCard = styled.button`
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  border: 1px solid ${props => props.theme.colors.borderColor};
  background: transparent;
  width: 62px;
  height: 62px;
  min-width: 62px;
  min-height: var(--od-touch-target-minimum);
  cursor: pointer;
  text-transform: capitalize;
  font-family: inherit;
  font-size: var(--od-type-control-size);
  color: var(--od-text-subtle);
  transition: all 0.3s;
  text-align: center;
  &.active {
    background-color: ${props => props.theme.colors.primary};
    color: ${props => props.theme.colors.primaryContrast};
  }
  &:focus-visible {
    outline: 2px solid var(--od-focus-ring-color);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

export const FormDriverTip = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`

export const DriverTipLabel = styled.label`
  font-size: var(--od-type-control-size);
  align-self: flex-start;

  ${props => props.theme?.rtl && css`
    margin-left: 20px;
    margin-right: 0;
  `}
`

export const WrapperInput = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-top: 10px;

  input {
    width: 65%;
    padding: 4px 15px;
    box-sizing: border-box;
    flex: 1;
    margin-inline-end: 10px;
  }

  @media (min-width: 768px) {
    input {
      width: 80%;
    }
  }
`

export const DriverTipMessage = styled.p`
  color: ${props => props.theme.colors.primary};
  font-weight: 600;
`

export const WrapperTips = styled.div`
  display: flex;
  width: 100%;
  justify-content: flex-start;
  align-items: center;
  flex-wrap: wrap;

  > div,
  > button {
    margin: 5px;
    text-align: center;
  }
`
