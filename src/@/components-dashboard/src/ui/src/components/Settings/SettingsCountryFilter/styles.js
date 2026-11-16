import styled, { css } from 'styled-components'

export const CountrySelectWrapper = styled.div`
  width: 100%;
  box-sizing: border-box;
  z-index: var(--od-x-layer-sticky);
  position: relative;
  margin-bottom: 20px;

  > label {
    margin-top: 0;
    font-weight: 600;
    margin-bottom: 10px;
    font-size: var(--od-type-control-size);
    color: ${props => props.theme?.colors.headingColor};
  }

  > p {
    margin-top: 0;
    margin-bottom: 5px;
    font-size: var(--od-type-content-size);
    color: ${props => props.theme?.colors.headingColor};
  }
`
export const CountrySearchWrapper = styled.div`
  position: relative;
`

export const SearchIconWrapper = styled.div`
  position: absolute;
  top: 0;
  display: flex;
  align-items: center;
  height: 100%;

  ${props => props.theme?.rtl
? css`
    left: 10px;
  `
: css`
    right: 10px;
  `}

  svg {
    font-size: 16px;
    color: #B1BCCC;
  }
`

export const CountrySearchInput = styled.input`
  border: 1px solid #DEE2E6;
  box-sizing: border-box;
  border-radius: 7.6px;
  font-size: var(--od-type-control-value-size);
  padding: 11px 30px 11px 14px;
  width: 100%;
  outline: none;

  ${props => props.theme?.rtl && css`
    padding: 11px 14px 11px 30px;
  `}
`

export const CountryListContainer = styled.div`
  margin-top: 7px;
  max-height: 250px;
  overflow: auto;
  position: absolute;
  min-width: 100%;
  background-color: ${props => props.theme?.colors.primaryContrast};
  z-index: calc(var(--od-x-layer-notice) - 10);
  border-width: 1px;
  border-style: solid;
  border-color: ${props => props.theme?.colors.borderColor};
  border-radius: 7.6px;
  box-shadow: 0px 4px 10px rgb(0 0 0 / 12%);
`

export const CountryListItem = styled.div`
  padding: 10px 7px;
  border-bottom: 1px solid ${props => props.theme?.colors.borderColor};
  font-size: var(--od-type-control-value-size);
  color: ${props => props.theme?.colors.headingColor};
  cursor: pointer;
  transition: all 0.3s;
  &:hover {
    background: ${props => props.theme?.colors.borderColor};
  }

  ${({ active }) => active && css`
    background: ${props => props.theme?.colors.borderColor};
  `}
`
