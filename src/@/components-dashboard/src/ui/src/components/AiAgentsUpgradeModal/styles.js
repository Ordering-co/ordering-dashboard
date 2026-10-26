import styled from 'styled-components'

export const ModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

export const Description = styled.p`
  margin: 0;
  font-size: 15px;
  line-height: 1.5;
  color: ${props => props.theme.colors.headingColor};
`

export const IframeContainer = styled.div`
  overflow: hidden;
  border-radius: 8px;
  background-color: #fff;
`

export const StyledIframe = styled.iframe`
  display: block;
  width: 100%;
  height: 640px;
  max-height: 65vh;
  border: 0;
`

export const StatusText = styled.p`
  margin: 0;
  font-size: 14px;
  text-align: center;
  color: ${props => props.theme.colors.headingColor};
  opacity: 0.7;
`

export const SecondaryLink = styled.a`
  align-self: center;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 8px;
  font-size: 13px;
  color: ${props => props.theme.colors.headingColor};
  opacity: 0.7;
  text-decoration: underline;

  &:hover,
  &:focus-visible {
    opacity: 1;
  }
`
