import React, { cloneElement, useEffect, useRef, useState } from 'react'

import { AppBootLoader } from '~ui'
import settings from '../../config'
import { WebStrategy } from '../../@/components-dashboard/src/webStrategy'
import { AUTOLOGIN_STASH_KEY, isHandoffPath, readAutologinParams } from '../../utils/stripAutologinQuery'
import {
  exchangeHandoffCode,
  getAutologinApplyResult,
  HANDOFF_EXPIRED_NOTICE,
  revokeReplacedSession,
  setAutologinNotice
} from './autologinSession'
import { SupportSwitchConfirm, SWITCH_PROJECT, SWITCH_USER } from './SupportSwitchConfirm'

const buildApiRoot = (project) => `${settings.api.url}/${settings.api.version}/${settings.api.language}/${project}`

const readStoredSession = async (strategy) => {
  try {
    const [token, project, user, language] = await Promise.all([
      strategy.getItem('token'),
      strategy.getItem('project'),
      strategy.getItem('user', true),
      strategy.getItem('language', true)
    ])
    return { token, project, user, languageCode: language?.code }
  } catch {
    return {}
  }
}

const clearAutologinParams = () => {
  const url = new URL(window.location.href)
  const hasHandoffCode = isHandoffPath(url.pathname) && url.searchParams.has('code')
  if (url.searchParams.has('token') || url.searchParams.has('project') || hasHandoffCode) {
    url.searchParams.delete('token')
    url.searchParams.delete('project')
    if (hasHandoffCode) url.searchParams.delete('code')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }
  delete window[AUTOLOGIN_STASH_KEY]
}

export const AutologinParams = (props) => {
  const [queryParams] = useState(() => readAutologinParams(window))
  const { project: queryProject, token: queryToken } = queryParams
  // A token wins over a one-time sign-in code when a link carries both.
  const queryCode = queryToken ? null : queryParams.code
  const pinnedProject = props.configFile?.local_project_pin
  const matchesProject = !pinnedProject || queryProject === pinnedProject
  const needsAutologin = Boolean(queryProject && (queryToken || queryCode) && matchesProject)
  const [userState, setUserState] = useState({
    loading: needsAutologin,
    result: null,
    error: null
  })
  const [appliedProject, setAppliedProject] = useState(null)
  const [switchPrompt, setSwitchPrompt] = useState(null)
  const handoffStartedRef = useRef(false)
  const fallbackProject = props.configFile?.project

  const appId = props.configFile?.app_id ?? settings.app_id

  const persistUserSession = async ({ sessionToken, user, providerProject, previousSession }) => {
    const strategy = new WebStrategy(props.configFile)
    await strategy.setItem('token', sessionToken)
    await strategy.setItem('user', user, true)
    await strategy.setItem('project', queryProject)
    setAppliedProject(providerProject)
    if (queryCode && previousSession?.token && previousSession.token !== sessionToken) {
      revokeReplacedSession({
        apiRoot: buildApiRoot(previousSession.project || fallbackProject),
        token: previousSession.token,
        appId
      })
    }
  }

  const setUser = async (previousSession = null) => {
    if (!queryProject || !(queryToken || queryCode) || !matchesProject) {
      clearAutologinParams()
      setUserState({ ...userState, loading: false })
      return
    }
    const apiRoot = buildApiRoot(queryProject)
    try {
      setUserState({ ...userState, loading: true })
      const sessionToken = queryToken || await exchangeHandoffCode({ apiRoot, code: queryCode })
      if (!sessionToken) {
        setAutologinNotice(HANDOFF_EXPIRED_NOTICE)
        setUserState({ ...userState, loading: false })
        return
      }
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`
        }
      }
      const response = await fetch(`${apiRoot}/users/me`, requestOptions)
      const { error, result } = await response.json()
      const { persistSession, providerProject } = getAutologinApplyResult({
        queryProject,
        queryToken: sessionToken,
        apiError: error,
        user: result,
        fallbackProject
      })
      const previousUserId = previousSession?.user?.id
      const sameProject = !previousSession?.project || previousSession.project === queryProject
      if (persistSession && queryCode && sameProject && previousSession?.token && previousUserId != null && previousUserId !== result?.id) {
        // Same project, different user: ask before replacing the session.
        setSwitchPrompt({
          kind: SWITCH_USER,
          previousSession,
          pending: { sessionToken, user: result, providerProject, previousSession }
        })
      } else if (persistSession) {
        await persistUserSession({ sessionToken, user: result, providerProject, previousSession })
      } else if (queryCode) {
        setAutologinNotice(HANDOFF_EXPIRED_NOTICE)
      }
      setUserState({
        ...userState,
        loading: false,
        error: result
      })
    } catch (e) {
      if (queryCode) setAutologinNotice(HANDOFF_EXPIRED_NOTICE)
      setUserState({
        ...userState,
        loading: false,
        error: e?.message
      })
    } finally {
      clearAutologinParams()
    }
  }

  // A sign-in code is single use: read the stored session once, then either
  // ask before leaving another project or go straight to the exchange.
  const startHandoff = async () => {
    const previousSession = await readStoredSession(new WebStrategy(props.configFile))
    if (previousSession.token && previousSession.project && previousSession.project !== queryProject) {
      setSwitchPrompt({ kind: SWITCH_PROJECT, previousSession })
      return
    }
    setUser(previousSession)
  }

  const handleSwitch = async () => {
    const prompt = switchPrompt
    setSwitchPrompt(null)
    if (prompt.kind === SWITCH_PROJECT) {
      setUser(prompt.previousSession)
      return
    }
    try {
      await persistUserSession(prompt.pending)
    } catch {}
  }

  const handleStay = () => {
    const prompt = switchPrompt
    setSwitchPrompt(null)
    clearAutologinParams()
    if (prompt.kind === SWITCH_USER) {
      // The one-time sign-in already opened a session; end it so it does not linger.
      revokeReplacedSession({ apiRoot: buildApiRoot(queryProject), token: prompt.pending.sessionToken, appId })
    }
    setUserState({ ...userState, loading: false })
  }

  useEffect(() => {
    if (!needsAutologin) {
      clearAutologinParams()
      return
    }
    if (queryCode) {
      if (handoffStartedRef.current) return
      handoffStartedRef.current = true
      startHandoff()
      return
    }
    setUser()
  }, [])

  if (switchPrompt) {
    const { previousSession } = switchPrompt
    return (
      <SupportSwitchConfirm
        kind={switchPrompt.kind}
        currentProject={previousSession.project || queryProject}
        currentUserEmail={previousSession.user?.email}
        newProject={queryProject}
        supportEmail={switchPrompt.pending?.user?.email}
        languageCode={previousSession.languageCode}
        onSwitch={handleSwitch}
        onStay={handleStay}
      />
    )
  }

  return (
    userState.loading
      ? <AppBootLoader variant='home' density='full' />
      : cloneElement(props.children, {
        settings: {
          ...settings,
          ...props.configFile,
          project: appliedProject ?? fallbackProject
        }
      })
  )
}
