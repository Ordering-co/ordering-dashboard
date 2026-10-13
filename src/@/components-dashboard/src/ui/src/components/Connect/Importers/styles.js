import styled, { css } from 'styled-components'

export const BusinessListingContainer = styled.div`
  flex: 1;
  padding: 20px;
  box-sizing: border-box;
  transition: all 0.5s;
  overflow: hidden;

  ${({ isAdd }) => isAdd && css`
    max-height: 100vh;
    overflow: auto;
  `}

  @media print {
    display: none;
  }
`

export const ViewContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
`
