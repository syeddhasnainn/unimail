export const ACCOUNT_DOTS = {
  blue: "bg-blue-400",
  amber: "bg-amber-400",
  emerald: "bg-emerald-400",
  violet: "bg-violet-400",
  rose: "bg-rose-400",
  cyan: "bg-cyan-400",
  orange: "bg-orange-400",
  lime: "bg-lime-400",
  pink: "bg-pink-400",
  slate: "bg-slate-400",
} as const

export type AccountColor = keyof typeof ACCOUNT_DOTS

export const ACCOUNT_TEXT: Record<AccountColor, string> = {
  blue: "text-blue-600 dark:text-blue-400",
  amber: "text-amber-700 dark:text-amber-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  violet: "text-violet-600 dark:text-violet-400",
  rose: "text-rose-600 dark:text-rose-400",
  cyan: "text-cyan-700 dark:text-cyan-400",
  orange: "text-orange-600 dark:text-orange-400",
  lime: "text-lime-700 dark:text-lime-400",
  pink: "text-pink-600 dark:text-pink-400",
  slate: "text-slate-500 dark:text-slate-400",
}

export const COLOR_NAMES = Object.keys(ACCOUNT_DOTS) as AccountColor[]

const isAccountColor = (color: string): color is AccountColor => color in ACCOUNT_DOTS

export function dotClass(color: string) {
  return ACCOUNT_DOTS[isAccountColor(color) ? color : "slate"]
}

export function textClass(color: string) {
  return ACCOUNT_TEXT[isAccountColor(color) ? color : "slate"]
}
