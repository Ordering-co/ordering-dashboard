import styled from 'styled-components'

export const DetailWrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
`

export const ActionBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 18px 16px 10px;
  border-bottom: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
`

export const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
  border-radius: 8px;
  background: transparent;
  color: ${props => props.theme.colors?.primary || '#E63757'};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.theme.colors?.primaryContrast || '#FFF2F4'};
  }

  svg {
    width: 14px;
    height: 14px;
  }
`

export const IframeWrapper = styled.div`
  flex: 1;
  min-height: 0;

  iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
`
