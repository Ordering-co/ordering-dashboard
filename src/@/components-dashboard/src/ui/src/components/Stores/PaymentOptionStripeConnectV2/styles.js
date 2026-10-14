import styled, { css } from 'styled-components'

export const TabContent = styled.div`
  margin-top: 10px;
`

export const PayoutsStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const PayoutsHelp = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.secundaryContrast};
`

export const PayoutsEmpty = styled.p`
  margin: 0;
  padding: 20px;
  border: 1px dashed ${props => props.theme.colors.borderColor};
  border-radius: 12px;
  font-size: 13px;
  line-height: 18px;
  text-align: center;
  color: ${props => props.theme.colors.secundaryContrast};
`

export const PayoutError = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.danger};
`

export const PayoutCard = styled.article`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 12px;
  background: ${props => props.theme.colors.backgroundPage};
`

export const PayoutHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
`

export const PayoutOrder = styled.p`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;

  a {
    color: ${props => props.theme.colors.headingColor};
    text-decoration: underline;
  }
`

export const PayoutDate = styled.p`
  margin: 0;
  font-size: 12px;
  line-height: 16px;
  color: ${props => props.theme.colors.secundaryContrast};
`

export const PayoutBadge = styled.span`
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  color: #8A5A00;
  background: #FFF4D6;

  ${({ $status }) => $status === 'paid' && css`
    color: ${props => props.theme.colors.deadlineOk};
    background: ${props => props.theme.colors.lightGreen};
  `}

  ${({ $status }) => $status === 'needs_review' && css`
    color: ${props => props.theme.colors.danger};
    background: #FDECEF;
  `}
`

export const PayoutLines = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

export const PayoutLine = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  line-height: 20px;
  color: ${props => props.theme.colors.secundaryContrast};

  ${({ $strong }) => $strong && css`
    font-weight: 600;
    color: ${props => props.theme.colors.headingColor};
  `}
`

export const PayoutAmount = styled.span`
  white-space: nowrap;
`

export const PayoutReason = styled.p`
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.headingColor};
  background: ${props => props.theme.colors.backgroundInfo};
`

export const PayoutsPagination = styled.div`
  display: flex;
  justify-content: flex-end;
`
