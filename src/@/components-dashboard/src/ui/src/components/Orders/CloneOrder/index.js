import React from 'react'
import { useLanguage } from '~components'
import { Container, Options, Title, CloneOption, CloneButtonContainer } from './styles'
import { Circle, RecordCircleFill } from 'react-bootstrap-icons'
import { Button } from '../../../styles'

export const CloneOrder = (props) => {
  const {
    handleCloneOrder,
    setCloneState,
    cloneState
  } = props
  const [, t] = useLanguage()

  const CloneOptionComponent = ({ title, active, value }) => {
    return (
      <CloneOption onClick={() => setCloneState({ ...cloneState, type: value })} active={active}>
        {active ? <RecordCircleFill /> : <Circle />} <p>{title}</p>
      </CloneOption>
    )
  }

  return (
    <Container>
      <Title>
        {t('CLONE_ORDER', 'Clone order')}
      </Title>
      <Options>
        <CloneOptionComponent
          value={1}
          title={t('CLONE_FULL_ORDER', 'Clone full order')}
          active={cloneState.type === 1}
        />
        <CloneOptionComponent
          value={2}
          title={t('CLONE_ORDER_WITHOUT_PRODUCTS', 'Clone order without products')}
          active={cloneState.type === 2}
        />
      </Options>
      <CloneButtonContainer>
        <Button
          color='primary'
          onClick={() => handleCloneOrder()}
          disabled={cloneState.loading}
        >
          {t('CLONE', 'Clone')}
        </Button>
      </CloneButtonContainer>
    </Container>
  )
}
