import { Array as Arr, Effect, Order, Schedule, Schema, Stream } from "effect"
import type { FetchMessageObject } from "imapflow"
import type { mailboxes } from "../server/db/schema"
import {
  applyFlagChanges,
  bumpVersion,
  insertMessages,
  knownFlags,
  LOCAL_FLAG_GRACE_MS,
  messageIdForUid,
  replaceMailboxes,
  resetMailbox,
  saveBody,
  setAccountStatus,
} from "../server/db/store.server"
import type { FlagState } from "../server/db/store.server"
import { MAX_BODY_BYTES, metadataFrom, parseSource, roleFor } from "../server/imap.server"
import type { Account } from "../server/imap.server"
import { Database } from "./Database"
import type { DatabaseError } from "./Database"
import { ImapSession } from "./ImapSession"
import type { ImapError } from "./ImapSession"
import type { CryptoError } from "./MailCrypto"
import { SyncRequests } from "./SyncRequests"

type Mailbox = typeof mailboxes.$inferSelect

const INITIAL_WINDOW = { inbox: 500, other: 200 }
const BODY_BATCH = 20

class ParseError extends Schema.TaggedError<ParseError>()("ParseError", {
  uid: Schema.Number,
  cause: Schema.Defect(),
}) {}

const flagState = (flags: Set<string> | undefined): FlagState => ({
  seen: flags?.has("\\Seen") ?? false,
  flagged: flags?.has("\\Flagged") ?? false,
  answered: flags?.has("\\Answered") ?? false,
})

const syncMailboxList = Effect.fn("syncMailboxList")(function* (account: Account) {
  const imap = yield* ImapSession
  const database = yield* Database
  const list = yield* imap.use((client) => client.list())
  const boxes = Arr.dedupeWith(
    list.flatMap((box) => {
      const role = roleFor(box.path, box.specialUse)
      return role ? [{ path: box.path, role }] : []
    }),
    (a, b) => a.role === b.role,
  )
  return yield* database.use((db) => replaceMailboxes(db, account.id, boxes))
})

const storeBody = Effect.fn("storeBody")(function* (mailboxId: number, message: FetchMessageObject) {
  const database = yield* Database
  const source = message.source
  if (!source) return
  const body = yield* Effect.tryPromise({
    try: () => parseSource(source),
    catch: (cause) => new ParseError({ uid: message.uid, cause }),
  })
  yield* database.use((db) => {
    const id = messageIdForUid(db, mailboxId, message.uid)
    if (id) saveBody(db, id, body)
  })
})

const fetchBodies = Effect.fn("fetchBodies")(function* (mailboxId: number, uids: ReadonlyArray<number>) {
  const imap = yield* ImapSession
  for (const batch of Arr.chunksOf(uids, BODY_BATCH)) {
    const fetched = yield* imap.use((client) => client.fetchAll([...batch], { uid: true, source: true }, { uid: true }))
    yield* Effect.forEach(
      fetched,
      (message) =>
        storeBody(mailboxId, message).pipe(
          Effect.catchTag("ParseError", (error) =>
            Effect.logWarning(`Could not parse message ${error.uid}`, error.cause),
          ),
        ),
      { discard: true },
    )
  }
})

const reconcileFlags = Effect.fn("reconcileFlags")(function* (mailboxId: number, exists: number) {
  const imap = yield* ImapSession
  const database = yield* Database
  const known = yield* database.use((db) => knownFlags(db, mailboxId))
  if (known.length === 0) return false

  const minUid = Math.min(...known.map((m) => m.uid))
  const remote =
    exists > 0
      ? yield* imap.use((client) => client.fetchAll(`${minUid}:*`, { uid: true, flags: true }, { uid: true }))
      : []
  const remoteFlags = new Map(remote.map((m) => [m.uid, flagState(m.flags)]))

  const gone = known.filter((row) => !remoteFlags.has(row.uid)).map((row) => row.id)
  const graceStart = Date.now() - LOCAL_FLAG_GRACE_MS
  const updates = known.flatMap((row) => {
    const next = remoteFlags.get(row.uid)
    if (!next) return []
    if (row.flagsChangedAt && row.flagsChangedAt.getTime() > graceStart) return []
    const differs = next.seen !== row.seen || next.flagged !== row.flagged || next.answered !== row.answered
    return differs ? [{ id: row.id, ...next }] : []
  })

  if (gone.length === 0 && updates.length === 0) return false
  yield* database.use((db) => applyFlagChanges(db, gone, updates))
  return true
})

