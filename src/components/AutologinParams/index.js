import React, { cloneElement, useEffect, useState } from 'react'

import { AppBootLoader } from '~ui'
import settings from '../../config'
import { WebStrategy } from '../../@/components-dashboard/src/webStrategy'
import { AUTOLOGIN_STASH_KEY, readAutologinParams } from '../../utils/stripAutologinQuery'
import { getAutologinApplyResult } from './autologinSession'

const clearAutologinParams = () => {
  const url = new URL(window.location.href)
  if (url.searchParams.has('token') || url.searchParams.has('project')) {
    url.searchParams.delete('token')
    url.searchParams.delete('project')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }
  delete window[AUTOLOGIN_STASH_KEY]
}

export const AutologinParams = (props) => {
  const [queryParams] = useState(() => readAutologinParams(window))
  const { project: queryProject, token: queryToken } = queryParams
  const pinnedProject = props.configFile?.local_project_pin
  const matchesProject = !pinnedProject || queryProject === pinnedProject
  const needsAutologin = Boolean(queryProject && queryToken && matchesProject)
  const [userState, setUserState] = useState({
    loading: needsAutologin,
    result: null,
    error: null
  })
  const [appliedProject, setAppliedProject] = useState(null)
  const fallbackProject = props.configFile?.project

  const setUser = async () => {
    if (!queryProject || !queryToken || !matchesProject) {
      clearAutologinParams()
      setUserState({ ...userState, loading: false })
      return
    }
    try {
      setUserState({ ...userState, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${queryToken}`
        }
      }
      const response = await fetch(`${settings.api.url}/${settings.api.version}/${settings.api.language}/${queryProject}/users/me`, requestOptions)
      const { error, result } = await response.json()
      const { persistSession, providerProject } = getAutologinApplyResult({
        queryProject,
        queryToken,
        apiError: error,
        user: result,
        fallbackProject
      })
      if (persistSession) {
        const strategy = new WebStrategy(props.configFile)
        await strategy.setItem('token', queryToken)
        await strategy.setItem('user', result, true)
        await strategy.setItem('project', queryProject)
        setAppliedProject(providerProject)
      }
      setUserState({
        ...userState,
        loading: false,
        error: result
      })
    } catch (e) {
      setUserState({
        ...userState,
        loading: false,
        error: e?.message
      })
    } finally {
      clearAutologinParams()
    }
  }

  useEffect(() => {
    if (!needsAutologin) {
      clearAutologinParams()
      return
    }
    setUser()
  }, [])

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
