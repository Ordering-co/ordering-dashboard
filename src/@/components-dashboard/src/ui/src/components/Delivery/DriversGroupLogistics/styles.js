import styled, { css } from 'styled-components'

export const LogisticsContainer = styled.div`
  padding: 20px 0;
  min-height: calc(100% - 120px);
  ${({ disabled }) => disabled && css`
    opacity: 0.7;
    pointer-events: none;
  `}

  > button {
    position: sticky;
    top: 100%;
    min-height: 44px;
    margin: 30px 0 20px;
  }
`

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
  font-family: inherit;
  text-align: start;

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

export const LogisticsConfigsContainer = styled.div`
  margin-top: 80px;
  border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
  border-radius: ${props => props.theme?.ordering?.radius?.control ?? '8px'};
  margin-bottom: 50px;
  overflow: hidden;
  > div:last-child,
  > button:last-child {
    border-bottom: none;
  }
`

export const LogisticsConfigItem = styled.div`
  cursor: pointer;
  padding: 10px 15px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: none;
  border: none;
  font-family: inherit;
  text-align: start;
  color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.lightGray};
  border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};

  &:hover {
    background-color: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors.lightPrimary};
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary};
    outline-offset: -2px;
  }

  span {
    font-size: var(--od-type-content-size);
  }

  ${({ active }) => active && css`
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
    border-top: 1px solid ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary};
    border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary} !important;
    background-color: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors.lightPrimary};
  `}

  svg {
    font-size: 20px;
  }
`
