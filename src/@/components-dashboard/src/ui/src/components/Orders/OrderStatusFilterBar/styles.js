import styled, { css } from 'styled-components'

import { getOrderingAction } from '~/brand/adapter'

export const OrderStatusFilterContainer = styled.div`
  border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
`

export const Tab = styled.button.attrs({ type: 'button' })`
  padding: 10px 0;
  border: 0;
  background: transparent;
  margin-inline-end: 30px;
  cursor: pointer;
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
  white-space: nowrap;
  font-size: var(--od-type-control-size);

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? getOrderingAction(props.theme)};
    outline-offset: 2px;
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }

  ${({ active }) => active && css`
    color: ${props => props.theme?.ordering?.actionOverride ?? props.theme?.ordering?.semantic?.action?.content ?? props.theme.colors?.primary};
    border-bottom: 3px solid ${props => getOrderingAction(props.theme) ?? props.theme.colors?.primary};
    font-weight: 500;
  `}

  ${({ active }) => !active && css`
    color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.lightGray};
  `}

  @keyframes spinner-content {
    0% { transform: rotate(0) }
    100% { transform: rotate(360deg) }
  }

  svg {
    animation: spinner-content 1.85s linear infinite;
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
  }
`