const syncMailbox = Effect.fn("syncMailbox")(function* (account: Account, mailbox: Mailbox) {
  const imap = yield* ImapSession
  const database = yield* Database
  const box = yield* imap.openMailbox(mailbox.path)
  const uidValidity = box.uidValidity.toString()
  let lastUid = mailbox.lastUid
  let changed = false

  if (mailbox.uidValidity !== uidValidity) {
    yield* database.use((db) => resetMailbox(db, mailbox.id, uidValidity))
    lastUid = 0
    changed = true
  }

  if (box.exists > 0) {
    const window = mailbox.role === "inbox" ? INITIAL_WINDOW.inbox : INITIAL_WINDOW.other
    const range = lastUid === 0 ? `${Math.max(1, box.exists - window + 1)}:*` : `${lastUid + 1}:*`
    const fetched = yield* imap.use((client) =>
      client.fetchAll(
        range,
        { uid: true, flags: true, envelope: true, size: true, internalDate: true },
        { uid: lastUid !== 0 },
      ),
    )
    const fresh = fetched.filter((m) => m.uid > lastUid)
    if (fresh.length > 0) {
      yield* database.use((db) => insertMessages(db, account.id, mailbox.id, fresh.map(metadataFrom)))
      yield* fetchBodies(
        mailbox.id,
        fresh.filter((m) => (m.size ?? 0) <= MAX_BODY_BYTES).map((m) => m.uid),
      )
      changed = true
    }
  }

  const flagsChanged = yield* reconcileFlags(mailbox.id, box.exists)
  return changed || flagsChanged
}, Effect.scoped)

const syncAccount = Effect.fn("syncAccount")(function* (account: Account) {
  const database = yield* Database
  const boxes = yield* syncMailboxList(account)
  const ordered = Arr.sortWith(boxes, (box) => (box.role === "inbox" ? 0 : 1), Order.Number)
  const results = yield* Effect.forEach(ordered, (box) => syncMailbox(account, box))
  const changed = results.some(Boolean)
  yield* database.use((db) => {
    setAccountStatus(db, account.id, null)
    if (changed) bumpVersion(db)
  })
  if (changed) yield* Effect.logInfo("Synced changes")
})

const session = Effect.fn("session")(function* (account: Account) {
  const imap = yield* ImapSession
  const requests = yield* SyncRequests
  yield* Effect.logInfo("Connected")

  yield* Effect.forever(
    Effect.gen(function* () {
      yield* syncAccount(account)
      yield* imap.use((client) => client.mailboxOpen("INBOX"))
      yield* Stream.merge(imap.changes, requests.requests).pipe(Stream.runHead, Effect.timeoutOption("5 minutes"))
      yield* Effect.sleep("750 millis")
    }),
  )
})

const describeFailure = (error: ImapError | DatabaseError | CryptoError) => {
  switch (error._tag) {
    case "ImapError":
      return error.message
    case "CryptoError":
      return "Could not decrypt the saved password"
    case "DatabaseError":
      return "Local database error"
  }
}

const retryPolicy = Schedule.min([Schedule.exponential("2 seconds"), Schedule.spaced("5 minutes")]).pipe(
  Schedule.jittered,
)

export const runAccount = Effect.fn("runAccount")(function* (account: Account) {
  const database = yield* Database
  yield* session(account).pipe(
    Effect.provide(ImapSession.layer(account)),
    Effect.tapError((error) =>
      Effect.logWarning("Sync failed", error).pipe(
        Effect.andThen(database.use((db) => setAccountStatus(db, account.id, describeFailure(error)))),
        Effect.ignore,
      ),
    ),
    Effect.retry(retryPolicy),
    Effect.annotateLogs({ account: account.email }),
  )
})
