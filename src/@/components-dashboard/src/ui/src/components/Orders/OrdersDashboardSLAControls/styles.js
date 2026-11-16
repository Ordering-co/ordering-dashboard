import styled, { css } from 'styled-components'

export const OrdersDashboardSLAControlsContainer = styled.div`
  display: flex;

  button {
    height: 42px;
    margin-inline-end: 14px;

    svg {
      margin-inline-start: 5px;
    }
  }

  @media (min-width: 992px) {
    margin: 0px;
  }
`

export const OrderTimeStatusSelectWrapper = styled.div`
  .timeStatusSelect {
    width: fit-content;
    height: 43px;
    line-height: 43px;
    border: none;
    background: ${props => props.theme?.ordering?.semantic?.surface?.subtle ?? '#F8F9FA'};
    margin: 0 10px;
    >div:first-child {
      height: 100%;
    }
  }

  .list-wrapper {
    min-width: 168px;
  }

  .search-bar-container {
    padding: 7px 11px;
    width: 100%;
    input {
      border-radius: ${props => props.theme?.ordering?.radius?.control ?? '7.6px'};
      width: 100%;
    }
  }

  .search-bar-container {
    svg {
      top: 13px;
    }
    input {
      height: 40px;
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
    line-height: 26px;
    color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.secundaryContrast};
  }

  ${({ noPadding }) => noPadding && css`
    padding: 0px;
  `}
`
export const Timestatus = styled.div`
  width: 4px;
  height: 22px;
  border-radius: ${props => props.theme?.ordering?.radius?.round ?? '20px'};
  margin-inline-end: 5px;
  ${({ timeState }) => timeState === 'in_time' && css`
    background-color: ${props => props.theme?.ordering?.semantic?.state?.success?.signal ?? '#00D27A'};
  `}
  ${({ timeState }) => timeState === 'at_risk' && css`
    background-color: ${props => props.theme?.ordering?.semantic?.state?.warning?.signal ?? '#FFC700'};
  `}
  ${({ timeState }) => timeState === 'delayed' && css`
    background-color: ${props => props.theme?.ordering?.semantic?.state?.danger?.signal ?? '#E63757'};
  `}
`
