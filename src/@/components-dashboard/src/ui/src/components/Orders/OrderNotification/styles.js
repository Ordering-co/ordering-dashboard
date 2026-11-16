import styled, { css } from 'styled-components'

import { getOrderingAction } from '~/brand/adapter'

export const ModalContainer = styled.div`
  padding: 10px;
  background: ${props => props.theme?.ordering?.semantic?.surface?.default ?? props.theme.colors?.backgroundPage ?? '#FFF'};
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: fadeIn 200ms;

  h1 {
    font-size: var(--od-type-section-title-size);
    font-weight: 700;
    margin: 0px;
  }

  p {
    text-align: center;
    font-size: var(--od-type-content-size);
    margin-top: 0px;
    margin-bottom: 22px;

    span {
      color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
      font-weight: 600;
    }
  }
  img {
    width: 250px;
    height: 250px;
    object-fit: contain;
    margin: 40px 0;
  }

  @keyframes fadeIn {
    from {
      transform: scale(2);
    }
  
    to {
      transform: scale(1);
    }
  }

  @media (min-width: 768px) {
    img {
      width: 290px;
      height: 290px;
    }
  }
`
export const ToastWrapper = styled.div`
  display: flex;
  align-items: center;
  img {
    height: 39px;
    max-width: 72px;
    object-fit: contain;
  }

  > div {
    display: flex;
    flex-direction: column;
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? '#344050'};
    margin-inline-start: 15px;
    span {
      &:first-child {
        font-size: var(--od-type-content-size);
        line-height: 21px;
        font-weight: 500;
        margin-bottom: 2px;
      }
      &:last-child {
        font-size: var(--od-type-secondary-size);
        line-height: 18px;
      }
    }
  }
`

export const AlarmContent = styled.div`
  button {
    height: 44px;
    width: 100%;
    border-radius: ${props => props.theme?.ordering?.radius?.control ?? '8px'};
    margin-top: 20px;
  }
  > span {
    font-weight: 500;
  }
`

export const CheckBoxWrapper = styled.button.attrs({ type: 'button' })`
  display: flex;
  align-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  margin-top: 10px;

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? getOrderingAction(props.theme)};
    outline-offset: 2px;
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }

  span {
    font-size: var(--od-type-control-size);
  }
  svg {
    margin-inline-end: 10px;
    font-size: 16px;
    color: ${props => props.theme?.ordering?.semantic?.text?.subtle ?? props.theme.colors.secundaryLight};
  }

  ${({ isChecked }) => isChecked && css`
    svg {
      color: ${props => getOrderingAction(props.theme) ?? props.theme.colors?.primary};
    }
  `}
`
