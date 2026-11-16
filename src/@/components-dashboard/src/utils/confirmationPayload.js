// the fields a protected request carries for the proof ConfirmAdmin handed over: the confirmation_token from
// POST /users/confirm_action.
export const confirmationPayload = (proof) => {
  if (typeof proof === 'string' && proof) return { confirmation_token: proof }
  return {}
}
