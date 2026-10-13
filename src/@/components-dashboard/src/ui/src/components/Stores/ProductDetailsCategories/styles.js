import styled from 'styled-components'

export const Container = styled.div`
  padding: 20px;

  h1 {
    font-weight: 700;
    font-size: 20px;
    color: ${props => props.theme.colors.headingColor};
    margin-bottom: 25px;
    margin-top: 0px;
  }
`

export const HeaderTitleContainer = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 20px;

  h2 {
    font-weight: 600;
    font-size: 18px;
    color: ${props => props.theme.colors.headingColor};
    margin: 0;
  }
`

export const InfoWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;

  span {
    font-size: 12px;
    color: ${props => props.theme.colors.headingColor};
  }
`

export const CategoriesWrapper = styled.div`
  display: flex;
  width: 100%;
`
