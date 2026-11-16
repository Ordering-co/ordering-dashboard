import styled, { css } from 'styled-components'

export const Container = styled.div`
  padding: 20px;
  width: 100%;
  overflow-x: hidden;

  > h1 {
    font-size: var(--od-type-title-size);
    font-weight: 700;
    margin-top: 0;
    margin-bottom: 7px;
  }
`
export const Tabs = styled.div`
  display: flex;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
  > div {
    &:not(:last-child) {
      ${props => props.theme?.rtl
? css`
        margin-left: 32px;
      `
: css`
        margin-right: 32px;
      `}
    }
  }
`
export const Tab = styled.div`
  appearance: none;
  background: none;
  border: 0;
  font-family: inherit;
  text-align: inherit;
  cursor: pointer;
  color: ${props => props.theme.colors.lightGray};
  font-size: var(--od-type-control-size);
  padding: 13px 0;
  position: relative;

  ${({ active }) => active && css`
    color: ${props => props.theme.colors.headingColor};
    font-weight: 600;
    &:after {
      content: "";
      background: ${props => props.theme.colors.headingColor};
      height: 2px;
      width: 100%;
      position: absolute;
      bottom: -1px;
      ${props => props.theme?.rtl
? css`
        right: 0px;
      `
: css`
        left: 0px;
      `}
    }
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
