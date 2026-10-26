import React from 'react'
import { useLanguage, useSession, useEvent } from '../../../../../index'
import { FileMedical, FileEarmarkArrowUp, TabletLandscape } from 'react-bootstrap-icons'
import { canOpenDashboardRoute } from '../../../../../utils/dashboardNavigation'
import {
  Container,
  GuideItemContainer,
  InfoWrapper,
  IconWrapper
} from './styles'

export const ProductStartGuide = (props) => {
  const { business, onClose, onImportMenu } = props
  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const [events] = useEvent()

  const handleIntegratePos = () => {
    onClose()
    events.emit('go_to_page', { page: 'pos_menu', search: `?id=${business?.id}` })
  }

  const guideList = [
    {
      id: 'empty',
      title: t('START_WITH_AN_EMPTY_MENU', 'Start with an empty Menu'),
      description: t('START_WITH_AN_EMPTY_MENU_DESC', 'Start with an empty Menu and enter your menu items'),
      icon: <FileMedical />,
      enabled: true,
      onClick: onClose
    },
    {
      id: 'import',
      title: t('IMPORT_YOUR_MENU', 'Import your menu'),
      description: t('IMPORT_YOUR_MENU_DESC', 'Bring your menu from DoorDash, Uber Eats, GloriaFood or another Ordering.co store.'),
      icon: <FileEarmarkArrowUp />,
      enabled: canOpenDashboardRoute('/connect/importers', user?.level),
      onClick: onImportMenu
    },
    {
      id: 'pos',
      title: t('INTEGRATE_MY_POS_TO_EXTRACT_MENU', 'Integrate my POS to extract the menu'),
      description: t('INTEGRATE_MY_POS_TO_EXTRACT_MENU_DESC', 'Connect Square, Clover, Simphony or Wansoft and sync your menu automatically.'),
      icon: <TabletLandscape />,
      enabled: canOpenDashboardRoute('/connect/pos-menu', user?.level),
      onClick: handleIntegratePos
    }
  ]

  return (
    <Container>
      <h2>{t('HOW_DO_YOU_WANT_TO_START', 'How do you want to start?')}</h2>
      {guideList.filter(guide => guide.enabled).map(guide => (
        <GuideItemContainer key={guide.id} onClick={guide.onClick} data-testid={`product-start-guide-${guide.id}`}>
          <IconWrapper>
            {guide.icon}
          </IconWrapper>
          <InfoWrapper>
            <h3>{guide.title}</h3>
            <p>{guide.description}</p>
          </InfoWrapper>
        </GuideItemContainer>
      ))}
    </Container>
  )
}
