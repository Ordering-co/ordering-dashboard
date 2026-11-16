import styled from 'styled-components'

export const ScheduleContainer = styled.div`
  @media (min-width: 1000px) {
    padding: 20px;
    min-height: 100%;
    display: flex;
    flex-direction: column;
  }
`

export const ScheduleSection = styled.div`
  border-top: 1px solid ${props => props.theme.colors.borderColor};
  margin-top: 30px;
  margin-bottom: 20px;
`

export const Title = styled.h1`
  font-size: var(--od-type-title-size);
  font-weight: 700;
  color: ${props => props.theme.colors.headingColor};
`
