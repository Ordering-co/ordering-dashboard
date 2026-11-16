import React from 'react'
import styled, { css } from 'styled-components'
import { markerStatusColor } from '../mapMarkerShared'

export const WrapperMapMarker = styled.button`
  width: 50px;
  height: 50px;
  background: ${props => props.theme?.ordering?.semantic?.surface?.default ?? props.theme.colors?.backgroundPage ?? '#FFF'};
  ${markerStatusColor}
  border: 3px solid var(--od-marker-status);
  border-radius: 100%;
  position: absolute;
  transform: translate(-50%, -100%);
  padding: 0;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors?.primary};
    outline-offset: 2px;
  }

  svg {
    width: 100%;
    height: 100%;
    border-radius: 100%;
    padding: 3px;
    box-sizing: border-box;
    background: ${props => props.theme?.ordering?.semantic?.surface?.default ?? props.theme.colors?.backgroundPage ?? '#FFF'};
    z-index: 1;
  }

  &:after {
    content:'';
    position: absolute;
    top: 77%;
    left: 50%;
    margin-left: -22px;
    width: 0;
    height: 0;
    border-top: solid 22px var(--od-marker-status);
    border-left: solid 22px transparent;
    border-right: solid 22px transparent;
    z-index: -1;
  }
`
const MapMarkerImgStyled = styled.div`
  background: ${props => props.theme?.ordering?.semantic?.surface?.default ?? props.theme.colors?.backgroundPage ?? '#FFF'};
  display: flex;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  position: relative;
  background-repeat: no-repeat, repeat;
  background-size: cover;
  object-fit: cover;
  background-position: center;
  border-radius: 100%;
  z-index: var(--od-x-layer-sticky);
`
export const MapMarkerImg = (props) => {
  return (
    <MapMarkerImgStyled
      {...props}
      style={{ backgroundImage: `url(${props.bgimage})` }}
    >
      {props.children}
    </MapMarkerImgStyled>
  )
}

export const InfoContainer = styled.div`
  background: ${props => props.theme?.ordering?.semantic?.surface?.default ?? props.theme.colors?.backgroundPage ?? '#FFF'};
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
  position: absolute;
  border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors?.borderColor};
  border-radius: ${props => props.theme?.ordering?.radius?.component ?? '5px'};
  padding: 10px;
  z-index: calc(var(--od-x-layer-sticky) + 100);
  box-shadow: ${props => props.theme?.ordering?.shadow?.[2] ?? '0px 2px 2px #00000029'};
  display: flex;
  flex-direction: column;
  row-gap: 5px;
  inline-size: max-content;
  max-inline-size: min(320px, calc(100vw - 32px));
`
export const TextContainer = styled.div`
  display: flex;
  column-gap: 10px;
  flex-wrap: wrap;
  min-inline-size: 0;
`
export const Text = styled.span`
  ${({ fontWeight }) => fontWeight && css`
    font-weight: 600;
  `}
  font-size: var(--od-type-content-size);
  overflow-wrap: anywhere;
`
