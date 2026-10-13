import styled, { css } from 'styled-components'

export const SitesListContainer = styled.div`
  padding: 0 20px;
  box-sizing: border-box;
  width: 100%;
  overflow-x: hidden;
`

export const Header = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;

  h1 {
    font-weight: 700;
    font-size: 20px;
    margin: 0;
  }

  margin-right: 35px;
  ${props => props.theme.rtl && css`
    margin-left: 35px;
    margin-right: 0;
  `}
`

export const SitesWrapper = styled.div`
  margin-top: 35px;
  border-radius: 8px;
  overflow: visible;
  > div:first-child {
    border-top: none !important;
  }

  > div:last-child {
    border-bottom: none !important;
  }
`
export const SiteItem = styled.div`
  cursor: pointer;
  padding: 12px 15px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: ${props => props.theme.colors.lightGray};
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};

  &:hover {
    background-color: ${props => props.theme.colors.lightPrimary};
  }
  span {
    font-size: 14px;
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
`
export const SelectContent = styled.div`
  padding-block: 20px;
  overflow: visible;

  p {
    font-size: 14px;
    color: #748194;
  }

  .select-wrapper {
    overflow: visible !important;
  }

  .select {
    border: none;
    width: 100%;
    line-height: 26px;
    padding: 0;

    > div:first-child {
      padding: 8px 15px;
      border-radius: 7.6px;
      border: 1px solid ${props => props.theme.colors.borderColor};
      font-size: 14px;
    }
  }

  .list {
    max-height: min(320px, calc(100vh - 220px));
    overflow-y: auto;
  }
`
export const Option = styled.div`
  display: flex;
  align-items: center;
  column-gap: 10px;
  font-size: 13px;
  line-height: 2;
  font-weight: 500;
`
