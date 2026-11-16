import styled, { css } from 'styled-components'

import { glyphButtonReset, overlayGlyphButton } from '../../../styles/glyphButton'

export const Content = styled.div`
  width: 100%;
`

export const CategoryName = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-right: 25px;
  ${props => props.theme.rtl && css`
    margin-right: 0;
    margin-left: 25px;
  `}

  p {
    font-weight: bold;
    font-size: var(--od-type-section-title-size);
    margin-bottom: 0px;
    width: auto
  }
`

export const Description = styled.p`
  font-size: var(--od-type-content-size);
  margin-bottom: 0px;
  text-align: justify;

  @media (min-width: 768px) {
    text-align: initial;
  }
`

export const VideoContainer = styled.div`
  position: relative;
  margin-top: 25px;
  height: 300px;
  background: #E9ECEF;
  border-radius: 7.6px;
  width: 100%;
  height: 100%;
  overflow: hidden;
  video {
    object-fit: cover;
    height: 100%;
    background: #E9ECEF;
  }

  ${glyphButtonReset}
  ${overlayGlyphButton({ top: '45%', left: '45%', glyphSize: '34px' })}

  svg {
    color: #748194;
    font-size: 34px;
  }
`

export const ButtonsWrapper = styled.div`
  display: flex;
  margin-top: 25px;

  > button {
    width: 100%;
  }
`
