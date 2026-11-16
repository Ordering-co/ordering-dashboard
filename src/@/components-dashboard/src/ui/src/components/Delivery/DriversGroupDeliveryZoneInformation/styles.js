import styled from 'styled-components'

export const FormContainer = styled.form`
  display: flex;
  flex-direction: column;
  min-height: calc(100% - 130px);

  > button {
    width: fit-content;
    position: sticky;
    top: 100%;
    margin-top: 30px;
    min-height: 44px;
  }
`
/* redesign DG-B2b (M-DG27 | decisión 6): the slot of P/MapFrame. The frame (size='fill') takes the height of this container,
   which is the height token of an embedded map; the frame owns the radius, the border and the notice. */
export const WrapperMap = styled.div`
  width: 100%;
  height: var(--od-x-map-height);
  box-sizing: border-box;
  margin: var(--od-space-5) 0 var(--od-space-4);
  position: relative;
`

/* The ready map and its Clear button, inside the frame. BusinessZoneGoogleMaps paints one absolutely positioned div; it fills the stage. */
export const MapStage = styled.div`
  position: relative;
  width: 100%;
  height: 100%;

  > div {
    position: relative !important;
    width: 100% !important;
    height: 100% !important;
  }

  > button {
    position: absolute;
    inset-block-start: var(--od-space-2);
    inset-inline-start: var(--od-space-2);
    z-index: var(--od-x-layer-raised);
  }
`

export const ErrorText = styled.div`
  font-size: var(--od-type-content-size);
  color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.lightGray};
  text-align: center;
  margin: 20px 0;
`
export const FormControl = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  label {
    font-size: var(--od-type-control-size);
    margin-bottom: 9px;
  }
  input {
    width: 100%;
    min-width: 0;
  }
`
export const Row = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 29px;

  > div {
    width: 45%;
  }

  @media (max-width: 620px) {
    flex-direction: column;
    gap: 20px;
    margin-bottom: 20px;

    > div {
      width: 100%;
    }
  }
`
export const KmlButtonWrapper = styled.div`
  margin-bottom: 20px;

  > button {
    min-height: 44px;
  }
`
