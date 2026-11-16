import styled, { css } from 'styled-components'

export const UserDetailsMenuContainer = styled.div`
  width: 100%;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
  margin-top: 15px;
`

export const Tab = styled.div`
  appearance: none;
  background: none;
  border: 0;
  font-family: inherit;
  text-align: inherit;
  padding: 10px 0px;
  cursor: pointer;
  color: ${props => props.theme.colors?.lightGray};
  white-space: nowrap;
  font-size: var(--od-type-control-size);

  ${props => props.theme?.rtl
? css`
    margin-left: 30px;
  `
: css`
    margin-right: 30px;
  `}

  ${({ active }) => active && css`
    color: ${props => props.theme.colors.headingColor};
    border-bottom: 2px solid ${props => props.theme.colors.headingColor};
    font-weight: 500;
    font-size: var(--od-type-control-size);
  `}

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
