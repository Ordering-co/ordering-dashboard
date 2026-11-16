import styled, { css } from 'styled-components'

export const OrderStatusTypeSelectWrapper = styled.div`
  .list-wrapper {
    min-width: 297px;
  }

  .orderStatus {
    width: 100%;

    > div:first-child {
      p {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        max-width: 200px;
      }
    }
  }

  .search-bar-container {
    padding: 10px 11px;
    width: 100%;
    input {
      border-radius: ${props => props.theme?.ordering?.radius?.control ?? '7.6px'};
      width: 100%;
    }
  }
`

export const Option = styled.div`
  display: flex;
  align-items: center;
  padding: 5px 10px;
  column-gap: 5px;

  p {
    margin: 0px;
    white-space: nowrap;
    font-size: var(--od-type-control-value-size);
  }

  ${({ isSubTitle }) => !isSubTitle
? css`
    border-inline-start: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
    margin-inline-start: 5px;

    p {
      padding: 0 10px;
      color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.secundaryContrast} !important;
    }
  `
: css`
    p {
      color: ${props => props.theme?.ordering?.semantic?.text?.subtle ?? props.theme.colors.secundaryLight};
    }
  `}

  ${({ noPadding }) => noPadding && css`
    padding: 0px;
  `}
`

export const PlaceholderTitle = styled(Option)`
  padding: 10px;
`
