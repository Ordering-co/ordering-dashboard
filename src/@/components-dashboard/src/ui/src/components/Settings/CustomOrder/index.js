import React, { useEffect, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { useLanguage, useApi, useSession, useToast, ToastType } from '../../../../../index'
import { Button, Input } from '../../../styles'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import styled, { css } from 'styled-components'
import { buildSettingsPath } from '../../../../../utils/settingsRedirects'
import { PLUGIN_KEY } from './constants'

const Container = styled.div`
  box-sizing: border-box;
  ${({ $embedded }) => !$embedded && css`
    @media (min-width: 576px) {
      padding: 0px 20px;
    }
  `}
`

const Title = styled.h1`
  font-size: 20px;
  font-weight: 700;
  color: ${props => props.theme.colors?.headingColor};
  margin-top: 5px;
  margin-bottom: 40px;
`

const SettingRow = styled.div`
  margin-bottom: 30px;
`

const Label = styled.label`
  font-weight: 600;
  font-size: 14px;
  color: ${props => props.theme.colors?.headingColor};
  margin: 0;
`

const HelpText = styled.p`
  font-size: 12px;
  color: ${props => props.theme.colors?.secundaryContrast || '#909BA9'};
  margin: 4px 0 10px;
`

const ErrorText = styled.p`
  color: ${props => props.theme.colors?.danger || '#e74c3c'};
  font-size: 13px;
  margin-bottom: 12px;
`

const InputWrapper = styled.div`
  max-width: 300px;
`

const LabelRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
`

const GlobalBadge = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: ${props => props.theme.colors?.primary || '#4393F5'};
  background: ${props => props.theme.colors?.primary ? `${props.theme.colors.primary}18` : '#4393F518'};
  border-radius: 4px;
  padding: 2px 7px;
  letter-spacing: 0.3px;
`

const LoadingOverlay = styled.div`
  opacity: 0.6;
  pointer-events: none;
`

const EmptyHelp = styled.p`
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors?.secundaryContrast || '#909BA9'};
`

const GLOBAL_SETTINGS = ['max_weight', 'delivery_fee_multiplier', 'max_distance']

export const CustomOrder = ({ hideHeader } = {}) => {
  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ token, user }] = useSession()
  const [, { showToast }] = useToast()
  const history = useHistory()
  const isAdmin = user?.level === 0

  const [pluginState, setPluginState] = useState({ loading: true, installed: false, pluginRoot: null, error: null })
  const [settingsSchema, setSettingsSchema] = useState({})
  const [settingsValues, setSettingsValues] = useState({})
  const [saveState, setSaveState] = useState({ loading: false, error: null })

  const orderingHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  }

  const pluginHeaders = (root) => {
    const headers = { ...orderingHeaders }
    if (root?.includes('ngrok')) headers['ngrok-skip-browser-warning'] = 'true'
    return headers
  }

  const fetchInstalledPlugin = async () => {
    try {
      setPluginState(prev => ({ ...prev, loading: true, error: null }))

      const installedRes = await fetch(`${ordering.root}/plugins/key/${PLUGIN_KEY}`, { headers: orderingHeaders })
      const installedContent = await installedRes.json()
      const installedPlugin = installedContent.error ? null : installedContent.result

      if (!installedPlugin) {
        setPluginState({ loading: false, installed: false, pluginRoot: null, error: null })
        return null
      }

      return installedPlugin.root
    } catch (err) {
      setPluginState({ loading: false, installed: false, pluginRoot: null, error: err.message })
      return null
    }
  }

  const fetchSettings = async (pluginRoot) => {
    if (!pluginRoot) return
    try {
      const projectCode = ordering.project
      const res = await fetch(
        `${pluginRoot}/${projectCode}/api/settings`,
        { headers: pluginHeaders(pluginRoot) }
      )
      const content = await res.json()
      if (!content.error && content.result?.settings) {
        const schema = content.result.settings
        setSettingsSchema(schema)

        const values = {}
        Object.keys(schema).forEach(key => {
          if (GLOBAL_SETTINGS.includes(key) && !isAdmin) return
          values[key] = String(schema[key].value ?? '')
        })
        setSettingsValues(values)
      }
    } catch (_) {}
  }

  useEffect(() => {
    const init = async () => {
      const pluginRoot = await fetchInstalledPlugin()
      if (pluginRoot) {
        await fetchSettings(pluginRoot)
        setPluginState({ loading: false, installed: true, pluginRoot, error: null })
      }
    }
    init()
  }, [])

  const handleOpenPlugins = () => {
    history.push(buildSettingsPath({
      group: 'developers',
      category: 'developers',
      id: 'plugins'
    }))
  }

  const handleValueChange = (key, value) => {
    setSettingsValues(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!pluginState.pluginRoot) return
    try {
      setSaveState({ loading: true, error: null })
      const projectCode = ordering.project

      const body = {}
      Object.keys(settingsValues).forEach(key => {
        body[key] = parseFloat(settingsValues[key]) || 0
      })

      const res = await fetch(
        `${pluginState.pluginRoot}/${projectCode}/api/settings`,
        {
          method: 'POST',
          headers: pluginHeaders(pluginState.pluginRoot),
          body: JSON.stringify(body)
        }
      )
      const content = await res.json()
      if (content.error) {
        throw new Error(content.result?.[0] || 'Save failed')
      }
      setSaveState({ loading: false, error: null })
      showToast(ToastType.Success, t('SAVED', 'Saved'))
    } catch (err) {
      setSaveState({ loading: false, error: err.message })
    }
  }

  if (pluginState.loading) {
    return (
      <Container $embedded={hideHeader}>
        {!hideHeader && <Skeleton width={160} height={28} style={{ marginBottom: 40 }} />}
        <SettingRow>
          <Skeleton width={220} height={16} style={{ marginBottom: 8 }} />
          <Skeleton width={300} height={12} style={{ marginBottom: 10 }} />
          <Skeleton width={300} height={38} />
        </SettingRow>
        <SettingRow>
          <Skeleton width={240} height={16} style={{ marginBottom: 8 }} />
          <Skeleton width={300} height={12} style={{ marginBottom: 10 }} />
          <Skeleton width={300} height={38} />
        </SettingRow>
        <Skeleton width={80} height={38} />
      </Container>
    )
  }

  if (pluginState.error) {
    return (
      <Container $embedded={hideHeader}>
        {!hideHeader && <Title>{t('CUSTOM_ORDER', 'Custom Order')}</Title>}
        <ErrorText>{pluginState.error}</ErrorText>
      </Container>
    )
  }

  if (!pluginState.installed) {
    return (
      <Container $embedded={hideHeader}>
        {!hideHeader && <Title>{t('CUSTOM_ORDER', 'Custom Order')}</Title>}
        <EmptyHelp>
          {t('SETTINGS_CUSTOM_ORDER_NOT_INSTALLED', 'The custom orders plugin is not installed on this project.')}
        </EmptyHelp>
        <Button
          color='primary'
          onClick={handleOpenPlugins}
        >
          {t('SETTINGS_CUSTOM_ORDER_OPEN_PLUGINS', 'Go to plugins')}
        </Button>
      </Container>
    )
  }

  const content = (
    <Container $embedded={hideHeader}>
      {!hideHeader && <Title>{t('CUSTOM_ORDER', 'Custom Order')}</Title>}
      {Object.keys(settingsSchema).map(key => {
        const setting = settingsSchema[key]
        const isGlobal = GLOBAL_SETTINGS.includes(key)

        if (isGlobal && !isAdmin) return null

        return (
          <SettingRow key={key}>
            <LabelRow>
              <Label>{setting.name}</Label>
              {isGlobal && <GlobalBadge>{t('GLOBAL_SETTING', 'Global setting')}</GlobalBadge>}
            </LabelRow>
            <HelpText>{setting.description}</HelpText>
            <InputWrapper>
              <Input
                type='number'
                min='0'
                step={setting.type === 'float' ? '0.01' : '1'}
                value={settingsValues[key] ?? ''}
                onChange={e => handleValueChange(key, e.target.value)}
                placeholder={String(setting.value ?? '')}
              />
            </InputWrapper>
          </SettingRow>
        )
      })}

      {saveState.error && <ErrorText>{saveState.error}</ErrorText>}

      <Button
        color='primary'
        disabled={saveState.loading}
        onClick={handleSave}
      >
        {saveState.loading ? t('SAVING', 'Saving') + '...' : t('SAVE', 'Save')}
      </Button>
    </Container>
  )

  return saveState.loading ? <LoadingOverlay>{content}</LoadingOverlay> : content
}
