import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import * as schema from "./schema"

export function connect(path: string) {
  mkdirSync(dirname(path), { recursive: true })
  const sqlite = new Database(path)
  sqlite.pragma("journal_mode = WAL")
  sqlite.pragma("busy_timeout = 5000")
  sqlite.pragma("foreign_keys = ON")
  return sqlite
}

export function createDb(sqlite: Database.Database) {
  const db = drizzle({ client: sqlite, schema, casing: "snake_case" })
  migrate(db, { migrationsFolder: resolve(process.cwd(), "drizzle") })
  return db
}

export function openDatabase(path: string) {
  return createDb(connect(path))
}

export type Db = ReturnType<typeof createDb>
