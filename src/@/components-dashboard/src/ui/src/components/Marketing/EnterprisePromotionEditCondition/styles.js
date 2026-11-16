import styled from 'styled-components'

export const SingleEditConditionContainer = styled.div`
  padding: 15px 5px;

  h1 {
    font-size: var(--od-type-title-size);
    font-weight: 700;
    margin: 0;
  }

  > button {
    height: 44px;
  }
`
export const InputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  margin: 45px 0;
  label {
    margin-bottom: 10px;
    font-size: var(--od-type-control-size);
  }
`
