import styled, { css } from 'styled-components'

export const MigrationCard = styled.section`
  margin-top: 30px;
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
  background: ${props => props.theme.colors?.backgroundPage || '#FFFFFF'};
  box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.1);

  ${({ tone }) => tone === 'done' && css`
    border-color: #B7E4C7;
    background: #F3FBF6;
  `}

  ${({ tone }) => tone === 'warning' && css`
    border-color: #FFE0A3;
    background: #FFFAEF;
  `}

  > svg {
    flex: none;
    width: 22px;
    height: 22px;
    margin-top: 2px;
    color: ${({ tone, theme }) => tone === 'done' ? '#2F9E5B' : tone === 'warning' ? '#B7791F' : theme.colors?.primary};
  }
`

export const MigrationBody = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  p {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: #5E6B7D;
  }
`

export const MigrationActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;

  a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
  }
`

export const MigrationError = styled.p`
  && {
    color: ${props => props.theme.colors?.danger || '#E63757'};
  }
`
