import styled, { css } from 'styled-components'

export const UserActiveStateFilterContainer = styled.div`
  width: 100%;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
`

export const Tab = styled.div`
  appearance: none;
  background: none;
  border: 0;
  font-family: inherit;
  text-align: inherit;
  padding: 10px 0px;
  font-size: var(--od-type-control-size);
  ${props => props.theme?.rtl
? css`
    margin-left: 30px;
  `
: css`
    margin-right: 30px;
  `}
  cursor: pointer;
  color: ${props => props.theme.colors?.headingColor};
  white-space: nowrap;

  ${({ active }) => active && css`
    border-bottom: 3px solid;
    font-weight: 500;
  `}

  ${({ active }) => !active && css`
    color: #909BA9;
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
