import styled, { css } from 'styled-components'

export const Container = styled.div`
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  input[type=number] {
    -moz-appearance: textfield;
  }
`

export const Title = styled.h1`
  font-weight: 700;
  font-size: var(--od-type-title-size);
  line-height: 30px;
  margin-top: 0px;
  margin-bottom: 45px;
`

export const RadioCheckWrapper = styled.div`
  margin-top: 28px;

  > button {
    display: flex;
    align-items: center;
    cursor: pointer;
    width: fit-content;
    background: none;
    border: none;
    padding: 0px;
    color: inherit;
    font-family: inherit;
    text-align: inherit;

    &:focus-visible {
      outline: 2px solid var(--od-action);
      outline-offset: 2px;
    }

    @media (pointer: coarse) {
      min-height: 44px;
    }


    span {
      font-weight: 400;
      font-size: var(--od-type-control-size);
      line-height: 24px;
    }

    svg {
      margin-right: 13px;
      ${props => props.theme.rtl && css`
        margin-right: 0px;
        margin-left: 13px;
      `}
      color: ${props => props.theme.colors.secundaryLight};
      &.fill {
        color:${props => props.theme.colors.primary};
      }
    }
  }
`

export const ButtonWrapper = styled.div`
  position: sticky;
  top: 100%;

  button {
    height: 44px;
  }
`

export const DateRangeWrapper = styled.div`
  margin-top: 15px;
`

export const CalendarWrapper = styled.div`
  margin-top: 15px;
`
