import { getCookie } from "@tanstack/react-start/server"
import { safeEqual, sign } from "./crypto.server"

export const SESSION_COOKIE = "unimail_session"
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function createSessionToken() {
  const expires = String(Date.now() + SESSION_TTL_MS)
  return `${expires}.${sign(expires)}`
}

export function isValidSession(token: string | undefined) {
  if (!token) return false
  const [expires, signature] = token.split(".")
  if (!expires || !signature || !safeEqual(signature, sign(expires))) return false
  return Number(expires) > Date.now()
}

export function isAuthenticated() {
  return isValidSession(getCookie(SESSION_COOKIE))
}
