import { stringToSlug } from '../ui/src/utils/stringToSlug'

// redesign W0-2d (T0-7): the one translation of a message the API sends as text (INTERNAL_ERROR is an API key).
// The global Alert of main translated every message by its slug; the quiet failures of the wizard, the alert
// dialogs and the export go through this same call. Without text (not a string, or blank) it says `fallback`.
// `defaultText` is the text `t` gives back for an unknown key (the message itself unless said otherwise).
export const translateApiMessage = (t, message, fallback, defaultText = message) => {
  if (typeof message !== 'string' || !message.trim()) return fallback
  return t(stringToSlug(message).toUpperCase(), defaultText)
}

// redesign W0-2 r2 (W0-P1-05): the text main gave as the default of the Alert (Confirm's `errors` table) for the two
// messages the report endpoint answers by key. When the project's dictionary has no entry for the key, this is what
// shows instead of the raw key. Confirm, AlertDialog and the export all read it from here.
export const API_MESSAGE_DEFAULTS = Object.freeze({
  ERROR_REPORT_MAX_A_DAY_AS_PERIOD: 'Error report, max a day as period',
  ERROR_REPORT_VERY_LONG_PERIOD: 'Error report, very long period'
})

// The `defaultText` of a message: its entry in the table, else the message itself. Own keys only, so a message
// like «constructor» is not read off the prototype.
export const getApiMessageDefault = (message) => (
  typeof message === 'string' && Object.prototype.hasOwnProperty.call(API_MESSAGE_DEFAULTS, message)
    ? API_MESSAGE_DEFAULTS[message]
    : message
)
