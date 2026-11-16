import styled, { css } from 'styled-components'

export const Container = styled.div`
  height: 365px;

  > button {
    position: sticky;
    top: 100%;
    min-height: 44px;
    margin-top: 20px;
  }
`

export const DateContainer = styled.div`
  display: flex;
  align-items: center;
  padding: 5px 0;

  input {
    border-radius: ${props => props.theme?.ordering?.radius?.control ?? '20px'};
    width: auto;
    min-width: 220px;
    outline: none;
    padding: 3px 10px;
    border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? '#F2F2F2'};

    &:focus-visible {
      outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary};
      outline-offset: 2px;
    }
  }

  ${props => props.theme?.rtl
  ? css`
    span {
      margin-left: 10px;
    }
  `
  : css`
    span {
      margin-right: 10px;
    }
  `}

  @media (min-width: 768px) {
    padding: 0;
  }
`
