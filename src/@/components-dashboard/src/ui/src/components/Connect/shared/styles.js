import React from 'react'
import styled, { css } from 'styled-components'

// Pieces the Connect list, the business panel and the integration detail
// share to show an integration: its logo and its state.

export const WrapperImage = styled.div`
  max-width: 45px;
  max-height: 45px;
  height: 45px;
  width: 45px;
  ${({ isSkeleton }) => !isSkeleton && css`
    border: 1px solid #E3E3E3;
    box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.1);
  `}
  border-radius: 10px;

  ${props => props.theme?.rtl
? css`
    margin-left: 10px;
  `
: css`
    margin-right: 10px;
  `}
`

const PosImageStyled = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  position: relative;
  background-repeat: no-repeat;
  background-size: contain;
  object-fit: contain;
  background-position: center;
  border-radius: 10px;
  background-color: ${props => props.theme.colors.backgroundPage};
`

// A POS logo is often a wordmark: contained, so it is not cropped.
export const PosImage = (props) => {
  return (
    <PosImageStyled
      {...props}
      style={{ backgroundImage: `url(${props.bgimage})` }}
    />
  )
}

export const StatusCell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;

  p.status-detail {
    margin: 0 0 0 2px;
    font-size: 12px;
    color: ${props => props.theme.colors.lightGray};
  }

  p.status-detail.danger {
    color: ${props => props.theme.colors.danger};
  }
`
