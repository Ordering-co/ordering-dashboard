import styled, { css } from 'styled-components'

export const Container = styled.div`
  width: 100%;
  margin-top: 20px;
  button{
    width: 100%;
    min-height: var(--od-touch-target-minimum);
    ${({ isLoading }) => isLoading && css`
      pointer-events: none;
    `}
  }

  /* The gift card action is mounted by the provider widget instead of the
     shared Button, so it carries the governed surface in both color modes. */
  #gift-card-button {
    background: var(--od-button-secondary-bg);
    color: var(--od-button-secondary-text);
    border: 1px solid var(--od-button-secondary-border);
    border-radius: 8px;
    cursor: pointer;
  }

  #gift-card-button:focus-visible {
    outline: 2px solid var(--od-focus-ring-color);
    outline-offset: 2px;
  }
`
export const Spinner = styled.div`
  position: absolute;
  top: 0;
  left: 50%;
  right: 50%;
  transform: translateY(75%);
`

export const PaymentSquareContainer = styled.div`
  min-height: 150px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
`
