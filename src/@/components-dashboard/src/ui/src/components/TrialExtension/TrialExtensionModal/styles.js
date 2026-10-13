import styled from 'styled-components'

export const ModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

export const OfferDescription = styled.p`
  margin: 0;
  font-size: 15px;
  line-height: 1.5;
  color: ${props => props.theme.colors.headingColor};
`

export const SuccessState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 20px 0 10px;

  button {
    margin-top: 10px;
    max-width: 220px;
  }
`

export const SuccessIcon = styled.div`
  color: ${props => props.theme.colors.success};
`

export const SuccessTitle = styled.h3`
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: ${props => props.theme.colors.headingColor};
`

export const SuccessText = styled.p`
  margin: 0;
  font-size: 15px;
  line-height: 1.5;
  color: ${props => props.theme.colors.headingColor};
  max-width: 420px;
`
