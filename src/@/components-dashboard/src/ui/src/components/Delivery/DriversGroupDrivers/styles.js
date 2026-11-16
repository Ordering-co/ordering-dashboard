import React from 'react'
import styled, { css } from 'styled-components'

export const Container = styled.div`
  height: calc(100% - 160px);
  margin-bottom: 35px;

  > button {
    position: sticky;
    top: 100%;
    min-height: 44px;
    margin-top: 20px;
  }
`

export const SearchBarWrapper = styled.div`
  margin-bottom: 10px;
`

export const ButtonGroup = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 20px;

  button {
    min-height: 44px;
  }
`

export const BusinessesContainer = styled.div`
  height: calc(100% - 130px);
  overflow: auto;
  max-height: 610px;
`

export const BusinessWrapper = styled.div`
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};

  p {
    margin: 0px;
    font-size: var(--od-type-content-size);
  }

  ${({ isDisabed }) => isDisabed && css`
    pointer-events: none;
  `}
`

export const WrapperImage = styled.div`
  max-width: 40px;
  max-height: 40px;
  height: 40px;
  width: 40px;
  ${({ isSkeleton }) => !isSkeleton && css`
    border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? '#E3E3E3'};
  `}
  border-radius: 8px;

  svg {
    width: 100%;
    height: 100%;
    padding: 7px;
    box-sizing: border-box;
    border-radius: 50%;
  }

  margin: 0 10px;
`

const ImageStyled = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  position: relative;
  background-repeat: no-repeat, repeat;
  background-size: cover;
  object-fit: cover;
  background-position: center;
  border-radius: 8px;
`

export const Image = (props) => {
  return (
    <ImageStyled
      {...props}
      style={props.bgimage ? { backgroundImage: `url(${props.bgimage})` } : undefined}
    >
      {props.children}
    </ImageStyled>
  )
}

export const DriverInfoContainer = styled.div`
  padding-inline-end: 15px;
  width: 200px;
  p {
    margin: 0px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    &:first-child {
      font-weight: 500;
      font-size: var(--od-type-control-size);
    }

    &:last-child {
      font-size: var(--od-type-secondary-size);
      color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.lightGray};
    }
  }
`
export const DriverTemporaryContainer = styled.div`
  padding-inline-start: 5px;

  button {
    margin: 0px;
    padding: 0px;
    font-weight: 500;
    font-size: var(--od-type-control-size);
    font-family: inherit;
    background: none;
    border: none;
    color: inherit;
    text-align: start;
    min-height: 44px;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
      color: ${props => props.theme?.ordering?.semantic?.action?.content ?? props.theme.colors.primary};
    }

    &:focus-visible {
      outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary};
      outline-offset: 2px;
    }
  }
`
