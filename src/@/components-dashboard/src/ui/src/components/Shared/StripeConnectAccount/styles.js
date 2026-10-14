import styled, { css } from 'styled-components'

export const AccountCard = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 12px;
  background: ${props => props.theme.colors.backgroundPage};
`

export const AccountHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

export const AccountTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  color: ${props => props.theme.colors.headingColor};
`

export const AccountHelp = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.secundaryContrast};
`

export const AccountBadges = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`

export const AccountBadge = styled.span`
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  color: ${props => props.theme.colors.secundaryDark};
  background: ${props => props.theme.colors.secundaryDarkContrast};

  ${({ $tone }) => $tone === 'ready' && css`
    color: ${props => props.theme.colors.deadlineOk};
    background: ${props => props.theme.colors.lightGreen};
  `}

  ${({ $tone }) => $tone === 'pending' && css`
    color: #8A5A00;
    background: #FFF4D6;
  `}
`

export const AccountId = styled.p`
  margin: 0;
  font-family: monospace;
  font-size: 13px;
  line-height: 18px;
  word-break: break-all;
  color: ${props => props.theme.colors.headingColor};
`

export const AccountChecks = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const AccountCheck = styled.li`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.secundaryContrast};

  svg {
    flex-shrink: 0;
    color: ${({ $ok, theme }) => $ok ? theme.colors.deadlineOk : theme.colors.lightGray};
  }
`

export const AccountNotice = styled.p`
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.headingColor};
  background: ${props => props.theme.colors.backgroundInfo};

  a {
    font-weight: 600;
  }
`

export const AccountError = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.danger};
`

export const AccountActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  button {
    height: 42px;
    border-radius: 8px;
    font-size: 14px;
  }
`
