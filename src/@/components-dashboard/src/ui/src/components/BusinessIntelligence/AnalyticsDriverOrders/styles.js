import styled, { css } from 'styled-components'

import { glyphButtonReset } from '../../../styles/glyphButton'

export const Container = styled.div`
  box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.1);
  border-radius: 7.6px;
  padding: 20px;
`

export const ChartContentWrapper = styled.div``

export const ChartHeaderContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 30px;

  p {
    margin: 0;
    font-size: var(--od-type-section-title-size);
    color: ${props => props.theme?.colors.headingColor};
    text-transform: uppercase;
  }
`

export const ActionBlock = styled.div`
  display: flex;
  align-items: center;

  ${glyphButtonReset}

  svg {
    font-size: 16px;
    color: #212121;
    cursor: pointer;

    &.download-view {
      margin-left: 15px;
      ${props => props.theme?.rtl && css`
        margin-right: 15px;
        margin-left: 0;
      `}
    }
  }

  ${({ disabled }) => disabled && css`
    svg {
      color: ${props => props.theme?.colors.disabled};
      cursor: not-allowed;
      pointer-events: none;
    }
  `}
`

export const ChartFooterContainer = styled.div`
  margin-top: 25px;

  h2 {
    font-weight: 500;
    font-size: var(--od-type-title-size);
    color: ${props => props.theme.colors.headingColor};
    margin: 0;
  }

  p {
    font-size: var(--od-type-content-size);
    color: ${props => props.theme.colors.lightGray};
    margin: 0;
  }
`

export const EmptyContent = styled.div`
  padding: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
`
