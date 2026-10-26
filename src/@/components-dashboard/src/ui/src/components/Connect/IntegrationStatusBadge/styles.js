import styled, { css } from 'styled-components'

export const FeaturedWrapper = styled.div`
  display: flex;
  align-items: center;

  p {
    border-radius: 10px;
    padding: 5px 10px;
    background-color: ${props => props.theme.colors.lightPrimary};
    font-size: 12px;
    color: ${props => props.theme.colors.lightGray};
    margin-bottom: 0px;

    ${({ tone }) => tone === 'success' && css`
      background-color: ${props => props.theme.colors.lightGreen};
      color: ${props => props.theme.colors.success};
    `}

    ${({ tone }) => tone === 'warning' && css`
      background-color: ${props => props.theme.colors.warning100};
      color: ${props => props.theme.colors.headingColor};
    `}

    ${({ tone }) => tone === 'danger' && css`
      background-color: ${props => props.theme.colors.danger100};
      color: ${props => props.theme.colors.danger};
    `}
  }
`

export const StatusBadgeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`

// Small warning next to a status badge; its title says why.
export const StatusWarningIcon = styled.span`
  display: inline-flex;
  color: ${props => props.theme.colors.orange};
  cursor: help;
`
