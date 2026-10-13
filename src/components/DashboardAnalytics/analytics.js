export const isDashboardAnalyticsReady = ({ auth, projectLoading, projectId }) => (
  Boolean(auth) && projectLoading === false && Boolean(projectId)
)

export const getDashboardRouteFingerprint = (projectId, pathname) => `${projectId}:${pathname}`
