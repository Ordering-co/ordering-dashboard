import React from 'react'
import styled, { css } from 'styled-components'

export const Container = styled.form`
  padding-bottom: 30px;
  ${({ disabled }) => disabled && css`
    opacity: 0.7;
    pointer-events: none;
  `}

  > button {
    position: sticky;
    top: 100%;
    min-height: 44px;
    margin: 30px 0 0 0px;
  }
`
export const InputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 35px;

  label {
    font-size: var(--od-type-control-size);
  }

  div {
    font-size: var(--od-type-control-value-size);
  }

  .select {
    padding: 11px 0;
    border: none;
    background-color: ${props => props.theme?.ordering?.semantic?.surface?.subtle ?? props.theme.colors.secundary};
  }
  .list {
    .options {
      > div {
        > div {
          padding: 7px 10px;
        }
      }
    }
  }

  /* redesign DG-B2b (M-DG37): text fields fill the field; a checkbox is an <input> too and must keep its own size, or
     the manager rows push the avatar and the name past the edge of the panel. */
  input:not([type='checkbox']),
  .select {
    min-width: 0;
    width: 100%;
  }
`

export const DriverManagerContainer = styled.div`
  height: calc(100% - 130px);
  overflow: auto;
  max-height: 250px;
`

export const DriverManagerWrapper = styled.div`
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

export const ManagerInfoContainer = styled.div`
  /* redesign DG-B2b (M-DG37): the name column may shrink and wraps a long email instead of widening the row */
  min-width: 0;
  overflow-wrap: anywhere;

  p {
    margin: 0px;
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

export const WrapperImage = styled.div`
  max-width: 40px;
  max-height: 40px;
  height: 40px;
  width: 40px;
  flex-shrink: 0; /* redesign DG-B2b (M-DG37) */
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

export const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  margin: 0 0 29px 0;

  label {
    font-size: var(--od-type-control-size);
    margin: 0px;
    padding-inline-start: 10px;
    min-height: 44px;
    display: flex;
    align-items: center;
  }
`

export const SearchBarWrapper = styled.div`
  margin-bottom: 15px;
  width: 100%;
`

export const ButtonGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 15px;

  button {
    min-height: 44px;
  }
`
