import styled, { css } from 'styled-components'

export const TabOption = styled.div`
  appearance: none;
  background: none;
  border: 0;
  font-family: inherit;
  text-align: inherit;
  display: flex;
  align-items: center;
  padding: 12px 0;
  cursor: pointer;
  color: ${props => props.theme.colors.headingColor};

  > svg {
    font-size: 20px;
    &.fill {
      color: ${props => props.theme.colors.primary};
    }
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors.primary};
    outline-offset: 2px;
    border-radius: ${props => props.theme?.ordering?.radius?.control ?? '4px'};
  }

  @media (pointer: coarse) {
    min-height: ${props => props.theme?.ordering?.component?.density?.touchTargetMinimum ?? '44px'};
    min-width: ${props => props.theme?.ordering?.component?.density?.touchTargetMinimum ?? '44px'};
  }
`

export const TabOptionName = styled.span`
  color: ${props => props.theme.colors.headingColor};
  ${props => props.theme?.rtl
? css`
    margin-right: 10px;
  `
: css`
    margin-left: 10px;
  `}
`
