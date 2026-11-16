import styled from 'styled-components'

export const WrapperMap = styled.div`
  width: 100%;
  height: 100%;
  background-color: ${props => props.theme?.ordering?.semantic?.surface?.subtle ?? '#EEE'};
  position: relative;

  /* redesign W1-2 (T1-3): the page region already has the panel radius and clips; the frame adds neither a second border nor a second radius. */
  & > .odc-map-frame {
    border: 0;
    border-radius: 0;
  }
`
