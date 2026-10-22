export type EmailTheme = "dark" | "original"

const READER_BACKGROUND = "#141414"

const NAMED_COLORS: Record<string, [number, number, number]> = {
  black: [0, 0, 0],
  white: [255, 255, 255],
}

function parseColor(value: string): [number, number, number] | undefined {
  const color = value.trim().toLowerCase()
  if (NAMED_COLORS[color]) return NAMED_COLORS[color]
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})\b/.exec(color)?.[1]
  if (hex) {
    const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number]
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(color)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  return undefined
}

function luminance([r, g, b]: [number, number, number]) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

function declaredBackground(html: string) {
  const head = html.slice(0, 20_000)
  const body = /<body\b[^>]*>/i.exec(head)?.[0] ?? ""
  const candidates = [
    /bgcolor\s*=\s*["']?([^"'\s>]+)/i.exec(body)?.[1],
    /background(?:-color)?\s*:\s*([^;"']+)/i.exec(body)?.[1],
    /bgcolor\s*=\s*["']?([^"'\s>]+)/i.exec(head)?.[1],
    /background(?:-color)?\s*:\s*(#[0-9a-f]{3,6}|rgba?\([^)]*\)|black|white)/i.exec(head)?.[1],
  ]
  for (const candidate of candidates) {
    const color = candidate ? parseColor(candidate) : undefined
    if (color) return color
  }
  return undefined
}

export function isDarkEmail(html: string) {
  const background = declaredBackground(html)
  return background !== undefined && luminance(background) < 0.4
}

function hasNativeDarkMode(html: string) {
  return /prefers-color-scheme\s*:\s*dark/i.test(html)
}

const BASE_STYLE = `html{padding:20px 24px}
body{margin:0;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#262626;word-wrap:break-word}
img{max-width:100%;height:auto}
*{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.16) transparent}`

const INVERT = "invert(1) hue-rotate(180deg)"

const DARK_STYLE = `:root{color-scheme:dark}
html{background:${READER_BACKGROUND}}
body{background:#fff;color-scheme:light;min-height:calc(100vh - 40px);box-sizing:border-box;filter:${INVERT} contrast(.85)}
img,video,picture,svg,canvas,iframe,[background],[style*="url("]{filter:${INVERT}}
[background] img,[style*="url("] img{filter:none}`

const NATIVE_DARK_STYLE = `:root{color-scheme:dark}
html{background:${READER_BACKGROUND}}`

const ORIGINAL_STYLE = `:root{color-scheme:light}
html{background:#fff}`

function themeStyle(html: string, theme: EmailTheme) {
  if (theme === "original") return ORIGINAL_STYLE
  return isDarkEmail(html) || hasNativeDarkMode(html) ? NATIVE_DARK_STYLE : DARK_STYLE
}

export function emailDocument(html: string, theme: EmailTheme) {
  const style = themeStyle(html, theme)
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'">
<base target="_blank">
<style>${BASE_STYLE}
${style}</style>
</head><body>${html}</body></html>`
}
