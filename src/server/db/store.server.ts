import { and, desc, eq, inArray, isNotNull, isNull, lt, notInArray, sql } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import type { Category } from "../../lib/categories"
import type { Db } from "./open.server"
import { accounts, bodies, classifications, mailboxes, messages } from "./schema"
import type { AttachmentMeta, CategorySource, MailboxRole } from "./schema"

export type MessageMetadata = Omit<typeof messages.$inferInsert, "id" | "accountId" | "mailboxId">
export type FlagState = { seen: boolean; flagged: boolean; answered: boolean }
export type ParsedBody = {
  html: string | null
  text: string | null
  snippet: string
  references: string | null
  attachments: AttachmentMeta[]
}

export function bumpVersion(db: Db) {
  db.run(sql`insert into meta (key, value) values ('version', '1')
    on conflict(key) do update set value = cast(value as integer) + 1`)
}

export function getVersion(db: Db) {
  return db.get<{ value: string } | undefined>(sql`select value from meta where key = 'version'`)?.value ?? "0"
}

export function getSyncRequest(db: Db) {
  return db.get<{ value: string } | undefined>(sql`select value from meta where key = 'sync_request'`)?.value ?? ""
}

export function setSyncRequest(db: Db) {
  db.run(sql`insert into meta (key, value) values ('sync_request', ${String(Date.now())})
    on conflict(key) do update set value = excluded.value`)
}

export function getProfileName(db: Db) {
  return db.get<{ value: string } | undefined>(sql`select value from meta where key = 'profile_name'`)?.value ?? ""
}

export function setProfileName(db: Db, name: string) {
  db.run(sql`insert into meta (key, value) values ('profile_name', ${name})
    on conflict(key) do update set value = excluded.value`)
}

export function listAccountRows(db: Db) {
  return db.select().from(accounts).all()
}

export function setAccountStatus(db: Db, accountId: number, error: string | null) {
  db.update(accounts)
    .set(error ? { syncError: error } : { syncError: null, lastSyncedAt: new Date() })
    .where(eq(accounts.id, accountId))
    .run()
  bumpVersion(db)
}

export function replaceMailboxes(db: Db, accountId: number, boxes: { path: string; role: MailboxRole }[]) {
  return db.transaction((tx) => {
    for (const box of boxes) {
      tx.insert(mailboxes)
        .values({ accountId, path: box.path, role: box.role })
        .onConflictDoUpdate({ target: [mailboxes.accountId, mailboxes.path], set: { role: box.role } })
        .run()
    }
    const paths = boxes.map((b) => b.path)
    tx.delete(mailboxes)
      .where(and(eq(mailboxes.accountId, accountId), paths.length ? notInArray(mailboxes.path, paths) : undefined))
      .run()
    return tx.select().from(mailboxes).where(eq(mailboxes.accountId, accountId)).all()
  })
}

export function resetMailbox(db: Db, mailboxId: number, uidValidity: string) {
  db.transaction((tx) => {
    tx.delete(messages).where(eq(messages.mailboxId, mailboxId)).run()
    tx.update(mailboxes).set({ uidValidity, lastUid: 0 }).where(eq(mailboxes.id, mailboxId)).run()
  })
}

export function insertMessages(db: Db, accountId: number, mailboxId: number, rows: MessageMetadata[]) {
  if (!rows.length) return
  db.transaction((tx) => {
    for (const row of rows) {
      tx.insert(messages)
        .values({ ...row, accountId, mailboxId })
        .onConflictDoNothing()
        .run()
    }
    const lastUid = Math.max(...rows.map((r) => r.uid))
    tx.update(mailboxes)
      .set({ lastUid: sql`max(${mailboxes.lastUid}, ${lastUid})` })
      .where(eq(mailboxes.id, mailboxId))
      .run()
  })
}

export const LOCAL_FLAG_GRACE_MS = 30_000

export function knownFlags(db: Db, mailboxId: number) {
  return db
    .select({
      id: messages.id,
      uid: messages.uid,
      seen: messages.seen,
      flagged: messages.flagged,
      answered: messages.answered,
      flagsChangedAt: messages.flagsChangedAt,
    })
    .from(messages)
    .where(eq(messages.mailboxId, mailboxId))
    .all()
}

export function applyFlagChanges(db: Db, gone: number[], updates: ({ id: number } & FlagState)[]) {
  db.transaction((tx) => {
    for (let i = 0; i < gone.length; i += 500) {
      tx.delete(messages)
        .where(inArray(messages.id, gone.slice(i, i + 500)))
        .run()
    }
    for (const { id, ...flags } of updates) {
      tx.update(messages).set(flags).where(eq(messages.id, id)).run()
    }
  })
}

export function messageIdForUid(db: Db, mailboxId: number, uid: number) {
  return db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.mailboxId, mailboxId), eq(messages.uid, uid)))
    .get()?.id
}

