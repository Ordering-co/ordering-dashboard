import styled, { css } from 'styled-components'

export const Container = styled.div`
  height: 100%;
  overflow-x: hidden;

  > h1 {
    font-size: var(--od-type-title-size);
    font-weight: 700;
    margin: 0px;
  }

  ${({ maxLimit }) => maxLimit && css`
    max-width: 500px;
  `}

  @media (min-width: 1000px) {
    padding: 20px;
  }
`
export const TabsConatiner = styled.div`
  width: 100%;
  margin: 20px 0;
  border-bottom: 1px solid #E9ECEF;
`
export const Tab = styled.div`
  appearance: none;
  background: none;
  border: 0;
  font-family: inherit;
  text-align: inherit;
  user-select: none;
  padding: 10px 0px;
  cursor: pointer;
  color: ${props => props.theme.colors?.headingColor};
  font-size: var(--od-type-control-size);
  white-space: nowrap;
  ${props => props.theme?.rtl
? css`
    margin-left: 30px;
  `
: css`
    margin-right: 30px;
  `}

  ${({ active }) => active && css`
    border-bottom: 2px solid;
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
