// redesign stores 2.A (decision 4, review F3-R1): the navigations of ⌘K and Mia (useDashboardNavigation) may remount the
// page or leave it, and a remount drops what an open editor holds before the editor can ask. An open editor registers a guard here
// while it is on screen; the navigation goes only when every guard lets it (calls `proceed`). A guard that keeps the user never calls
// it, and nothing has moved yet: the address and the page are as they were.
//
//   registerRouteLeaveGuard(guard) -> unregister      guard: (proceed) => any
//   requestRouteLeave(proceed)                         asks the guards in the order they were registered

const guards = new Set()

export const registerRouteLeaveGuard = (guard) => {
  guards.add(guard)
  return () => { guards.delete(guard) }
}

export const requestRouteLeave = (proceed) => {
  const chain = [...guards]
  const step = (index) => {
    if (index === chain.length) {
      proceed()
      return
    }
    chain[index](() => step(index + 1))
  }
  step(0)
}