export function saveBody(db: Db, messageId: number, body: ParsedBody) {
  db.transaction((tx) => {
    tx.update(messages)
      .set({ snippet: body.snippet, hasAttachments: body.attachments.length > 0, references: body.references })
      .where(eq(messages.id, messageId))
      .run()
    tx.insert(bodies)
      .values({ messageId, html: body.html, text: body.text, attachments: body.attachments })
      .onConflictDoNothing()
      .run()
  })
}

export const MAX_CLASSIFY_ATTEMPTS = 3

export function pendingClassification(db: Db, limit: number) {
  return db
    .select({
      id: messages.id,
      accountEmail: accounts.email,
      fromName: messages.fromName,
      fromAddress: messages.fromAddress,
      to: messages.to,
      subject: messages.subject,
      date: messages.date,
      snippet: messages.snippet,
      text: bodies.text,
      sentToSender: sql<number>`(
        select count(*) from messages as sent
        join mailboxes as sent_box on sent_box.id = sent.mailbox_id
        where sent_box.role = 'sent'
          and sent.account_id = ${messages.accountId}
          and ${messages.fromAddress} is not null
          and instr(lower(sent."to"), lower(${messages.fromAddress})) > 0
      )`,
    })
    .from(messages)
    .innerJoin(mailboxes, eq(messages.mailboxId, mailboxes.id))
    .innerJoin(accounts, eq(messages.accountId, accounts.id))
    .leftJoin(bodies, eq(bodies.messageId, messages.id))
    .where(
      and(eq(mailboxes.role, "inbox"), isNull(messages.category), lt(messages.classifyAttempts, MAX_CLASSIFY_ATTEMPTS)),
    )
    .orderBy(desc(messages.date))
    .limit(limit)
    .all()
}

export function learnedCategory(db: Db, fromAddress: string | null) {
  if (!fromAddress) return undefined
  return (
    db
      .select({ category: messages.category })
      .from(messages)
      .where(
        and(eq(messages.fromAddress, fromAddress), eq(messages.categorySource, "user"), isNotNull(messages.category)),
      )
      .orderBy(desc(messages.date))
      .get()?.category ?? undefined
  )
}

export function recentCorrections(db: Db, limit: number) {
  return db
    .select({ fromAddress: messages.fromAddress, subject: messages.subject, category: messages.category })
    .from(messages)
    .where(and(eq(messages.categorySource, "user"), isNotNull(messages.category)))
    .orderBy(desc(messages.date))
    .limit(limit)
    .all()
}

export type ClassificationResult = { id: number; category: Category; reason: string; source: CategorySource }

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]

function rememberClassifications(tx: Tx, where: SQL) {
  tx.run(sql`
    insert into ${classifications} (account_id, message_id, category, reason, source)
    select account_id, message_id, category, category_reason, coalesce(category_source, 'ai')
    from ${messages}
    where message_id is not null and category is not null and ${where}
    on conflict (account_id, message_id) do update set
      category = excluded.category, reason = excluded.reason, source = excluded.source
    where ${classifications.source} != 'user' or excluded.source = 'user'
  `)
}

function restoreSaved(tx: Tx | Db) {
  return tx.run(sql`
    update ${messages} set
      category = c.category, category_reason = c.reason, category_source = c.source
    from ${classifications} as c
    where c.account_id = ${messages.accountId}
      and c.message_id = ${messages.messageId}
      and ${messages.category} is null
  `).changes
}

export function restoreClassifications(db: Db) {
  return restoreSaved(db)
}

export function saveClassifications(db: Db, results: ClassificationResult[], failedIds: number[]) {
  db.transaction((tx) => {
    restoreSaved(tx)
    for (const result of results) {
      tx.update(messages)
        .set({ category: result.category, categoryReason: result.reason, categorySource: result.source })
        .where(and(eq(messages.id, result.id), isNull(messages.category)))
        .run()
    }
    if (results.length) {
      rememberClassifications(
        tx,
        inArray(
          messages.id,
          results.map((r) => r.id),
        ),
      )
    }
    if (failedIds.length) {
      tx.update(messages)
        .set({ classifyAttempts: sql`${messages.classifyAttempts} + 1` })
        .where(inArray(messages.id, failedIds))
        .run()
    }
  })
}

export function setUserCategory(db: Db, messageId: number, category: Category) {
  db.transaction((tx) => {
    const message = tx
      .select({ fromAddress: messages.fromAddress })
      .from(messages)
      .where(eq(messages.id, messageId))
      .get()
    tx.update(messages)
      .set({ category, categoryReason: "Set by you", categorySource: "user" })
      .where(eq(messages.id, messageId))
      .run()
    if (message?.fromAddress) {
      tx.update(messages)
        .set({ category, categoryReason: "Learned from your correction", categorySource: "sender" })
        .where(
          and(
            eq(messages.fromAddress, message.fromAddress),
            sql`${messages.id} != ${messageId}`,
            sql`coalesce(${messages.categorySource}, 'ai') != 'user'`,
          ),
        )
        .run()
    }
    rememberClassifications(
      tx,
      message?.fromAddress ? eq(messages.fromAddress, message.fromAddress) : eq(messages.id, messageId),
    )
  })
  bumpVersion(db)
}
