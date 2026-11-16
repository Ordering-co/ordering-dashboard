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

export const GroupsContainer = styled.div`
  overflow: auto;
  max-height: 460px;
`

export const GroupWrapper = styled.div`
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};

  label {
    margin: 0px;
    font-size: var(--od-type-content-size);
    padding-inline-start: 15px;
    min-height: 44px;
    display: flex;
    align-items: center;
  }

  ${({ isDisabed }) => isDisabed && css`
    pointer-events: none;
  `}
`
