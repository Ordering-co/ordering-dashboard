import styled from 'styled-components'

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
`

export const Label = styled.label`
  font-size: 14px;
  font-weight: 500;
  color: ${props => props.theme?.colors?.headingColor || '#213050'};
`
