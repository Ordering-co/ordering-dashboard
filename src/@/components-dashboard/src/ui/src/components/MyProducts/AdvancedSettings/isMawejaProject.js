export const isMawejaProject = (project) => (
  String(project ?? '').trim().toLowerCase() === 'maweja'
)
