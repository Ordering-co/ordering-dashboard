export const DASHBOARD_AUTOLOGIN_LEVELS = [0, 2, 5, 8]

export const getAutologinApplyResult = ({
  queryProject,
  queryToken,
  apiError,
  user,
  fallbackProject
}) => {
  const persistSession = Boolean(
    queryProject &&
    queryToken &&
    !apiError &&
    DASHBOARD_AUTOLOGIN_LEVELS.includes(user?.level)
  )

  return {
    persistSession,
    providerProject: persistSession ? queryProject : fallbackProject
  }
}
