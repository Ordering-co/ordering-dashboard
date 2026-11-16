import styled, { css } from 'styled-components'

export const OrderDashboardControlsContainer = styled.div`
  display: flex;
  margin-top: 10px;

  > div {
    > button {
      flex: 0 0 auto;
      min-height: 44px;
      height: auto;
      max-width: 100%;
      white-space: normal;
      overflow-wrap: anywhere;
      ${props => props.theme?.rtl
? css`
        margin-left: 14px;
      `
: css`
        margin-right: 14px;
      `}
  
      svg {
        ${props => props.theme?.rtl
? css`
          margin-right: 5px;
        `
: css`
          margin-left: 5px;
        `}
      }
    }
  }

  @media (min-width: 992px) {
    margin: 0px;
  }

  /* redesign tramo A r3 (W0-QA1-02): on a phone the controls wrap to a second row; Export is a 32px button with a 44px
     area (6px above and below it), so the rows are 8px apart and the list does not start under that area. */
  @media (max-width: 767px) {
    margin-bottom: 8px;
  }
`

export const InnerContnet = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  min-width: 0;
  width: 100%;

  @media (max-width: 767px) {
    row-gap: 8px;
  }
`

export const WrapOrderStatusTypeSelector = styled.div`
  margin: 0 7px;
  > div {
    > div:first-child {
      border-color: ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors?.secundary};
      border-radius: ${props => props.theme?.ordering?.radius?.component ?? '8px'};
      background-color: ${props => props.theme?.ordering?.semantic?.surface?.subtle ?? props.theme.colors?.secundary};
      > div:first-child {
        padding-top: 4px;
        padding-bottom: 4px;
        > div:first-child {
          > div {
            border: none !important;
            p {
              color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.secundaryContrast} !important;
              padding: 0 !important;
            }
          }
        }
      }
    }

    .list-wrapper {
      > div {
        padding: 0 10px;
      }
    }
  }
`
