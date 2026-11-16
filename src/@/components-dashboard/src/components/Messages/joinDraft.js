// redesign tramo A r4 (W0-QA2-05): the draft that comes back after a failed send, joined to what was typed meanwhile with ONE space:
// the edge of the new text (its leading white space) and the end of the sent draft are trimmed at the join, never the inside of either.
// A new text that is only white space adds nothing.
export const joinDraft = (sent, current) => {
  if (current === '') return sent
  if (sent === '') return current
  const joined = current.replace(/^\s+/, '')
  return joined === '' ? sent : `${sent.replace(/\s+$/, '')} ${joined}`
}
