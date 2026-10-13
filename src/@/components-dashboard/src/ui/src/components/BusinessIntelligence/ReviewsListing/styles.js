import styled, { css } from 'styled-components'

export const ReviewsListingContainer = styled.div`
  flex: 1;
  padding: 20px;
  box-sizing: border-box;
  transition: all 0.5s;
  max-height: 100vh;
  overflow: auto;
`

export const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  row-gap: 20px;
`

export const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  h1 {
    font-size: 20px;
    font-weight: 700;
    color: ${props => props.theme.colors.headingColor};
    margin: 0px;
    text-transform: capitalize;
  }
  > button {
    ${props => props.theme?.rtl
? css`
      margin-left: 8px;
      margin-right: -8px;
    `
: css`
      margin-right: 8px;
      margin-left: -8px;
    `}

    svg {
      width: 25px;
      height: 25px;
    }
  }
`

export const HeaderRight = styled.div`
  display: flex;
  align-items: center;

  input {
    border: none;
    background-color: ${props => props.theme.colors.secundary};
  }
`

export const Tabs = styled.div`
  margin-top: 25px;
  display: flex;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
`

export const Tab = styled.div`
  padding: 10px 0;
  ${props => props.theme?.rtl
? css`
    margin-left: 30px;
  `
: css`
    margin-right: 30px;
  `}
  cursor: pointer;
  color: ${props => props.theme.colors?.headingColor};
  white-space: nowrap;
  font-size: 14px;

  ${({ active }) => active && css`
    border-bottom: 3px solid;
    font-weight: 500;
  `}

  ${({ active }) => !active && css`
    color: ${props => props.theme.colors.lightGray};
  `}
`

export const SelectWrapper = styled.div`
  position: relative;
`

export const TitleWrapper = styled.div`
  display: flex;
  align-items: center;
  cursor: pointer;

  svg {
    margin: 0 5px;
    font-size: 16px;
    transition: 0.2s ease-in-out;
    &.rotate {
      transform: rotate(180deg);
    }
  }
`

export const DownloadBar = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;

  button {
    svg {
      margin: ${props => props.theme?.rtl ? '0 6px 0 0' : '0 0 0 6px'};
    }
  }
`

export const DownloadForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
`

export const FormField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;

  > label {
    font-size: 13px;
    font-weight: 600;
    color: ${props => props.theme.colors.headingColor};
  }
`

export const DownloadActions = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;

  button {
    svg {
      margin: ${props => props.theme?.rtl ? '0 0 0 6px' : '0 6px 0 0'};
    }
  }
`

export const FilterButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  background-color: ${props => props.theme.colors.secundary};
  color: ${props => props.theme.colors.headingColor};
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 14px;
  white-space: nowrap;

  b {
    font-weight: 600;
  }

  svg {
    font-size: 12px;
    transition: 0.2s ease-in-out;
    &.rotate {
      transform: rotate(180deg);
    }
  }
`

export const DriverSelectWrapper = styled.div`
  min-width: 220px;

  .select {
    width: 100%;
    display: block;
  }

  .list {
    position: static;
    margin-top: 10px;
    box-shadow: none;
  }

  .list-wrapper {
    max-height: 260px;
    overflow-y: auto;
  }
`

export const ModalBusinessSelect = styled.div`
  position: relative;

  > div {
    position: static;
    width: 100%;
    box-shadow: none;
    margin-top: 10px;
    max-height: 280px;
    overflow-y: auto;
  }
`

export const CalendarWrapper = styled.div`
  position: relative;

  > button {
    background: transparent;
    color: ${props => props.theme.colors.primary};
    border: 1px solid ${props => props.theme.colors.primary};
    border-radius: 8px;

    svg {
      color: ${props => props.theme.colors.primary};
      margin: ${props => props.theme?.rtl ? '0 0 0 10px' : '0 10px 0 0'};
    }
  }

  .ordering-calendar {
    position: static;
    margin-top: 10px;
    box-shadow: none;
    width: fit-content;
    max-width: 100%;

    .rdrCalendarWrapper,
    .rdrDateRangeWrapper {
      max-width: 100%;
    }
  }
`

export const ClearFilter = styled.span`
  cursor: pointer;
  color: ${props => props.theme.colors.primary};
  font-size: 13px;
  margin: ${props => props.theme?.rtl ? '0 8px 0 0' : '0 0 0 8px'};
`

export const ErrorText = styled.p`
  color: ${props => props.theme.colors.danger || '#D81212'};
  font-size: 13px;
  margin: 10px 0 0 0;
`
