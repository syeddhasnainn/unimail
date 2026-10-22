import { Context, Effect, Layer, PubSub, Schedule, Stream } from "effect"
import { getSyncRequest } from "../server/db/store.server"
import { Database } from "./Database"

export class SyncRequests extends Context.Service<
  SyncRequests,
  {
    readonly requests: Stream.Stream<void>
  }
>()("unimail/sync/SyncRequests") {
  static readonly layer = Layer.effect(
    SyncRequests,
    Effect.gen(function* () {
      const database = yield* Database
      const pubsub = yield* PubSub.unbounded<void>()
      yield* Effect.addFinalizer(() => PubSub.shutdown(pubsub))

      yield* Stream.tick("2 seconds").pipe(
        Stream.mapEffect(() => database.use(getSyncRequest)),
        Stream.changes,
        Stream.drop(1),
        Stream.runForEach(() => PubSub.publish(pubsub, undefined)),
        Effect.tapError((error) => Effect.logWarning("Polling sync requests failed", error)),
        Effect.retry(Schedule.spaced("5 seconds")),
        Effect.forkScoped,
      )

      return SyncRequests.of({ requests: Stream.fromPubSub(pubsub) })
    }),
  )
}
