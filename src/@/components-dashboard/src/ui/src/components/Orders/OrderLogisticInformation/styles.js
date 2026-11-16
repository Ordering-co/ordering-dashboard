import styled, { css } from 'styled-components'

export const WraaperLogs = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: var(--od-type-content-size);
  border-radius: 97px;
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};

  > button {
    margin-bottom: 15px;
    min-height: 44px;
    font-size: var(--od-type-control-size);
    padding: 0 25px;
  }
`
export const SkeletonHitory = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  column-gap: 20px;

  span {
    border-radius: 5px;
  }

  @media (max-width: 576px) {
    span {
      width: 250px !important;
    }
  }
`
export const BubbleConsole = styled.div`
  border-radius: ${props => props.theme?.ordering?.radius?.component ?? '5px'};
  padding: 5px 15px;
  max-width: 90%;
  margin-bottom: 15px;
  background: ${props => props.theme?.ordering?.semantic?.surface?.subtle ?? '#EFEFEF'};
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
  text-align: center;
  height: auto;
  overflow: hidden;
  overflow-wrap: break-word;

  @media (min-width: 1024px){
    max-width: 60%
  }
`

export const UppercaseText = styled.span`
  text-transform: uppercase;

  ${({ title }) => title && css`
    font-weight: 500;
    font-size: var(--od-type-content-size);
    opacity: 0.8;
  `}
`
