import styled from 'styled-components'

export const RegressionContainer = styled.form`
  display: flex;
  flex-direction: column;

  h2 {
    font-size: 20px;
    font-weight: 700;
    text-align: center;
    margin: 0 0 30px 0;
  }

  p {
    margin: 4px 0;
    font-size: 14px;
  }

  button {
    height: 44px;
  }
`

export const StatusTransition = styled.p`
  font-weight: 600;

  span {
    color: ${props => props.theme.colors.primary};
  }
`

export const ReasonContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin: 30px 0;

  label {
    font-size: 14px;
    margin-bottom: 7px;
  }
`

export const ActionsContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;

  button {
    min-width: 120px;
  }
`
