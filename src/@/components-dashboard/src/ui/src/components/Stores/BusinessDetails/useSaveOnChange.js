import { useEffect, useRef } from 'react'

// redesign stores 1.A (G2-02, G5-01)
// The sections of the store editor that save the shared form as soon as it holds changes (Categories, Notifications, Ordering
// channels). When a save failed, the controller kept those changes in a new formState and the effect sent them again on every
// render: a request loop for as long as the failure lasted. Each set of changes is sent once; the next user action makes a new
// one (handleUpdateBusinessClick keeps the same `changes` object after a failure), so it is a new attempt.
export const useSaveOnChange = (formState, save) => {
  const sent = useRef(null)

  useEffect(() => {
    const changes = formState?.changes
    if (!changes || Object.keys(changes).length === 0 || changes === sent.current) return
    sent.current = changes
    // Changes that are being sent already (the shell retries what a section left when another one opens, and that section
    // mounts while the retry runs) count as sent: a failure must not send them a second time.
    if (formState?.loading) return
    save()
  }, [formState])
}
