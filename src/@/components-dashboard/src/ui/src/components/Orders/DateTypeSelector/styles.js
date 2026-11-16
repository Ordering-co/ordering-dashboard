import styled, { css } from 'styled-components'

export const Option = styled.div`
  display: flex;
  align-items: center;
  padding: 5px 10px;

  svg {
    margin-inline-end: 5px;
  }

  ${({ isDateOption }) => isDateOption && css`
    max-width: calc(100vw - 60px);
    overflow: auto;
    > div:first-child {
      margin-inline-end: 10px;
    }
  `}
`

export const PlaceholderTitle = styled(Option)`
  padding: 10px;
`

export const DateContainer = styled.div`
  display: flex;
  align-items: center;
  padding: 5px 0;

  input {
    border-radius: ${props => props.theme?.ordering?.radius?.control ?? '20px'};
    width: 140px;
    outline: none;
    padding: 3px 10px;
    border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? '#F2F2F2'};

    &:focus-visible {
      outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors?.primary};
      outline-offset: 2px;
    }
  }

  span {
    margin-inline-end: 10px;
  }

  @media (min-width: 768px) {
    padding: 0;
  }
`
