import styled from 'styled-components'

export const Container = styled.div`
  > button {
    position: sticky;
    top: 100%;
  }
`

export const HeatMapToggleWrap = styled.span`
  position: absolute;
  bottom: 30px;
  left: 20px;
  z-index: 1;
  font-size: 14px;
  width: 200px;
`

export const WrapperMap = styled.div`
  width: 100%;
  height: 270px;
  position: relative;
  > div {
    position: relative !important;
    width: 100% !important;
    height: 100% !important;
    border-radius: 8px;
  }

  @media (min-width: 768px) {
    height: 320px;
  }
`
