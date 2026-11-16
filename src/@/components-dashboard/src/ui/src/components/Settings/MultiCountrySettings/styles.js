import styled, { css } from 'styled-components'

export const SitesListContainer = styled.div`
  padding: 0px 20px;
  box-sizing: border-box;
  width: 100%;
  overflow-x: hidden;

  h1 {
    font-weight: 700;
    font-size: var(--od-type-title-size);
    margin: 0;
  }
`
export const SitesWrapper = styled.div`
  margin-top: 35px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  overflow: hidden;
  > div:first-child {
    border-top: none !important;
  }

  > div:last-child {
    border-bottom: none !important;
  }
`
export const SiteItem = styled.button.attrs({ type: 'button' })`
  background: none;
  border: none;
  text-align: inherit;
  font-family: inherit;
  font-size: inherit;
  /*
    A div in a column fills its container and a button shrinks to its content,
    so the width is pinned rather than inherited by luck.
  */
  width: 100%;
  cursor: pointer;
  padding: 12px 15px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--od-x-text-subtle);
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};

  &:hover {
    background-color: ${props => props.theme.colors.lightPrimary};
  }
  span {
    font-size: var(--od-type-content-size);
  }
  svg {
    font-size: 20px;
  }
  ${({ active }) => active && css`
    color: ${props => props.theme.colors.headingColor};
    border-top: 1px solid ${props => props.theme.colors.primary};
    border-bottom: 1px solid ${props => props.theme.colors.primary} !important;
    background-color: ${props => props.theme.colors.lightPrimary};
  `}
  ${({ disabled }) => disabled && css`
    cursor: not-allowed;
    background-color: ${props => props.theme.colors.disabled} !important;
  `}
`

// n.1 (D-56 a): inside the hub, the country form and its save bar in one column of the panel's full width
export const HubFormColumn = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
`
