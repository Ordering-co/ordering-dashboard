// Teclado de un grupo de radios (patrón WAI-ARIA `radiogroup`): tabindex itinerante
// (solo el radio marcado, o el primero si ninguno lo está, es parada de Tab) y
// flechas / Home / End que seleccionan y mueven el foco. Mismo contrato que
// Delivery/DriversGroupLogistics, pero basado en el DOM para no repetirlo en cada grupo.

const isRadioDisabled = (radio) => (
  radio.disabled === true || radio.getAttribute('aria-disabled') === 'true'
)

// Radios que pertenecen a `group`: los [role="radio"] descendientes cuyo
// radiogroup más cercano es ese mismo grupo (se saltan los de grupos anidados).
const getGroupRadios = (group) => (
  Array.from(group.querySelectorAll('[role="radio"]'))
    .filter(radio => radio.closest('[role="radiogroup"]') === group)
)

export const radioTabIndex = (isChecked, isFirst, anyChecked) => (
  isChecked || (isFirst && !anyChecked) ? 0 : -1
)

export const radioGroupKeyDown = (event) => {
  const current = event.currentTarget
  const group = current?.closest?.('[role="radiogroup"]')
  if (!group) return

  const radios = getGroupRadios(group).filter(radio => !isRadioDisabled(radio))
  const index = radios.indexOf(current)
  if (index === -1) return

  let target
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      target = radios[(index + 1) % radios.length]
      break
    case 'ArrowLeft':
    case 'ArrowUp':
      target = radios[(index - 1 + radios.length) % radios.length]
      break
    case 'Home':
      target = radios[0]
      break
    case 'End':
      target = radios[radios.length - 1]
      break
    default:
      return
  }

  event.preventDefault()
  // El click dispara el onClick del radio, es decir, la selección real.
  target.click()
  target.focus()
}
