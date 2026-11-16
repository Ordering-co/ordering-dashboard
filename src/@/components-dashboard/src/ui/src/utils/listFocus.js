// redesign BO-B2 (promoted from Users/CustomersListing; originally redesign UC-B7, as OpenCartListing, OC-F2): after a delete the
// focus goes to the row that took the deleted user's place, and closing the panel gives it back to the row. DataTable's rows (and
// the cards of the phone list) carry `data-row-id`; with no row left it goes to the table's region. The DOM is not ready the
// moment the controller answers (the list re-renders, the panel and its dialog close and give the focus back), so it is tried on
// the next frames until it holds, and it leaves alone a focus the person already put somewhere in the list.
const FOCUS_FRAMES = 30
const FOCUS_STABLE_FRAMES = 3
const nextFrame = (callback) => (typeof window !== 'undefined' && window.requestAnimationFrame ? window.requestAnimationFrame(callback) : setTimeout(callback, 16))

export const focusableIn = (element) => {
  if (!element) return null
  if (element.hasAttribute('tabindex')) return element
  return element.querySelector('a[href], button, [tabindex]') ?? element
}

// redesign RA-I3 (promoted from Marketing/CampaignListing, CA-R2 M2): with no id, `emptyTarget(frame)` (optional) names the control that
// takes the focus when no row is left (a page's «New …» button); if it gives none, the table's region does.
export const focusTargetIn = (frame, id, final, emptyTarget) => {
  if (!frame) return null
  if (id != null) {
    const row = Array.from(frame.querySelectorAll('[data-row-id]')).find(element => element.getAttribute('data-row-id') === String(id))
    if (row) return focusableIn(row)
    if (!final) return null // the list may not have rendered yet
  } else if (emptyTarget) {
    const control = emptyTarget(frame)
    if (control) return control
  }
  const region = frame.querySelector('.odc-table-scroll, ul[role="list"]') ?? frame
  if (!region.hasAttribute('tabindex')) region.setAttribute('tabindex', '-1')
  return region
}

// redesign RA-I3 (promoted from Marketing/CampaignListing, CA-R2 M2): after a delete the browser (the closing dialog, the table's roving
// tab stop) puts the focus on the table's tab stop, the FIRST row, before the first frame runs, and the plain mode takes that for «the
// focus the person already put in the list» and gives up. In `takeover` mode (a delete: the successor row is known) a focus that is on a
// ROW of the list (`[data-row-id]`) is not the person's choice and is replaced; a focus on any other control of the list is still left
// alone. It also watches for longer (TAKEOVER_STABLE_FRAMES), because the dialog's own hand-back can come after the first frames, and with
// no id `emptyTarget(frame)` says where the focus goes. Without the third argument it behaves as it always did.
const TAKEOVER_STABLE_FRAMES = 10

export const settleFocusOn = (getFrame, id, { takeover = false, emptyTarget } = {}) => {
  let frames = 0
  let stable = 0
  const step = () => {
    frames++
    const frame = getFrame()
    const target = focusTargetIn(frame, id, frames >= 4, emptyTarget)
    if (target) {
      const active = document.activeElement
      if (active === target) {
        stable++
      } else if (
        !active || active === document.body || !active.isConnected || !frame.contains(active) ||
        (takeover && active.closest('[data-row-id]'))
      ) {
        target.focus({ preventScroll: true })
        stable = 0
      } else {
        return // the focus is already on something in the list
      }
      if (stable >= (takeover ? TAKEOVER_STABLE_FRAMES : FOCUS_STABLE_FRAMES)) return
    }
    if (frames < FOCUS_FRAMES) nextFrame(step)
  }
  nextFrame(step)
}
