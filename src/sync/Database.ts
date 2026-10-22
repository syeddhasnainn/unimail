import { Config, Context, Effect, Layer, Schema } from "effect"
import { openDatabase } from "../server/db/open.server"
import type { Db } from "../server/db/open.server"

export class DatabaseError extends Schema.TaggedError<DatabaseError>()("DatabaseError", {
  cause: Schema.Defect(),
}) {}

export class Database extends Context.Service<
  Database,
  {
    use<A>(f: (db: Db) => A): Effect.Effect<A, DatabaseError>
  }
>()("unimail/sync/Database") {
  static readonly layer = Layer.effect(
    Database,
    Effect.gen(function* () {
      const path = yield* Config.String("DATABASE_PATH").pipe(Config.withDefault("data/unimail.db"))
      const db = yield* Effect.acquireRelease(
        Effect.try({ try: () => openDatabase(path), catch: (cause) => new DatabaseError({ cause }) }),
        (opened) => Effect.sync(() => opened.$client.close()),
      )
      return Database.of({
        use: (f) => Effect.try({ try: () => f(db), catch: (cause) => new DatabaseError({ cause }) }),
      })
    }),
  )
}
