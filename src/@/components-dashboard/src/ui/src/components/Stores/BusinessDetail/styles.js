import styled from 'styled-components'

export const Container = styled.div`
  display: flex;
  height: 100%;
`
export const InfoConatiner = styled.div`
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  /*  OP-20: this box scrolls, so it is where the sticky P/SaveBar stops. It resets the offset of the editor's padding
     (store-editor.css) and, from 1000px, gives back its own (the rule is the editor's: .odc-se-content .odc-savebar). */
  --odc-bar-end: 0;
  h1 {
    color: ${props => props.theme.colors.headingColor};
    font-size: var(--od-type-title-size);
    font-weight: 700;
  }
  @media (min-width: 1000px) {
    --odc-info-pad: 20px;
    --odc-bar-end: calc(var(--odc-info-pad) * -1);
    padding: var(--odc-info-pad);
  }
`
