import styled, { css } from 'styled-components'

export const HubPage = styled.div`
  flex: 1;
  box-sizing: border-box;
  /* 65px matches the fixed app header offset (AdminMainContainer). */
  height: calc(100vh - 65px);
  max-height: calc(100vh - 65px);
  min-height: 0;
  min-width: 0;
  overflow: clip;
  overflow-anchor: none;
  display: flex;
  flex-direction: column;
  padding: 20px 16px 16px;
  background: ${props => props.theme.colors.backgroundPage};
`

export const HubHeader = styled.header`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  flex-shrink: 0;
  flex-wrap: wrap;
`

export const HubTitleBlock = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
`

export const HubTitle = styled.h1`
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
  color: ${props => props.theme.colors.headingColor};
`

export const HubSubtitle = styled.p`
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.secundaryContrast};
`

export const HeaderActions = styled.div`
  display: flex;
  align-items: stretch;
  justify-content: flex-end;
  gap: 8px;
  height: 40px;
  min-width: 0;
  flex: 1;
  max-width: 520px;
`

export const SuggestionsButton = styled.button`
  appearance: none;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  margin: 0;
  padding: 0 12px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  background: ${props => props.theme.colors.backgroundPage};
  color: ${props => props.theme.colors.headingColor};
  font-family: inherit;
  font-size: 14px;
  font-weight: 400;
  line-height: 1;
  white-space: nowrap;
  flex-shrink: 0;

  svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  &:hover {
    background: ${props => props.theme.colors.secundary};
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 1px;
  }

  ${({ active }) => active && css`
    border-color: ${props => props.theme.colors.primary};
    background: ${props => props.theme.colors.lightPrimary};
    color: ${props => props.theme.colors.primary};
  `}

  @media (max-width: 767px) {
    width: 40px;
    padding: 0;

    span {
      display: none;
    }
  }
`

export const SearchField = styled.label`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  min-width: 180px;
  max-width: 360px;
  flex: 1;
  height: 40px;
  padding: 0 12px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  background: ${props => props.theme.colors.backgroundPage};

  svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    color: ${props => props.theme.colors.lightGray};
  }

  input {
    width: 100%;
    min-width: 0;
    height: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    outline: 0;
    background: transparent;
    font-family: inherit;
    font-size: 14px;
    line-height: 1;
    color: ${props => props.theme.colors.headingColor};

    &::placeholder {
      color: ${props => props.theme.colors.lightGray};
    }
  }

  &:focus-within {
    border-color: ${props => props.theme.colors.primary};
  }
`

export const SearchClear = styled.button`
  appearance: none;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: ${props => props.theme.colors.lightGray};
  flex-shrink: 0;

  svg {
    width: 14px;
    height: 14px;
    color: inherit;
  }

  &:hover {
    color: ${props => props.theme.colors.headingColor};
    background: ${props => props.theme.colors.secundary};
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 1px;
  }
`

export const IconButton = styled.button`
  background: transparent;
  border: 0;
  border-radius: 6px;
  height: 32px;
  width: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.theme.colors.headingColor};
  flex-shrink: 0;

  &:hover {
    background: ${props => props.theme.colors.secundary};
  }
`

export const HubBody = styled.div`
  display: flex;
  gap: 16px;
  min-height: 0;
  flex: 1;
`

export const NavColumn = styled.nav`
  width: 232px;
  flex-shrink: 0;
  overflow: auto;
  overflow-anchor: none;
  padding-right: 4px;

  ${({ hiddenOnMobile }) => hiddenOnMobile && css`
    @media (max-width: 767px) {
      display: none;
    }
  `}
`

export const ListColumn = styled.div`
  width: 280px;
  flex-shrink: 0;
  overflow: auto;
  overflow-anchor: none;
  min-height: 0;

  ${({ hiddenOnMobile }) => hiddenOnMobile && css`
    @media (max-width: 767px) {
      display: none;
    }
  `}

  ${({ mobileOnly }) => mobileOnly && css`
    width: 100%;
  `}
`

export const DetailColumn = styled.section`
  flex: 1;
  min-width: 0;
  overflow: auto;
  overflow-anchor: none;
  background: ${props => props.theme.colors.backgroundPage};
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 10px;

  ${({ hiddenOnMobile }) => hiddenOnMobile && css`
    @media (max-width: 767px) {
      display: none;
    }
  `}

  @media (max-width: 767px) {
    border: 0;
    border-radius: 0;
  }
`

export const GroupButton = styled.button`
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 4px;
  color: ${props => props.theme.colors.headingColor};

  &:hover {
    background: ${props => props.theme.colors.lightPrimary};
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 1px;
  }

  ${({ active }) => active && css`
    background: ${props => props.theme.colors.lightPrimary};
    box-shadow: inset 3px 0 0 ${props => props.theme.colors.primary};
  `}
`

export const GroupLabel = styled.span`
  display: block;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
`

export const GroupHint = styled.span`
  display: block;
  margin-top: 2px;
  font-size: 12px;
  line-height: 16px;
  color: ${props => props.theme.colors.secundaryContrast};
`

export const SectionButton = styled.button`
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 2px;
  font-size: 14px;
  line-height: 20px;
  color: ${props => props.theme.colors.headingColor};

  &:hover {
    background: ${props => props.theme.colors.secundary};
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 1px;
  }

  ${({ active }) => active && css`
    background: ${props => props.theme.colors.lightPrimary};
    color: ${props => props.theme.colors.primary};
    font-weight: 600;
  `}
`

export const ListHeading = styled.h2`
  margin: 0 0 8px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${props => props.theme.colors.lightGray};
`

export const DetailHeader = styled.div`
  padding: 20px 20px 12px;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
`

export const DetailTitleRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`

export const DetailTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 24px;
  color: ${props => props.theme.colors.headingColor};
`

export const DetailDescription = styled.p`
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.secundaryContrast};
`

export const DetailBody = styled.div`
  padding: 8px 20px 24px;
`

export const StatusPanel = styled.div`
  padding: 32px 20px;
  text-align: center;
  color: ${props => props.theme.colors.secundaryContrast};
  font-size: 14px;
  line-height: 20px;
`

export const BackRow = styled.div`
  display: none;
  margin-bottom: 8px;

  @media (max-width: 767px) {
    display: block;
  }
`

export const BackButton = styled.button`
  border: 0;
  background: transparent;
  color: ${props => props.theme.colors.primary};
  font-size: 14px;
  font-weight: 500;
  padding: 4px 0;

  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 2px;
  }
`
