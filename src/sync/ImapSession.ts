import { Cause, Context, Effect, Layer, Queue, Redacted, Schema, Stream } from "effect"
import type { Scope } from "effect"
import type { ImapFlow, MailboxObject } from "imapflow"
import { createImap } from "../server/imap.server"
import type { Account } from "../server/imap.server"
import { MailCrypto } from "./MailCrypto"

export class ImapError extends Schema.TaggedError<ImapError>()("ImapError", {
  message: Schema.String,
  cause: Schema.Defect(),
}) {}

const toImapError = (cause: unknown) => {
  const error = cause as { responseText?: string; message?: string } | undefined
  return new ImapError({ message: error?.responseText ?? error?.message ?? "IMAP request failed", cause })
}

export class ImapSession extends Context.Service<
  ImapSession,
  {
    use<A>(f: (client: ImapFlow) => Promise<A>): Effect.Effect<A, ImapError>
    openMailbox(path: string): Effect.Effect<MailboxObject, ImapError, Scope.Scope>
    readonly changes: Stream.Stream<void, ImapError>
  }
>()("unimail/sync/ImapSession") {
  static readonly layer = (account: Account) =>
    Layer.effect(
      ImapSession,
      Effect.gen(function* () {
        const crypto = yield* MailCrypto
        const password = yield* crypto.decrypt(account.passwordEnc)

        const client = yield* Effect.acquireRelease(
          Effect.tryPromise({
            try: async () => {
              const connection = createImap(account, Redacted.value(password))
              connection.on("error", () => {})
              await connection.connect()
              return connection
            },
            catch: toImapError,
          }),
          (connection) => Effect.promise(() => connection.logout().catch(() => connection.close())),
        )

        const use = <A>(f: (client: ImapFlow) => Promise<A>) =>
          Effect.tryPromise({ try: () => f(client), catch: toImapError })

        const openMailbox = Effect.fn("ImapSession.openMailbox")(function* (path: string) {
          yield* Effect.acquireRelease(
            use((c) => c.getMailboxLock(path)),
            (lock) => Effect.sync(() => lock.release()),
          )
          return client.mailbox as MailboxObject
        })

        const changes = Stream.callback<void, ImapError>((queue) =>
          Effect.acquireRelease(
            Effect.sync(() => {
              const onChange = () => Queue.offerUnsafe(queue, undefined)
              const onClose = () =>
                Queue.failCauseUnsafe(queue, Cause.fail(toImapError(new Error("Connection closed"))))
              const events = ["exists", "expunge", "flags"] as const
              events.forEach((event) => client.on(event, onChange))
              client.on("close", onClose)
              return () => {
                events.forEach((event) => client.off(event, onChange))
                client.off("close", onClose)
              }
            }),
            (unsubscribe) => Effect.sync(unsubscribe),
          ),
        )

        return ImapSession.of({ use, openMailbox, changes })
      }),
    )
}
