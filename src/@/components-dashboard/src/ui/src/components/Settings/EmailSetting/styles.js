import styled, { css } from 'styled-components'

export const EmailSettingsContainer = styled.div``

export const AccordionTitle = styled.div`
  color: ${props => props.theme?.colors.headingColor};
  font-size: var(--od-type-section-title-size);
  font-weight: 600;
  cursor: pointer;
  border-bottom: 1px solid ${props => props.theme?.colors.borderColor};
  padding: 10px 5px;
`

export const GeneralWrapper = styled.div`
  padding-top: 15px;
`

export const ToggleItemWrapper = styled.div`
  background: transparent;

  ${({ active }) => active && css`
    background: ${props => props.theme?.colors.borderColor};
  `}
`

export const SelectWrapper = styled.div`
  margin-top: 25px;
  margin-bottom: 20px;
  label {
    font-weight: 400;
    font-size: var(--od-type-control-size);
    line-height: 24px;
    margin-bottom: 10px;
  }
  > div {
    width: 100%;
    border: none;

    > div:first-child {
      background-color: ${props => props.theme.colors.secundary};
      height: 43px;
      border: none;
      border-radius: 7.6px;
      font-weight: 400;
      font-size: var(--od-type-control-value-size);
      line-height: 24px;
      color: var(--od-x-text-subtle);
    }
    .list {
      background-color: ${props => props.theme.colors.secundary};
      border: none;

      .list-wrapper {
        > div {
          padding: 6px 10px;
          &:hover {
            background-color: #f2f5f7;
          }
        }
      }
    }
  }
`

export const Option = styled.div`
  font-weight: 400;
  font-size: var(--od-type-control-value-size);
  line-height: 24px;
  color: var(--od-x-text-subtle);
  text-transform: lowercase;
  &::first-letter {
    text-transform: uppercase;
  }
`
