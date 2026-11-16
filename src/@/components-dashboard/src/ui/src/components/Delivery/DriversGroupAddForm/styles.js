import styled from 'styled-components'

export const Container = styled.form`
  h2 {
    font-weight: 600;
    font-size: var(--od-type-section-title-size);
    line-height: 24px;
    margin: 0 0 29px 0;
  }
`

export const SectionContainer = styled.div`
  box-shadow: ${props => props.theme?.ordering?.shadow?.[2] ?? '0px 4px 10px rgba(0, 0, 0, 0.12)'};
  border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? 'transparent'};
  border-radius: ${props => props.theme?.ordering?.radius?.component ?? '7.6px'};
  padding: 25px 38px;
  margin: 25px 20px 34px 20px;

  > div {
    max-width: 1024px;
  }

  @media (max-width: 480px) {
    padding: 20px 16px;
    margin-inline: 12px;
  }
`
export const ButtonsContainer = styled.div`
  display: flex;
  align-items: center;
  padding: 20px;
  position: sticky;
  z-index: var(--od-x-layer-sticky);
  /* redesign AH: in a record body the bar gives back its foot padding, like P/SaveBar (record-panel.css); a sticky box
     stops at that padding, so it floated above the foot and the drivers list showed under it. 0 outside a record body. */
  bottom: calc(var(--odc-record-pad-end, 0) * -1);
  background-color: ${props => props.theme?.ordering?.semantic?.background ?? props.theme.colors.backgroundPage};

  > button {
    border-radius: ${props => props.theme?.ordering?.radius?.control ?? '8px'};
    min-height: 44px;
    &:last-child {
      margin: 0 10px;
    }
  }

  @media (max-width: 480px) {
    align-items: stretch;
    flex-direction: column;
    gap: 8px;

    > button {
      width: 100%;

      &:last-child {
        margin: 0;
      }
    }
  }
`
