import styled, { css } from 'styled-components'

export const Container = styled.div`
  display: flex;
  align-items: center;
  padding: 10px 0px;
  cursor: pointer;
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  border: 0;
  background: transparent;
  font: inherit;
  color: inherit;
  text-align: start;

  span {
    display: flex;
    font-size: var(--od-type-content-size);
    color: ${props => props.theme.colors.darkGray};
  }

  span:nth-child(1) {
    margin-right: 10px;
    ${props => props.theme?.rtl && css`
      margin-left: 10px;
      margin-right: 0px;
    `}
    svg {
      color: ${props => props.isSoldOut ? props.theme.colors.lightGray : props.theme.colors.primary};
      font-size: 24px;
      &[disabled] {
        color: ${props => props.theme.colors.lightGray};
      }
    }
  }
`
