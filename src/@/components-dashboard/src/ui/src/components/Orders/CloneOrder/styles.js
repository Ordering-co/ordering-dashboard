import styled, { css } from 'styled-components'

export const Container = styled.div`
  box-sizing: border-box;
`
export const Title = styled.p`
  font-size: 20px;
  font-weight: 600;
  color: ${props => props.theme.colors?.headingColor};
`
export const Options = styled.div`
  display: flex;
  flex-direction: column;
`

export const CloneOption = styled.div`
  display: flex;
  flex-direction: row;
  cursor: pointer;
  svg {
    margin-right: 20px;
    position: relative;
    top: 4px;
  }
  ${({ active }) => active && css`
    svg {
      color: ${props => props.theme.colors.primary};
    }
  `}
`

export const CloneButtonContainer = styled.div`
  button {
    width: 100%;
    border-radius: 8px;
  }
`
