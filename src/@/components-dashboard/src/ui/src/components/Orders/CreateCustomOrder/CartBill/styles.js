import styled, { css } from 'styled-components'

export const CartBillContainer = styled.div`
  margin-top: 40px;
  > h3 {
    margin-bottom: 15px;
  }

  table {
    width: 100%;
    font-size: var(--od-type-content-size);

    td {
      padding: 5px 0;
    }

    td span {
      unicode-bidi: bidi-override;
    }

    tr td:nth-child(2) {
      text-align: right;
      ${props => props.theme?.rtl && css`
        text-align: left;
      `}
    }

    .icon {
      display: flex;
      align-items: center;
      min-height: 25px;
    }
  }
  table.total {
    border-top: 1px solid ${props => props.theme.colors.borderColor};
    margin-top: 10px;
    tr {
      td {
        font-weight: bold;
        font-size: var(--od-type-section-title-size);

        &#loyalty {
          font-weight: normal;
          font-size: var(--od-type-content-size);
        }
      }
    }
  }
`
export const CouponContainer = styled.div`
  margin-top: 10px;
`
export const IconContainer = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  margin-inline-start: 5px;
  min-height: 20px;

  > button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--od-touch-target-minimum);
    min-height: var(--od-touch-target-minimum);
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  > button:focus-visible {
    outline: 2px solid var(--od-focus-ring-color);
    outline-offset: 2px;
  }
  svg:nth-child(1){
    position: relative;
    top: -1px;
  }
  > button:nth-child(2) svg {
    top: -3px;
  }
`
