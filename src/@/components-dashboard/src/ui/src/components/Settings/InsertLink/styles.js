import styled from 'styled-components'

export const InsertLinkContainer = styled.div`
  h1 {
    font-size: var(--od-type-title-size);
    font-weight: 700;
    margin-bottom: 25px;
  }

  > button {
    height: 42px;
  }
`

export const WrapperInput = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 10px;

  label {
    font-size: var(--od-type-control-size);
  }
`

export const CheckboxWrapper = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 25px;

  > span {
    margin: 0 10px;
    font-size: var(--od-type-control-size);
  }  
`
