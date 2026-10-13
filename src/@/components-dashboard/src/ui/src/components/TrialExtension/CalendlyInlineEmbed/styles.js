import styled from 'styled-components'

export const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const IframeContainer = styled.div`
  overflow: hidden;
  border-radius: 8px;
  background-color: #fff;
  ${({ $height }) => $height ? `height: ${$height}px;` : ''}
`

export const StyledIframe = styled.iframe`
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  /**
   * Calendly reports its own content height once loaded (calendly.page_height); until then,
   * a min-height avoids a 0px flash. Once sized ($sized), it must drop to 0 or the iframe
   * overflows its own reported height and gets clipped by the container's overflow: hidden.
   */
  min-height: ${({ $sized }) => $sized ? '0' : '700px'};

  @media (max-width: 700px) {
    min-height: ${({ $sized }) => $sized ? '0' : '1050px'};
  }
`

export const StatusText = styled.p`
  margin: 0;
  font-size: 14px;
  text-align: center;
  color: ${props => props.theme.colors.headingColor};
  opacity: 0.7;
`

export const FailedNotice = styled.div`
  text-align: center;
  padding: 20px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;

  p {
    margin: 0 0 16px;
    color: ${props => props.theme.colors.headingColor};
  }
`

export const ProminentLink = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 24px;
  border-radius: 8px;
  background-color: ${props => props.theme.colors.primary};
  color: ${props => props.theme.colors.primaryContrast || '#fff'};
  font-weight: 600;
  text-decoration: none;

  &:hover,
  &:focus-visible {
    opacity: 0.9;
  }
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

export const BookedElsewhere = styled.div`
  display: flex;
  justify-content: center;
`

export const BookedElsewhereButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 24px;
  border: 1px solid ${props => props.theme.colors.primary};
  border-radius: 8px;
  background-color: transparent;
  color: ${props => props.theme.colors.primary};
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background-color: ${props => props.theme.colors.lightPrimary || 'transparent'};
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 2px;
  }
`
