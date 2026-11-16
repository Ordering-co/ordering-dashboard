import styled, { css } from 'styled-components'

export const Container = styled.div`
  box-sizing: border-box;
`
export const Title = styled.p`
  font-size: var(--od-type-section-title-size);
  font-weight: 600;
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
`
export const Options = styled.div`
  display: flex;
  flex-direction: column;
`

export const CloneOption = styled.button`
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
  text-align: start;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors.primary};
    outline-offset: 2px;
  }

  svg {
    margin-inline-end: 20px;
  }

  span {
    font-size: var(--od-type-control-size);
  }
  ${({ active }) => active && css`
    svg {
      color: ${props => props.theme?.ordering?.actionOverride ?? props.theme?.ordering?.semantic?.action?.content ?? props.theme.colors.primary};
    }
  `}
`

export const CloneButtonContainer = styled.div`
  button {
    width: 100%;
    border-radius: 8px;
  }
`
