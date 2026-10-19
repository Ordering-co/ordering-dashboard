import React, { useState } from 'react'
import { useApi, useLanguage } from '../../../../../index'
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
    onImportClick,
    /** Card id whose import modal is open: that row hides its status so it is not shown twice. */
    openImporterId = null
  } = props

  const [, t] = useLanguage()
  const [ordering] = useApi()
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
                  business={business}
                  project={ordering?.project}
                  onImportClick={onImportClick}
                  hideRunStatus={card.id === openImporterId}
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
