import React from 'react'
import styled, { css } from 'styled-components'

export const Container = styled.div``

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
  max-height: 610px;
  overflow: auto;
`

export const BusinessWrapper = styled.div`
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};

  label {
    margin: 0px;
    font-size: var(--od-type-content-size);
    min-height: 44px;
    display: flex;
    align-items: center;
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

export const SkeletonWrapper = styled.div`
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
`

export const SkeletonContainer = styled.div`
  display: flex;
  align-items: center;
`
