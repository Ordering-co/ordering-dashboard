import React from 'react'
import styled, { css } from 'styled-components'

export const BusinessInfo = styled.div`
  display: flex;
  align-items: center;
  padding: 15px 0;
  position: relative;
  min-width: 0;

  > svg {
    position: absolute;
    top: 32px;
    inset-inline-end: 10px;
    transition: all 0.3s;
  }
`

export const PhotoWrapper = styled.div`
  max-width: 48px;
  max-height: 48px;
  height: 48px;
  width: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: ${props => props.theme?.ordering?.shadow?.[1] ?? '0px 1px 4px rgba(0, 0, 0, 0.1)'};
  border-radius: ${props => props.theme?.ordering?.radius?.component ?? '7.6px'};

  svg {
    width: 40px;
    height: 40px;
    border-radius: 50%;
  }
`

const PhotoStyled = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  position: relative;
  background-repeat: no-repeat, repeat;
  background-size: cover;
  object-fit: cover;
  background-position: center;
  border-radius: 10px;
`

export const Photo = (props) => {
  return (
    <PhotoStyled
      {...props}
      style={{ backgroundImage: `url(${props.bgimage})` }}
    >
      {props.children}
    </PhotoStyled>
  )
}

export const InfoContent = styled.div`
  flex: 1;
  min-width: 0;
  > div {
    display: flex;
    align-items: center;
    min-width: 0;

    > p {
      display: flex;
      margin: 0px;
      font-weight: 400;
      min-width: 0;
      overflow-wrap: anywhere;
      color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
    }
  }

  > p {
    color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors?.lightGray};
    font-size: var(--od-type-secondary-size);
    margin: 0px;
  }

  .name-small {
    font-size: var(--od-type-secondary-size);
  }

  margin-inline-start: 15px;
`

export const CustomerInfo = styled(BusinessInfo)``

export const ActionIconWrapper = styled.div`
  display: flex;
  align-items: center;
  height: 100%;
  gap: 4px;
  position: relative;
  z-index: 1;

  > button {
    min-width: 44px;
    min-height: 44px;
  }

  > .down-arrow {
    transition: all 0.3s;
    margin: 0 10px;
  }
  .edit-icon {
    color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.secundaryLight};
    cursor: pointer;
  }

  @media (prefers-reduced-motion: reduce) {
    .down-arrow {
      transition: none;
    }
  }
`

export const ReviewWrapper = styled.div`
  margin-top: 23px;
  label {
    font-size: var(--od-type-control-size);
    font-weight: 500;
    margin-bottom: 12px;
  }
  textarea {
    width: 100%;
  }
`

export const DriverInfoContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`
export const DriverInfo = styled(BusinessInfo)``

export const CompanySelectorContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 23px;
  margin-bottom: 13px;
  > p {
    font-size: var(--od-type-control-size);
    margin-top: 0;
    margin-bottom: 15px;
  }
  > div {
    width: 100%;
    border-radius: 8px;
    background-color: ${props => props.theme?.ordering?.semantic?.surface?.subtle ?? props.theme.colors?.secundary};

    > div {
      &:first-child {
        border: none;
        height: 50px;
      }
      > div:first-child {
        color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
      }
    }
  }
`
export const DriverSelectorContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 23px;
  margin-bottom: 13px;
  > p {
    font-size: var(--od-type-control-size);
    margin-top: 0;
    margin-bottom: 15px;
  }
  > div {
    width: 100%;
    border-radius: 8px;
    background-color: ${props => props.theme?.ordering?.semantic?.surface?.subtle ?? props.theme.colors?.secundary};

    > div {
      > div {
        &:first-child {
          border: none;
          height: 50px;
        }
        > div:first-child {
          color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
        }
      }
    }
  }
`
export const CutsomerDetail = styled.div`
  border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors?.secundary};
  padding-bottom: 15px;
  margin-bottom: 15px;
  width: 100%;
`

export const CustomerInfoTable = styled.table`
  width: 100%;
  table-layout: fixed;

  tr {
    td {
      color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors?.lightGray};
      font-size: var(--od-type-secondary-size);
      margin: 0px;
      padding-block: 4px;
      vertical-align: top;
      overflow-wrap: anywhere;
      word-break: break-word;

      &:first-child {
        width: 34%;
        padding-inline-end: 12px;
        color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
      }

      > a {
        color: ${props => props.theme?.ordering?.actionOverride ?? props.theme?.ordering?.semantic?.action?.content ?? props.theme.colors?.primary};
        transition: all 0.3s linear;
        &:hover {
          color: ${props => props.theme?.ordering?.semantic?.action?.hover ?? props.theme.colors?.headingColor};
        }
        &:focus-visible {
          outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors.primary};
          outline-offset: 2px;
        }
      }
    }
  }

  @media (prefers-reduced-motion: reduce) {
    a {
      transition: none;
    }
  }
`

export const ToggleItemWrapper = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px;
  border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors?.secundary};

  > .disclosure-button {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    width: 100%;
    min-width: 0;
    min-height: 44px;
    padding: 0;
    border: 0;
    border-radius: ${props => props.theme?.ordering?.radius?.component ?? '6px'};
    background: transparent;
    color: inherit;
    text-align: start;
    cursor: pointer;

    .down-arrow {
      margin: 0 10px;
      transition: transform 0.3s;
    }

    &:hover {
      background: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors.secundary};
    }

    &:focus-visible {
      outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors.primary};
      outline-offset: -2px;
    }
  }

  ${({ active }) => active && css`
    border-bottom: none;
    .down-arrow {
      transform: rotateZ(180deg);
    }
  `}

  @media (prefers-reduced-motion: reduce) {
    > .disclosure-button .down-arrow {
      transition: none;
    }
  }
`
export const ReviewButton = styled.button.attrs({ type: 'button' })`
  cursor: pointer;
  min-height: 44px;
  padding: 0 8px;
  border: 0;
  border-radius: ${props => props.theme?.ordering?.radius?.control ?? '4px'};
  background: transparent;
  color: ${props => props.theme?.ordering?.actionOverride ?? props.theme?.ordering?.semantic?.action?.content ?? props.theme.colors.primary};
  font-size: var(--od-type-control-size);
  text-decoration: underline;

  &:hover {
    background: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors.secundary};
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors.primary};
    outline-offset: 2px;
  }
`

export const CustomerEditWrapper = styled.div`
  input {
    width: 100%;
    margin-bottom: 12px;
  }
  .input-autocomplete {
    width: 100%;
    background: ${props => props.theme?.ordering?.semantic?.surface?.default ?? props.theme.colors?.backgroundPage ?? '#FFF'};
    border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
    border-radius: 8px;
    font-size: var(--od-type-control-value-size);
    padding: 10px 15px;
    outline: none;
    ::placeholder {
      color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.secundaryLight};
    }

    &:-ms-input-placeholder {
      color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.secundaryLight};
    }

    &::-ms-input-placeholder { /* Microsoft Edge */
      color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.secundaryLight};
    }
    &:focus {
      border-color: ${props => props.theme?.ordering?.semantic?.action?.focus ?? '#CCC'};
      outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors.primary};
      outline-offset: 2px;
    }
  }
  button {
    margin-top: 10px;
    display: block;
    height: 44px;
    border-radius: 8px;
    margin-inline-start: auto;
  }
`
export const WrapperMap = styled.div`
  width: 100%;
  height: 150px;
  margin-bottom: 10px;

  > div {
    position: relative !important;
    width: 100% !important;
    height: 100% !important;
    border-radius: 8px;
  }

  @media (min-width: 768px) {
    height: 200px;
  }
`
