import React from 'react'
import styled, { css } from 'styled-components'

export const Container = styled.form`
  padding-bottom: 30px;
  ${({ disabled }) => disabled && css`
    opacity: 0.7;
    pointer-events: none;
  `}

  .message {
    font-size: 14px;
  }
  .red {
    color: ${props => props.theme.colors.danger};
  }
  > button {
    position: sticky;
    top: 100%;
    height: 42px;
    margin: 30px 0 0 0px;
  }
`
export const InputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 35px;

  label {
    margin: 0;
    display: flex;
    font-size: 14px;
  }

  div {
    font-size: 14px;
  }

  .select {
    padding: 11px 0;
    border: none;
    background-color: ${props => props.theme.colors.secundary};
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
`

export const WrapperImage = styled.div`
  max-width: 40px;
  max-height: 40px;
  height: 40px;
  width: 40px;
  ${({ isSkeleton }) => !isSkeleton && css`
    border: 1px solid #E3E3E3;
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
      style={{ backgroundImage: `url(${props.bgimage})` }}
    >
      {props.children}
    </ImageStyled>
  )
}

export const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  margin: 0 0 29px 0;

  p {
    font-size: 14px;
    margin: 0px;
    ${props => props.theme?.rtl
? css`
      padding-right: 10px;
    `
: css`
      padding-left: 10px;
    `}
  }
`

export const ButtonGroup = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  button:first-child {
    ${props => props.theme?.rtl
? css`
      margin-left: 7px;
    `
: css`
      margin-right: 7px;
    `}
  }
`

export const SearchBarWrapper = styled.div`
  margin-bottom: 10px;
`

export const BusinessesContainer = styled.div`
  height: calc(100% - 175px);
  overflow: auto;
`

export const SkeletonWrapper = styled.div`
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
`

export const SkeletonContainer = styled.div`
  display: flex;
  align-items: center;
`

export const BusinessWrapper = styled.div`
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};

  p {
    margin: 0px;
    font-size: 12px;
  }

  ${({ isDisabed }) => isDisabed && css`
    pointer-events: none;
  `}
`

export const PaginationWrapper = styled.div`
  margin: 20px;
`

export const ButtonWrapper = styled.div`
  a {
    display: inline-flex;
    height: 44px;
    background: ${props => props.theme.colors.primary};
    color: white;
    border-radius: 8px;
    font-size: 14px;
  }
`

export const SkeletonWrapperOutside = styled.div`
  margin-top: 52px;

  div {
    margin-bottom: 15px;
  }
`
