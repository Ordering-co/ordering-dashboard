import styled from 'styled-components'

export const LabelsHeader = styled.div`
  margin-bottom: 4px;

  h3 {
    margin: 0 0 4px 0;
    font-size: 15px;
  }

  p {
    margin: 0;
    font-size: 13px;
    color: ${({ theme }) => theme?.colors?.secundaryText || '#748194'};
  }
`

export const SummaryBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 4px 0 14px 0;
  font-size: 14px;

  strong {
    color: ${({ theme }) => theme?.colors?.headingColor || '#151b26'};
  }
`

export const WarningBox = styled.div`
  border: 1px solid ${({ theme }) => theme?.colors?.danger || '#E63757'};
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 14px;
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.danger || '#E63757'};
`

export const PreviewWrapper = styled.div`
  border: 1px solid ${({ theme }) => theme?.colors?.borderColor || '#E9ECEF'};
  border-radius: 8px;
  padding: 14px;
  background: #F8F9FA;
`

export const PreviewHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin: -14px -14px 8px;
  padding: 10px 14px;
  border-radius: 8px 8px 0 0;
  background: #fff;
  border-bottom: 1px solid ${({ theme }) => theme?.colors?.borderColor || '#E9ECEF'};
  box-shadow: ${({ $elevated }) => ($elevated ? '0 3px 8px rgba(0, 0, 0, 0.12)' : 'none')};
  position: relative;
  z-index: 1;
  transition: box-shadow 0.15s ease;

  > p {
    margin: 0;
  }
`

export const PreviewNote = styled.p`
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme?.colors?.headingColor || '#151b26'};
`

export const PreviewHint = styled.p`
  margin: 0 0 12px 0;
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.secundaryText || '#748194'};
`

export const PreviewScroll = styled.div`
  height: 60vh;
  overflow: auto;
  scrollbar-gutter: stable;
  padding: 8px 0;
  box-sizing: border-box;
`

export const PreviewActions = styled.div`
  display: flex;
  align-items: center;

  button {
    min-height: 36px;
    padding: 0 18px;
    font-size: 14px;
  }
`

export const PreviewZoom = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;

  span {
    min-width: 44px;
    text-align: center;
    font-size: 13px;
    color: ${({ theme }) => theme?.colors?.headingColor || '#151b26'};
  }

  svg {
    font-size: 18px;
  }
`

export const PreviewPages = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  user-select: none;

  canvas {
    display: block;
    flex-shrink: 0;
    margin: 0 auto;
    height: auto;
    background: #fff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  }
`
