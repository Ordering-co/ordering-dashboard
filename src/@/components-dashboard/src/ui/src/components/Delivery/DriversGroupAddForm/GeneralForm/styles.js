import styled from 'styled-components'

export const Container = styled.div``
// the Product name field keeps the gap of the legacy rows without their label, div and input rules, which would
// override the field's own type and size
export const FieldSpacer = styled.div`
  margin-bottom: 35px;
`
export const InputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 35px;

  label {
    font-size: var(--od-type-control-size);
  }

  div {
    font-size: var(--od-type-control-value-size);
  }

  .select {
    padding: 11px 0;
    border: none;
    background-color: ${props => props.theme?.ordering?.semantic?.surface?.subtle ?? props.theme.colors.secundary};
  }
  .list {
    .options {
      > div {
        > div {
          padding: 7px 10px;
        }
      }
    }
  }

  input,
  .select {
    min-width: 0;
    width: 100%;
  }

  .odc-notice {
    margin-inline: 0;
  }
`
