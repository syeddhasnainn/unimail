import type Database from "better-sqlite3"
import { env } from "../env.server"
import { connect, createDb } from "./open.server"

const globalForDb = globalThis as unknown as { unimailSqlite?: Database.Database }

const sqlite = (globalForDb.unimailSqlite ??= connect(env.databasePath))

export const db = createDb(sqlite)
