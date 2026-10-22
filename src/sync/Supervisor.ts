import { Effect, FiberMap, Layer, Schedule } from "effect"
import { listAccountRows } from "../server/db/store.server"
import { runAccount } from "./AccountSync"
import { Database } from "./Database"

export const Supervisor = Layer.effectDiscard(
  Effect.gen(function* () {
    const database = yield* Database
    const sessions = yield* FiberMap.make<string>()

    const reconcile = Effect.gen(function* () {
      const accounts = yield* database.use(listAccountRows)
      const wanted = new Map(accounts.map((account) => [`${account.id}:${account.updatedAt.getTime()}`, account]))

      for (const key of Array.from(sessions, ([running]) => running)) {
        if (!wanted.has(key)) yield* FiberMap.remove(sessions, key)
      }
      for (const [key, account] of wanted) {
        yield* FiberMap.run(sessions, key, runAccount(account), { onlyIfMissing: true })
      }
    })

    yield* reconcile.pipe(
      Effect.tapError((error) => Effect.logError("Failed to load accounts", error)),
      Effect.ignore,
      Effect.repeat(Schedule.spaced("3 seconds")),
      Effect.forkScoped,
    )
    yield* Effect.logInfo("Unimail sync worker started")
  }),
)
