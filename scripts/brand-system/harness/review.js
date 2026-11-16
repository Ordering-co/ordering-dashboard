const frame = document.querySelector('iframe')
const status = document.getElementById('preview-status')
const retry = document.getElementById('retry')
const options = document.querySelectorAll('button[data-mode], button[data-density]')
let mode = 'light'
let density = 'full'
let observer
let deadline

function failed () {
  observer?.disconnect()
  status.textContent = 'No se pudo mostrar la demostración. Puedes volver a cargarla.'
  retry.hidden = false
}

function preparing () {
  observer?.disconnect()
  clearTimeout(deadline)
  retry.hidden = true
  status.textContent = 'Preparando la demostración…'
  deadline = setTimeout(failed, 10000)
}

function reportReady () {
  const specimen = frame.contentDocument?.querySelector('[data-testid="boot-home"]')
  if (!specimen) return false
  clearTimeout(deadline)
  observer?.disconnect()
  status.textContent = 'Demostración cargada. Los bloques animados son el resultado esperado.'
  return true
}

frame.addEventListener('load', () => {
  if (reportReady()) return
  const body = frame.contentDocument?.body
  if (!body) { failed(); return }
  observer?.disconnect()
  observer = new MutationObserver(reportReady)
  observer.observe(body, { childList: true, subtree: true })
})

function reload () {
  preparing()
  frame.src = `./index.html?pilot=${mode}&density=${density}`
}

for (const button of options) {
  button.addEventListener('click', () => {
    mode = button.dataset.mode || mode
    density = button.dataset.density || density
    document.body.dataset.odTheme = mode
    for (const option of options) {
      option.setAttribute('aria-pressed', String(option.dataset.mode ? option.dataset.mode === mode : option.dataset.density === density))
    }
    reload()
  })
}
retry.addEventListener('click', reload)
preparing()
reportReady()
