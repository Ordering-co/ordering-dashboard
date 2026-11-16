import styled from 'styled-components'
import React from 'react'

export const WrapperMap = styled.div`
  width: 100%;
  height: 100%;
  background-color: ${props => props.theme?.ordering?.semantic?.surface?.subtle ?? '#EEE'};
  position: relative;
  /* redesign deliveries F2-B2 (decision 1, DV-01): a column. The map frame grows; the drivers strip is the second child, in the flow. */
  display: flex;
  flex-direction: column;
  min-height: 0;

  /* redesign W1-2 (T1-3): the page region already has the panel radius and clips; the frame adds neither a second border nor a second radius. */
  & > .odc-map-frame {
    border: 0;
    border-radius: 0;
  }

  /* redesign deliveries F2-B2 (decision 1): the frame takes what the strip leaves (its own floor, the compact map height, still applies). */
  & > .odc-map-frame[data-size] {
    flex: 1 1 0;
    block-size: auto;
  }
`
export const WrapperOnlineDrivers = styled.div`
  position: absolute;
  bottom: 10px;
  inset-inline-start: 10px;
  background: ${props => props.theme?.ordering?.semantic?.surface?.default ?? props.theme.colors?.backgroundPage ?? '#FFF'};
  border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors?.borderColor};
  border-radius: ${props => props.theme?.ordering?.radius?.panel ?? '10px'};
  box-shadow: ${props => props.theme?.ordering?.shadow?.[2] ?? '0px 3px 6px #00000029'};
  max-width: calc(100% - 20px);
  padding: 10px 20px;
  box-sizing: border-box;
  overflow-y: hidden;
  & > p {
    font-weight: 600;
    font-size: var(--od-type-section-title-size);
    color: ${props => props.theme?.ordering?.actionOverride ?? props.theme?.ordering?.semantic?.action?.content ?? props.theme.colors.primary};
    margin: 0 0 5px 0;
  }
`
export const OnlineDrivers = styled.div`
  display: flex;
`
export const WrapDriverInfo = styled.div`
  display: flex;
  column-gap: 10px;
  align-items: center;
  margin-inline: 10px;
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
  min-width: 0;
`
export const WrapperDriverImage = styled.div`
  width: 50px;
  height: 50px;
  background: ${props => props.theme?.ordering?.semantic?.surface?.default ?? props.theme.colors?.backgroundPage ?? '#FFF'};
  box-shadow: ${props => props.theme?.ordering?.shadow?.[1] ?? '0px 3px 6px #00000029'};
  border-radius: ${props => props.theme?.ordering?.radius?.component ?? '6px'};
  flex: 0 0 50px;

  svg {
    width: 100%;
    height: 100%;
    border-radius: 100%;
    padding: 3px;
    box-sizing: border-box;
    border: none;
    background: none;
  }
`
const DriverImgStyled = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  position: relative;
  background-repeat: no-repeat, repeat;
  background-size: cover;
  object-fit: cover;
  background-position: center;
  border-radius: ${props => props.theme?.ordering?.radius?.component ?? '5px'};
`
export const DriverImage = (props) => {
  return (
    <DriverImgStyled
      {...props}
      style={{ backgroundImage: `url(${props.bgimage})` }}
    >
      {props.children}
    </DriverImgStyled>
  )
}

export const DriverInfo = styled.div`
  min-width: 0;
  p {
    margin: 0px;
    &:first-child {
      font-size: var(--od-type-content-size);
      font-weight: 600;
      overflow-wrap: anywhere;
    }

    &:last-child {
      font-size: var(--od-type-secondary-size);
    }
  }
`
