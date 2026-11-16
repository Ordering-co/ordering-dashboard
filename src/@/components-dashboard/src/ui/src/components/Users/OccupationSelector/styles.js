import styled from 'styled-components'

export const SelectWrapper = styled.div`
  width: 100%;
  margin-bottom: 20px;

  .select-wrapper {
    .select {
      border: 1px solid ${props => props.theme.colors.borderColor};
      padding: 6px 0;
      font-size: var(--od-type-control-value-size);

      .header {
        font-size: var(--od-type-control-value-size);
        padding: 4px 0;
      }
    }

    .list .option {
      font-size: var(--od-type-control-size);
      padding: 10px;
    }

    .custom-option {
      border-top: 1px solid ${props => props.theme.colors.borderColor};
      color: ${props => props.theme.colors.primary};
    }
  }
`
export const Option = styled.div`
  font-size: var(--od-type-control-value-size);
  padding: 4px 0;
`
