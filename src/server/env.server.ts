import { existsSync } from "node:fs"

if (existsSync(".env")) process.loadEnvFile(".env")

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var ${name}`)
  return value
}

export const env = {
  get databasePath() {
    return process.env.DATABASE_PATH ?? "data/unimail.db"
  },
  get secret() {
    return required("UNIMAIL_SECRET")
  },
  get password() {
    return required("UNIMAIL_PASSWORD")
  },
}
