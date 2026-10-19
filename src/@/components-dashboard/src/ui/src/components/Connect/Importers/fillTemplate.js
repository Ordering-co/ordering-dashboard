/** Replaces `{{key}}` placeholders in a translated string. */
export const fillTemplate = (template, values) => Object.entries(values).reduce(
  (text, [key, value]) => text.split(`{{${key}}}`).join(String(value)),
  template
)
