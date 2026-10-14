import styled, { css } from 'styled-components'

export const Container = styled.div`
  box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.1);
  border-radius: 7.6px;
  padding: 20px;
`

export const Header = styled.div`
  margin-bottom: 15px;

  p {
    margin: 0;
    font-size: 14px;
    color: ${props => props.theme?.colors.headingColor};
    text-transform: uppercase;
  }

  span {
    font-size: 12px;
    color: ${props => props.theme?.colors.lightGray};
  }
`

export const ActionBlock = styled.div`
  svg {
    font-size: 16px;
    color: #212121;
    cursor: pointer;
  }

  ${({ disabled }) => disabled && css`
    svg {
      color: ${props => props.theme?.colors.disabled};
      cursor: not-allowed;
    }
  `}
`

export const SearchForm = styled.form`
  display: flex;
  gap: 10px;
  margin-bottom: 20px;

  input {
    flex: 1;
    max-width: 240px;
  }
`

export const Message = styled.p`
  margin: 10px 0;
  font-size: 14px;
  color: ${props => props.theme?.colors.lightGray};
`

export const Summary = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 15px;
  font-size: 14px;
  color: ${props => props.theme?.colors.headingColor};
`

export const MapWrapper = styled.div`
  width: 100%;
  height: 320px;
  margin-top: 10px;
  border-radius: 8px;
  overflow: hidden;

  @media (min-width: 768px) {
    height: 420px;
  }
`

export const MapCanvas = styled.div`
  width: 100%;
  height: 100%;
`

export const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin: 12px 0;
  font-size: 12px;
  color: ${props => props.theme?.colors.headingColor};
`

export const LegendItem = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
`

export const Dot = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 600;
  color: ${props => props.theme?.colors.white};
  background: ${props => props.color};
`

export const PinDot = styled(Dot)`
  width: 24px;
  height: 24px;
  font-size: 12px;
`

export const DeliveryDistance = styled.p`
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 500;
  color: ${props => props.theme?.colors.headingColor};
`

export const TableToolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20px;
  padding: 0 8px 8px;

  p {
    margin: 0;
    font-size: 14px;
    color: ${props => props.theme?.colors.headingColor};
    text-transform: uppercase;
  }
`

export const StopsTable = styled.table`
  width: 100%;
  font-size: 13px;
  color: ${props => props.theme?.colors.headingColor};

  th {
    font-weight: 500;
    padding: 8px;
    border-bottom: 1px solid ${props => props.theme?.colors.borderColor};
  }

  td {
    padding: 8px;
    border-bottom: 1px solid ${props => props.theme?.colors.borderColor};
  }

  th:first-child,
  td:first-child {
    width: 48px;
    text-align: center;
  }
`
