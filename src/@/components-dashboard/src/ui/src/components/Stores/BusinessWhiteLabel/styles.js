import styled from 'styled-components'

export const Container = styled.div`
  padding: 20px;
  height: 100%;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

export const HeaderContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;

  h1 {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
  }

  p {
    margin: 0;
    color: ${props => props.theme.colors?.disabled || '#748194'};
    font-size: 13px;
  }
`

export const SectionCard = styled.div`
  border: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  background-color: ${props => props.theme.colors?.backgroundPage || '#FFFFFF'};
  flex-shrink: 0;

  ${({ fillHeight }) => fillHeight && `
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    margin-bottom: 0;
  `}
`

export const SectionTitle = styled.h2`
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 12px 0;
`

export const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
`

export const EmptyWrapper = styled.div`
  text-align: center;
  padding: 24px 0;
  color: ${props => props.theme.colors?.disabled || '#748194'};
  font-size: 13px;
`

export const EditorWrapper = styled.div`
  margin-top: 8px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;

  > * {
    flex: 1;
    min-height: 0;
  }
`
