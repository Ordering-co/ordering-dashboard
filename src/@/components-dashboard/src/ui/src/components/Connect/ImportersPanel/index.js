import React, { useState } from 'react'
import { useLanguage } from '../../../../../index'
import { SideBar } from '../../Shared'
import { IMPORTER_CARDS } from '../Importers/importerCards'
import { ImporterRow } from './ImporterRow'
import { ImportRawLogsTab } from './ImportRawLogsTab'

import {
  PanelContainer,
  DetailsHeader,
  BusinessName,
  SectionLabel,
  ImportersList,
  TabsRow,
  PanelTab
} from './styles'

export const ImportersPanel = (props) => {
  const {
    open,
    business,
    onClose,
    onImportClick
  } = props

  const [, t] = useLanguage()
  const [activeTab, setActiveTab] = useState('importers')
  const businessName = business?.name || t('BUSINESS', 'Business')

  if (!open) return null

  return (
    <SideBar
      open={open}
      onClose={onClose}
      defaultSideBarWidth={460}
      showExpandIcon
      sidebarId='importers_panel'
    >
      <PanelContainer>
        <DetailsHeader>
          <BusinessName data-testid='importers-panel-business-name'>
            {businessName}
          </BusinessName>
        </DetailsHeader>

        <TabsRow data-testid='importers-panel-tabs'>
          <PanelTab
            type='button'
            $active={activeTab === 'importers'}
            onClick={() => setActiveTab('importers')}
            data-testid='importers-panel-tab-importers'
          >
            {t('IMPORTERS_TAB_IMPORTERS', 'Importers')}
          </PanelTab>
          <PanelTab
            type='button'
            $active={activeTab === 'logs'}
            onClick={() => setActiveTab('logs')}
            data-testid='importers-panel-tab-logs'
          >
            {t('IMPORTERS_TAB_LOGS', 'Logs')}
          </PanelTab>
        </TabsRow>

        {activeTab === 'importers' && (
          <>
            <SectionLabel>
              {t('MENU_IMPORTERS', 'Menu importers')}
            </SectionLabel>
            <ImportersList data-testid='importers-panel-list'>
              {IMPORTER_CARDS.map((card) => (
                <ImporterRow
                  key={card.id}
                  card={card}
                  onImportClick={onImportClick}
                />
              ))}
            </ImportersList>
          </>
        )}

        {activeTab === 'logs' && (
          <ImportRawLogsTab
            business={business}
            onGoToImporters={() => setActiveTab('importers')}
          />
        )}
      </PanelContainer>
    </SideBar>
  )
}
