import styled from 'styled-components'

export const GroupOrdersContainer = styled.div`
  width: 100%;
  padding: 20px;

  h1 {
    font-size: var(--od-type-title-size);
    font-weight: 700;
    margin-bottom: 15px;
  }
`

export const FieldWrapper = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 35px;
  border: none;
  padding: 0;
  min-width: 0;

  > label,
  > legend {
    font-size: var(--od-type-control-size);
    margin-bottom: 12px;
    padding: 0;
    float: none;
    width: auto;
  }
`

export const UseMapsApiCheckboxContainer = styled.div`
  display: flex;

  > input {
    margin-top: 5px;
  }
`

export const MapsApiDescriptionContainer = styled.div`
  margin-inline-start: 10px;

  label {
    margin: 0px;
    font-size: var(--od-type-control-size);
    display: block;
  }

  p {
    margin: 0px;
    font-size: var(--od-type-secondary-size);
    color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.lightGray};

    a {
      color: ${props => props.theme?.ordering?.semantic?.action?.content ?? props.theme.colors.primary};
      margin: 0 7px;
      white-space: nowrap;
    }
  }
`

export const MaxTimeInputsContainer = styled.div`
  display: flex;
  align-items: center;
  input {
    width: 75px;
  }

  strong {
    margin: 0 20px;
  }
`

export const IconImage = styled.div`
  -webkit-mask: url(${({ url }) => url}) no-repeat center;
  mask: url(${({ url }) => url}) no-repeat center;
  width: 92px;
  height: 24px;
  background-color: ${props => props.theme?.ordering?.semantic?.text?.subtle ?? props.theme.colors.secundaryLight};
`

export const MaxTimeBusinessInputContainer = styled.div`
  display: flex;
  align-items: center;

  > input {
    flex: 1;
    min-width: 0;
    margin-inline-start: 25px;
  }
`

export const FieldRowContainer = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;

  > div:first-child {
    margin-inline-end: 25px;
  }
`
