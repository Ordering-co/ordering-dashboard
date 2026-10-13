import styled, { css } from 'styled-components'

export const PromotionWorkspace = styled.main`
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: hidden;
  background: ${props => props.theme.colors?.backgroundPage || '#FFFFFF'};
  color: ${props => props.theme.colors?.headingColor || '#0B0C0D'};
`

export const WorkspaceHeader = styled.header`
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 8px;
  padding: 20px 20px 0;

  h1 {
    margin: 0;
    color: ${props => props.theme.colors?.headingColor || '#0B0C0D'};
    font-size: 20px;
    font-weight: 600;
    line-height: 1.3;
  }
`

export const WorkspaceTabs = styled.div`
  display: flex;
  min-width: 0;
  gap: 20px;
  padding: 8px 20px 0;
  border-bottom: 1px solid ${props => props.theme.colors?.borderColor || '#DEE0E3'};
  overflow-x: auto;
`

export const WorkspaceTab = styled.button`
  position: relative;
  min-height: 44px;
  padding: 8px 0 10px;
  border: 0;
  background: transparent;
  color: ${props => props.$active ? (props.theme.colors?.primary || '#266DF0') : (props.theme.colors?.headingColor || '#3F4145')};
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: ${props => props.$active ? 600 : 500};
  white-space: nowrap;
  transition: color 180ms ease;

  &::after {
    position: absolute;
    right: 0;
    bottom: -1px;
    left: 0;
    height: 2px;
    background: ${props => props.$active ? (props.theme.colors?.primary || '#266DF0') : 'transparent'};
    content: '';
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors?.primary || '#266DF0'};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

export const PromotionsListingContainer = styled.div`
  flex: 1;
  padding: 20px;
  box-sizing: border-box;
  transition: all 0.5s;
  overflow: hidden;
`
export const HeaderContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  flex-direction: column;

  input {
    background: ${props => props.theme.colors.secundary};
    border: none;
  }

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
`

export const HeaderTitleContainer = styled.div`
  flex: 1;
  display: flex;
  align-items: center;

  > h1 {
    font-size: 20px;
    margin: 0px;
    font-weight: 600;
    color: ${props => props.theme.colors.headingColor};
    white-space: nowrap;
    text-transform: capitalize;
  }

  > button {
    ${props => props.theme?.rtl
? css`
      margin-left: 8px;
      margin-right: -8px;
    `
: css`
      margin-right: 8px;
      margin-left: -8px;
    `}

    svg {
      width: 25px;
      height: 25px;
    }
  }
`
export const ActionsWrapper = styled.div`
  display: flex;
  align-items: center;
  > button {
    height: 41px;
    width: 90px;
    white-space: nowrap;
    ${props => props.theme?.rtl
? css`
      margin-left: 15px;
    `
: css`
      margin-right: 15px;
    `}
    @media (min-width: 768px) {
      width: unset;
    }
  }

  ${({ eventDisabled }) => eventDisabled && css`
    cursor: not-allowed;
    opacity: 0.4;
    > * {
      pointer-events: none;
    }
  `}
`
