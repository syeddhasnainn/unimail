const BLOCK_END = /<\/(p|div|li|tr|h[1-6]|blockquote)>/gi
const LINE_BREAK = /<br\s*\/?>/gi

export function htmlToText(html: string) {
  const marked = html.replace(LINE_BREAK, "\n").replace(BLOCK_END, "$&\n")
  const text = new DOMParser().parseFromString(marked, "text/html").body.textContent
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
