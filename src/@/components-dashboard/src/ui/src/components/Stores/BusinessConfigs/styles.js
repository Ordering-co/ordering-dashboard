import styled from 'styled-components'
import { SubmitBtnWrapper } from '../../Settings/SettingsList/styles'

export const Container = styled.div`
  padding: 20px 20px 60px;
  min-height: 100%;
  box-sizing: border-box;

  h1 {
    font-size: 20px;
    font-weight: 700;
    margin-top: 5px;
    margin-bottom: 20px;
    color: ${props => props.theme.colors?.headingColor};
  }
`

export const SectionCard = styled.section`
  border: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  background-color: ${props => props.theme.colors?.backgroundPage || '#FFFFFF'};

  ${SubmitBtnWrapper} {
    position: static;
  }
`

export const SectionHeader = styled.div`
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
`

export const SectionTitle = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: ${props => props.theme.colors?.headingColor};
`

export const EmptyState = styled.p`
  margin-top: 25px;
  font-size: 14px;
  color: ${props => props.theme.colors.lightGray};
`
