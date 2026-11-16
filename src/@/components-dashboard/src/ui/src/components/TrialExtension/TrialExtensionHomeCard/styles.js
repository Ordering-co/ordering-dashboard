import styled from 'styled-components'

export const Card = styled.section`
  display: flex;
  flex-direction: column;
  gap: var(--od-space-3);
  background-color: var(--od-x-info-soft);
  border: 1px solid var(--od-border);
  border-radius: var(--od-radius-panel);
  padding: var(--od-space-4) var(--od-space-5);
  margin-bottom: var(--od-space-6);

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
`

export const TextContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--od-x-space-1-5);
`

export const Title = styled.h2`
  margin: 0;
  font-size: var(--od-type-section-title-size);
  font-weight: 700;
  color: var(--od-text);
`

export const Description = styled.p`
  margin: 0;
  font-size: var(--od-type-content-size);
  line-height: 1.5;
  color: var(--od-text-muted);
`
