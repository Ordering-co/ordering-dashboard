import styled, { css } from 'styled-components'

export const PopMenuContatiner = styled.div`
  position: absolute;
  left:0px;
  background: ${props => props.theme.colors?.backgroundPage || '#FFF'};
  width: 325px;
  border: 1px solid #E9ECEF;
  box-sizing: border-box;
  box-shadow: 0px 4px 10px rgb(0 0 0 / 12%);
  border-radius: 7.6px;
  padding: 8px;
  z-index: calc(var(--od-x-layer-chrome) - 1);
`
export const SelectHeaderContent = styled.div`
  position: relative;
  width: 100%;
  height: 100%;

  > button {
    margin-top: 10px;
    width: 100%;
  }
`
export const BusinessSearch = styled.div`
  display: flex;
  margin-bottom: 5px;
  padding: 5px;

  > div {
   width: 100%;

   > input {
    background: ${props => props.theme.colors.secundary};
   }
  }
`
export const OptionItem = styled.div`
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 5px;
  border-radius: 7.6px;
  /* redesign W1-7 (T1-7-4, W1-QC1-03): the business option is a real button (as='button'); same box and look as the div it was */
  &[type='button'] {
    box-sizing: border-box;
    width: 100%;
    border: 0;
    background-color: transparent;
    color: inherit;
    text-align: start;
  }
  &:hover {
    background-color: ${props => props.theme.colors.lightPrimary};
  }
  &:focus-visible {
    outline-style: solid;
    outline-width: var(--od-focus-ring-width);
    outline-color: var(--od-focus-ring-color);
    outline-offset: calc(var(--od-focus-ring-width) * -1);
  }
  img {
    min-height: 38px;
    min-width: 38px;
    height: 38px;
    width: 38px;
    border-radius: 8px;
    object-fit: cover;
    box-shadow: rgba(99, 99, 99, 0.2) 0px 2px 8px 0px;
    margin-right: 8px;
    ${props => props.theme?.rtl && css`
      margin-right: 0px;
      margin-left: 8px;
    `}
  }
  > div {
    display: flex;
    flex-direction: column;
    max-width: 230px;
    b {
      font-size: var(--od-type-content-size);
      line-height: 20px;
      font-weight: 400;
      color: ${props => props.theme.colors.textBlack};
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
    }
    p {
      margin: 0;
      font-size: var(--od-type-secondary-size);
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
      color: ${props => props.theme.colors.textGray};
    }
  }
  span {
    display: flex;
  }
`
export const BusinessList = styled.div`
`
export const WrapperPagination = styled.div`
  margin-top: 10px;
  display: flex;
  justify-content: center;

  >div>div{
    margin: 0;
    button {
      font-size: var(--od-type-control-size);
    }
  }
`
