import React from 'react'
import styled, { css } from 'styled-components'

export const DriversGroupsContainer = styled.div`
  padding: 20px;
`

export const TableWrapper = styled.div`
  overflow: auto;
`

export const GroupsTable = styled.table`
  width: calc(100% - 10px);
  min-width: 900px;
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};

  td, th {
    padding: 13px 0;
    font-size: var(--od-type-secondary-size);
  }

  thead {
    tr {
      border-bottom: solid 1px ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors?.disabled};
    }
  }

  tbody {
    border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors?.borderColor};
    ${({ disabled }) => !disabled && css`
      cursor: pointer;
      &:hover {
        background-color: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors?.lightPrimary};
      }
      &.active {
        background-color: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors?.lightPrimary};
        td {
          border-top: 1px solid ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors?.primary};
          border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors?.primary};
        }
      }
    `}
  }
`

export const BorderWrapper = styled.div`
  font-size: var(--od-type-secondary-size);
  ${({ isHeader }) => isHeader
? css`
    font-weight: 700;
  `
: css`
    height: 40px;
    display: flex;
    align-items: center;
    ${props => props.theme?.rtl
? css`
      margin-left: 20px;
      padding-left: 10px;
      border-left: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors?.borderColor};
    `
: css`
      margin-right: 20px;
      padding-right: 10px;
      border-right: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors?.borderColor};
    `}  
  `}
`

export const GroupNameContainer = styled(BorderWrapper)`
  display: flex;
  align-items: center;

  > p {
    font-size: var(--od-type-secondary-size);
    margin: 0px;
  }
`

export const CheckBoxWrapper = styled.button`
  appearance: none;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  cursor: pointer;
  svg {
    font-size: 24px;
    color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? '#B1BCCC'};
  }

  ${({ isChecked }) => isChecked && css`
    svg {
      color: ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors?.primary};
    }
  `}

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors?.primary};
    outline-offset: 2px;
  }
`

export const DriverManagerContainer = styled(BorderWrapper)`
  display: flex;
  align-items: center;
  font-size: var(--od-type-secondary-size);
  font-weight: 700;

  > div:first-child {
    ${props => props.theme?.rtl
? css`
      margin-left: 10px;
    `
: css`
      margin-right: 10px;
    `}
  }
`

export const WrapperImage = styled.div`
  max-width: 45px;
  max-height: 45px;
  height: 45px;
  width: 45px;
  ${({ isSkeleton }) => !isSkeleton && css`
    border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? '#E3E3E3'};
  `}
  border-radius: 10px;

  svg {
    width: 100%;
    height: 100%;
    padding: 7px;
    box-sizing: border-box;
    border-radius: 50%;
  }

  ${props => props.theme?.rtl
? css`
    margin-left: 10px;
  `
: css`
    margin-right: 10px;
  `}
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

export const InfoBlock = styled.div`
  p {
    margin: 5px 0 0 0;
    font-size: var(--od-type-secondary-size);
    color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors?.lightGray};
  }
  p.bold {
    margin: 0px;
    font-size: var(--od-type-control-size);
    font-weight: 600;
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
  }
`

export const DriverGroupTypeContainer = styled(BorderWrapper)`
  ${({ isHeader }) => isHeader && css`
    font-weight: 700;
  `}
`

export const ActionsContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  padding-bottom: 8px;
`

export const EnableWrapper = styled.div`
  display: flex;
  align-items: center;
  width: fit-content;

  span {
    font-size: var(--od-type-secondary-size);
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};

    ${props => props.theme?.rtl
? css`
      padding-left: 10px;
    `
: css`
      padding-right: 10px;
    `}
  }
`

export const PagesBottomContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  row-gap: 10px;
  margin: 15px 0 38px 0;
`

export const GroupIdWrapper = styled.div`
  display: flex;
  align-items: center;

  > span {
    margin: 0 20px;
  }
`
