import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

const encryptionKey = (secret: string) => createHash("sha256").update(`enc:${secret}`).digest()

export function encryptWith(secret: string, plain: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv)
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".")
}

export function decryptWith(secret: string, payload: string) {
  const [iv, tag, data] = payload.split(".").map((part) => Buffer.from(part, "base64"))
  if (!iv || !tag || !data) throw new Error("Malformed encrypted payload")
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8")
}
