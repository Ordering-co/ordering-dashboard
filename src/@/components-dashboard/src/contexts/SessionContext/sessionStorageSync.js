export const getSessionStorageSyncAction = ({
  storageToken,
  sessionToken,
  storageProject,
  sessionProject
}) => {
  if (!storageToken) return sessionToken ? 'logout' : 'none'
  if (storageToken === sessionToken) return 'none'
  if (storageProject && storageProject !== sessionProject) return 'reload'
  return 'login'
}
