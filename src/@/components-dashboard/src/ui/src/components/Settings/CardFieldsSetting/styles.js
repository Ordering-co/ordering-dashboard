import styled, { css } from 'styled-components'

// (batch AC): inside the hub the section body already pads the sides and closes the section, so the list has no
// padding or margin of its own, spaces with the spacing tokens, titles with the section role of Product and draws the
// chevron with the Product icon (Lucide, at its token size). Nothing here moves a control or a handler.
export const SitesListContainer = styled.div`
  padding: 0;
  box-sizing: border-box;
  width: 100%;
  min-inline-size: 0;
  overflow-x: hidden;
`

export const Header = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--od-space-3);

  h1 {
    flex: 1 1 0;
    min-inline-size: 0;
    margin: 0;
    font-size: var(--od-type-section-title-size);
    font-weight: var(--od-font-weight-semibold);
    line-height: var(--od-x-leading-title);
    overflow-wrap: anywhere;
  }
`

export const SitesWrapper = styled.div`
  margin-block-start: var(--od-space-4);
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
    A div in a column fills its container and a button shrinks to its content.
    Losing that is the exact regression the deferred wave warns about, so the
    width is pinned explicitly rather than inherited by luck.
  */
  width: 100%;
  cursor: pointer;
  padding: var(--od-space-3) var(--od-space-4);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--od-space-2);
  color: var(--od-x-text-subtle);
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};

  &:hover {
    background-color: ${props => props.theme.colors.lightPrimary};
  }
  span {
    font-size: var(--od-type-content-size);
  }
  svg {
    flex: none;
  }
  /* with touch or on a phone the row is reached with a 44 px area */
  @media (pointer: coarse), (max-width: 767px) {
    min-block-size: var(--od-x-target-coarse);
  }
  ${({ active }) => active && css`
    color: ${props => props.theme.colors.headingColor};
    border-top: 1px solid ${props => props.theme.colors.primary};
    border-bottom: 1px solid ${props => props.theme.colors.primary} !important;
    background-color: ${props => props.theme.colors.lightPrimary};
  `}
`

export const CardFieldsDetailsContainer = styled.div`
  padding: 26px 40px;
  box-sizing: border-box;
  width: 100%;
  overflow-x: hidden;

  h1 {
    font-weight: var(--od-font-weight-semibold);
    font-size: var(--od-type-section-title-size);
    margin-bottom: 10px;
  }
`

export const FieldContainer = styled.div`
  display: flex;
  align-items: center;
  padding: 10px 0;
  ${({ isHeader }) => isHeader && css`
    border-bottom: 1px solid ${props => props.theme.colors.borderColor};
    margin-bottom: 15px;
    > div {
      font-weight: 700;
      font-size: var(--od-type-control-size);
    }
  `}

  .name {
    flex: 1;
    font-size: var(--od-type-control-size);
  }

  .required {
    width: 80px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .status {
    width: 80px;
    display: flex;
    justify-content: center;
    align-items: center;
  }
`
