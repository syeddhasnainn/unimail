const ADDRESS = /^[^\s@<>"(),;:]+@[^\s@<>"(),;:]+\.[^\s@<>"(),;:]{2,}$/

function addressOf(entry: string) {
  const bracketed = /<([^<>]*)>\s*$/.exec(entry)
  return (bracketed?.[1] ?? entry).trim()
}

function splitRecipients(input: string) {
  const entries: string[] = []
  let current = ""
  let inQuote = false
  let inAngle = false
  for (const char of input) {
    if (char === '"' && !inAngle) inQuote = !inQuote
    else if (char === "<" && !inQuote) inAngle = true
    else if (char === ">" && !inQuote) inAngle = false
    if ((char === "," || char === ";" || char === "\n") && !inQuote && !inAngle) {
      entries.push(current)
      current = ""
    } else {
      current += char
    }
  }
  entries.push(current)
  return entries.map((entry) => entry.trim()).filter(Boolean)
}

export function invalidRecipients(input: string | undefined) {
  if (!input) return []
  return splitRecipients(input).filter((entry) => !ADDRESS.test(addressOf(entry)))
}

export function recipientError(field: string, input: string | undefined) {
  const invalid = invalidRecipients(input)
  if (invalid.length === 0) return undefined
  const list = invalid.map((entry) => `"${entry}"`).join(", ")
  return invalid.length === 1
    ? `${list} in ${field} isn't a valid email address`
    : `${list} in ${field} aren't valid email addresses`
}
