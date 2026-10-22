import { createHmac, timingSafeEqual } from "node:crypto"
import { decryptWith, encryptWith } from "./cipher.server"
import { env } from "./env.server"

export const encrypt = (plain: string) => encryptWith(env.secret, plain)

export const decrypt = (payload: string) => decryptWith(env.secret, payload)

export function sign(value: string) {
  return createHmac("sha256", `sig:${env.secret}`).update(value).digest("base64url")
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}
