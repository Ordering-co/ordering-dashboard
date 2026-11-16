import styled from 'styled-components'

export const WraaperLogs = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: var(--od-type-content-size);
  border-radius: ${props => props.theme?.ordering?.radius?.round ?? '97px'};
  width: 100%;
  min-width: 0;

  > button {
    margin-bottom: 15px;
    font-size: var(--od-type-control-size);
    padding: 0 25px;
  }
`
export const BubbleConsole = styled.div`
  border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors?.borderColor};
  border-radius: ${props => props.theme?.ordering?.radius?.component ?? '5px'};
  padding: 10px 25px;
  margin-bottom: 20px;
  background: ${props => props.theme?.ordering?.semantic?.surface?.subtle ?? props.theme.colors.secundary};
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
  text-align: center;
  height: auto;
  overflow: hidden;
  overflow-wrap: break-word;
  width: min(80%, 720px);
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
`
export const TimeofSent = styled.p`
  position: relative;
  font-size: var(--od-type-identifier-size);
  font-family: var(--od-type-identifier-font);
  font-variant-ligatures: var(--od-type-identifier-ligatures);
  margin-block-start: 0.2em;
  margin-block-end: initial;
  width: fit-content;
  cursor: pointer;
  font-weight: 600;
  direction: ltr;
  unicode-bidi: isolate;
  
  margin-inline-start: auto;
`
export const Reason = styled.p`
  text-align: center;
  margin: 0px;
`
export const SkeletonHitory = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  column-gap: 20px;
  width: 100%;

  span {
    border-radius: ${props => props.theme?.ordering?.radius?.component ?? '5px'};
    max-width: calc(100vw - 64px);
  }

  @media (max-width: 576px) {
    span {
      width: 250px !important;
    }
  }
`
