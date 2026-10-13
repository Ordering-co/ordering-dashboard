import styled from 'styled-components'
import { orderingBrandScope, orderingFocusRing } from '../../styles/OrderingBrand'

/**
 * Focused docs-connect page on Ordering.co brand tokens (`--od-*`), like the
 * login: one centered card, no Dashboard shell around it.
 */
export const ConsentPage = styled.div`
  ${orderingBrandScope}
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--od-space-5) var(--od-space-4);
  background: var(--od-surface-subtle);
  color: var(--od-text);
  font-family: var(--od-font-sans);
  font-size: var(--od-font-size-2);
  line-height: var(--od-line-body);
  -webkit-font-smoothing: antialiased;

  *, *::before, *::after {
    box-sizing: border-box;
  }

  @media (min-width: 768px) {
    padding: var(--od-space-7);
  }
`

export const Card = styled.main`
  width: 100%;
  max-width: 440px;
  padding: var(--od-space-5);
  border: var(--od-stroke) solid var(--od-border);
  border-radius: var(--od-radius-panel);
  background: var(--od-surface);
  box-shadow: var(--od-shadow-2);

  @media (min-width: 768px) {
    padding: var(--od-space-6);
  }
`

export const Logo = styled.div`
  margin-bottom: var(--od-space-5);

  img {
    display: block;
    height: 28px;
    max-width: 200px;
    object-fit: contain;
    object-position: left center;
  }
`

export const Heading = styled.div`
  margin-bottom: var(--od-space-5);

  h1 {
    margin: 0 0 var(--od-space-2);
    color: var(--od-text);
    font-size: 1.5rem;
    font-weight: var(--od-font-weight-semibold);
    line-height: var(--od-line-heading);
    letter-spacing: var(--od-tracking-heading);
  }

  p {
    margin: 0;
    color: var(--od-text-muted);
    font-size: var(--od-font-size-2);
    overflow-wrap: anywhere;
  }
`

export const Scope = styled.section`
  margin-bottom: var(--od-space-4);
  padding: var(--od-space-4);
  border: var(--od-stroke) solid var(--od-border);
  border-radius: var(--od-radius-component);

  h2 {
    margin: 0 0 var(--od-space-3);
    color: var(--od-text-muted);
    font-size: var(--od-font-size-2);
    font-weight: var(--od-font-weight-medium);
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: var(--od-space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    gap: var(--od-space-2);
    align-items: flex-start;
    color: var(--od-text);
  }

  svg {
    flex: none;
    width: 18px;
    height: 18px;
    margin-top: 2px;
    color: var(--od-action-content);
  }
`

export const Notice = styled.p`
  display: flex;
  gap: var(--od-space-2);
  align-items: flex-start;
  margin: 0 0 var(--od-space-5);
  padding: var(--od-space-3);
  border-radius: var(--od-radius-component);
  background: var(--od-action-soft);
  color: var(--od-text);
  font-size: var(--od-font-size-2);

  svg {
    flex: none;
    width: 18px;
    height: 18px;
    margin-top: 2px;
    color: var(--od-action-content);
  }
`

export const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--od-space-3);
`

export const TextButton = styled.button`
  align-self: center;
  min-height: 36px;
  padding: 0 var(--od-space-3);
  border: 0;
  border-radius: var(--od-radius-control);
  background: transparent;
  color: var(--od-text-muted);
  font: inherit;
  font-size: var(--od-font-size-2);
  font-weight: var(--od-font-weight-medium);
  cursor: pointer;

  &:hover {
    color: var(--od-text);
    text-decoration: underline;
  }

  &:focus-visible {
    ${orderingFocusRing}
  }
`

export const Status = styled.p`
  display: flex;
  gap: var(--od-space-2);
  align-items: center;
  justify-content: center;
  margin: 0;
  color: var(--od-text-muted);
  font-size: var(--od-font-size-1);
  text-align: center;
`

export const Result = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--od-space-4);
  text-align: center;

  > svg {
    width: 40px;
    height: 40px;
    color: ${({ $tone }) => $tone === 'danger' ? 'var(--od-danger-functional)' : 'var(--od-action-content)'};
  }

  p {
    margin: 0;
    color: var(--od-text);
    font-size: var(--od-font-size-3);
  }
`
