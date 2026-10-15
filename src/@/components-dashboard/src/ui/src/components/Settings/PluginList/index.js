import React, { useState, useEffect } from 'react'
import { useTheme } from 'styled-components'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import FiMoreVertical from '@meronex/icons/fi/FiMoreVertical'
import { Dropdown, DropdownButton } from 'react-bootstrap'
import { ChevronRight, PlusCircleFill } from 'react-bootstrap-icons'
import {
  useLanguage,
  PluginList as PluginListController,
  useApi,
  useSession
} from '../../../../../index'
import {
  Modal
} from '~ui'
import { Button, IconButton, Switch } from '../../../styles'
import { Alert, Confirm, Pagination, SearchBar } from '../../Shared'
import { parseTemplate } from '../../../utils'
import {
  PluginListContainer,
  Header,
  PluginsTable,
  PluginTbody,
  PagesBottomContainer,
  ActionsContainer,
  EnableWrapper,
  ActionSelectorWrapper,
  PLuginsSeparator
} from './styles'

const PluginListUI = (props) => {
  const {
    pluginListState,
    isAddMode,
    setIsAddMode,
    setNewUrl,
    handleAddNewPlugin,
    actionState,
    handleDeletePlugin,
    handleUpdatePlugin,
    handleInstallSysPlugin
  } = props
  const [languageState, t] = useLanguage()
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const theme = useTheme()
  const [searchValue, setSearchValue] = useState(null)

  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [confirm, setConfirm] = useState({ open: false, content: null, handleOnAccept: null })
  const [pluginSelected, setPluginSelected] = useState({
    open: false,
    url: null
  })

  // Change page
  const [currentPage, setCurrentPage] = useState({ plugins: 1, sysPlugins: 1 })
  const [pluginsPerPage, setPluginsPerPage] = useState({ plugins: 10, sysPlugins: 10 })

  // Get current plugins
  const [currentPlugins, setCurrentPlugins] = useState({ plugins: [], sysPlugins: [] })
  const [totalPages, setTotalPages] = useState({ plugins: null, sysPlugins: null })

  const variables = {
    project_code: ordering.project,
    access_token: token,
    language_code: languageState?.language?.code
  }

  const handleChangePage = (page, type) => {
    setCurrentPage({ ...currentPage, [type]: page })
  }

  const handleChangePageSize = (pageSize, type) => {
    const expectedPage = Math.ceil(((currentPage[type] - 1) * pluginsPerPage[type] + 1) / pageSize)
    setCurrentPage({ ...currentPage, [type]: expectedPage })
    setPluginsPerPage({ ...pluginsPerPage, [type]: pageSize })
  }

  const onClickDeletePlugin = (id) => {
    setConfirm({
      open: true,
      content: t('QUESTION_DELETE_PLUGIN', 'Are you sure to delete this plugin?'),
      handleOnAccept: () => {
        setConfirm({ ...confirm, open: false })
        handleDeletePlugin(id, () => window.location.reload())
      }
    })
  }

  const handleOpenPluginDetails = (e, plugin) => {
    if (!plugin?.links?.general_settings) return
    e.stopPropagation()
    setPluginSelected({
      open: true,
      title: plugin.name,
      url: plugin.root + plugin.links.general_settings
    })
  }

  useEffect(() => {
    if (pluginListState.loading) return
    let _totalPages
    let _totalsysPages
    let plugins = []
    const sysPlugins = [...pluginListState.sysPlugins]
    if (searchValue) {
      plugins = pluginListState.plugins.filter(plugin => plugin.name?.toLowerCase().includes(searchValue?.toLowerCase()))
    } else {
      plugins = [...pluginListState.plugins]
    }
    if (plugins.length > 0) {
      _totalPages = Math.ceil(plugins.length / pluginsPerPage.plugins)
    }
    if (sysPlugins.length > 0) {
      _totalsysPages = Math.ceil(sysPlugins.length / pluginsPerPage.sysPlugins)
    }
    const indexOfLastPost = currentPage.plugins * pluginsPerPage.plugins
    const indexOfFirstPost = indexOfLastPost - pluginsPerPage.plugins
    const _currentPlugins = plugins.slice(indexOfFirstPost, indexOfLastPost)

    const indexOfLastPostSys = currentPage.sysPlugins * pluginsPerPage.sysPlugins
    const indexOfFirstPostSys = indexOfLastPostSys - pluginsPerPage.sysPlugins
    const _currentSysPlugins = sysPlugins.slice(indexOfFirstPostSys, indexOfLastPostSys)

    setTotalPages({ plugins: _totalPages, sysPlugins: _totalsysPages })
    setCurrentPlugins({ plugins: _currentPlugins, sysPlugins: _currentSysPlugins })
  }, [pluginListState, currentPage, pluginsPerPage, searchValue])

  useEffect(() => {
    if (!actionState?.error) return
    setAlertState({
      open: true,
      content: actionState?.error
    })
  }, [actionState?.error])

  return (
    <>
      <PluginListContainer>
        <PLuginsSeparator h={pluginListState.sysPlugins?.length > 0 && '50%'}>
          <Header>
            <h1>{t('PLUGINS', 'Plugins')}</h1>
            <Button
              borderRadius='8px'
              color='lightPrimary'
              onClick={() => setIsAddMode(true)}
            >
              {t('ADD_PLUGIN', 'Add plugin')}
            </Button>
          </Header>
          <SearchBar
            isCustomLayout
            lazyLoad
            placeholder={t('SEARCH', 'Search')}
            search={searchValue}
            onSearch={val => setSearchValue(val)}
          />
          <PluginsTable>
            <thead>
              <tr>
                <th>{t('PLUGINS', 'Plugins')}</th>
                <th>{t('ACTIONS', 'Actions')}</th>
              </tr>
            </thead>
            {pluginListState.loading
              ? (
                  [...Array(pluginsPerPage.plugins).keys()].map(i => (
                <PluginTbody key={i}>
                  <tr>
                    <td><Skeleton width={100} /></td>
                    <td>
                      <ActionsContainer>
                        <EnableWrapper>
                          <Skeleton width={50} />
                        </EnableWrapper>
                        <ActionSelectorWrapper>
                          <Skeleton width={15} />
                        </ActionSelectorWrapper>
                      </ActionsContainer>
                    </td>
                  </tr>
                </PluginTbody>
                  ))
                )
              : (
                  currentPlugins.plugins.map(plugin => (
                <PluginTbody
                  key={plugin.id}
                  onClick={(e) => handleOpenPluginDetails(e, plugin)}
                  hasLink={Boolean(plugin?.links?.general_settings)}
                >
                  <tr>
                    <td>{plugin?.name} ({plugin?.hooks.length} {t('HOOKS', 'Hooks')})</td>
                    <td>
                      <ActionsContainer>
                        <EnableWrapper onClick={(e) => e.stopPropagation()}>
                          <span>{t('ENABLE', 'Enable')}</span>
                          <Switch
                            defaultChecked={plugin?.enabled}
                            onChange={enabled => handleUpdatePlugin(plugin.id, { enabled })}
                          />
                        </EnableWrapper>
                        <ActionSelectorWrapper onClick={(e) => e.stopPropagation()}>
                          <DropdownButton
                            menuAlign={theme?.rtl ? 'left' : 'right'}
                            title={<FiMoreVertical />}
                            id={theme?.rtl ? 'dropdown-menu-align-left' : 'dropdown-menu-align-right'}
                          >
                            <Dropdown.Item
                              onClick={() => handleUpdatePlugin(plugin.id, { root: plugin.root })}
                            >
                              {t('UPDATE', 'Update')}
                            </Dropdown.Item>
                            <Dropdown.Item
                              onClick={() => onClickDeletePlugin(plugin.id)}
                            >
                              {t('DELETE', 'Delete')}
                            </Dropdown.Item>
                          </DropdownButton>
                        </ActionSelectorWrapper>
                        {Boolean(plugin?.links?.general_settings) && <ChevronRight />}
                      </ActionsContainer>
                    </td>
                  </tr>
                </PluginTbody>
                  ))
                )}
            {isAddMode && (
              <PluginTbody isAddMode>
                <tr>
                  <td>
                    <input
                      onChange={e => setNewUrl(e.target.value)}
                      placeholder={t('URL', 'Url')}
                    />
                  </td>
                  <td>
                    <IconButton
                      color='primary'
                      onClick={() => handleAddNewPlugin(() => window.location.reload())}
                    >
                      <PlusCircleFill />
                    </IconButton>
                  </td>
                </tr>
              </PluginTbody>
            )}
          </PluginsTable>
          {!pluginListState.loading && (
            <PagesBottomContainer>
              <Button
                color='primary'
                borderRadius='8px'
                onClick={() => setIsAddMode(true)}
              >
                {t('ADD_NEW_PLUGIN ', 'Add new plugin')}
              </Button>
              {currentPlugins.plugins?.length > 0 && (
                <Pagination
                  currentPage={currentPage.plugins}
                  totalPages={totalPages.plugins}
                  handleChangePage={(e) => handleChangePage(e, 'plugins')}
                  defaultPageSize={pluginsPerPage.plugins}
                  handleChangePageSize={(e) => handleChangePageSize(e, 'plugins')}
                />
              )}
            </PagesBottomContainer>
          )}
        </PLuginsSeparator>

        {!pluginListState.loading && pluginListState.sysPlugins?.length > 0 && (
          <PLuginsSeparator h='50%'>
            <Header mb={0}>
              <h1 style={{ marginTop: 20 }}>{t('SYSTEM_PLUGINS', 'System Plugins')}</h1>
            </Header>
            <PluginsTable>
              <thead>
                <tr>
                  <th>{t('PLUGINS', 'Plugins')}</th>
                  <th>{t('ACTIONS', 'Actions')}</th>
                </tr>
              </thead>

              {currentPlugins.sysPlugins.map(plugin => (
                <PluginTbody key={plugin.id}>
                  <tr>
                    <td>{plugin?.name}</td>
                    <td>
                      <ActionsContainer>
                        {plugin?.installed
                          ? (
                          <span>{t('SYSTEM_PLUGIN_INSTALLED', 'Installed')}</span>
                            )
                          : (
                          <Button
                            borderRadius='8px'
                            color='lightPrimary'
                            onClick={() => handleInstallSysPlugin(plugin.id, () => window.location.reload())}
                          >
                            <span>{t('INSTALL', 'Install')}</span>
                          </Button>
                            )}
                      </ActionsContainer>
                    </td>
                  </tr>
                </PluginTbody>
              ))}
            </PluginsTable>
            <PagesBottomContainer justifyContent='flex-end'>
              {currentPlugins.sysPlugins?.length > 0 && (
                <Pagination
                  currentPage={currentPage.sysPlugins}
                  totalPages={totalPages.sysPlugins}
                  handleChangePage={(e) => handleChangePage(e, 'sysPlugins')}
                  defaultPageSize={pluginsPerPage.sysPlugins}
                  handleChangePageSize={(e) => handleChangePageSize(e, 'sysPlugins')}
                />
              )}
            </PagesBottomContainer>
          </PLuginsSeparator>
        )}
      </PluginListContainer>
      <Alert
        title={t('WEB_APPNAME', 'Ordering')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />
      <Confirm
        title={t('WEB_APPNAME', 'Ordering')}
        content={confirm.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={confirm.open}
        onClose={() => setConfirm({ ...confirm, open: false })}
        onCancel={() => setConfirm({ ...confirm, open: false })}
        onAccept={confirm.handleOnAccept}
        closeOnBackdrop={false}
      />
      <Modal
        open={pluginSelected.open}
        title={pluginSelected.title}
        onClose={() => setPluginSelected({ ...pluginSelected, open: false })}
        height='80vh'
        width='80vw'
      >
        <iframe
          src={parseTemplate(pluginSelected.url, variables, /@\{([^}]+)\}/g)}
          style={{ width: '100%', height: '85%' }}
        />
      </Modal>
    </>
  )
}

export const PluginList = (props) => {
  const [ordering] = useApi()
  const pluginListProps = {
    ...props,
    UIComponent: PluginListUI,
    projectCode: ordering.project
  }
  return <PluginListController {...pluginListProps} />
}
