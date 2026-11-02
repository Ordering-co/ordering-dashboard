import styled, { css } from 'styled-components'

export const StripeConnectStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

export const StripeConnectTabs = styled.div`
  display: flex;
  gap: 20px;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
  overflow-x: auto;
`

export const StripeConnectTab = styled.button`
  appearance: none;
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  padding: 10px 0;
  font-size: 14px;
  line-height: 20px;
  white-space: nowrap;
  color: ${props => props.theme.colors.lightGray};
  cursor: pointer;

  ${({ active }) => active && css`
    color: ${props => props.theme.colors.headingColor};
    font-weight: 600;
    border-bottom-color: ${props => props.theme.colors.headingColor};
  `}
`

export const StripeConnectPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
`

export const RuleFootnote = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.secundaryContrast};
`

export const RedirectUriCard = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 12px;
  min-width: 0;
`

export const RedirectUriTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  color: ${props => props.theme.colors.headingColor};
`

export const RedirectUriText = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.secundaryContrast};
`

export const RedirectUriRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`

export const RedirectUriValue = styled.code`
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 18px;
  overflow-wrap: anywhere;
  user-select: all;
  color: ${props => props.theme.colors.headingColor};
  background: ${props => props.theme.colors.backgroundInfo};
`

export const RedirectUriNotes = styled.ul`
  margin: 0;
  padding-inline-start: 18px;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.secundaryContrast};
`
