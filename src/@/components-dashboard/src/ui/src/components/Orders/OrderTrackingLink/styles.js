import styled from 'styled-components'

export const TrackingModalContent = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0 30px 30px;

  p {
    margin: 0 0 12px;
    font-size: var(--od-type-content-size);
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
  }

  input {
    width: 100%;
    box-sizing: border-box;
    margin-top: 12px;
  }
`

export const SelectWrapper = styled.div`
  position: relative;

  .select {
    width: 100%;
  }

  .list {
    position: static;
    width: 100%;
  }
`

export const TrackingOption = styled.div`
  display: flex;
  flex-direction: column;
  font-size: var(--od-type-control-value-size);

  small {
    font-size: var(--od-type-secondary-size);
    color: ${props => props.theme.colors.lightGray};
  }
`

export const ErrorText = styled.span`
  color: ${props => props.theme?.ordering?.semantic?.state?.danger?.functional ?? '#E63757'};
  font-size: var(--od-type-secondary-size);
  margin-top: 8px;
`

export const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;

  button {
    min-width: 120px;
  }
`
