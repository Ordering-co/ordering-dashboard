import styled from 'styled-components'

export const Container = styled.div`
  margin: 0 40px;
  font-size: 16px;
  flex: 1;
  max-height: 100vh;
  box-sizing: border-box;

  @media (max-width: 640px) {
    max-width: 100%;
    margin: 0;
    padding: 0 20px;
  }
`

export const SectionTitle = styled.h2`
  margin-top: 10px;
`

export const List = styled.ul`
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  list-style: none;
  padding: 0;
`

export const Card = styled.li`
  width: calc(50% - 10px);
  margin: 20px 0;
  border: 0;

  @media (max-width: 640px) {
    width: 100%;
  }
`
