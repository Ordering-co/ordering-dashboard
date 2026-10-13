import styled from 'styled-components'

export const Card = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
  background-color: ${props => props.theme.colors.backgroundInfo || props.theme.colors.lightPrimary};
  border-radius: 8px;
  padding: 20px 24px;
  margin-bottom: 40px;

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
`

export const TextContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

export const Title = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: ${props => props.theme.colors.headingColor};
`

export const Description = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: ${props => props.theme.colors.headingColor};
  opacity: 0.85;
`
