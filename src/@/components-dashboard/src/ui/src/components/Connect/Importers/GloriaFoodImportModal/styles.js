import styled from 'styled-components'

export const GLORIAFOOD_HELP_VIDEO_URL = 'https://www.youtube.com/embed/67nwsD7PWBY'

export const HelpVideoFrame = styled.iframe`
  width: 100%;
  height: 315px;
  border: 0;
  border-radius: 8px;
  background: ${props => props.theme.colors.secundary || '#F8F9FA'};
`

export const StepHeading = styled.h3`
  position: relative;
  margin: 0;
  padding: 0 32px;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  color: ${props => props.theme.colors.headingColor};
`

export const BackButton = styled.button`
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  border: 0;
  background: transparent;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  color: ${props => props.theme.colors.headingColor};
  padding: 0;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`
