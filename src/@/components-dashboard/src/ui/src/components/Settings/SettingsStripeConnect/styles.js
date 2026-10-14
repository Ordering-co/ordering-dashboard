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
