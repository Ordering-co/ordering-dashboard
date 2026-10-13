import styled, { css } from 'styled-components'

export const LoyaltyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin: 8px 0 16px;
`

export const LoyaltyCard = styled.section`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 12px;
  background: ${props => props.theme.colors.backgroundPage};
`

export const LoyaltyCardHeader = styled.div`
  padding-bottom: 12px;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
`

export const LoyaltyCardTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  color: ${props => props.theme.colors.headingColor};
`

export const LoyaltyCardHelp = styled.p`
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.secundaryContrast};
`

export const LoyaltyTabs = styled.div`
  display: flex;
  gap: 20px;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
`

export const LoyaltyTab = styled.button`
  appearance: none;
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  padding: 10px 0;
  font-size: 14px;
  line-height: 20px;
  color: ${props => props.theme.colors.lightGray};
  cursor: pointer;

  ${({ active }) => active && css`
    color: ${props => props.theme.colors.headingColor};
    font-weight: 600;
    border-bottom-color: ${props => props.theme.colors.headingColor};
  `}
`

export const LoyaltyBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

export const LoyaltyBlockHelp = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.secundaryContrast};
`

export const EmbeddedWalletForm = styled.div`
  form {
    min-height: 0;
  }
`

export const EmbeddedLevels = styled.div`
  > div {
    padding: 0;
    width: 100%;
  }

  > div > h1 {
    display: none;
  }
`
