import styled, { css } from 'styled-components'
import { brandFocusOutline } from '../../../styles/touchTarget'

export const ImageContainer = styled.div`
  margin-bottom: 20px;
  p {
    font-weight: 600;
    margin: 0 0 10px 0;
    font-size: var(--od-type-control-size);
  }
`

export const ConfigImage = styled.div`
  width: 200px;
  height: 200px;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  cursor: -webkit-grab;
  cursor: grab;
  filter: drop-shadow(0px 1px 4px rgba(0, 0, 0, 0.1));

  ${({ isEdit }) => !isEdit && css`
    pointer-event: none;
  `}

  img,
  div {
    width: 100%;
    border-radius: 8px;
    height: 100%;
    overflow: hidden;
  };

  img{
    object-fit: contain;
  }

  ${brandFocusOutline}
`
export const UploadImageIconContainer = styled.div`
  position: absolute;
  top: 0px;
  background: rgba(0,0,0,0.2);
  ${({ small }) => small
? css`
    padding: 4px;
  `
: css`
    padding: 8px;
  `}
`
export const UploadImageIcon = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  /* : white on the grey scrim was under AA; the label sits on the surface in the text color (both color modes) */
  color: var(--od-text);
  background: var(--od-surface);
  border: 1px dashed var(--od-border-strong);
  span {
    margin: 0;
    text-align: center;
    font-size: var(--od-type-control-size);
  }

  svg {   
    ${({ small }) => small
? css`
      width: 25px;
      height: 25px;
    `
: css`
      width: 45px;
      height: 45px;
    `}
  }
`

export const ImageActions = styled.div`
  margin-top: 10px;

  button {
    height: 36px;
    font-size: var(--od-type-control-size);
  }
`
