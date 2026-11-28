// UI names in the guide come from the app's messages, so the guide uses the
// app's own words (spec: "UI names in the guide come from the messages").

export type Messages = Record<string, unknown>

const VARIABLE = /\{(\w+)\}/

/**
 * The text of the message `key`. Throws for an unknown key, and for a message
 * with a variable or plural forms: a UI name in the guide is one fixed text.
 */
export function uiText(messages: Messages, key: string): string {
  if (!(key in messages) || key === '$schema') {
    throw new Error(
      `The guide names the message "${key}", which does not exist`,
    )
  }
  const message = messages[key]
  if (typeof message !== 'string') {
    throw new Error(
      `The message "${key}" has plural or variant forms; a UI name in the guide is one fixed text`,
    )
  }
  const variable = VARIABLE.exec(message)
  if (variable) {
    throw new Error(
      `The message "${key}" has the variable {${variable[1]}}; a UI name in the guide is one fixed text`,
    )
  }
  return message
}
