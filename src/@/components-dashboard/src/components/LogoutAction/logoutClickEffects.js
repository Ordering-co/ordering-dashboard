export const getLogoutClickEffects = ({ useDefaultSessionManager }) => ({
  shouldClearLocalSession: useDefaultSessionManager !== false,
  shouldNotifySuccess: true
})
