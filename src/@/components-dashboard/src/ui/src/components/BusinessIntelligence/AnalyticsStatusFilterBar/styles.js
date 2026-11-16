import styled, { css } from 'styled-components'
import { brandFocusRing } from '../../../styles/touchTarget'

export const OrderStatusFilterContainer = styled.div`
  width: 100%;
  border-bottom: 1px solid #CCC;
`

export const Tab = styled.button.attrs({ type: 'button' })`
  background: none;
  border: none;
  text-align: inherit;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  padding: 10px 0px;
  cursor: pointer;
  color: ${props => props.theme.colors?.headingColor};
  white-space: nowrap;
  ${props => props.theme?.rtl
? css`
    margin-left: 30px;
  `
: css`
    margin-right: 30px;
  `}

  ${({ active }) => active && css`
    border-bottom: 3px solid;
    font-weight: 500;
  `}

  ${({ active }) => !active && css`
    color: #909BA9;
  `}

  ${brandFocusRing}
`
