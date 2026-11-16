import styled, { css } from 'styled-components'

export const LogisticsContainer = styled.div``

export const OrderStatusGroup = styled.div`
  display: flex;
  flex-direction: column;
`

export const OrderStatusWrapper = styled.div`
  padding: 15px 0;
  min-height: 44px;
  border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
  display: flex;
  align-items: center;
  cursor: pointer;
  width: 100%;
  background: none;
  border-inline: none;
  border-top: none;
  color: inherit;
  text-align: start;
  font-family: inherit;

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary};
    outline-offset: 2px;
  }

  > span {
    font-size: var(--od-type-control-size);
    margin-inline-start: 15px;
  }
`

export const RadioButton = styled.div`
  display: flex;
  align-items: center;

  svg {
    font-size: 16px;
    color: ${props => props.theme?.ordering?.semantic?.text?.subtle ?? props.theme.colors.secundaryLight};
  }

  ${({ active }) => active && css`
    svg {
      color: ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary};
    }
  `}
`
export const SubSectionContainer = styled.div`
  margin: 45px 0;
  > div {
    padding: 0;
    h1 {
      font-weight: 600;
      font-size: var(--od-type-section-title-size);
      line-height: 1.3;
    }
  }
`
export const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  margin: 0 0 29px 0;

  label {
    font-size: var(--od-type-control-size);
    margin: 0px;
    padding-inline-start: 10px;
    min-height: 44px;
    display: flex;
    align-items: center;
  }
`
export const HeaderWrapper = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;

  h2 {
    padding-inline-end: 16px;
  }
`
